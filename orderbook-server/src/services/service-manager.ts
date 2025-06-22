import { redisService } from './redis-service';
import { dbProcessorService } from './db-processor';
import { marketMakerService } from './market-maker';
import { candleService } from './candle-service';
import { userService } from './user-service';
import { walletService } from './wallet-service';
import { getWebSocketHandler } from '../websocket';
import { getDataSource } from '../db/database';
import { DataSource } from 'typeorm';
import { Trade, Order, OrderSide, OrderType, OrderStatus, MarketData, ExtendedOrder } from '../types';
import { MatchingEngine, ProcessOrderResult } from '../matching-engine';

// Import types from matching-engine but rename to avoid conflicts
import { MarketConfig as MatchingEngineMarketConfig } from '../matching-engine';

// MarketConfig interface for market maker - must match exactly what's in market-maker.ts
interface MarketMakerConfig {
  symbol: string;
  basePrice: number;
  spreadPercentage: number;
  levels: number;
  levelSizeMultiplier: number;
  baseQuantity: number;
  tickSize: number;
  stepSize: number;
  refreshInterval: number;
  maxPriceDeviation: number;
  activeOrderIds: string[];
}

/**
 * Service Manager
 * Responsible for initializing and managing all services
 */
class ServiceManager {
  private static instance: ServiceManager;
  private initialized = false;
  private matchingEngine?: MatchingEngine;
  private markets: string[] = ['BTC_USDC', 'ETH_USDC', 'ETH_BTC'];
  private dataSource?: DataSource;

