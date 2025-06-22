import { DataSource, Repository, EntityManager } from 'typeorm';
import { redisService } from './redis-service';
import { Trade } from '../types';

/**
 * Entity for wallet balances
 */
export class Balance {
  id: string = '';
  userId: string = '';
  asset: string = '';
  available: number = 0;
  locked: number = 0;
  total: number = 0;
  updatedAt: Date = new Date();
}

/**
 * Entity for wallet transactions
 */
export class Transaction {
  id: string = '';
  userId: string = '';
  type: 'deposit' | 'withdrawal' | 'trade' | 'fee' | 'adjustment' = 'deposit';
  asset: string = '';
  amount: number = 0;
  fee: number = 0;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' = 'pending';
  txId?: string; // External transaction ID for blockchain transactions
  orderId?: string; // Related order ID for trades
  tradeId?: string; // Related trade ID for trades
  timestamp: Date = new Date();
  metadata?: any; // Additional data specific to transaction type
}

/**
 * Service for managing user wallets
 * Handles balances, deposits, withdrawals, and other financial transactions
 */
export class WalletService {
  private static instance: WalletService;
  private dataSource!: DataSource; // Using the definite assignment assertion
  private balanceRepository!: Repository<Balance>; // Using the definite assignment assertion
  private transactionRepository!: Repository<Transaction>; // Using the definite assignment assertion
  
  private constructor() {}

  public static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  /**
   * Initialize the service with the database connection
   * @param dataSource TypeORM data source
   */
  public async initialize(dataSource: DataSource): Promise<void> {
    this.dataSource = dataSource;
    this.balanceRepository = this.dataSource.getRepository(Balance);
    this.transactionRepository = this.dataSource.getRepository(Transaction);
    
    // Subscribe to trade channel to update balances for trading
    await redisService.subscribe('trade', (trade: Trade) => {
      this.processTrade(trade);
    });
    
    console.log('WalletService initialized');
  }

  /**
   * Get user's balance for a specific asset
   * @param userId User ID
   * @param asset Asset symbol (e.g., BTC, USDC)
   */
  public async getBalance(userId: string, asset: string): Promise<Balance> {
    let balance = await this.balanceRepository.findOne({
      where: { userId, asset }
    });
    
    if (!balance) {
      // Create new balance record if it doesn't exist
      balance = new Balance();
      balance.userId = userId;
      balance.asset = asset;
      balance.available = 0;
      balance.locked = 0;
      balance.total = 0;
      balance.updatedAt = new Date();
      
      await this.balanceRepository.save(balance);
    }
    
    return balance;
  }

  /**
   * Get all balances for a user
   * @param userId User ID
   */
  public async getAllBalances(userId: string): Promise<Balance[]> {
    return await this.balanceRepository.find({
      where: { userId }
    });
  }

  /**
   * Process a deposit transaction
   * @param userId User ID
   * @param asset Asset symbol
   * @param amount Amount to deposit
   * @param txId External transaction ID
   */
  public async processDeposit(
    userId: string,
    asset: string,
    amount: number,
    txId?: string
  ): Promise<Transaction> {
    return await this.dataSource.transaction(async (manager) => {
      // Create transaction record
      const transaction = new Transaction();
      transaction.userId = userId;
      transaction.type = 'deposit';
      transaction.asset = asset;
      transaction.amount = amount;
      transaction.fee = 0;
      transaction.status = 'completed';
      transaction.txId = txId;
      transaction.timestamp = new Date();
      
      await manager.save(Transaction, transaction);
      
      // Update user balance
      await this.updateBalance(manager, userId, asset, amount, 0);
      
      // Publish balance update event
      const balance = await this.getBalance(userId, asset);
      redisService.publish(`balance@${userId}`, balance);
      
      return transaction;
    });
  }

  /**
   * Process a withdrawal transaction
   * @param userId User ID
   * @param asset Asset symbol
   * @param amount Amount to withdraw
   * @param fee Fee for the withdrawal
   * @param destination Destination address/account
   */
  public async requestWithdrawal(
    userId: string,
    asset: string,
    amount: number,
    fee: number,
    destination: string
  ): Promise<Transaction> {
    return await this.dataSource.transaction(async (manager) => {
      // Check if user has sufficient balance
      const balance = await this.getBalance(userId, asset);
      const totalAmount = amount + fee;
      
      if (balance.available < totalAmount) {
        throw new Error('Insufficient balance');
      }
      
      // Create pending withdrawal transaction
      const transaction = new Transaction();
      transaction.userId = userId;
      transaction.type = 'withdrawal';
      transaction.asset = asset;
      transaction.amount = amount;
      transaction.fee = fee;
      transaction.status = 'pending';
      transaction.timestamp = new Date();
      transaction.metadata = { destination };
      
      await manager.save(Transaction, transaction);
      
      // Lock the funds
      await this.lockFunds(manager, userId, asset, totalAmount);
      
      // Publish balance update event
      const updatedBalance = await this.getBalance(userId, asset);
      redisService.publish(`balance@${userId}`, updatedBalance);
      
      // This would typically trigger an external process to handle the withdrawal
      // For now, we'll just return the transaction
      return transaction;
    });
  }

