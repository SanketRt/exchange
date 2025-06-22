const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Also add the cors middleware as backup
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());

// In-memory storage for orders and trades
let orders = [];
let trades = [];
let orderBook = { bids: [], asks: [] };

// Mock Market Data Generator
function generateMockMarketData() {
  const basePrice = 50000; // Base BTC price
  const spread = 10; // $10 spread
  
  // Generate bid orders (buy orders below market price)
  const bids = [];
  for (let i = 0; i < 15; i++) {
    const price = basePrice - spread/2 - (i * 8); // Decreasing prices
    const quantity = (Math.random() * 2 + 0.1).toFixed(4); // Random quantity 0.1-2.1
    bids.push([price.toFixed(2), quantity]);
  }
  
  // Generate ask orders (sell orders above market price)
  const asks = [];
  for (let i = 0; i < 15; i++) {
    const price = basePrice + spread/2 + (i * 8); // Increasing prices
    const quantity = (Math.random() * 2 + 0.1).toFixed(4); // Random quantity 0.1-2.1
    asks.push([price.toFixed(2), quantity]);
  }
  
  return { bids, asks };
}

// Generate mock trades
function generateMockTrades() {
  const trades = [];
  const basePrice = 50000;
  const now = Date.now();
  
  // Generate 50 random trades over the last 24 hours
  for (let i = 0; i < 50; i++) {
    const timestamp = now - (Math.random() * 24 * 60 * 60 * 1000); // Random time in last 24h
    const priceVariation = (Math.random() - 0.5) * 1000; // ±$500 variation
    const price = (basePrice + priceVariation).toFixed(2);
    const quantity = (Math.random() * 0.5 + 0.01).toFixed(4); // 0.01-0.51 BTC
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    
    trades.push({
      tradeId: `mock_${i}`,
      price: parseFloat(price),
      quantity: parseFloat(quantity),
      side: side,
      timestamp: new Date(timestamp).toISOString()
    });
  }
  
  // Sort by timestamp (oldest first)
  return trades.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// Initialize mock data
let mockOrderBook = generateMockMarketData();
let mockTrades = generateMockTrades();

// Update mock data every 5 seconds to simulate live market
setInterval(() => {
  mockOrderBook = generateMockMarketData();
  
  // Add a new random trade occasionally
  if (Math.random() > 0.7) { // 30% chance
    const basePrice = 50000;
    const priceVariation = (Math.random() - 0.5) * 100; // ±$50 variation
    const price = (basePrice + priceVariation).toFixed(2);
    const quantity = (Math.random() * 0.1 + 0.01).toFixed(4);
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    
    const newTrade = {
      tradeId: `live_${Date.now()}`,
      price: parseFloat(price),
      quantity: parseFloat(quantity),
      side: side,
      timestamp: new Date().toISOString()
    };
    
    mockTrades.push(newTrade);
    
    // Keep only last 100 trades
    if (mockTrades.length > 100) {
      mockTrades = mockTrades.slice(-100);
    }
  }
}, 5000);

// Simple matching engine
class SimpleMatchingEngine {
  constructor() {
    this.buyOrders = []; // Sorted by price (highest first)
    this.sellOrders = []; // Sorted by price (lowest first)
  }

  addOrder(order) {
    const orderWithId = {
      ...order,
      orderId: uuidv4(),
      timestamp: new Date().toISOString(),
      status: 'open',
      filledQuantity: 0
    };

    if (order.side === 'buy') {
      this.buyOrders.push(orderWithId);
      this.buyOrders.sort((a, b) => b.price - a.price); // Highest price first
    } else {
      this.sellOrders.push(orderWithId);
      this.sellOrders.sort((a, b) => a.price - b.price); // Lowest price first
    }

    orders.push(orderWithId);
    this.tryMatch();
    
    return orderWithId;
  }

  tryMatch() {
    while (this.buyOrders.length > 0 && this.sellOrders.length > 0) {
      const bestBuy = this.buyOrders[0];
      const bestSell = this.sellOrders[0];

      if (bestBuy.price >= bestSell.price) {
        const tradeQuantity = Math.min(
          bestBuy.quantity - bestBuy.filledQuantity,
          bestSell.quantity - bestSell.filledQuantity
        );
        const tradePrice = bestSell.price; // Seller's price (first come, first served)

        // Create trade
        const trade = {
          tradeId: uuidv4(),
          buyOrderId: bestBuy.orderId,
          sellOrderId: bestSell.orderId,
          price: tradePrice,
          quantity: tradeQuantity,
          timestamp: new Date().toISOString(),
          side: 'buy' // Taker side
        };

        trades.push(trade);
        mockTrades.push(trade); // Also add to mock trades for API

        // Update orders
        bestBuy.filledQuantity += tradeQuantity;
        bestSell.filledQuantity += tradeQuantity;

        // Remove fully filled orders
        if (bestBuy.filledQuantity >= bestBuy.quantity) {
          bestBuy.status = 'filled';
          this.buyOrders.shift();
        }
        if (bestSell.filledQuantity >= bestSell.quantity) {
          bestSell.status = 'filled';
          this.sellOrders.shift();
        }
      } else {
        break; // No more matches possible
      }
    }
  }

  getOrderBook() {
    const bids = this.buyOrders.slice(0, 20).map(order => [
      order.price.toString(),
      (order.quantity - order.filledQuantity).toString()
    ]);
    
    const asks = this.sellOrders.slice(0, 20).map(order => [
      order.price.toString(),
      (order.quantity - order.filledQuantity).toString()
    ]);

    return { bids, asks };
  }
}

const matchingEngine = new SimpleMatchingEngine();

// API Routes

// Get order book
app.get('/api/v1/orderbook/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Try to get real order book first, fallback to mock
    const realOrderBook = matchingEngine.getOrderBook();
    
    if (realOrderBook.bids.length > 0 || realOrderBook.asks.length > 0) {
      const orderbook = {
        bids: realOrderBook.bids,
        asks: realOrderBook.asks,
        updateId: Date.now(),
        timestamp: Date.now()
      };
      res.json(orderbook);
    } else {
      // Return mock data if no real orders
      const orderbook = {
        bids: mockOrderBook.bids,
        asks: mockOrderBook.asks,
        updateId: Date.now(),
        timestamp: Date.now()
      };
      res.json(orderbook);
    }
  } catch (error) {
    console.error('Error fetching orderbook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get trades
app.get('/api/v1/trades/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Return all trades (both real and mock)
    const allTrades = [...mockTrades];
    
    // Sort by timestamp (most recent last)
    allTrades.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.json(allTrades);
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Place order
app.post('/api/v1/order', (req, res) => {
  try {
    const { baseAsset, quoteAsset, price, quantity, side, type } = req.body;

    // Validation
    if (!baseAsset || !quoteAsset || !quantity || !side) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (type === 'limit' && !price) {
      return res.status(400).json({ error: 'Price required for limit orders' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be positive' });
    }

    if (type === 'limit' && price <= 0) {
      return res.status(400).json({ error: 'Price must be positive' });
    }

    const order = {
      baseAsset,
      quoteAsset,
      price: type === 'limit' ? parseFloat(price) : null,
      quantity: parseFloat(quantity),
      side,
      type
    };

    if (type === 'market') {
      return res.status(400).json({ error: 'Market orders not yet implemented' });
    }

    const placedOrder = matchingEngine.addOrder(order);
    
    console.log('✅ Order placed:', placedOrder);
    
    res.json({
      orderId: placedOrder.orderId,
      side: placedOrder.side,
      type: placedOrder.type,
      price: placedOrder.price,
      quantity: placedOrder.quantity,
      status: placedOrder.status,
      timestamp: placedOrder.timestamp
    });

  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user orders
app.get('/api/v1/orders', (req, res) => {
  try {
    const userOrders = orders.slice(-50); // Get last 50 orders
    res.json(userOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    totalOrders: orders.length,
    totalTrades: trades.length
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Crypto Exchange API',
    version: '1.0.0',
    endpoints: {
      orderbook: '/api/v1/orderbook/:symbol',
      trades: '/api/v1/trades/:symbol',
      order: '/api/v1/order (POST)',
      orders: '/api/v1/orders',
      health: '/health'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Crypto Exchange Server Started!');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log('🎭 Mock market data initialized with:');
  console.log(`📊 ${mockOrderBook.bids.length} bid orders`);
  console.log(`📊 ${mockOrderBook.asks.length} ask orders`); 
  console.log(`📈 ${mockTrades.length} historical trades`);
  console.log('💹 Market data will update every 5 seconds');
  console.log('\n🔗 Available endpoints:');
  console.log(`   GET  ${PORT === 3000 ? 'http://localhost:3000' : `http://localhost:${PORT}`}/api/v1/orderbook/BTC-USD`);
  console.log(`   GET  ${PORT === 3000 ? 'http://localhost:3000' : `http://localhost:${PORT}`}/api/v1/trades/BTC-USD`);
  console.log(`   POST ${PORT === 3000 ? 'http://localhost:3000' : `http://localhost:${PORT}`}/api/v1/order`);
});