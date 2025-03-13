# Cryptocurrency Exchange Platform

This project is a cryptocurrency trading platform with a robust order book implementation and real-time data streaming via WebSockets. It consists of a React frontend client and a microservices-based backend architecture.

## Project Structure

```
/Exchange
  /client - React frontend
    /public
    /src
      /components
        OrderForm.js
        OrderBook.js
        TradesTab.js
        DepthChart.js
        PriceChart.js - Candlestick chart component
      /services
        WebSocketService.js - WebSocket client service
      App.js
      index.js
      index.css
      components.css
      App.css
  /orderbook-server - Backend services
    /src
      index.ts - Main server file
      orderbook.ts - Order book implementation
      types.ts - TypeScript types
      server.ts - Express server setup
      websocket.ts - WebSocket server implementation
      matching-engine.ts - Order matching engine
      market-data.ts - Market data service
  architecture.md - Backend architecture documentation
  test-websocket-server.js - WebSocket test server
  test-client.html - WebSocket test client
```

## Setup and Installation

### Backend Setup (orderbook-server)

1. Install dependencies:
   ```
   cd orderbook-server
   npm install
   ```

2. Start the server:
   ```
   npm run start:server
   ```
   This will start the Express server on port 3000.

### Frontend Setup (client)

1. Install dependencies:
   ```
   cd client
   npm install
   ```

2. Start the React development server:
   ```
   npm start
   ```
   This will start the React development server and proxy API requests to the backend server on port 3000.

## Features

- Real-time order book display
- Trade execution with price-time priority matching
- Order placement (market and limit orders)
- Trade history with real-time updates
- Depth chart visualization
- Live candlestick charts with WebSocket data streaming
- Real-time ticker updates
- Microservices architecture for scalability
- Redis-based pub/sub for event distribution

## API Endpoints

- `POST /api/v1/order` - Place a new order
  - Request body: 
    ```json
    {
      "baseAsset": "BTC",
      "quoteAsset": "USD",
      "price": 35000,
      "quantity": 0.5,
      "side": "buy",
      "type": "limit",
      "kind": "ioc" // Optional
    }
    ```
  - Response:
    ```json
    {
      "orderId": "abc123",
      "executedQty": 0.5,
      "fills": [
        {
          "price": 35000,
          "qty": 0.5,
          "tradeId": 1
        }
      ]
    }
    ```

## Development

To work on both the client and server simultaneously, you can use the convenience script in orderbook-server:

```
cd orderbook-server
npm run start
```

This will start both the backend server and the frontend client using concurrently.

### WebSocket Testing

You can test the WebSocket functionality using the test server and client:

```
# Start the test WebSocket server
node test-websocket-server.js

# In another terminal, serve the test client
python -m http.server 8000
```

Then open http://localhost:8000/test-client.html in your browser to view the WebSocket test interface.

## Backend Architecture

The backend is built on a microservices architecture with the following components:

1. **Order Processing Service** - Handles order validation, matching, and execution
2. **Market Data Service** - Manages candlestick generation, ticker, and depth data
3. **WebSocket Gateway** - Provides real-time data streaming to clients
4. **Redis Pub/Sub** - Event bus for inter-service communication

For more details, see [architecture.md](architecture.md).

## License

ISC 