  /**
   * Complete a withdrawal after external processing
   * @param transactionId Transaction ID
   * @param txId External transaction ID
   * @param status New status
   */
  public async completeWithdrawal(
    transactionId: string,
    txId: string,
    status: 'completed' | 'failed' | 'cancelled'
  ): Promise<Transaction> {
    return await this.dataSource.transaction(async (manager) => {
      // Find the withdrawal transaction
      const transaction = await manager.findOne(Transaction, {
        where: { id: transactionId, type: 'withdrawal', status: 'pending' }
      });
      
      if (!transaction) {
        throw new Error('Withdrawal transaction not found or not in pending status');
      }
      
      const totalAmount = transaction.amount + transaction.fee;
      const userId = transaction.userId;
      const asset = transaction.asset;
      
      // Update transaction status
      transaction.status = status;
      transaction.txId = txId;
      transaction.timestamp = new Date();
      
      await manager.save(Transaction, transaction);
      
      // Update balance based on status
      if (status === 'completed') {
        // If successful, deduct the locked funds from the total
        await this.unlockAndDeductFunds(manager, userId, asset, totalAmount);
      } else {
        // If failed or cancelled, unlock the funds
        await this.unlockFunds(manager, userId, asset, totalAmount);
      }
      
      // Publish balance update event
      const balance = await this.getBalance(userId, asset);
      redisService.publish(`balance@${userId}`, balance);
      
      return transaction;
    });
  }

  /**
   * Lock funds for an order
   * @param userId User ID
   * @param asset Asset symbol
   * @param amount Amount to lock
   * @param orderId Order ID
   */
  public async lockOrderFunds(
    userId: string,
    asset: string,
    amount: number,
    orderId: string
  ): Promise<boolean> {
    return await this.dataSource.transaction(async (manager) => {
      // Check if user has sufficient balance
      const balance = await this.getBalance(userId, asset);
      
      if (balance.available < amount) {
        return false;
      }
      
      // Lock the funds
      await this.lockFunds(manager, userId, asset, amount);
      
      // Create transaction record
      const transaction = new Transaction();
      transaction.userId = userId;
      transaction.type = 'trade';
      transaction.asset = asset;
      transaction.amount = amount;
      transaction.fee = 0;
      transaction.status = 'pending';
      transaction.orderId = orderId;
      transaction.timestamp = new Date();
      
      await manager.save(Transaction, transaction);
      
      // Publish balance update event
      const updatedBalance = await this.getBalance(userId, asset);
      redisService.publish(`balance@${userId}`, updatedBalance);
      
      return true;
    });
  }

  /**
   * Unlock funds when an order is cancelled
   * @param userId User ID
   * @param asset Asset symbol
   * @param amount Amount to unlock
   * @param orderId Order ID
   */
  public async unlockOrderFunds(
    userId: string,
    asset: string,
    amount: number,
    orderId: string
  ): Promise<boolean> {
    return await this.dataSource.transaction(async (manager) => {
      // Unlock the funds
      await this.unlockFunds(manager, userId, asset, amount);
      
      // Update transaction status
      await manager.update(
        Transaction,
        { userId, orderId, status: 'pending' },
        { status: 'cancelled', timestamp: new Date() }
      );
      
      // Publish balance update event
      const balance = await this.getBalance(userId, asset);
      redisService.publish(`balance@${userId}`, balance);
      
      return true;
    });
  }

