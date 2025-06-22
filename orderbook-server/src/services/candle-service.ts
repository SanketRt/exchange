import { DataSource, Repository } from 'typeorm';
import { Candle } from '../db/entities/Candle';
import { Trade } from '../types';
import { redisService } from './redis-service';

// Candle mapping interface to match our DB entity
interface CandleData {
  market: string;
  timeframe: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  trades: number;
}

/**
 * Service for managing candle data
 * Handles the aggregation of trade data into candles of different time intervals
 */
export class CandleService {
  private static instance: CandleService;
  private dataSource!: DataSource; // Using the definite assignment assertion
  private candleRepository!: Repository<Candle>; // Using the definite assignment assertion
  private candleCache: Map<string, Map<string, CandleData>> = new Map(); // market -> timeframe -> candle
  private intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];
  
  private constructor() {
    // Initialize the candle cache for different timeframes
    this.intervals.forEach(interval => {
      this.candleCache.set(interval, new Map());
    });
  }

  public static getInstance(): CandleService {
    if (!CandleService.instance) {
      CandleService.instance = new CandleService();
    }
    return CandleService.instance;
  }

  /**
   * Initialize the service with the database connection
   * @param dataSource TypeORM data source
   */
  public async initialize(dataSource: DataSource): Promise<void> {
    this.dataSource = dataSource;
    this.candleRepository = this.dataSource.getRepository(Candle);
    
    // Subscribe to the trade channel
    await redisService.subscribe('trade', (trade: Trade) => {
      this.processTrade(trade);
    });

    console.log('CandleService initialized');
  }

  /**
   * Process a new trade and update candles
   * @param trade The trade to process
   */
  public processTrade(trade: Trade): void {
    const market = trade.market || 'BTC_USDC';
    const timestamp = trade.timestamp || Date.now();
    const price = trade.price;
    const quantity = trade.quantity;
    
    // Update candles for each interval
    this.intervals.forEach(interval => {
      const intervalMs = this.getIntervalMs(interval);
      const candleTimestamp = Math.floor(timestamp / intervalMs) * intervalMs;
      
      const marketCandles = this.candleCache.get(interval) || new Map();
      const cacheKey = `${market}-${candleTimestamp}`;
      let candle = marketCandles.get(cacheKey);
      
      if (!candle) {
        // Create a new candle
        candle = {
          market,
          timeframe: interval,
          timestamp: new Date(candleTimestamp),
          open: price,
          high: price,
          low: price,
          close: price,
          volume: quantity,
          quoteVolume: price * quantity,
          trades: 1
        };
      } else {
        // Update existing candle
        candle.high = Math.max(candle.high, price);
        candle.low = Math.min(candle.low, price);
        candle.close = price;
        candle.volume += quantity;
        candle.quoteVolume += price * quantity;
        candle.trades += 1;
      }
      
      marketCandles.set(cacheKey, candle);
      
      // Publish candle update to Redis
      redisService.publish(`candle-${interval}@${market}`, candle);
      
      // If candle is complete (timestamp older than current time minus interval),
      // save it to the database and remove from cache
      if (candleTimestamp + intervalMs < Date.now()) {
        this.saveCandle(candle);
        marketCandles.delete(cacheKey);
      }
    });
  }

  /**
   * Save candle to database
   * @param candle The candle to save
   */
  private async saveCandle(candle: CandleData): Promise<void> {
    try {
      await this.candleRepository.save(candle);
    } catch (error) {
      console.error('Error saving candle:', error);
    }
  }

  /**
   * Get candles for a specific market and interval
   * @param market The market symbol
   * @param interval The time interval
   * @param limit The maximum number of candles to return
   * @param startTime Optional start time (timestamp in ms)
   * @param endTime Optional end time (timestamp in ms)
   */
  public async getCandles(
    market: string,
    interval: string,
    limit: number = 100,
    startTime?: number,
    endTime?: number
  ): Promise<Candle[]> {
    // Build query conditions
    let query = this.candleRepository
      .createQueryBuilder('candle')
      .where('candle.market = :market', { market })
      .andWhere('candle.timeframe = :timeframe', { timeframe: interval })
      .orderBy('candle.timestamp', 'DESC')
      .limit(limit);
    
    if (startTime) {
      query = query.andWhere('candle.timestamp >= :startTime', { startTime });
    }
    
    if (endTime) {
      query = query.andWhere('candle.timestamp <= :endTime', { endTime });
    }
    
    // Execute the query
    const candles = await query.getMany();
    
    // Add any cached candles that match the criteria
    const cachedCandles = Array.from((this.candleCache.get(interval) || new Map()).values())
      .filter(c => c.market === market);
    
    if (startTime) {
      cachedCandles.filter(c => c.timestamp >= startTime);
    }
    
    if (endTime) {
      cachedCandles.filter(c => c.timestamp <= endTime);
    }
    
    // Combine database and cached candles
    const allCandles = [...candles, ...cachedCandles]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    
    return allCandles;
  }

  /**
   * Convert time interval string to milliseconds
   * @param interval Time interval string (e.g., '1m', '5m', '15m', '1h', '4h', '1d')
   */
  private getIntervalMs(interval: string): number {
    const unit = interval.slice(-1);
    const value = parseInt(interval.slice(0, -1));
    
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 60 * 1000; // Default to 1 minute
    }
  }
  
  /**
   * Get the latest candle for a market and interval
   * @param market Market symbol
   * @param interval Candle interval
   */
  public async getLatestCandle(market: string, interval: string): Promise<Candle | null> {
    // First check if we have it in the cache
    const marketCandles = this.candleCache.get(interval);
    if (marketCandles) {
      // Find the most recent candle for this market
      const latestCandle = Array.from(marketCandles.values())
        .filter(c => c.market === market)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      
      if (latestCandle) {
        // Convert to Candle entity
        return this.candleRepository.create(latestCandle);
      }
    }
    
    // If not in cache, fetch from database
    return await this.candleRepository.findOne({
      where: { market, timeframe: interval },
      order: { timestamp: 'DESC' }
    });
  }
  
  /**
   * Check if an interval is valid
   * @param interval Interval to check
   */
  public isValidInterval(interval: string): boolean {
    return this.intervals.includes(interval);
  }
  
  /**
   * Get all supported intervals
   */
  public getSupportedIntervals(): string[] {
    return [...this.intervals];
  }
}

export const candleService = CandleService.getInstance();
