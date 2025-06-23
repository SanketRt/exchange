# Cryptocurrency Exchange Platform

A modern cryptocurrency trading platform with real-time market simulation, featuring interactive candlestick charts, order book visualization, and a complete trading interface. Built with React frontend and Node.js backend with realistic market data simulation.

![Exchange Interface](media/test_frontend.png)
*Live cryptocurrency exchange interface with real-time data updates*

## Current Implementation Status

**Fully Working Features:**
- Real-time candlestick chart with 1-minute intervals
- Interactive order book with live updates
- Trade history with realistic market simulation
- Order placement interface (buy/sell orders)
- Market summary with live price updates
- Professional trading UI with multiple timeframes
- Responsive design for mobile and desktop
- Complete Docker containerization with orchestration
- Production-ready deployment configuration
- Monitoring and observability stack

**Real-time Updates:**
- Price data updates every 3 seconds
- Realistic market noise and volatility simulation
- Dynamic chart scaling for optimal visualization
- Live connection status indicators

## Project Structure

```
/Exchange
  /client           
    /public
    /src
      /components
        OrderForm.js                
        OrderBook.js                
        TradeHistory.js            
        PriceChart.js            
        MarketSummary.js            
      App.js                       
      App.css                      
      index.js
    Dockerfile
    Dockerfile.prod
    nginx.conf
    .dockerignore                   
  /crypto-exchange-backend
    server.js                       
    package.json
    Dockerfile
    Dockerfile.prod
    .dockerignore                   
  /database
    init.sql
    postgresql.conf
  /nginx
    nginx.conf
    /ssl
  /redis
    redis.conf
  /secrets
    db_password.txt
    jwt_secret.txt
    grafana_password.txt
  /scripts
    deploy.sh
    dev.sh
    cleanup.sh
  /monitoring
    prometheus.yml
    /grafana
  docker-compose.yml
  docker-compose.prod.yml
  Makefile
  .env.example
  README.md
  architecture.md                        
  media/
    test_frontend.png
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js (v16 or higher) for development
- npm or yarn package manager

### Development Environment

**Option 1: Using Docker (Recommended)**

1. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd Exchange
   cp .env.example .env
   ```

2. **Quick setup with Makefile:**
   ```bash
   make setup
   ```

3. **Start development services:**
   ```bash
   make dev
   ```

4. **Start application servers:**
   ```bash
   # Terminal 1: Backend
   cd crypto-exchange-backend && npm run dev

   # Terminal 2: Frontend
   cd client && npm start
   ```

**Option 2: Manual Setup**

1. **Backend Setup:**
   ```bash
   cd crypto-exchange-backend
   npm install express cors
   npm start
   ```

2. **Frontend Setup:**
   ```bash
   cd client
   npm install
   npm start
   ```

### Production Deployment

1. **Setup production environment:**
   ```bash
   # Create secrets
   mkdir -p secrets
   echo "your_secure_password" > secrets/db_password.txt
   echo "your_jwt_secret" > secrets/jwt_secret.txt
   echo "your_grafana_password" > secrets/grafana_password.txt
   ```

2. **Deploy production stack:**
   ```bash
   make prod
   ```

3. **Access services:**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3000
   - Monitoring: http://localhost:3001 (Grafana)

## Docker Infrastructure

### Services

- **TimescaleDB**: Time-series database for trading data
- **Redis**: Caching and pub/sub messaging
- **Backend**: Node.js API server with Express
- **Frontend**: React application served by Nginx
- **Nginx**: Reverse proxy with SSL termination
- **Prometheus**: Metrics collection and monitoring
- **Grafana**: Visualization and alerting dashboards

### Available Commands

```bash
# Development
make dev          # Start development services
make dev-stop     # Stop development services
make dev-logs     # View development logs

# Production
make prod         # Deploy production environment
make prod-stop    # Stop production environment
make prod-logs    # View production logs

# Build & Test
make build        # Build all Docker images
make test         # Run test suites
make lint         # Run code linting

# Maintenance
make logs         # Show all service logs
make status       # Check service health
make backup       # Backup database
make clean        # Clean containers and images
make monitor      # Open monitoring dashboards
```

## API Endpoints

### Market Data
```javascript
// Get current order book
GET /api/v1/orderbook/BTC-USD
Response: {
  "bids": [["49500.00", "0.1234"], ...],
  "asks": [["49600.00", "0.0987"], ...]
}

// Get recent trades
GET /api/v1/trades/BTC-USD
Response: [
  {
    "tradeId": "trade_abc123",
    "price": "49550.00",
    "quantity": "0.0500",
    "side": "buy",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
]
```

