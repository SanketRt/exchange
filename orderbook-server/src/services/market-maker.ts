import { redisService } from './redis-service';
import { Order } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Configuration for a market that the market maker should provide liquidity for
 */
interface MarketConfig {
  // Market symbol (e.g., BTC_USDC)
  symbol: string;
  // Base price to calculate spread around
  basePrice: number;
  // Spread percentage (e.g., 0.02 for 2%)
  spreadPercentage: number;
  // Number of orders to place on each side
  levels: number;
  // Amount each subsequent order should increase by (e.g., 1.5 means each order is 1.5x the previous)
  levelSizeMultiplier: number;
  // Base quantity for orders
  baseQuantity: number;
  // Minimum price movement
  tickSize: number;
  // Minimum quantity movement
  stepSize: number;
  // Interval for refreshing orders in milliseconds
  refreshInterval: number;
  // Maximum price change allowed before recalibrating (e.g., 0.05 for 5%)
  maxPriceDeviation: number;
  // List of active order IDs placed by the market maker
  activeOrderIds: string[];
}

/**
 * Market Maker Service
 * Provides automated liquidity to the exchange by placing buy and sell orders
 */
class MarketMakerService {
  private static instance: MarketMakerService;
  private isRunning: boolean = false;
  private markets: Map<string, MarketConfig> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {}

  public static getInstance(): MarketMakerService {
    if (!MarketMakerService.instance) {
      MarketMakerService.instance = new MarketMakerService();
    }
    return MarketMakerService.instance;
  }

  /**
   * Initialize the market maker for a specific market
   * @param config Market maker configuration for a market
   */
  public startMarketMaking(config: MarketConfig): void {
    if (this.markets.has(config.symbol)) {
      console.log(`Market maker already running for ${config.symbol}`);
      return;
    }

    this.markets.set(config.symbol, {
      ...config,
      activeOrderIds: []
    });

    // Subscribe to market data to keep track of price
    redisService.subscribe(`ticker@${config.symbol}`, (ticker) => {
      this.updateMarketPrice(config.symbol, ticker.lastPrice);
    });

    // Start the market making interval
    const interval = setInterval(() => {
      this.refreshOrders(config.symbol);
    }, config.refreshInterval);

    this.intervals.set(config.symbol, interval);
    this.isRunning = true;

    console.log(`Market maker started for ${config.symbol}`);
    
    // Initial order placement
    this.refreshOrders(config.symbol);
  }

  /**
   * Stop market making for a specific market
   * @param symbol Market symbol (e.g., BTC_USDC)
   */
  public stopMarketMaking(symbol: string): void {
    const marketConfig = this.markets.get(symbol);
    if (!marketConfig) {
      console.log(`Market maker not running for ${symbol}`);
      return;
    }

    // Clear the interval
    const interval = this.intervals.get(symbol);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(symbol);
    }

    // Cancel all active orders
    this.cancelAllOrders(symbol);

    // Remove market configuration
    this.markets.delete(symbol);

    console.log(`Market maker stopped for ${symbol}`);

