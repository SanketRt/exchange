import { redisService } from './redis-service';
import { getDataSource } from '../db/database';
import { Order } from '../db/entities/Order';
import { Trade } from '../db/entities/Trade';
import { Candle } from '../db/entities/Candle';
import { Repository, DataSource } from 'typeorm';

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
      let order = await this.orderRepository.findOne({ where: { id: orderData.id } });
      
      if (order) {
        // Update existing order
        Object.assign(order, orderData);
      } else {
        // Create new order
        order = this.orderRepository.create(orderData);
      }

      return await this.orderRepository.save(order);
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
      if (typeof tradeData.timestamp === 'number') {
        tradeData.timestamp = new Date(tradeData.timestamp);
      }
      
      const trade = this.tradeRepository.create(tradeData);
      return await this.tradeRepository.save(trade);
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
      // Make sure timestamp is a Date object
      if (typeof candleData.timestamp === 'number') {
        candleData.timestamp = new Date(candleData.timestamp);
      }
      
      // Check if candle already exists
      let candle = await this.candleRepository.findOne({
        where: {
          market: candleData.market,
          timeframe: candleData.timeframe,
          timestamp: candleData.timestamp
        }
      });
      
      if (candle) {
        // Update existing candle
        Object.assign(candle, candleData);
      } else {
        // Create new candle
        candle = this.candleRepository.create(candleData);
      }

      return await this.candleRepository.save(candle);
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

    return this.candleRepository.find({
      where: {
        market,
        timeframe,
        timestamp: {
          $lte: endTime
        }
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

    return this.tradeRepository.find({
      where: {
        market,
        timestamp: {
          $lte: endTime
        }
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

    // Get trades within the timeframe for this market
    const trades = await this.tradeRepository.find({
      where: {
        market,
        timestamp: {
          $gte: startTime,
          $lt: endTime
        }
      },
      order: {
        timestamp: 'ASC'
      }
    });

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

    // Create candle entity
    const candle = this.candleRepository.create({
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
    });

    return await this.candleRepository.save(candle);
  }
}

export const dbProcessorService = DbProcessorService.getInstance();
