import { redisService } from './redis-service';
import { getDataSource } from '../db/database';
import { Order } from '../db/entities/Order';
import { Trade } from '../db/entities/Trade';
import { Candle } from '../db/entities/Candle';
import { Repository, DataSource, LessThanOrEqual, MoreThanOrEqual, LessThan } from 'typeorm';

/**
 * Database Processor Service
 * Responsible for persisting trading data to PostgreSQL/TimescaleDB
 */
class DbProcessorService {
  private static instance: DbProcessorService;
  private dataSource: DataSource | null = null;
  private orderRepository: Repository<Order> | null = null;
  private tradeRepository: Repository<Trade> | null = null;
  private candleRepository: Repository<Candle> | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance(): DbProcessorService {
    if (!DbProcessorService.instance) {
      DbProcessorService.instance = new DbProcessorService();
    }
    return DbProcessorService.instance;
  }

  /**
   * Initialize the database processor service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize database connection
      this.dataSource = await getDataSource();
      this.orderRepository = this.dataSource.getRepository(Order);
      this.tradeRepository = this.dataSource.getRepository(Trade);
      this.candleRepository = this.dataSource.getRepository(Candle);

      // Subscribe to Redis channels for new data
      this.subscribeToRedisChannels();

      this.initialized = true;
      console.log('Database Processor Service initialized');
    } catch (error) {
      console.error('Failed to initialize Database Processor Service:', error);
      throw error;
    }
  }

  /**
   * Subscribe to Redis channels for real-time data processing
   */
  private subscribeToRedisChannels(): void {
    // Subscribe to new orders
    redisService.subscribe('orders', async (order) => {
      await this.saveOrder(order);
    });

    // Subscribe to new trades
    redisService.subscribe('trades', async (trade) => {
      await this.saveTrade(trade);
    });

    // Subscribe to candle updates
    redisService.subscribe('candles', async (candle) => {
      await this.saveCandle(candle);
    });
  }

  /**
   * Save an order to the database
   * @param orderData Order data to save
   */
  public async saveOrder(orderData: any): Promise<Order> {
    if (!this.orderRepository) {
      throw new Error('Order repository not initialized');
    }

    try {
      // Check if order already exists
      const existingOrder = await this.orderRepository.findOneBy({ id: orderData.id });
      
      if (existingOrder) {
        // Update existing order - merge the data
        this.orderRepository.merge(existingOrder, orderData);
        const savedOrder = await this.orderRepository.save(existingOrder);
        return savedOrder as unknown as Order;
      } else {
        // Create new order
        const newOrder = this.orderRepository.create(orderData);
        const savedOrder = await this.orderRepository.save(newOrder);
        return savedOrder as unknown as Order;
      }
    } catch (error) {
      console.error('Error saving order:', error);
      throw error;
    }
  }

  /**
   * Save a trade to the database
   * @param tradeData Trade data to save
   */
  public async saveTrade(tradeData: any): Promise<Trade> {
    if (!this.tradeRepository) {
      throw new Error('Trade repository not initialized');
    }

    try {
      // Make sure timestamp is a Date object
      const processedTradeData = { ...tradeData };
      if (typeof processedTradeData.timestamp === 'number') {
        processedTradeData.timestamp = new Date(processedTradeData.timestamp);
      }
      
      const trade = this.tradeRepository.create(processedTradeData);
      const savedTrade = await this.tradeRepository.save(trade);
      return savedTrade as unknown as Trade;
    } catch (error) {
      console.error('Error saving trade:', error);
      throw error;
    }
  }

