import React, { useState, useEffect, useRef } from 'react';

const OrderBook = () => {
  const [orderBook, setOrderBook] = useState({
    bids: [],
    asks: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [spread, setSpread] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [animatingRows, setAnimatingRows] = useState(new Set());
  const prevOrderBookRef = useRef({ bids: [], asks: [] });

  useEffect(() => {
    const fetchOrderBook = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/v1/orderbook/BTC-USD');
        
        if (!response.ok) {
          throw new Error('Failed to fetch order book');
        }
        
        const data = await response.json();
        
        // Process the order book data
        const processedBids = data.bids.map(bid => ({
          price: parseFloat(bid[0] || bid.price),
          quantity: parseFloat(bid[1] || bid.quantity),
          total: 0
        }));
        
        const processedAsks = data.asks.map(ask => ({
          price: parseFloat(ask[0] || ask.price),
          quantity: parseFloat(ask[1] || ask.quantity),
          total: 0
        }));

        // Calculate cumulative totals
        let bidTotal = 0;
        processedBids.forEach(bid => {
          bidTotal += bid.quantity;
          bid.total = bidTotal;
        });

        let askTotal = 0;
        processedAsks.forEach(ask => {
          askTotal += ask.quantity;
          ask.total = askTotal;
        });

        // Calculate spread
        let calculatedSpread = null;
        if (processedBids.length > 0 && processedAsks.length > 0) {
          const bestBid = processedBids[0].price;
          const bestAsk = processedAsks[0].price;
          calculatedSpread = bestAsk - bestBid;
        }

        // Detect changes for animation
        const newAnimatingRows = new Set();
        const prevBids = prevOrderBookRef.current.bids;
        const prevAsks = prevOrderBookRef.current.asks;
        
        // Check for changes in bids
        processedBids.slice(0, 15).forEach((bid, index) => {
          const prevBid = prevBids[index];
          if (!prevBid || prevBid.price !== bid.price || prevBid.quantity !== bid.quantity) {
            newAnimatingRows.add(`bid-${index}`);
          }
        });
        
        // Check for changes in asks
        processedAsks.slice(0, 15).forEach((ask, index) => {
          const prevAsk = prevAsks[index];
          if (!prevAsk || prevAsk.price !== ask.price || prevAsk.quantity !== ask.quantity) {
            newAnimatingRows.add(`ask-${index}`);
          }
        });

        const newOrderBook = {
          bids: processedBids.slice(0, 15),
          asks: processedAsks.slice(0, 15)
        };

        setOrderBook(newOrderBook);
        setSpread(calculatedSpread);
        setLastUpdate(Date.now());
        setAnimatingRows(newAnimatingRows);
        setIsLoading(false);

        // Store current data for next comparison
        prevOrderBookRef.current = newOrderBook;

        // Clear animations after delay
        setTimeout(() => {
          setAnimatingRows(new Set());
        }, 1000);

      } catch (error) {
        console.error('Error fetching order book:', error);
        setIsLoading(false);
      }
    };

    fetchOrderBook();
    const interval = setInterval(fetchOrderBook, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatQuantity = (quantity) => {
    return parseFloat(quantity).toFixed(4);
  };

  const getDepthPercentage = (total, maxTotal) => {
    return maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  };

  const formatLastUpdate = () => {
    const now = Date.now();
    const diff = now - lastUpdate;
    if (diff < 5000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    return `${Math.floor(diff / 60000)}m ago`;
  };

  if (isLoading) {
    return (
      <div className="orderbook">
        <div className="loading">
          <div className="loading-spinner"></div>
          <span>Loading order book...</span>
        </div>
      </div>
    );
  }

  const maxBidTotal = orderBook.bids.length > 0 ? Math.max(...orderBook.bids.map(b => b.total)) : 0;
  const maxAskTotal = orderBook.asks.length > 0 ? Math.max(...orderBook.asks.map(a => a.total)) : 0;

  return (
    <div className="orderbook">
      <div className="orderbook-header">
        <h3>Order Book</h3>
        <div className="orderbook-meta">
          {spread !== null && (
            <div className="spread-info">
              Spread: {formatPrice(spread)}
            </div>
          )}
          <div className="last-update">
            {formatLastUpdate()}
          </div>
        </div>
      </div>

      <div className="orderbook-header-row">
        <div>Price (USD)</div>
        <div>Size (BTC)</div>
        <div>Total</div>
      </div>

      {/* Asks (Sell Orders) */}
      <div className="asks">
        <div className="section-label asks-label">
          <span>ASKS</span>
          <span className="order-count">({orderBook.asks.length})</span>
        </div>
        {orderBook.asks.length === 0 ? (
          <div className="no-orders">No sell orders</div>
        ) : (
          orderBook.asks
            .slice().reverse() // Show highest price first
            .map((ask, reverseIndex) => {
              const index = orderBook.asks.length - 1 - reverseIndex;
              const isAnimating = animatingRows.has(`ask-${index}`);
              return (
                <div 
                  key={`ask-${index}`} 
                  className={`order-row ask-row ${isAnimating ? 'updating' : ''}`}
                  style={{
                    '--depth-percent': getDepthPercentage(ask.total, maxAskTotal) / 100
                  }}
                >
                  <div className="price ask-price">{formatPrice(ask.price)}</div>
                  <div className="quantity">{formatQuantity(ask.quantity)}</div>
                  <div className="total">{formatQuantity(ask.total)}</div>
                </div>
              );
            })
        )}
      </div>

      {/* Spread Display */}
      {spread !== null && orderBook.bids.length > 0 && orderBook.asks.length > 0 && (
        <div className="spread">
          <div className="spread-value">
            {formatPrice(spread)}
          </div>
          <div className="spread-percent">
            ({((spread / ((orderBook.bids[0]?.price || 0) + (orderBook.asks[0]?.price || 0)) / 2) * 100).toFixed(3)}%)
          </div>
        </div>
      )}

      {/* Bids (Buy Orders) */}
      <div className="bids">
        <div className="section-label bids-label">
          <span>BIDS</span>
          <span className="order-count">({orderBook.bids.length})</span>
        </div>
        {orderBook.bids.length === 0 ? (
          <div className="no-orders">No buy orders</div>
        ) : (
          orderBook.bids.map((bid, index) => {
            const isAnimating = animatingRows.has(`bid-${index}`);
            return (
              <div 
                key={`bid-${index}`} 
                className={`order-row bid-row ${isAnimating ? 'updating' : ''}`}
                style={{
                  '--depth-percent': getDepthPercentage(bid.total, maxBidTotal) / 100
                }}
              >
                <div className="price bid-price">{formatPrice(bid.price)}</div>
                <div className="quantity">{formatQuantity(bid.quantity)}</div>
                <div className="total">{formatQuantity(bid.total)}</div>
              </div>
            );
          })
        )}
      </div>

      <div className="orderbook-footer">
        <div className="orderbook-stats">
          <div className="stat">
            <span className="stat-label">Best Bid:</span>
            <span className="stat-value bid-color">
              {orderBook.bids.length > 0 ? formatPrice(orderBook.bids[0].price) : '—'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Best Ask:</span>
            <span className="stat-value ask-color">
              {orderBook.asks.length > 0 ? formatPrice(orderBook.asks[0].price) : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderBook;