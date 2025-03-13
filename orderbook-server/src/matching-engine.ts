
import { Order, Trade } from './types';
import { orderbook } from './orderbook';
import { getWebSocketHandler } from './websocket';

class MatchingEngine {
  private static instance: MatchingEngine;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): MatchingEngine {
    if (!MatchingEngine.instance) {
      MatchingEngine.instance = new MatchingEngine();
    }
    return MatchingEngine.instance;
  }

  /**
   * Process a new order and attempt to match it with existing orders
   * @param order The new order to process
   * @returns Array of trades that were executed
   */
  public processOrder(order: Order): Trade[] {
    // Add the order to the orderbook
    orderbook.addOrder(order);
    
    // Try to match the order with existing orders
    const trades = this.matchOrder(order);
    
    // Publish trades to WebSocket
    this.publishTrades(trades);
    
    return trades;
  }

  /**
   * Match an order against the opposite side of the book
   * @param order Order to match
   * @returns Array of executed trades
   */
  private matchOrder(order: Order): Trade[] {
    const trades: Trade[] = [];
    let remainingQuantity = order.quantity;
    
    // Get the opposite side of the book
    const oppositeSide = order.side === 'buy' ? 'sell' : 'buy';
    const priceMap = oppositeSide === 'buy' ? orderbook.getBids() : orderbook.getAsks();
    
    // Sort prices for matching
    // For buy orders, we want to match against the lowest asks first
    // For sell orders, we want to match against the highest bids first
    const prices = Array.from(priceMap.keys()).sort((a: number, b: number) => 
      oppositeSide === 'buy' ? b - a : a - b
    );
    
    // Iterate through prices to find matches
    for (const price of prices) {
      // Check if we need to continue matching
      if (remainingQuantity <= 0) break;
      
      // For buy orders, only match if the ask price is <= the order price
      // For sell orders, only match if the bid price is >= the order price
      if ((order.side === 'buy' && price > order.price) || 
          (order.side === 'sell' && price < order.price)) {
        break;
      }
      
      const orders = priceMap.get(price) || [];
      
      // Match against orders at this price level
      let i = 0;
      while (i < orders.length && remainingQuantity > 0) {
        const matchedOrder = orders[i];
        const matchQuantity = Math.min(remainingQuantity, matchedOrder.quantity);
        
        // Generate fallback IDs if needed
        const orderId = order.id || order.orderId || `order-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        const matchedOrderId = matchedOrder.id || matchedOrder.orderId || `matched-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        
        // Create a trade
        const trade: Trade = {
          tradeId: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
          buyOrderId: order.side === 'buy' ? orderId : matchedOrderId,
          sellOrderId: order.side === 'sell' ? orderId : matchedOrderId,
          price,
          quantity: matchQuantity,
          timestamp: Date.now(),
          makerOrderId: matchedOrderId,
          takerOrderId: orderId,
          side: order.side
        };
        
        trades.push(trade);
        
        // Update remaining quantities
        remainingQuantity -= matchQuantity;
        matchedOrder.quantity -= matchQuantity;
        
        // Remove the matched order if fully filled
        if (matchedOrder.quantity <= 0) {
          orders.splice(i, 1);
        } else {
          i++;
        }
      }
      
      // Update the orders at this price level
      if (orders.length > 0) {
        priceMap.set(price, orders);
      } else {
        priceMap.delete(price);
      }
    }
    
    // Update the order's remaining quantity
    order.quantity = remainingQuantity;
    
    // If the order is partially filled, make sure it's still in the book
    if (remainingQuantity > 0) {
      const orderSidePriceMap = order.side === 'buy' ? orderbook.getBids() : orderbook.getAsks();
      const ordersAtPrice = orderSidePriceMap.get(order.price) || [];
      
      if (!ordersAtPrice.includes(order)) {
        ordersAtPrice.push(order);
        orderSidePriceMap.set(order.price, ordersAtPrice);
      }
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
      if (!trade.market) {
        trade.market = 'BTC_USDC';
      }
      
      const marketTrades = tradesByMarket.get(trade.market) || [];
      marketTrades.push(trade);
      tradesByMarket.set(trade.market, marketTrades);
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
}

// Export singleton instance
export const matchingEngine = MatchingEngine.getInstance();
