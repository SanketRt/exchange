import { Trade, Candle, Ticker, OrderBookSnapshot } from './types';
import { getWebSocketHandler } from './websocket';
import { orderbook } from './orderbook';

/**
 * Market Data Service
 * Responsible for generating and managing market data including:
 * - Candlestick data for different timeframes
 * - Ticker information (24h statistics)
 * - Order book snapshots at different depth levels
 */
class MarketDataService {
  private static instance: MarketDataService;
  
  // Store candles by market and timeframe
  private candles: Map<string, Map<string, Candle[]>> = new Map();
  
  // Store latest ticker data by market
  private tickers: Map<string, Ticker> = new Map();
  
  // Supported timeframes in milliseconds
  private timeframes: Map<string, number> = new Map([
    ['1m', 60 * 1000],
    ['5m', 5 * 60 * 1000],
    ['15m', 15 * 60 * 1000],
    ['1h', 60 * 60 * 1000],
    ['4h', 4 * 60 * 60 * 1000],
    ['1d', 24 * 60 * 60 * 1000],
  ]);
  
  private constructor() {
    this.initializeMarketData();
    this.startBackgroundTasks();
  }
  
  public static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }
  
  /**
   * Initialize market data structures
   */
  private initializeMarketData(): void {
    // Initialize for our default market BTC_USDC
    const markets = ['BTC_USDC'];
    
    for (const market of markets) {
      // Initialize candles for each timeframe
      const marketCandles = new Map<string, Candle[]>();
      
      for (const timeframe of this.timeframes.keys()) {
        marketCandles.set(timeframe, []);
      }
      
      this.candles.set(market, marketCandles);
      
      // Initialize ticker
      this.tickers.set(market, {
        symbol: market,
        lastPrice: 0,
        priceChange: 0,
        priceChangePercent: 0,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Start background tasks for periodic operations
   */
  private startBackgroundTasks(): void {
    // Generate order book snapshots every 30 seconds
    setInterval(() => this.generateOrderBookSnapshots(), 30000);
    
    // Clean up old candle data every hour
    setInterval(() => this.cleanupOldData(), 60 * 60 * 1000);
  }
  
  /**
   * Process new trades to update candles and ticker data
   * @param trades Array of new trades
   * @param market Market symbol
   */
  public processTrades(trades: Trade[], market: string = 'BTC_USDC'): void {
    if (trades.length === 0) return;
    
    // Update candles
    for (const trade of trades) {
      for (const [timeframe, interval] of this.timeframes.entries()) {
        this.updateCandle(trade, market, timeframe, interval);
      }
    }
    
    // Update ticker
    this.updateTicker(trades, market);
  }
  
  /**
   * Update a candle for a specific timeframe based on a new trade
   * @param trade New trade
   * @param market Market symbol
   * @param timeframe Timeframe string (e.g. '1m', '5m')
   * @param interval Timeframe interval in milliseconds
   */
  private updateCandle(trade: Trade, market: string, timeframe: string, interval: number): void {
    const marketCandles = this.candles.get(market);
    if (!marketCandles) return;
    
    const candles = marketCandles.get(timeframe) || [];
    
    // Calculate the candle timestamp (floor to the interval)
    const candleTimestamp = Math.floor(trade.timestamp / interval) * interval;
    
    // Check if we need to create a new candle
    if (candles.length === 0 || candles[candles.length - 1].timestamp < candleTimestamp) {
      // Create a new candle
      candles.push({
        timestamp: candleTimestamp,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: trade.quantity
      });
    } else {
      // Update the current candle
      const currentCandle = candles[candles.length - 1];
      currentCandle.high = Math.max(currentCandle.high, trade.price);
      currentCandle.low = Math.min(currentCandle.low, trade.price);
      currentCandle.close = trade.price;
      currentCandle.volume += trade.quantity;
    }
    
    // Store updated candles
    marketCandles.set(timeframe, candles);
    
    // Publish candle update via WebSocket
    const websocketHandler = getWebSocketHandler();
    if (websocketHandler) {
      websocketHandler.publishToStream(`kline@${market}@${timeframe}`, {
        candle: candles[candles.length - 1],
        timeframe
      });
    }
  }
  
  /**
   * Update ticker data based on new trades
   * @param trades Array of new trades
   * @param market Market symbol
   */
  private updateTicker(trades: Trade[], market: string): void {
    const currentTicker = this.tickers.get(market);
    if (!currentTicker) return;
    
    const lastPrice = trades[trades.length - 1].price;
    const volume = trades.reduce((sum, trade) => sum + trade.quantity, 0);
    const high = Math.max(...trades.map(trade => trade.price));
    const low = Math.min(...trades.map(trade => trade.price));
    
    // Update ticker
    const updatedTicker: Ticker = {
      ...currentTicker,
      lastPrice,
      high24h: Math.max(currentTicker.high24h || 0, high),
      low24h: currentTicker.low24h === 0 ? low : Math.min(currentTicker.low24h, low),
      volume24h: currentTicker.volume24h + volume,
      timestamp: Date.now()
    };
    
    // Calculate price change (simple implementation)
    if (currentTicker.lastPrice > 0) {
      updatedTicker.priceChange = lastPrice - currentTicker.lastPrice;
      updatedTicker.priceChangePercent = (updatedTicker.priceChange / currentTicker.lastPrice) * 100;
    }
    
    // Store updated ticker
    this.tickers.set(market, updatedTicker);
    
    // Publish ticker update
    const websocketHandler = getWebSocketHandler();
    if (websocketHandler) {
      websocketHandler.publishToStream(`ticker@${market}`, updatedTicker);
    }
  }
  
  /**
   * Generate order book snapshots and broadcast them
   */
  private generateOrderBookSnapshots(): void {
    const markets = ['BTC_USDC']; // For now, just support our main market
    
    for (const market of markets) {
      const snapshot = orderbook.getSnapshot();
      
      // Create different depth levels
      const depths = [5, 10, 20];
      
      for (const depth of depths) {
        const depthSnapshot: OrderBookSnapshot = {
          bids: snapshot.bids.slice(0, depth),
          asks: snapshot.asks.slice(0, depth),
          updateId: snapshot.updateId,
          timestamp: Date.now()
        };
        
        // Publish snapshot
        const websocketHandler = getWebSocketHandler();
        if (websocketHandler) {
          websocketHandler.publishToStream(`depth@${market}@${depth}`, depthSnapshot);
        }
      }
    }
  }
  
  /**
   * Clean up old candle data to prevent memory bloat
   */
  private cleanupOldData(): void {
    const now = Date.now();
    
    // Define retention periods for each timeframe
    const retentionPeriods = new Map<string, number>([
      ['1m', 7 * 24 * 60 * 60 * 1000], // 7 days
      ['5m', 30 * 24 * 60 * 60 * 1000], // 30 days
      ['15m', 60 * 24 * 60 * 60 * 1000], // 60 days
      ['1h', 180 * 24 * 60 * 60 * 1000], // 180 days
      ['4h', 365 * 24 * 60 * 60 * 1000], // 1 year
      ['1d', 3 * 365 * 24 * 60 * 60 * 1000], // 3 years
    ]);
    
    // Clean up for each market and timeframe
    for (const [market, marketCandles] of this.candles.entries()) {
      for (const [timeframe, candles] of marketCandles.entries()) {
        const retentionPeriod = retentionPeriods.get(timeframe) || 0;
        const cutoffTime = now - retentionPeriod;
        
        // Filter out old candles
        const filteredCandles = candles.filter(candle => candle.timestamp >= cutoffTime);
        
        // Update with filtered candles
        marketCandles.set(timeframe, filteredCandles);
      }
    }
  }
  
  /**
   * Get candles for a specific market and timeframe
   * @param market Market symbol
   * @param timeframe Candle timeframe
   * @param limit Maximum number of candles to return
   * @returns Array of candles
   */
  public getCandles(market: string, timeframe: string, limit: number = 100): Candle[] {
    const marketCandles = this.candles.get(market);
    if (!marketCandles) return [];
    
    const candles = marketCandles.get(timeframe) || [];
    
    // Return the most recent candles up to the limit
    return candles.slice(-limit);
  }
  
  /**
   * Get the current ticker for a market
   * @param market Market symbol
   * @returns Ticker object
   */
  public getTicker(market: string): Ticker | undefined {
    return this.tickers.get(market);
  }
}

// Export singleton instance
export const marketDataService = MarketDataService.getInstance();
