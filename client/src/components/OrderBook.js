import React, { useState, useEffect } from 'react';
import './components.css';

const OrderBook = () => {
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrderBook = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/orderbook');
        if (!response.ok) throw new Error('Failed to fetch order book');
        
        const data = await response.json();
        setOrderBook({
          bids: data.bids || [],
          asks: (data.asks || []).reverse() // Reverse asks for display
        });
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching order book:', error);
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchOrderBook();
    
    // Set up polling
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
    return quantity.toFixed(4);
  };

  const getDepthPercentage = (price, quantity, side) => {
    // Calculate max total across both sides for scaling
    const maxBidTotal = orderBook.bids.length > 0 
      ? Math.max(...orderBook.bids.map(b => b.total)) 
      : 0;
    
    const maxAskTotal = orderBook.asks.length > 0 
      ? Math.max(...orderBook.asks.map(a => a.total)) 
      : 0;
    
    const maxTotal = Math.max(maxBidTotal, maxAskTotal);
    
    if (maxTotal === 0) return 0;
    
    // Price * quantity as percentage of max total
    const percentage = (price * quantity) / maxTotal * 100;
    return Math.min(percentage, 100); // Cap at 100%
  };

  if (isLoading) {
    return <div className="order-book-container loading">Loading order book...</div>;
  }

  return (
    <div className="order-book-container">
      <h2>Order Book</h2>
      <div className="order-book-header">
        <div className="price-col">Price</div>
        <div className="quantity-col">Amount</div>
        <div className="total-col">Total</div>
      </div>
      
      <div className="asks">
        {orderBook.asks.map((ask, index) => (
          <div className="order-row ask" key={`ask-${index}`}>
            <div 
              className="depth-visualization" 
              style={{ width: `${getDepthPercentage(ask.price, ask.quantity, 'ask')}%` }} 
            />
            <div className="price-col ask-price">{formatPrice(ask.price)}</div>
            <div className="quantity-col">{formatQuantity(ask.quantity)}</div>
            <div className="total-col">{formatPrice(ask.total || ask.price * ask.quantity)}</div>
          </div>
        ))}
      </div>
      
      <div className="spread-row">
        <div className="spread-label">
          Spread: {
            orderBook.asks.length > 0 && orderBook.bids.length > 0 
              ? formatPrice(orderBook.asks[orderBook.asks.length - 1].price - orderBook.bids[0].price) 
              : '—'
          }
        </div>
      </div>
      
      <div className="bids">
        {orderBook.bids.map((bid, index) => (
          <div className="order-row bid" key={`bid-${index}`}>
            <div 
              className="depth-visualization" 
              style={{ width: `${getDepthPercentage(bid.price, bid.quantity, 'bid')}%` }} 
            />
            <div className="price-col bid-price">{formatPrice(bid.price)}</div>
            <div className="quantity-col">{formatQuantity(bid.quantity)}</div>
            <div className="total-col">{formatPrice(bid.total || bid.price * bid.quantity)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderBook; 