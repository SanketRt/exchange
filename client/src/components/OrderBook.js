import React, { useState, useEffect } from 'react';
import './components.css';

const OrderBook = () => {
  const [orderBook, setOrderBook] = useState({
    bids: [],
    asks: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [spread, setSpread] = useState(null);

  useEffect(() => {
    const fetchOrderBook = async () => {
      try {
        // Fixed: Use the correct API endpoint
        const response = await fetch('http://localhost:3000/api/v1/orderbook/BTC-USD');
        
        if (!response.ok) {
          throw new Error('Failed to fetch order book');
        }
        
        const data = await response.json();
        
        // Process the order book data
        const processedBids = data.bids.map(bid => ({
          price: parseFloat(bid[0] || bid.price),
          quantity: parseFloat(bid[1] || bid.quantity),
          total: 0 // Will be calculated below
        }));
        
        const processedAsks = data.asks.map(ask => ({
          price: parseFloat(ask[0] || ask.price),
          quantity: parseFloat(ask[1] || ask.quantity),
          total: 0 // Will be calculated below
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

        setOrderBook({
          bids: processedBids.slice(0, 20), // Show top 20
          asks: processedAsks.slice(0, 20)  // Show top 20
        });
        setSpread(calculatedSpread);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching order book:', error);
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchOrderBook();
    
    // Poll for updates every 1 second
    const interval = setInterval(fetchOrderBook, 1000);
    
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

  if (isLoading) {
    return (
      <div className="orderbook">
        <div className="loading">Loading order book...</div>
      </div>
    );
  }

  const maxBidTotal = orderBook.bids.length > 0 ? Math.max(...orderBook.bids.map(b => b.total)) : 0;
  const maxAskTotal = orderBook.asks.length > 0 ? Math.max(...orderBook.asks.map(a => a.total)) : 0;

  return (
    <div className="orderbook">
      <div className="orderbook-header">
        <h3>Order Book</h3>
        {spread !== null && (
          <div className="spread-info">
            Spread: {formatPrice(spread)}
          </div>
        )}
      </div>

      <div className="orderbook-header-row">
        <div>Price</div>
        <div>Quantity</div>
        <div>Total</div>
      </div>

      {/* Asks (Sell Orders) */}
      <div className="asks">
        <div className="section-label asks-label">Asks (Sell)</div>
        {orderBook.asks.length === 0 ? (
          <div className="no-orders">No asks available</div>
        ) : (
          orderBook.asks
            .slice().reverse() // Show highest price first
            .map((ask, index) => (
              <div 
                key={`ask-${index}`} 
                className="order-row ask-row"
                style={{
                  '--depth-percent': getDepthPercentage(ask.total, maxAskTotal) / 100
                }}
              >
                <div className="price ask-price">{formatPrice(ask.price)}</div>
                <div className="quantity">{formatQuantity(ask.quantity)}</div>
                <div className="total">{formatQuantity(ask.total)}</div>
              </div>
            ))
        )}
      </div>

      {/* Spread Display */}
      {spread !== null && (
        <div className="spread">
          Spread: {formatPrice(spread)} ({((spread / ((orderBook.bids[0]?.price || 0) + (orderBook.asks[0]?.price || 0)) / 2) * 100).toFixed(3)}%)
        </div>
      )}

      {/* Bids (Buy Orders) */}
      <div className="bids">
        <div className="section-label bids-label">Bids (Buy)</div>
        {orderBook.bids.length === 0 ? (
          <div className="no-orders">No bids available</div>
        ) : (
          orderBook.bids.map((bid, index) => (
            <div 
              key={`bid-${index}`} 
              className="order-row bid-row"
              style={{
                '--depth-percent': getDepthPercentage(bid.total, maxBidTotal) / 100
              }}
            >
              <div className="price bid-price">{formatPrice(bid.price)}</div>
              <div className="quantity">{formatQuantity(bid.quantity)}</div>
              <div className="total">{formatQuantity(bid.total)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default OrderBook;