  /**
   * Save a candle to the database
   * @param candleData Candle data to save
   */
  public async saveCandle(candleData: any): Promise<Candle> {
    if (!this.candleRepository) {
      throw new Error('Candle repository not initialized');
    }

    try {
      // Process candle data
      const processedCandleData = { ...candleData };
      if (typeof processedCandleData.timestamp === 'number') {
        processedCandleData.timestamp = new Date(processedCandleData.timestamp);
      }
      
      // Check if candle already exists
      const existingCandle = await this.candleRepository.findOneBy({
        market: processedCandleData.market,
        timeframe: processedCandleData.timeframe,
        timestamp: processedCandleData.timestamp
      });
      
      if (existingCandle) {
        // Update existing candle - merge the data
        this.candleRepository.merge(existingCandle, processedCandleData);
        const savedCandle = await this.candleRepository.save(existingCandle);
        return savedCandle as unknown as Candle;
      } else {
        // Create new candle
        const newCandle = this.candleRepository.create(processedCandleData);
        const savedCandle = await this.candleRepository.save(newCandle);
        return savedCandle as unknown as Candle;
      }
    } catch (error) {
      console.error('Error saving candle:', error);
      throw error;
    }
  }

  /**
   * Retrieve historical candles for a market and timeframe
   * @param market Market pair (e.g., BTC_USDC)
   * @param timeframe Candle timeframe (e.g., 1m, 5m, 15m, 1h, 4h, 1d)
   * @param limit Number of candles to retrieve
   * @param endTime End timestamp (default: now)
   */
  public async getHistoricalCandles(
    market: string,
    timeframe: string,
    limit: number = 100,
    endTime: Date = new Date()
  ): Promise<Candle[]> {
    if (!this.candleRepository) {
      throw new Error('Candle repository not initialized');
    }

    return await this.candleRepository.find({
      where: {
        market,
        timeframe,
        timestamp: LessThanOrEqual(endTime)
      },
      order: {
        timestamp: 'DESC'
      },
      take: limit
    });
  }

  /**
   * Retrieve historical trades for a market
   * @param market Market pair (e.g., BTC_USDC)
   * @param limit Number of trades to retrieve
   * @param endTime End timestamp (default: now)
   */
  public async getHistoricalTrades(
    market: string,
    limit: number = 100,
    endTime: Date = new Date()
  ): Promise<Trade[]> {
    if (!this.tradeRepository) {
      throw new Error('Trade repository not initialized');
    }

    return await this.tradeRepository.find({
      where: {
        market,
        timestamp: LessThanOrEqual(endTime)
      },
      order: {
        timestamp: 'DESC'
      },
      take: limit
    });
  }

  /**
   * Aggregate trade data into a new candle
   * @param market Market pair (e.g., BTC_USDC)
   * @param timeframe Candle timeframe (e.g., 1m, 5m, 15m, 1h, 4h, 1d)
   * @param startTime Start timestamp of the candle period
   * @param endTime End timestamp of the candle period
   */
  public async aggregateCandle(
    market: string,
    timeframe: string,
    startTime: Date,
    endTime: Date
  ): Promise<Candle | null> {
    if (!this.tradeRepository || !this.candleRepository) {
      throw new Error('Repositories not initialized');
    }

    // Get trades within the timeframe for this market using query builder
    const trades = await this.tradeRepository
      .createQueryBuilder('trade')
      .where('trade.market = :market', { market })
      .andWhere('trade.timestamp >= :startTime', { startTime })
      .andWhere('trade.timestamp < :endTime', { endTime })
      .orderBy('trade.timestamp', 'ASC')
      .getMany();

    if (trades.length === 0) {
      return null;
    }

    // Calculate OHLCV data
    const firstTrade = trades[0];
    const lastTrade = trades[trades.length - 1];
    
    let high = Number(firstTrade.price);
    let low = Number(firstTrade.price);
    let volume = 0;
    let quoteVolume = 0;

    for (const trade of trades) {
      const price = Number(trade.price);
      const quantity = Number(trade.quantity);
      
      high = Math.max(high, price);
      low = Math.min(low, price);
      volume += quantity;
      quoteVolume += quantity * price;
    }

    // Create candle data object
    const candleData = {
      market,
      timeframe,
      timestamp: startTime,
      open: Number(firstTrade.price),
      high,
      low,
      close: Number(lastTrade.price),
      volume,
      quoteVolume,
      trades: trades.length
    };

    // Create and save candle entity
    const candle = this.candleRepository.create(candleData);
    const savedCandle = await this.candleRepository.save(candle);
    return savedCandle as unknown as Candle;
  }
}

export const dbProcessorService = DbProcessorService.getInstance();