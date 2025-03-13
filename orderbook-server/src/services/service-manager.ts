import { redisService } from './redis-service';
import { dbProcessorService } from './db-processor';
import { marketMakerService } from './market-maker';
import { getWebSocketHandler } from '../websocket';
import { getDataSource } from '../db/database';

/**
 * Service Manager
 * Responsible for initializing and managing all services
 */
class ServiceManager {
  private static instance: ServiceManager;
  private initialized = false;

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
      await getDataSource();
      
      // Initialize database processor service
      console.log('Initializing database processor service...');
      await dbProcessorService.initialize();
      
      // Initialize WebSocket service
      console.log('Initializing WebSocket service...');
      const wsHandler = getWebSocketHandler();
      if (!wsHandler) {
        throw new Error('Failed to initialize WebSocket handler');
      }
      
      // Set up event listeners between services using Redis pub/sub
      this.setupEventListeners();
      
      // Optionally start market maker for certain markets
      this.startMarketMaker('BTC_USDC');
      
      this.initialized = true;
      console.log('All services initialized successfully');
    } catch (error) {
      console.error('Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners between services
   */
  private setupEventListeners(): void {
    // Example: When a new trade happens, update both the market data service and the websocket clients
    redisService.subscribe('trades', (trade) => {
      // The DB processor service will handle saving trades to the database
      // The WebSocket handler will publish trade updates to connected clients
      const wsHandler = getWebSocketHandler();
      if (wsHandler) {
        wsHandler.publishToStream(`trades@${trade.market}`, trade);
      }
    });

    // Example: When market data updates, publish to WebSocket
    redisService.subscribe('market_data', (marketData) => {
      const wsHandler = getWebSocketHandler();
      if (wsHandler && marketData.market) {
        wsHandler.publishToStream(`ticker@${marketData.market}`, marketData);
      }
    });
  }

  /**
   * Start the market maker for a specific market
   * @param market Market symbol
   */
  private startMarketMaker(market: string): void {
    // Configure market maker
    const marketConfig = {
      symbol: market,
      basePrice: 40000, // Initial price estimate
      spreadPercentage: 0.002, // 0.2% spread
      levels: 5, // 5 orders on each side
      levelSizeMultiplier: 1.5, // Each level is 1.5x the size of the previous
      baseQuantity: 0.01, // Base quantity in BTC
      tickSize: 0.01, // Minimum price movement
      stepSize: 0.001, // Minimum quantity movement
      refreshInterval: 30000, // Refresh orders every 30 seconds
      maxPriceDeviation: 0.05, // 5% price deviation before recalibrating
      activeOrderIds: []
    };

    // Start market making
    marketMakerService.startMarketMaking(marketConfig);
  }

  /**
   * Shut down all services gracefully
   */
  public async shutdown(): Promise<void> {
    try {
      console.log('Shutting down services...');
      
      // Stop market maker
      marketMakerService.getActiveMarkets().forEach(market => {
        marketMakerService.stopMarketMaking(market);
      });
      
      // Close Redis connections
      await redisService.disconnect();
      
      // Shutdown database connections
      const dataSource = await getDataSource();
      await dataSource.destroy();
      
      console.log('All services shut down successfully');
    } catch (error) {
      console.error('Error during service shutdown:', error);
      throw error;
    }
  }
}

export const serviceManager = ServiceManager.getInstance();
