import { Order, OrderBookLevel, OrderBookSnapshot, Trade } from './types';

class OrderBook {
  private bids: Map<number, Order[]>;
  private asks: Map<number, Order[]>;
  private trades: Trade[];
  private updateId: number;

  constructor() {
    this.bids = new Map();
    this.asks = new Map();
    this.trades = [];
    this.updateId = 0;
  }

  addOrder(order: Order): void {
    const priceMap = order.side === 'buy' ? this.bids : this.asks;
    const orders = priceMap.get(order.price) || [];
    orders.push(order);
    priceMap.set(order.price, orders);
    this.updateId++;
  }

  removeOrder(orderId: string): Order | undefined {
    let removedOrder: Order | undefined;

    // Search in both bids and asks
    for (const [price, orders] of this.bids) {
      const index = orders.findIndex(o => o.orderId === orderId);
      if (index !== -1) {
        removedOrder = orders[index];
        orders.splice(index, 1);
        if (orders.length === 0) {
          this.bids.delete(price);
        }
        break;
      }
    }

    if (!removedOrder) {
      for (const [price, orders] of this.asks) {
        const index = orders.findIndex(o => o.orderId === orderId);
        if (index !== -1) {
          removedOrder = orders[index];
          orders.splice(index, 1);
          if (orders.length === 0) {
            this.asks.delete(price);
          }
          break;
        }
      }
    }

    return removedOrder;
  }

  matchOrder(order: Order): { fills: Trade[]; remainingQuantity: number } {
    const fills: Trade[] = [];
    let remainingQuantity = order.quantity;
    const oppositeOrders = order.side === 'buy' ? 
      Array.from(this.asks.entries()).sort(([a], [b]) => a - b) :
      Array.from(this.bids.entries()).sort(([a], [b]) => b - a);

    for (const [price, orders] of oppositeOrders) {
      if (order.side === 'buy' && price > order.price) break;
      if (order.side === 'sell' && price < order.price) break;

      for (const matchingOrder of orders) {
        if (remainingQuantity <= 0) break;

        const fillQuantity = Math.min(remainingQuantity, matchingOrder.remainingQuantity);
        remainingQuantity -= fillQuantity;
        matchingOrder.remainingQuantity -= fillQuantity;
        matchingOrder.filledQuantity += fillQuantity;

        const trade: Trade = {
          tradeId: this.trades.length + 1,
          price: matchingOrder.price,
          quantity: fillQuantity,
          timestamp: Date.now(),
          makerOrderId: matchingOrder.orderId,
          takerOrderId: order.orderId,
          side: order.side
        };

        fills.push(trade);
        this.trades.push(trade);

        if (matchingOrder.remainingQuantity === 0) {
          matchingOrder.status = 'filled';
          this.removeOrder(matchingOrder.orderId);
        }
      }
    }

    return { fills, remainingQuantity };
  }

  getSnapshot(): OrderBookSnapshot {
    const processOrders = (orders: Map<number, Order[]>): OrderBookLevel[] => {
      return Array.from(orders.entries())
        .map(([price, orders]) => ({
          price,
          quantity: orders.reduce((sum, o) => sum + o.remainingQuantity, 0),
          total: orders.reduce((sum, o) => sum + o.remainingQuantity * price, 0),
          orderCount: orders.length
        }))
        .sort((a, b) => b.price - a.price);
    };

    return {
      bids: processOrders(this.bids),
      asks: processOrders(this.asks),
      updateId: this.updateId,
      timestamp: Date.now()
    };
  }

  getRecentTrades(limit: number = 50): Trade[] {
    return this.trades.slice(-limit);
  }

  getBestBid(): { price: number; quantity: number } | null {
    const prices = Array.from(this.bids.keys()).sort((a, b) => b - a);
    if (prices.length === 0) return null;
    
    const bestPrice = prices[0];
    const orders = this.bids.get(bestPrice)!;
    return {
      price: bestPrice,
      quantity: orders.reduce((sum, o) => sum + o.remainingQuantity, 0)
    };
  }

  getBestAsk(): { price: number; quantity: number } | null {
    const prices = Array.from(this.asks.keys()).sort((a, b) => a - b);
    if (prices.length === 0) return null;
    
    const bestPrice = prices[0];
    const orders = this.asks.get(bestPrice)!;
    return {
      price: bestPrice,
      quantity: orders.reduce((sum, o) => sum + o.remainingQuantity, 0)
    };
  }

  getSpread(): number | null {
    const bestBid = this.getBestBid();
    const bestAsk = this.getBestAsk();
    
    if (!bestBid || !bestAsk) return null;
    return bestAsk.price - bestBid.price;
  }

  /**
   * Get the bid side of the order book
   * @returns Map of price to orders
   */
  getBids(): Map<number, Order[]> {
    return this.bids;
  }

  /**
   * Get the ask side of the order book
   * @returns Map of price to orders
   */
  getAsks(): Map<number, Order[]> {
    return this.asks;
  }
}

export const orderbook = new OrderBook();