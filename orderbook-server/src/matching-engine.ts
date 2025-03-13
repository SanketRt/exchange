import { Order, Trade } from './types';
import { getWebSocketHandler } from './websocket';

/**
 * Matching engine for order execution
 */
export class MatchingEngine {
  private static instance: MatchingEngine;
  private orders: Map<string, Order> = new Map();

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of the matching engine
   */
  public static getInstance(): MatchingEngine {
    if (!MatchingEngine.instance) {
      MatchingEngine.instance = new MatchingEngine();
    }
    return MatchingEngine.instance;
  }

  /**
   * Process an order against the orderbook for potential matches
   * @param order The order to process
   * @returns Array of trades that were executed
   */
  public processOrder(order: Order): Trade[] {
    // Store the order in our local map for tracking
    this.orders.set(order.orderId, order);
    
    // Match against existing orders - this would invoke OrderBook methods
    // but we'll simulate matching here for the demo without direct OrderBook dependency
    const trades: Trade[] = [];
    
    // In a real implementation, this would call orderbook.matchOrder 
    // but we'll assume no matches for this demo to avoid circular dependencies
    // The actual matching will be done when this is called from OrderBook
    
    // Publish trades to WebSocket if any were made
    if (trades.length > 0) {
      this.publishTrades(trades);
    }
    
    return trades;
  }

  /**
   * Publish trades to WebSocket for real-time updates
   * @param trades Trades to publish
   */
  private publishTrades(trades: Trade[]): void {
    if (trades.length === 0) return;
    
    const websocketHandler = getWebSocketHandler();
    if (!websocketHandler) return;
    
    // Group trades by market
    const tradesByMarket = new Map<string, Trade[]>();
    
    trades.forEach(trade => {
      // Set a default market if not specified
      const market = trade.market || 'BTC_USDC';
      
      const marketTrades = tradesByMarket.get(market) || [];
      marketTrades.push(trade);
      tradesByMarket.set(market, marketTrades);
    });
    
    // Publish trades for each market
    for (const [market, marketTrades] of tradesByMarket.entries()) {
      websocketHandler.publishToStream(`trades@${market}`, marketTrades);
      
      // Also update ticker data
      this.updateTickerForTrades(market, marketTrades);
    }
  }

  /**
   * Update ticker data based on new trades
   * @param market Market symbol
   * @param trades New trades for the market
   */
  private updateTickerForTrades(market: string, trades: Trade[]): void {
    if (trades.length === 0) return;
    
    const websocketHandler = getWebSocketHandler();
    if (!websocketHandler) return;
    
    // Calculate ticker data
    const lastPrice = trades[trades.length - 1].price;
    const volume24h = trades.reduce((sum, trade) => sum + trade.quantity, 0);
    const high24h = Math.max(...trades.map(trade => trade.price));
    const low24h = Math.min(...trades.map(trade => trade.price));
    
    // Simple calculation for price change (in a real system this would use a 24h window)
    const priceChangePercent = trades.length > 1 
      ? ((lastPrice - trades[0].price) / trades[0].price) * 100
      : 0;
    
    // Publish ticker update
    websocketHandler.publishToStream(`ticker@${market}`, {
      symbol: market,
      lastPrice,
      priceChange: lastPrice - trades[0].price,
      priceChangePercent,
      high24h,
      low24h,
      volume24h,
      timestamp: Date.now()
    });
  }

  /**
   * Get an order by ID
   */
  public getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Update the status of an order
   */
  public updateOrderStatus(orderId: string, status: Order['status'], filledQty: number): void {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = status;
      order.filledQuantity = filledQty;
      order.remainingQuantity = order.quantity - filledQty;
    }
  }
}

// Export singleton instance
export const matchingEngine = MatchingEngine.getInstance();