  private constructor() {}

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * Initialize all services
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('Services already initialized');
      return;
    }

    try {
      console.log('Initializing services...');
      
      // Initialize database connection first
      console.log('Initializing database connection...');
      this.dataSource = await getDataSource();
      
      // Initialize database processor service
      console.log('Initializing database processor service...');
      await dbProcessorService.initialize();
      
      // Initialize WebSocket service
      console.log('Initializing WebSocket service...');
      const wsHandler = getWebSocketHandler();
      if (!wsHandler) {
        throw new Error('Failed to initialize WebSocket handler');
      }
      
      // Initialize candle service
      console.log('Initializing candle service...');
      await candleService.initialize(this.dataSource);
      
      // Initialize user service
      console.log('Initializing user service...');
      await userService.initialize(this.dataSource);
      
      // Initialize wallet service
      console.log('Initializing wallet service...');
      await walletService.initialize(this.dataSource);
      
      // Initialize matching engine for all supported markets
      console.log('Initializing matching engine...');
      this.initializeMatchingEngine();
      
      // Set up event listeners between services using Redis pub/sub
      this.setupEventListeners();
      
      // Start market makers for liquid markets
      console.log('Starting market makers...');
      this.startMarketMakers();
      
      this.initialized = true;
      console.log('All services initialized successfully');
    } catch (error) {
      console.error('Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize the matching engine for all markets
   */
  private initializeMatchingEngine(): void {
    this.matchingEngine = MatchingEngine.getInstance();
    
    // Initialize order books for all supported markets
    for (const market of this.markets) {
      console.log(`Initializing order book for ${market}`);
      
      // Create market configuration
      const [baseAsset, quoteAsset] = market.split('_');
      const marketConfig: MatchingEngineMarketConfig = {
        market: market,
        baseAsset: baseAsset,
        quoteAsset: quoteAsset
      };
      
      this.matchingEngine.createOrderBook(marketConfig);
      
      // Load existing orders from the database
      this.loadOpenOrdersForMarket(market);
    }
  }
  
  /**
   * Load open orders for a market from the database
   * @param market Market symbol
   */
  private async loadOpenOrdersForMarket(market: string): Promise<void> {
    if (!this.dataSource) {
      console.error('Data source not initialized');
      return;
    }
    
    try {
      // In a real implementation, this would query the database for open orders
      // For now, we'll just log a message
      console.log(`Loading open orders for ${market}`);
      
      // Example of how this might be implemented:
      // const orderRepository = this.dataSource.getRepository(Order);
      // const openOrders = await orderRepository.find({
      //   where: { market, status: 'open' }
      // });
      // 
      // for (const order of openOrders) {
      //   this.matchingEngine.addOrder(order);
      // }
    } catch (error) {
      console.error(`Error loading open orders for ${market}:`, error);
    }
  }

  /**
   * Set up event listeners between services
   */
  private setupEventListeners(): void {
    // When a new trade happens, update services and notify clients
    redisService.subscribe('trade', (trade: Trade) => {
      // Process the trade in various services
      this.processTrade(trade);
      
      // The WebSocket handler will publish trade updates to connected clients
      const wsHandler = getWebSocketHandler();
      if (wsHandler && trade.market) {
        wsHandler.publishToStream(`trades@${trade.market}`, trade);
      }
    });

    // When market data updates, publish to WebSocket
    redisService.subscribe('market_data', (marketData) => {
      const wsHandler = getWebSocketHandler();
      if (wsHandler && marketData.market) {
        wsHandler.publishToStream(`ticker@${marketData.market}`, marketData);
      }
    });
    
    // When candle data updates, publish to WebSocket
    redisService.subscribe('candle-1m', (candle) => {
      const wsHandler = getWebSocketHandler();
      if (wsHandler && candle.market) {
        wsHandler.publishToStream(`kline_1m@${candle.market}`, candle);
      }
    });
    
    // When balance updates, notify the specific user
    redisService.subscribe('balance', (balanceUpdate) => {
      if (balanceUpdate.userId) {
        const wsHandler = getWebSocketHandler();
        if (wsHandler) {
          wsHandler.publishToUser(balanceUpdate.userId, 'balance', balanceUpdate);
        }
      }
    });
  }

  /**
   * Process a new trade across all services
   * @param trade The trade to process
   */
  public processTrade(trade: Trade): void {
    if (!trade.market) {
      console.error('Cannot process trade: missing market');
      return;
    }
    
    console.log(`Processing trade: ${trade.quantity} ${trade.market} at ${trade.price}`);
    
    // Add timestamp if not provided
    if (!trade.timestamp) {
      trade.timestamp = Date.now();
    }
    
    // Publish trade to Redis for other services to consume
    redisService.publish('trade', trade);
    
    // Publish directly to candle service
    redisService.publish('candle_update', trade);
    
    // Process trade settlement in the wallet service
    if (trade.makerOrderId && trade.takerOrderId) {
      redisService.publish('trade_settlement', trade);
    }
    
    // Store trade in database
    redisService.publish('db_trade', trade);
    
    // Update market data
    this.updateMarketData(trade);
  }

  /**
   * Start market makers for all liquid markets
   */
  private startMarketMakers(): void {
    // Initialize market maker for each supported market
    for (const market of this.markets) {
      console.log(`Starting market maker for ${market}`);
      
          // Create a basic market configuration for market maker
      const marketConfig: MarketMakerConfig = {
        symbol: market,
        basePrice: market.includes('BTC') ? 40000 : 2800, // Default base prices
        spreadPercentage: 0.01, // 1% spread
        levels: 3,
        levelSizeMultiplier: 1.5,
        baseQuantity: 0.01,
        tickSize: 0.01,
        stepSize: 0.001,
        refreshInterval: 30000,
        maxPriceDeviation: 0.05,
        activeOrderIds: []
      };
      
      marketMakerService.startMarketMaking(marketConfig);
    }
    
    // Start specialized market makers with custom parameters
    this.startMarketMaker('BTC_USDC', 40000, 0.002);
    
    // Start market maker for ETH/USDC
    this.startMarketMaker('ETH_USDC', 2800, 0.003);
  }
  
  /**
   * Start a market maker for a specific market with custom parameters
   * @param market Market symbol
   * @param basePrice Base price for market maker orders
   * @param spreadPercentage Percentage spread around base price
   */
  private startMarketMaker(market: string, basePrice: number, spreadPercentage: number): void {
    console.log(`Starting specialized market maker for ${market} with base price ${basePrice} and spread ${spreadPercentage}`);
    
    // Create market maker configuration with custom parameters
    const marketConfig: MarketMakerConfig = {
      symbol: market,
      basePrice: basePrice,
      spreadPercentage: spreadPercentage,
      levels: 5,
      levelSizeMultiplier: 1.5,
      baseQuantity: 0.05,
      tickSize: basePrice * 0.0001, // Small tick size relative to price
      stepSize: 0.001,
      refreshInterval: 30000,
      maxPriceDeviation: 0.03,
      activeOrderIds: []
    };
    
    // Start market making with specific parameters
    marketMakerService.startMarketMaking(marketConfig);
  }
  /**
   * Submit a new order to the matching engine
   * @param order The order to submit
   */
  public async submitOrder(order: ExtendedOrder): Promise<Order> {
    if (!this.matchingEngine) {
      throw new Error('Matching engine not initialized');
    }
    
    if (!order.timestamp) {
      order.timestamp = Date.now();
    }
    
    if (!order.status) {
      order.status = OrderStatus.OPEN;
    }
    
    console.log(`Submitting order: ${order.side} ${order.quantity} ${order.market} at ${order.price}`);
    
    // For market orders, check if price is null/undefined
    if (order.type === OrderType.MARKET && order.price !== undefined) {
      // Market orders don't have a price - assign a temporary value that will be ignored
      order.price = 0;
    }
    
    // Lock funds for the order
    const fundLocked = await this.lockFundsForOrder(order);
    if (!fundLocked) {
      throw new Error('Insufficient funds to place order');
    }
    
    // Store order in database
    redisService.publish('db_order', { ...order, action: 'create' });
    
    // Submit to matching engine - ensure matching engine is initialized
    if (!this.matchingEngine) {
      throw new Error('Matching engine not initialized');
    }
    
    const result = this.matchingEngine.processOrder(order);
    
    // Process any resulting trades
    if (result.trades && result.trades.length > 0) {
      for (const trade of result.trades) {
        this.processTrade(trade);
      }
    }
    
    // If order was fully filled, update its status
    if (result.remainingOrder) {
      order.status = OrderStatus.OPEN;
      order.remainingQuantity = result.remainingOrder.quantity;
      
      // Publish order update
      this.publishOrderUpdate(order);
    } else {
      order.status = OrderStatus.FILLED;
      order.remainingQuantity = 0;
      
      // Publish order update
      this.publishOrderUpdate(order);
    }
    
    return order;
  }
  
  /**
   * Cancel an existing order
   * @param orderId Order ID to cancel
   * @param userId User ID who owns the order
   */
  public async cancelOrder(orderId: string, userId: string): Promise<boolean> {
    if (!this.matchingEngine) {
      throw new Error('Matching engine not initialized');
    }
    
    // In real implementation, we would verify the user owns this order
    // const order = await orderRepository.findOne({ where: { id: orderId, userId } });
    
    console.log(`Cancelling order: ${orderId}`);
    
    // Remove from matching engine
    const cancelledOrder = this.matchingEngine.cancelOrder(orderId);
    if (!cancelledOrder) {
      return false;
    }
    
    // Update order status in database
    redisService.publish('db_order', { id: orderId, status: OrderStatus.CANCELLED, action: 'update' });
    
    // Unlock funds
    if (cancelledOrder.remainingQuantity > 0) {
      await this.unlockFundsForCancelledOrder(cancelledOrder);
    }
    
    // Publish order update
    this.publishOrderUpdate({ ...cancelledOrder, status: OrderStatus.CANCELLED });
    
    return true;
  }
  
  /**
   * Lock funds for a new order
   * @param order The order to lock funds for
   */
  private async lockFundsForOrder(order: ExtendedOrder): Promise<boolean> {
    // Skip for market maker orders
    if (order.isMarketMaker) {
      return true;
    }
    
    // Extract asset and amount to lock based on order side
    if (!order.market) {
      console.error('Order missing market information');
      return false;
    }
    
    const [baseAsset, quoteAsset] = order.market.split('_');
    
    let asset: string;
    let amount: number;
    
    if (order.side === OrderSide.BUY) {
      // For buy orders, lock quote asset based on price and quantity
      // For market orders, use a safe estimate or use available balance
      asset = quoteAsset;
      amount = order.price ? order.price * order.quantity : order.notional || 0;
    } else {
      // For sell orders, lock base asset
      asset = baseAsset;
      amount = order.quantity;
    }
    
    // Lock funds in wallet service
    if (!order.userId || !order.id) {
      console.error('Order missing user or order ID information');
      return false;
    }
    
    return await walletService.lockOrderFunds(order.userId, asset, amount, order.id);
  }
  
  /**
   * Unlock funds for a cancelled order
   * @param order The cancelled order
   */
  private async unlockFundsForCancelledOrder(order: ExtendedOrder): Promise<boolean> {
    // Skip for market maker orders
    if (order.isMarketMaker) {
      return true;
    }
    
    // Extract asset and amount to unlock based on order side
    if (!order.market) {
      console.error('Order missing market information');
      return false;
    }
    
    const [baseAsset, quoteAsset] = order.market.split('_');
    
    let asset: string;
    let amount: number;
    
    if (order.side === OrderSide.BUY) {
      // For buy orders, unlock remaining quote asset
      asset = quoteAsset;
      amount = order.price ? order.price * order.remainingQuantity : order.notional || 0;
    } else {
      // For sell orders, unlock remaining base asset
      asset = baseAsset;
      amount = order.remainingQuantity;
    }
    
    // Unlock funds in wallet service
    if (!order.userId || !order.id) {
      console.error('Order missing user or order ID information');
      return false;
    }
    
    return await walletService.unlockOrderFunds(order.userId, asset, amount, order.id);
  }
  
  /**
   * Publish order update to websocket
   * @param order The updated order
   */
  private publishOrderUpdate(order: Order): void {
    if (!order.userId) {
      console.error('Cannot publish order update: missing userId');
      return;
    }
    
    // Publish to websocket for the specific user
    const wsHandler = getWebSocketHandler();
    if (wsHandler) {
      // Publish to market stream for all users
      if (order.market) {
        wsHandler.publishToStream(`orders@${order.market}`, {
          id: order.id,
          market: order.market,
          side: order.side,
          status: order.status,
          price: order.price,
          quantity: order.quantity,
          remainingQuantity: order.remainingQuantity,
          timestamp: order.timestamp
        });
      }
      
      // Publish to specific user's stream
      wsHandler.publishToUser(order.userId, 'orders', order);
    }
  }
  
  /**
   * Update and publish market data based on recent trade
   * @param trade Recent trade to update market data with
   */
  private updateMarketData(trade: Trade): void {
    if (!trade.market) {
      console.error('Cannot update market data: trade missing market');
      return;
    }
    
    // In a real implementation, we would maintain market data objects
    // For now, we'll create one with data from the trade
    const marketData: MarketData = {
      market: trade.market,
      lastPrice: trade.price,
      lastQuantity: trade.quantity,
      lastTradeTime: trade.timestamp || Date.now(),
      volume24h: trade.quantity, // Would accumulate in reality
      priceChange24h: 0, // Would calculate in reality
      priceChangePercent24h: 0, // Would calculate in reality
      high24h: trade.price,
      low24h: trade.price,
      bestBid: 0, // Would get from orderbook
      bestAsk: 0, // Would get from orderbook
      updatedAt: Date.now()
    };
    
    // Publish market data update
    redisService.publish('market_data', marketData);
  }



  /**
   * Shut down all services gracefully
   */
  public async shutdown(): Promise<void> {
    try {
      console.log('Shutting down services...');
      
      // Stop all market makers
      const activeMarkets = marketMakerService.getActiveMarkets();
      if (Array.isArray(activeMarkets)) {
        activeMarkets.forEach((market: string) => {
          marketMakerService.stopMarketMaking(market);
        });
      }
      
      // Close Redis connections
      await redisService.disconnect();
      
      // Shutdown database connections
      if (this.dataSource) {
        await this.dataSource.destroy();
      }
      
      console.log('All services shut down successfully');
    } catch (error) {
      console.error('Error during service shutdown:', error);
      throw error;
    }
  }
  
  /**
   * Get the list of supported markets
   */
  public getSupportedMarkets(): string[] {
    return [...this.markets];
  }
  
  /**
   * Get the matching engine instance
   */
  public getMatchingEngine(): MatchingEngine | undefined {
    return this.matchingEngine;
  }
}

export const serviceManager = ServiceManager.getInstance();
