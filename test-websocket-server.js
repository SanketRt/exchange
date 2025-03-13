const WebSocket = require('ws');
const http = require('http');

// Create HTTP server
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);
  
  // Send initial connection message
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to test WebSocket server',
    timestamp: Date.now()
  }));
  
  // Subscription handler
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);
      
      if (data.action === 'subscribe') {
        ws.send(JSON.stringify({
          type: 'subscription',
          stream: data.stream,
          status: 'success',
          timestamp: Date.now()
        }));
        
        // If subscribing to trade stream, start sending simulated trade data
        if (data.stream === 'trades@BTC_USDC') {
          startTradeUpdates(ws);
        }
        
        // If subscribing to ticker stream, start sending simulated ticker data
        if (data.stream === 'ticker@BTC_USDC') {
          startTickerUpdates(ws);
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
});

// Generate random price within range
function randomPrice(base, range) {
  return base + (Math.random() * range * 2 - range);
}

// Simulated trade updates
function startTradeUpdates(ws) {
  const basePrice = 62500;
  let tradeId = 1;
  
  const interval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(interval);
      return;
    }
    
    const price = randomPrice(basePrice, 50);
    const quantity = Math.random() * 0.5;
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    
    const trade = {
      type: 'trade',
      stream: 'trades@BTC_USDC',
      data: {
        tradeId: tradeId++,
        price: price,
        quantity: quantity,
        side: side,
        timestamp: Date.now(),
        symbol: 'BTC_USDC'
      }
    };
    
    ws.send(JSON.stringify(trade));
  }, 2000); // Send a trade update every 2 seconds
}

// Simulated ticker updates
function startTickerUpdates(ws) {
  const basePrice = 62500;
  
  const interval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(interval);
      return;
    }
    
    const price = randomPrice(basePrice, 100);
    const priceChange = price - basePrice;
    const priceChangePercent = (priceChange / basePrice) * 100;
    
    const ticker = {
      type: 'ticker',
      stream: 'ticker@BTC_USDC',
      data: {
        symbol: 'BTC_USDC',
        lastPrice: price,
        priceChange: priceChange,
        priceChangePercent: priceChangePercent,
        volume: Math.random() * 100,
        quoteVolume: Math.random() * 6000000,
        timestamp: Date.now()
      }
    };
    
    ws.send(JSON.stringify(ticker));
  }, 1000); // Send a ticker update every second
}

// Broadcast to all connected clients
function broadcast(data) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Start the server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

// Every 30 seconds, simulate a market depth update for all clients
setInterval(() => {
  const depthUpdate = {
    type: 'depth',
    stream: 'depth@BTC_USDC',
    data: {
      symbol: 'BTC_USDC',
      lastUpdateId: Date.now(),
      bids: [
        [randomPrice(62400, 50), Math.random() * 2],
        [randomPrice(62350, 50), Math.random() * 3],
        [randomPrice(62300, 50), Math.random() * 5]
      ],
      asks: [
        [randomPrice(62600, 50), Math.random() * 2],
        [randomPrice(62650, 50), Math.random() * 3],
        [randomPrice(62700, 50), Math.random() * 5]
      ],
      timestamp: Date.now()
    }
  };
  
  broadcast(depthUpdate);
}, 30000);
