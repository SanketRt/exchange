import React, { useState, useEffect } from 'react';
import './components.css';

const TradeHistory = () => {
  const [trades, setTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/trades');
        if (!response.ok) throw new Error('Failed to fetch trades');
        
        const data = await response.json();
        setTrades(data.reverse() || []); // Most recent first
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching trades:', error);
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchTrades();
    
    // Set up polling
    const interval = setInterval(fetchTrades, 1000);
    
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

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (isLoading) {
    return <div className="trade-history-container loading">Loading trades...</div>;
  }

  return (
    <div className="trade-history-container">
      <h2>Recent Trades</h2>
      <div className="trade-history-header">
        <div className="time-col">Time</div>
        <div className="price-col">Price</div>
        <div className="amount-col">Amount</div>
      </div>
      
      <div className="trade-list">
        {trades.length > 0 ? (
          trades.map((trade) => (
            <div 
              key={trade.tradeId} 
              className={`trade-row ${trade.side === 'buy' ? 'buy' : 'sell'}`}
            >
              <div className="time-col">{formatTime(trade.timestamp)}</div>
              <div className="price-col">{formatPrice(trade.price)}</div>
              <div className="amount-col">{trade.quantity.toFixed(4)}</div>
            </div>
          ))
        ) : (
          <div className="no-trades">No trades yet</div>
        )}
      </div>
    </div>
  );
};

export default TradeHistory; 