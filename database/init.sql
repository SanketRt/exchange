CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trading_pairs (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) UNIQUE NOT NULL,
    base_asset VARCHAR(10) NOT NULL,
    quote_asset VARCHAR(10) NOT NULL,
    min_quantity DECIMAL(20, 8) DEFAULT 0.00000001,
    min_price DECIMAL(20, 8) DEFAULT 0.00000001,
    price_precision INTEGER DEFAULT 8,
    quantity_precision INTEGER DEFAULT 8,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    trading_pair_id INTEGER REFERENCES trading_pairs(id),
    order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('market', 'limit')),
    side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8),
    filled_quantity DECIMAL(20, 8) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'cancelled', 'partially_filled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    trading_pair_id INTEGER REFERENCES trading_pairs(id),
    buyer_order_id INTEGER REFERENCES orders(id),
    seller_order_id INTEGER REFERENCES orders(id),
    price DECIMAL(20, 8) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    total DECIMAL(20, 8) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candles (
    trading_pair_id INTEGER REFERENCES trading_pairs(id),
    timeframe VARCHAR(10) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    PRIMARY KEY (trading_pair_id, timeframe, timestamp)
);

CREATE TABLE IF NOT EXISTS user_balances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    asset VARCHAR(10) NOT NULL,
    available DECIMAL(20, 8) DEFAULT 0,
    locked DECIMAL(20, 8) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, asset)
);

SELECT create_hypertable('trades', 'timestamp', if_not_exists => TRUE);

SELECT create_hypertable('candles', 'timestamp', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_trades_trading_pair_timestamp ON trades (trading_pair_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candles_trading_pair_timeframe ON candles (trading_pair_id, timeframe, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_trading_pair_status ON orders (trading_pair_id, status);
CREATE INDEX IF NOT EXISTS idx_user_balances_user_id ON user_balances (user_id);

INSERT INTO trading_pairs (symbol, base_asset, quote_asset, price_precision, quantity_precision)
VALUES ('BTC-USD', 'BTC', 'USD', 2, 8)
ON CONFLICT (symbol) DO NOTHING;

INSERT INTO users (email, password_hash)
VALUES ('test@example.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_balances (user_id, asset, available)
VALUES 
    (1, 'BTC', 1.0),
    (1, 'USD', 50000.0)
ON CONFLICT (user_id, asset) DO NOTHING;