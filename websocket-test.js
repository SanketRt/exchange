// Simple WebSocket test script
const WebSocket = require('ws');

// Create WebSocket connection to the test server
const socket = new WebSocket('ws://localhost:8080');

// Connection opened
socket.on('open', function() {
  console.log('Connected to WebSocket server');
  
  // Subscribe to trade updates
  socket.send(JSON.stringify({
    action: 'subscribe',
    stream: 'trades@BTC_USDC'
  }));
  
  // Subscribe to ticker updates
  socket.send(JSON.stringify({
    action: 'subscribe',
    stream: 'ticker@BTC_USDC'
  }));
  
  console.log('Subscribed to trades and ticker streams');
});

// Listen for messages
socket.on('message', function(data) {
  const message = JSON.parse(data);
  
  console.log(`\n[${new Date().toISOString()}] New message of type: ${message.type}`);
  
  if (message.type === 'trade') {
    const trade = message.data;
    console.log(`Trade: ${trade.side.toUpperCase()} ${trade.quantity} BTC @ $${trade.price}`);
  }
  else if (message.type === 'ticker') {
    const ticker = message.data;
    console.log(`Price: $${ticker.lastPrice} (${ticker.priceChangePercent > 0 ? '+' : ''}${ticker.priceChangePercent.toFixed(2)}%)`);
  }
  else if (message.type === 'depth') {
    console.log(`Depth update with ${message.data.bids.length} bids and ${message.data.asks.length} asks`);
  }
  else {
    console.log('Message data:', message);
  }
});

// Connection closed
socket.on('close', function() {
  console.log('Connection closed');
});

// Connection error
socket.on('error', function(error) {
  console.log('Connection error:', error);
});

console.log('Starting WebSocket test...');
