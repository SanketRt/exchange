const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3001', // React dev server
  credentials: true
}));
app.use(express.json());

// Simple ID generator (instead of uuid)
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Mock data generators
const generateMockTrades = () => {
  const trades = [];
  const basePrice = 45000 + Math.random() * 10000; // Realistic BTC range
  
  for (let i = 0; i < 100; i++) {
    // Multiple noise layers for realistic price movements
    const microMove = (Math.random() - 0.5) * 0.002; // 0.2% micro moves
    const smallMove = (Math.random() - 0.5) * 0.005; // 0.5% small moves
    const mediumMove = (Math.random() - 0.5) * 0.012; // 1.2% medium moves
    
    // Occasional larger moves (10% chance)
    const largeMove = Math.random() < 0.1 ? (Math.random() - 0.5) * 0.025 : 0;
    
    // Random walk bias (weak trend)
    const walkBias = Math.random() < 0.15 ? (Math.random() - 0.5) * 0.008 : 0;
    
    // Market maker spread simulation
    const spreadNoise = (Math.random() - 0.5) * 0.001;
    
    const totalVariance = microMove + smallMove + mediumMove + largeMove + walkBias + spreadNoise;
    const price = basePrice * (1 + totalVariance);
    
    // Realistic quantity with noise
    const baseQuantity = 0.01 + Math.random() * 0.15; // 0.01 to 0.16 BTC
    const quantityNoise = Math.random() < 0.3 ? Math.random() * 0.5 : 0; // 30% chance of larger order
    const quantity = baseQuantity + quantityNoise;
    
    // More realistic side distribution (slight buy bias in bull markets)
    const side = Math.random() > 0.48 ? 'buy' : 'sell'; // 52% buy, 48% sell
    
    trades.push({
      tradeId: `trade_${generateId()}`,
      price: price.toFixed(2),
      quantity: quantity.toFixed(4),
      side: side,
      timestamp: new Date(Date.now() - (i * Math.random() * 60000)).toISOString() // Random time distribution
    });
  }
  
  return trades.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

const generateMockOrderBook = () => {
  const midPrice = 45000 + Math.random() * 10000; // Realistic BTC range
  const bids = [];
  const asks = [];
  
  // Generate bids (buy orders) with realistic noise
  for (let i = 0; i < 25; i++) {
    // Non-linear price gaps (closer prices have smaller gaps)
    const baseGap = 5 + (i * 2); // Start with $5 gaps, increase
    const gapNoise = (Math.random() - 0.5) * 3; // ±$1.50 noise
    const priceGap = baseGap + gapNoise;
    
    const price = midPrice - (priceGap * (i + 1));
    
    // Realistic quantity distribution (more noise)
    const baseQuantity = 0.01 + Math.random() * 0.3; // 0.01 to 0.31 BTC
    const quantityNoise = Math.random() < 0.2 ? Math.random() * 1.5 : 0; // 20% chance of whale order
    const quantity = baseQuantity + quantityNoise;
    
    bids.push([price.toFixed(2), quantity.toFixed(4)]);
  }
  
  // Generate asks (sell orders) with realistic noise
  for (let i = 0; i < 25; i++) {
    const baseGap = 5 + (i * 2);
    const gapNoise = (Math.random() - 0.5) * 3;
    const priceGap = baseGap + gapNoise;
    
    const price = midPrice + (priceGap * (i + 1));
    
    const baseQuantity = 0.01 + Math.random() * 0.3;
    const quantityNoise = Math.random() < 0.2 ? Math.random() * 1.5 : 0;
    const quantity = baseQuantity + quantityNoise;
    
    asks.push([price.toFixed(2), quantity.toFixed(4)]);
  }
  
  return { bids, asks };
};

// API Routes
app.get('/api/v1/trades/:symbol', (req, res) => {
  try {
    console.log(`📊 Fetching trades for ${req.params.symbol}`);
    const trades = generateMockTrades();
    res.json(trades);
  } catch (error) {
    console.error('Error generating trades:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

app.get('/api/v1/orderbook/:symbol', (req, res) => {
  try {
    console.log(`📈 Fetching order book for ${req.params.symbol}`);
    const orderBook = generateMockOrderBook();
    res.json(orderBook);
  } catch (error) {
    console.error('Error generating order book:', error);
    res.status(500).json({ error: 'Failed to fetch order book' });
  }
});

app.post('/api/v1/order', (req, res) => {
  try {
    const { baseAsset, quoteAsset, price, quantity, side, type } = req.body;
    
    console.log(`💰 Placing ${side} order:`, { price, quantity, type });
    
    // Validate required fields
    if (!price || !quantity || !side) {
      return res.status(400).json({ 
        error: 'Missing required fields: price, quantity, side' 
      });
    }
    
    // Mock order response
    const order = {
      orderId: `order_${generateId()}`,
      baseAsset: baseAsset || 'BTC',
      quoteAsset: quoteAsset || 'USD',
      price: parseFloat(price),
      quantity: parseFloat(quantity),
      side,
      type: type || 'limit',
      status: 'filled',
      timestamp: new Date().toISOString(),
      total: (parseFloat(price) * parseFloat(quantity)).toFixed(2)
    };
    
    res.json(order);
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Crypto Exchange Backend',
    version: '1.0.0',
    endpoints: [
      'GET /api/v1/trades/:symbol',
      'GET /api/v1/orderbook/:symbol', 
      'POST /api/v1/order',
      'GET /health'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Crypto Exchange Backend Server`);
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`🕐 Started at: ${new Date().toISOString()}`);
  console.log(`\n📊 Available endpoints:`);
  console.log(`   GET  /api/v1/trades/BTC-USD`);
  console.log(`   GET  /api/v1/orderbook/BTC-USD`);
  console.log(`   POST /api/v1/order`);
  console.log(`   GET  /health`);
  console.log(`   GET  / (info)`);
  console.log(`\n✅ Server ready for connections!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down server...');
  process.exit(0);
});