    // Check if there are any more markets running
    if (this.markets.size === 0) {
      this.isRunning = false;
      console.log('All market makers stopped');
    }
  }

  /**
   * Update the market price for a specific market
   * @param symbol Market symbol
   * @param newPrice New market price
   */
  private updateMarketPrice(symbol: string, newPrice: number): void {
    const marketConfig = this.markets.get(symbol);
    if (!marketConfig) return;

    // Check if price deviation exceeds threshold
    const priceDeviation = Math.abs(newPrice - marketConfig.basePrice) / marketConfig.basePrice;
    if (priceDeviation > marketConfig.maxPriceDeviation) {
      console.log(`Market price for ${symbol} has deviated by ${(priceDeviation * 100).toFixed(2)}%. Recalibrating...`);
      
      // Update base price and refresh orders
      this.markets.set(symbol, {
        ...marketConfig,
        basePrice: newPrice
      });

      this.refreshOrders(symbol);
    }
  }

  /**
   * Cancel all active orders for a market
   * @param symbol Market symbol
   */
  private cancelAllOrders(symbol: string): void {
    const marketConfig = this.markets.get(symbol);
    if (!marketConfig) return;

    // Cancel each active order
    marketConfig.activeOrderIds.forEach(orderId => {
      // Publish cancel order event
      redisService.publish('cancel_order', {
        symbol,
        orderId
      });
    });

    // Clear active orders list
    this.markets.set(symbol, {
      ...marketConfig,
      activeOrderIds: []
    });
  }

  /**
   * Refresh orders for a market
   * @param symbol Market symbol
   */
  private refreshOrders(symbol: string): void {
    const marketConfig = this.markets.get(symbol);
    if (!marketConfig) return;

    // Cancel existing orders
    this.cancelAllOrders(symbol);

    // Generate new buy and sell orders
    const newOrders: Order[] = [
      ...this.generateBuyOrders(marketConfig),
      ...this.generateSellOrders(marketConfig)
    ];

    // Place new orders
    const newOrderIds: string[] = [];
    newOrders.forEach(order => {
      // The order already has an orderId, so we can use that
      newOrderIds.push(order.orderId);

      // Publish new order
      redisService.publish('new_order', {
        ...order,
        userId: 'market-maker',
        source: 'market-maker'
      });
    });

    // Update active orders
    this.markets.set(symbol, {
      ...marketConfig,
      activeOrderIds: newOrderIds
    });
  }

  /**
   * Generate buy orders for a market
   * @param config Market configuration
   */
  private generateBuyOrders(config: MarketConfig): Order[] {
    const orders: Order[] = [];
    const basePrice = config.basePrice;
    const spreadAmount = basePrice * config.spreadPercentage;

    for (let i = 0; i < config.levels; i++) {
      // Calculate price with spread discount (buy below market)
      // Add more distance for each level
      const levelDiscount = spreadAmount * (1 + i * 0.5);
      let price = basePrice - levelDiscount;
      
      // Round price to tick size
      price = Math.floor(price / config.tickSize) * config.tickSize;
      
      // Calculate quantity for this level
      const quantity = config.baseQuantity * Math.pow(config.levelSizeMultiplier, i);
      
      // Round quantity to step size
      const roundedQuantity = Math.floor(quantity / config.stepSize) * config.stepSize;
      
      orders.push({
        orderId: uuidv4(),
        market: config.symbol,
        side: 'buy',
        type: 'limit',
        kind: 'gtc', // Good Till Cancelled - standard for market maker orders
        price,
        quantity: roundedQuantity,
        remainingQuantity: roundedQuantity,
        filledQuantity: 0,
        status: 'open',
        timestamp: Date.now()
      });
    }

    return orders;
  }

  /**
   * Generate sell orders for a market
   * @param config Market configuration
   */
  private generateSellOrders(config: MarketConfig): Order[] {
    const orders: Order[] = [];
    const basePrice = config.basePrice;
    const spreadAmount = basePrice * config.spreadPercentage;

    for (let i = 0; i < config.levels; i++) {
      // Calculate price with spread markup (sell above market)
      // Add more distance for each level
      const levelMarkup = spreadAmount * (1 + i * 0.5);
      let price = basePrice + levelMarkup;
      
      // Round price to tick size
      price = Math.ceil(price / config.tickSize) * config.tickSize;
      
      // Calculate quantity for this level
      const quantity = config.baseQuantity * Math.pow(config.levelSizeMultiplier, i);
      
      // Round quantity to step size
      const roundedQuantity = Math.floor(quantity / config.stepSize) * config.stepSize;
      
      orders.push({
        orderId: uuidv4(),
        market: config.symbol,
        side: 'sell',
        type: 'limit',
        kind: 'gtc', // Good Till Cancelled - standard for market maker orders
        price,
        quantity: roundedQuantity,
        remainingQuantity: roundedQuantity,
        filledQuantity: 0,
        status: 'open',
        timestamp: Date.now()
      });
    }

    return orders;
  }

  /**
   * Get a list of all markets where the market maker is active
   */
  public getActiveMarkets(): string[] {
    return Array.from(this.markets.keys());
  }

  /**
   * Get the market maker configuration for a specific market
   * @param symbol Market symbol
   */
  public getMarketConfig(symbol: string): MarketConfig | undefined {
    return this.markets.get(symbol);
  }

  /**
   * Update the market maker configuration for a specific market
   * @param symbol Market symbol
   * @param newConfig Updated market configuration
   */
  public updateMarketConfig(symbol: string, newConfig: Partial<MarketConfig>): void {
    const currentConfig = this.markets.get(symbol);
    if (!currentConfig) {
      console.log(`Market maker not running for ${symbol}`);
      return;
    }

    // Update the configuration
    this.markets.set(symbol, {
      ...currentConfig,
      ...newConfig
    });

    // If refresh interval changed, reset the interval
    if (newConfig.refreshInterval && newConfig.refreshInterval !== currentConfig.refreshInterval) {
      const interval = this.intervals.get(symbol);
      if (interval) {
        clearInterval(interval);
      }

      const newInterval = setInterval(() => {
        this.refreshOrders(symbol);
      }, newConfig.refreshInterval);

      this.intervals.set(symbol, newInterval);
    }

    console.log(`Market maker configuration updated for ${symbol}`);
    
    // Refresh orders with new configuration
    this.refreshOrders(symbol);
  }
}

export const marketMakerService = MarketMakerService.getInstance();