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
      database.ts - Database configuration and TimescaleDB setup
  architecture.md - Backend architecture documentation
  test-websocket-server.js - WebSocket test server
  test-client.html - WebSocket test client
```

## Setup and Installation

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v14 or higher)
- Redis server
- TimescaleDB extension (optional, for enhanced time-series performance)

### Backend Setup (orderbook-server)

1. Install dependencies:
   ```
   cd orderbook-server
   npm install
   ```

2. Configure environment variables:
   ```bash
   # Create .env file with your database credentials
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=exchange
   NODE_ENV=development
   ```

3. Start PostgreSQL and Redis services:
   ```bash
   # Start PostgreSQL (varies by system)
   sudo systemctl start postgresql
   
   # Start Redis
   redis-server
   ```

4. Start the server:
   ```
   npm run start:server
   ```
   This will start the Express server on port 3000.

**Note on TimescaleDB:** The application will attempt to use TimescaleDB for optimized time-series performance but will gracefully fall back to standard PostgreSQL tables if TimescaleDB is not available.

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
- TimescaleDB optimization for time-series data (optional)

## API Endpoints

### Order Management
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

### Market Data
- `GET /api/v1/orderbook/{market}` - Get current order book
  - Example: `/api/v1/orderbook/BTC-USD`
  - Response:
    ```json
    {
      "bids": [["35000", "0.5"]],
      "asks": [["36000", "0.3"]],
      "updateId": 123,
      "timestamp": 1640995200000
    }
    ```

- `GET /api/v1/trades/{market}` - Get recent trades
  - Example: `/api/v1/trades/BTC-USD`
  - Response:
    ```json
    [
      {
        "price": "35000",
        "quantity": "0.5",
        "timestamp": 1640995200000,
        "side": "buy"
      }
    ]
    ```

- `GET /api/v1/ticker/{market}` - Get 24h ticker statistics (if implemented)
- `GET /api/v1/candles/{market}` - Get candlestick data (if implemented)

## Development

To work on both the client and server simultaneously, you can use the convenience script in orderbook-server:

```
cd orderbook-server
npm run start
```

This will start both the backend server and the frontend client using concurrently.

### Testing the API

You can test the core functionality using curl:

```bash
# Place a buy order
curl -X POST http://localhost:3000/api/v1/order \
  -H "Content-Type: application/json" \
  -d '{
    "baseAsset": "BTC",
    "quoteAsset": "USD",
    "price": 35000,
    "quantity": 0.5,
    "side": "buy",
    "type": "limit"
  }'

# Check the order book
curl http://localhost:3000/api/v1/orderbook/BTC-USD

# Place a matching sell order
curl -X POST http://localhost:3000/api/v1/order \
  -H "Content-Type: application/json" \
  -d '{
    "baseAsset": "BTC",
    "quoteAsset": "USD",
    "price": 35000,
    "quantity": 0.3,
    "side": "sell",
    "type": "limit"
  }'

# Check if trades were executed
curl http://localhost:3000/api/v1/trades/BTC-USD
```

### WebSocket Testing

You can test the WebSocket functionality using the test server and client:

```
# Start the test WebSocket server
node test-websocket-server.js

# In another terminal, serve the test client
python -m http.server 8000
```

Then open http://localhost:8000/test-client.html in your browser to view the WebSocket test interface.

## Troubleshooting

### TimescaleDB Issues
If you encounter TimescaleDB extension errors:
- The application will automatically fall back to standard PostgreSQL
- For production use, consider installing TimescaleDB for better performance:
  ```bash
  # Ubuntu/Debian
  curl -s https://packagecloud.io/install/repositories/timescale/timescaledb/script.deb.sh | sudo bash
  sudo apt install timescaledb-2-postgresql-16
  ```

### Database Connection Issues
- Ensure PostgreSQL is running and accessible
- Verify your `.env` file has correct database credentials
- Check if the database `exchange` exists

### Redis Connection Issues
- Ensure Redis server is running: `redis-server`
- Check Redis connection: `redis-cli ping`

## Backend Architecture

The backend is built on a microservices architecture with the following components:

1. **Order Processing Service** - Handles order validation, matching, and execution
2. **Market Data Service** - Manages candlestick generation, ticker, and depth data
3. **WebSocket Gateway** - Provides real-time data streaming to clients
4. **Redis Pub/Sub** - Event bus for inter-service communication
5. **Database Layer** - PostgreSQL with optional TimescaleDB for time-series optimization

For more details, see [architecture.md](architecture.md).