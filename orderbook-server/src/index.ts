import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import http from "http";
import { OrderInputSchema, Order, Trade } from "./types";
import { orderbook } from "./orderbook";
import { serviceManager } from "./services/service-manager";
import { redisService } from "./services/redis-service";
import { initializeWebSocketServer } from "./websocket";

// Load environment variables

// Create Express server instance
const app = express();
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Get server port from environment or use default
const PORT = process.env.PORT || 3000;

// Create a WebSocket server
const wsHandler = initializeWebSocketServer(server);

// RESTful API endpoints
app.post('/api/v1/order', async (req, res) => {
  const orderResult = OrderInputSchema.safeParse(req.body);
  if (!orderResult.success) {
    res.status(400).send({ error: orderResult.error.message });
    return;
  }

  const { baseAsset, quoteAsset, price, quantity, side, type, kind } = orderResult.data;
  const market = `${baseAsset}_${quoteAsset}`;
  const orderId = `order-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

  // Create order object
  const order: Order = {
    orderId,
    market,
    side,
    type,
    kind: kind || 'gtc',
    price,
    quantity,
    remainingQuantity: quantity,
    filledQuantity: 0,
    status: 'open',
    timestamp: Date.now(),
    userId: req.body.userId || 'anonymous',
    id: orderId // For compatibility with both id and orderId fields
  };

  try {
    // Publish the order to Redis for processing
    redisService.publish('new_order', order);
    
    // Get the matching engine singleton from the orderbook module
    const matchingEngine = orderbook.getMatchingEngine();
    
    // Process the order through the matching engine
    const result = matchingEngine.processOrder(order);
    
    res.status(200).send({
      orderId,
      status: order.status,
      executedQty: order.filledQuantity,
      remainingQty: order.remainingQuantity,
      fills: result.trades.map((trade: Trade) => ({
        price: trade.price,
        quantity: trade.quantity,
        tradeId: trade.tradeId
      }))
    });
  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).send({ error: 'Failed to process order' });
  }
});

// Get order book endpoint
app.get('/api/v1/orderbook/:market', (req, res) => {
  const market = req.params.market;
  const snapshot = orderbook.getSnapshot(market);
  res.status(200).send(snapshot);
});

// Get recent trades endpoint
app.get('/api/v1/trades/:market', (req, res) => {
  const market = req.params.market;
  const limit = parseInt(req.query.limit as string) || 50;
  const trades = orderbook.getRecentTrades(market, limit);
  res.status(200).send(trades);
});

// Initialize the server
async function initializeServer() {
  try {
    // Initialize all services
    await serviceManager.initialize();
    
    // Start the HTTP server
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`WebSocket server is running on ws://localhost:${PORT}`);
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Received SIGINT signal. Shutting down gracefully...');
      await serviceManager.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM signal. Shutting down gracefully...');
      await serviceManager.shutdown();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Start the server
initializeServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});


function getOrderId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

interface Fill {
    "price": number,
    "qty": number,
    "tradeId": number,
}

// Global variables for order tracking
let GLOBAL_TRADE_ID = 1;

// Book with quantity for aggregated order book views
const bookWithQuantity: { bids: Record<number, number>, asks: Record<number, number> } = {
    bids: {},
    asks: {}
}

function fillOrder(orderId: string, price: number, quantity: number, side: "buy" | "sell", type?: "ioc"): { status: "rejected" | "accepted"; executedQty: number; fills: Fill[] } {
    // Use the matching engine to process the order instead of manual matching
    const matchingEngine = orderbook.getMatchingEngine();
    
    // Create the order object
    const order: Order = {
        orderId,
        price,
        quantity,
        remainingQuantity: quantity,
        filledQuantity: 0,
        side: side === 'buy' ? 'buy' : 'sell',
        type: 'limit',
        kind: type || 'gtc',
        status: 'open',
        market: 'BTC_USDC',
        timestamp: Date.now(),
        userId: 'system',
        id: orderId // For compatibility with both id and orderId fields
    };

    // Process the order through the matching engine
    const result = matchingEngine.processOrder(order);
    
    // Extract the fills and remaining quantity from the result
    const fills: Fill[] = [];
    let executedQuantity = 0;
    
    // Check if the result matches the expected structure
    if ('fills' in result && 'remainingQuantity' in result) {
        // Type assertion to help TypeScript understand the structure
        const matchResult = result as { fills: Trade[], remainingQuantity: number };
        
        // Map trades to fills format for compatibility
        matchResult.fills.forEach(trade => {
            fills.push({
                price: trade.price,
                qty: trade.quantity,
                tradeId: typeof trade.tradeId === 'number' ? trade.tradeId : parseInt(trade.tradeId, 10)
            });
            executedQuantity += trade.quantity;
        });
        
        // Update the executed quantity based on remaining quantity
        if (executedQuantity === 0) {
            executedQuantity = quantity - matchResult.remainingQuantity;
        }
    }

    // Update bookWithQuantity object for UI purposes
    updateBookWithQuantity();

    // Return in the expected format
    return { 
        status: fills.length > 0 || executedQuantity > 0 ? 'accepted' : 'rejected', 
        executedQty: executedQuantity, 
        fills 
    };
}

function getFillAmount(price: number, quantity: number, side: "buy" | "sell"): number {
    let available = 0;
    
    // Get the appropriate side of the book
    const orders = side === 'buy' ? 
        orderbook.getAsks() : 
        orderbook.getBids();
    
    // Calculate available quantity to fill
    for (const [orderPrice, orderList] of orders.entries()) {
        if ((side === 'buy' && orderPrice <= price) || 
            (side === 'sell' && orderPrice >= price)) {
            for (const order of orderList) {
                available += order.remainingQuantity;
            }
        }
    }

    return Math.min(quantity, available);
}

// Update the bookWithQuantity object based on current orderbook state
function updateBookWithQuantity(): void {
    // Reset book with quantity
    bookWithQuantity.bids = {};
    bookWithQuantity.asks = {};
    
    // Get bids and asks from orderbook
    const bids = orderbook.getBids();
    const asks = orderbook.getAsks();
    
    // Process bids
    for (const [price, orders] of bids.entries()) {
        const totalQuantity = orders.reduce((sum, order) => sum + order.remainingQuantity, 0);
        bookWithQuantity.bids[price] = totalQuantity;
    }
    
    // Process asks
    for (const [price, orders] of asks.entries()) {
        const totalQuantity = orders.reduce((sum, order) => sum + order.remainingQuantity, 0);
        bookWithQuantity.asks[price] = totalQuantity;
    }
}