### Order Management
```javascript
// Place a new order
POST /api/v1/order
Request: {
  "baseAsset": "BTC",
  "quoteAsset": "USD",
  "price": 49500,
  "quantity": 0.1,
  "side": "buy",
  "type": "limit"
}
Response: {
  "orderId": "order_xyz789",
  "status": "filled",
  "price": 49500,
  "quantity": 0.1,
  "total": "4950.00"
}
```

### Health Check
```javascript
// Server status
GET /health
Response: {
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

## Application Components

### PriceChart Component
- **Technology**: Chart.js with candlestick financial charts
- **Features**: 
  - Real-time 1-minute candlestick data
  - Multiple timeframe selection (1H, 1D, 1W, 1M)
  - SMA indicators with toggle controls
  - Dynamic Y-axis scaling for optimal view
  - Professional tooltip with OHLC data
  - Smooth animations and updates

### OrderBook Component
- Real-time bid/ask display
- Price level aggregation
- Visual depth indication
- Spread calculation

### TradeHistory Component
- Recent trades list
- Buy/sell side indicators
- Real-time trade updates
- Price and volume display

### OrderForm Component
- Buy/sell order placement
- Market/limit order types
- Input validation
- Balance calculations

## Development

### Testing the Full Stack

1. **API endpoint testing:**
   ```bash
   # Check server health
   curl http://localhost:3000/health

   # Get market data
   curl http://localhost:3000/api/v1/trades/BTC-USD
   curl http://localhost:3000/api/v1/orderbook/BTC-USD

   # Place a test order
   curl -X POST http://localhost:3000/api/v1/order \
     -H "Content-Type: application/json" \
     -d '{
       "baseAsset": "BTC",
       "quoteAsset": "USD", 
       "price": 49500,
       "quantity": 0.1,
       "side": "buy",
       "type": "limit"
     }'
   ```

2. **Frontend testing:**
   - Access interface at http://localhost:3001 (development) or http://localhost:8080 (production)
   - Verify real-time price updates
   - Test order placement functionality
   - Monitor chart animations and data flow

### Technical Stack

**Frontend:**
- React 18 with functional components and hooks
- Chart.js with financial candlestick charts
- Modern CSS with flexbox/grid layouts
- Responsive design principles
- Nginx for production serving

**Backend:**
- Node.js with Express framework
- RESTful API architecture
- CORS configuration for cross-origin requests
- Real-time data generation algorithms

**Infrastructure:**
- Docker containerization
- TimescaleDB for time-series data
- Redis for caching and pub/sub
- Nginx reverse proxy with SSL
- Prometheus and Grafana monitoring

**Data Simulation:**
- Multi-layered price noise generation
- Realistic order book simulation
- Natural trade flow patterns
- Dynamic market conditions

## Market Simulation Details

### Price Generation Algorithm
- **Base Price Range**: 45,000 - 55,000 USD (realistic BTC levels)
- **Noise Layers**: 
  - Micro movements: ±0.2%
  - Small movements: ±0.5% 
  - Medium movements: ±1.2%
  - Large movements: ±2.5% (5% probability)
- **Market Bias**: Weak trending with random walk
- **Update Frequency**: Every 3 seconds with continuous data generation

### Order Book Simulation
- **Spread Management**: Dynamic bid/ask spreads with market maker simulation
- **Depth Levels**: 25 price levels on each side
- **Quantity Distribution**: Realistic order sizes with occasional whale orders
- **Price Gaps**: Non-linear spacing with market noise

## Performance Features

- **Optimized Rendering**: Chart updates without full re-renders
- **Memory Management**: Limited dataset size (120 candles max)
- **Efficient API Calls**: Batched requests and error handling
- **Responsive Updates**: Smooth 3-second refresh cycle
- **Dynamic Scaling**: Auto-adjusting chart scales for optimal viewing
- **Container Resource Limits**: Optimized memory and CPU allocation
- **Database Indexing**: Efficient queries for time-series data
- **Caching Strategy**: Redis-based caching for frequently accessed data

## Security Features

- **Container Security**: Non-root user execution, minimal base images
- **Network Security**: Internal Docker networks, rate limiting, CORS protection
- **Data Security**: Encrypted connections, JWT authentication, secrets management
- **SSL/TLS**: Production-ready SSL termination and security headers
- **Input Validation**: Comprehensive validation for all API endpoints

## Monitoring and Observability

- **Prometheus Metrics**: Custom trading metrics and system performance
- **Grafana Dashboards**: Trading analytics and infrastructure monitoring
- **Health Checks**: Automated service health monitoring
- **Logging**: Structured logging with configurable levels
- **Alerting**: Configurable alerts for system and business metrics