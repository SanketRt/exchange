import express from 'express';
import cors from 'cors';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { orderbook } from './orderbook';
import { OrderInputSchema, Order } from './types';
import { z } from 'zod';
import Redis from 'ioredis';
import { initializeWebSocketServer, getWebSocketHandler } from './websocket';

// Initialize Redis client for publishing events
const redisPub = new Redis();

const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Get order book snapshot
app.get('/api/orderbook', (req, res) => {
  const snapshot = orderbook.getSnapshot();
  res.json(snapshot);
  
  // Publish depth update to Redis
  redisPub.publish('depth@BTC_USDC', JSON.stringify(snapshot));
});

// Get recent trades
app.get('/api/trades', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const market = req.query.market as string || 'BTC_USDC';
  const trades = orderbook.getRecentTrades(market, limit);
  res.json(trades);
});

// Place a new order
app.post('/api/orders', (req, res) => {
  try {
    const input = OrderInputSchema.parse(req.body);
    const orderId = uuidv4();
    
    const order = {
      ...input,
      orderId,
      timestamp: Date.now(),
      status: 'open' as const,
      remainingQuantity: input.quantity,
      filledQuantity: 0
    } as Order;

    // Match the order against the order book
    const { fills, remainingQuantity } = orderbook.matchOrder(order);

    // If there's remaining quantity, add it to the order book
    if (remainingQuantity > 0) {
      order.remainingQuantity = remainingQuantity;
      order.status = fills.length > 0 ? 'partially_filled' : 'open';
      orderbook.addOrder(order);
    } else {
      order.status = 'filled';
    }

    // Publish trades to Redis
    if (fills.length > 0) {
      redisPub.publish('trades@BTC_USDC', JSON.stringify(fills));
      
      // Create ticker update
      const lastTrade = fills[fills.length - 1];
      const tickerUpdate = {
        symbol: 'BTC_USDC',
        lastPrice: lastTrade.price,
        lastQty: lastTrade.quantity,
        timestamp: Date.now(),
        side: lastTrade.side
      };
      
      // Publish ticker update
      redisPub.publish('ticker@BTC_USDC', JSON.stringify(tickerUpdate));
    }

    // Publish order book update
    const snapshot = orderbook.getSnapshot();
    redisPub.publish('depth@BTC_USDC', JSON.stringify(snapshot));

    res.json({
      order,
      fills
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Cancel an order
app.delete('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  const removedOrder = orderbook.removeOrder(orderId);
  
  if (removedOrder) {
    res.json(removedOrder);
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

// Get market summary
app.get('/api/market/summary', (req, res) => {
  const bestBid = orderbook.getBestBid();
  const bestAsk = orderbook.getBestAsk();
  const spread = orderbook.getSpread();
  
  res.json({
    bestBid,
    bestAsk,
    spread,
    timestamp: Date.now()
  });
});

const PORT = process.env.PORT || 3000;

// Initialize WebSocket server
initializeWebSocketServer(server);

// Start the server
server.listen(PORT, () => {
  console.log(`Order book server running on port ${PORT}`);
  console.log(`WebSocket server initialized`);
});