  /**
   * Process a trade and update balances
   * @param trade The trade to process
   */
  private async processTrade(trade: Trade): Promise<void> {
    // Extract trade details
    const { makerOrderId, takerOrderId, price, quantity, side } = trade;
    
    // We need to fetch the user IDs for the maker and taker orders
    // This would typically be done by looking up the orders in the database
    // For this example, we'll assume we have this information
    const makerOrder = await this.getOrderInfo(makerOrderId);
    const takerOrder = await this.getOrderInfo(takerOrderId);
    
    if (!makerOrder || !takerOrder) {
      console.error('Failed to process trade - orders not found');
      return;
    }
    
    const makerId = makerOrder.userId;
    const takerId = takerOrder.userId;
    
    // Calculate the amounts
    const quoteAmount = price * quantity;
    
    await this.dataSource.transaction(async (manager) => {
      // Process based on side
      if (side === 'buy') {
        // Buyer (taker) gets the base asset, seller (maker) gets the quote asset
        await this.settleTrade(manager, takerId, makerOrder.baseAsset, quantity, trade.tradeId.toString(), takerOrderId);
        await this.settleTrade(manager, makerId, makerOrder.quoteAsset, quoteAmount, trade.tradeId.toString(), makerOrderId);
      } else {
        // Seller (taker) gets the quote asset, buyer (maker) gets the base asset
        await this.settleTrade(manager, takerId, makerOrder.quoteAsset, quoteAmount, trade.tradeId.toString(), takerOrderId);
        await this.settleTrade(manager, makerId, makerOrder.baseAsset, quantity, trade.tradeId.toString(), makerOrderId);
      }
    });
  }

  /**
   * Settle a trade for a user
   * @param manager Entity manager
   * @param userId User ID
   * @param asset Asset symbol
   * @param amount Amount to settle
   * @param tradeId Trade ID
   * @param orderId Order ID
   */
  private async settleTrade(
    manager: EntityManager,
    userId: string, 
    asset: string, 
    amount: number,
    tradeId: string,
    orderId: string
  ): Promise<void> {
    // Create transaction record
    const transaction = new Transaction();
    transaction.userId = userId;
    transaction.type = 'trade';
    transaction.asset = asset;
    transaction.amount = amount;
    transaction.fee = 0; // Fees would be calculated here in a real system
    transaction.status = 'completed';
    transaction.orderId = orderId;
    transaction.tradeId = tradeId;
    transaction.timestamp = new Date();
    
    await manager.save(Transaction, transaction);
    
    // Update balance - add the received amount to available balance
    await this.updateBalance(manager, userId, asset, amount, 0);
    
    // Publish balance update event
    const balance = await this.getBalance(userId, asset);
    redisService.publish(`balance@${userId}`, balance);
  }

  /**
   * Update a user's balance
   * @param manager Entity manager
   * @param userId User ID
   * @param asset Asset symbol
   * @param availableDelta Change in available balance
   * @param lockedDelta Change in locked balance
   */
  private async updateBalance(
    manager: EntityManager,
    userId: string,
    asset: string,
    availableDelta: number,
    lockedDelta: number
  ): Promise<void> {
    let balance = await manager.findOne(Balance, {
      where: { userId, asset }
    });
    
    if (!balance) {
      // Create new balance record if it doesn't exist
      balance = new Balance();
      balance.userId = userId;
      balance.asset = asset;
      balance.available = 0;
      balance.locked = 0;
      balance.total = 0;
    }
    
    // Update balances
    balance.available += availableDelta;
    balance.locked += lockedDelta;
    balance.total = balance.available + balance.locked;
    balance.updatedAt = new Date();
    
    await manager.save(Balance, balance);
  }

  /**
   * Lock funds (move from available to locked)
   * @param manager Entity manager
   * @param userId User ID
   * @param asset Asset symbol
   * @param amount Amount to lock
   */
  private async lockFunds(
    manager: EntityManager,
    userId: string,
    asset: string,
    amount: number
  ): Promise<void> {
    await this.updateBalance(manager, userId, asset, -amount, amount);
  }

  /**
   * Unlock funds (move from locked to available)
   * @param manager Entity manager
   * @param userId User ID
   * @param asset Asset symbol
   * @param amount Amount to unlock
   */
  private async unlockFunds(
    manager: EntityManager,
    userId: string,
    asset: string,
    amount: number
  ): Promise<void> {
    await this.updateBalance(manager, userId, asset, amount, -amount);
  }

  /**
   * Unlock and deduct funds (remove from locked balance)
   * @param manager Entity manager
   * @param userId User ID
   * @param asset Asset symbol
   * @param amount Amount to deduct
   */
  private async unlockAndDeductFunds(
    manager: EntityManager,
    userId: string,
    asset: string,
    amount: number
  ): Promise<void> {
    await this.updateBalance(manager, userId, asset, 0, -amount);
  }

  /**
   * Get order information (mock implementation)
   * In a real system, this would query the order repository
   * @param orderId Order ID
   */
  private async getOrderInfo(orderId: string): Promise<any> {
    // Mock implementation - in a real system, this would query the database
    // For now, return mock data
    return {
      userId: 'user-123',
      baseAsset: 'BTC',
      quoteAsset: 'USDC',
      side: 'buy',
      type: 'limit',
      price: 50000,
      quantity: 1
    };
  }
}

export const walletService = WalletService.getInstance();
