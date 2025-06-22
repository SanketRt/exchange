import React, { useState, useEffect } from 'react';
import './components.css';

const TradeHistory = () => {
  const [trades, setTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        // Fixed: Use the correct API endpoint
        const response = await fetch('http://localhost:3000/api/v1/trades/BTC-USD');
        
        if (!response.ok) {
          throw new Error('Failed to fetch trades');
        }
        
        const data = await response.json();
        setTrades(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching trades:', error);
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchTrades();
    
    // Poll for updates every 2 seconds
    const interval = setInterval(fetchTrades, 2000);
    
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

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="trades-tab">
        <div className="loading">Loading trades...</div>
      </div>
    );
  }

  return (
    <div className="trades-tab">
      <div className="trades-header">
        <h3>Recent Trades</h3>
        <div className="trade-count">
          {trades.length} trade{trades.length !== 1 ? 's' : ''}
        </div>
      </div>
      
      <div className="trades-container">
        <table className="trades-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Price</th>
              <th>Quantity</th>
              <th>Side</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan="4" className="no-data">
                  No trades available
                </td>
              </tr>
            ) : (
              trades
                .slice(-50) // Show last 50 trades
                .reverse() // Show most recent first
                .map((trade, index) => (
                  <tr 
                    key={trade.tradeId || index} 
                    className={`trade-row ${trade.side === 'buy' ? 'buy-row' : 'sell-row'}`}
                  >
                    <td className="trade-time">
                      <div className="time-display">
                        <span className="time">{formatTime(trade.timestamp)}</span>
                        <span className="date">{formatDate(trade.timestamp)}</span>
                      </div>
                    </td>
                    <td className={`trade-price ${trade.side === 'buy' ? 'buy-price' : 'sell-price'}`}>
                      {formatPrice(trade.price)}
                    </td>
                    <td className="trade-quantity">
                      {formatQuantity(trade.quantity)}
                    </td>
                    <td className={`trade-side ${trade.side}`}>
                      <span className={`side-badge ${trade.side}`}>
                        {trade.side.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
      
      {trades.length > 50 && (
        <div className="trades-footer">
          <span className="trade-note">
            Showing last 50 of {trades.length} trades
          </span>
        </div>
      )}
    </div>
  );
};

export default TradeHistory;