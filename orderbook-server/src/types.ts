import { z } from "zod";

export const OrderInputSchema = z.object({
  baseAsset: z.string(),
  quoteAsset: z.string(),
  price: z.number().positive(),
  quantity: z.number().positive(),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['limit', 'market']),
  kind: z.enum(['ioc', 'gtc', 'fok']).optional().default('gtc'),
});

export type OrderInput = z.infer<typeof OrderInputSchema>;

export interface Order {
  orderId: string;
  price: number;
  quantity: number;
  timestamp: number;
  side: 'buy' | 'sell';
  status: 'open' | 'filled' | 'cancelled' | 'partially_filled';
  filledQuantity: number;
  remainingQuantity: number;
  type: 'limit' | 'market';
  kind: 'ioc' | 'gtc' | 'fok';
  market?: string; // Market symbol (e.g., BTC_USDC)
  userId?: string; // User ID who placed the order
  id?: string; // Alternative ID field (for compatibility)
}

export enum OrderStatus {
  OPEN = 'open',
  FILLED = 'filled',
  PARTIALLY_FILLED = 'partially_filled',
  CANCELLED = 'cancelled'
}

export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell'
}

export enum OrderType {
  LIMIT = 'limit',
  MARKET = 'market'
}

export interface Trade {
  tradeId: string | number;
  price: number;
  quantity: number;
  timestamp: number;
  makerOrderId: string;
  takerOrderId: string;
  side: 'buy' | 'sell';
  market?: string; // Market symbol
  fee?: number; // Trading fee
  feeAsset?: string; // Asset in which fee was collected
  buyOrderId?: string; // ID of the buy order
  sellOrderId?: string; // ID of the sell order
  makerUserId?: string; // User ID of the maker
  takerUserId?: string; // User ID of the taker
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  total: number;
  orderCount: number;
}

export interface OrderBookSnapshot {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  updateId: number;
  timestamp?: number;
}

export interface Fill {
  price: number;
  quantity: number;
  tradeId: number;
}

export interface OrderResponse {
  orderId: string;
  status: 'accepted' | 'rejected';
  executedQty: number;
  fills: Fill[];
  message?: string;
}

/**
 * Candle data for a specific timeframe
 */
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Ticker information for a market
 */
export interface Ticker {
  symbol: string;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

/**
 * Market data for a specific trading pair
 */
export interface MarketData {
  market: string;
  lastPrice: number;
  lastQuantity: number;
  lastTradeTime: number;
  volume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  bestBid: number;
  bestAsk: number;
  updatedAt: number;
}

/**
 * Extended Order interface with additional properties for the matching engine
 */
export interface ExtendedOrder extends Order {
  isMarketMaker?: boolean;
  notional?: number; // For market orders: quantity * price
}
