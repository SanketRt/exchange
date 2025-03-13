import React, { useState, useEffect } from 'react';
import './TradesTab.css';

const TradesTab = () => {
  const [trades, setTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch trades from API when component mounts
  useEffect(() => {
    // Initially load with simulated data until your API is ready
    setIsLoading(true);
    
    // Mock data for development - replace with actual API call
    const mockTrades = [
      { tradeId: 15, price: 133.48, qty: 54.72, time: new Date().getTime() - 5000, side: 'buy' },
      { tradeId: 14, price: 133.52, qty: 85.05, time: new Date().getTime() - 15000, side: 'sell' },
      { tradeId: 13, price: 133.54, qty: 149.77, time: new Date().getTime() - 25000, side: 'sell' },
      { tradeId: 12, price: 133.50, qty: 36.95, time: new Date().getTime() - 35000, side: 'buy' },
      { tradeId: 11, price: 133.47, qty: 117.22, time: new Date().getTime() - 45000, side: 'buy' },
      { tradeId: 10, price: 133.43, qty: 172.19, time: new Date().getTime() - 55000, side: 'sell' },
      { tradeId: 9, price: 133.38, qty: 22.07, time: new Date().getTime() - 65000, side: 'buy' },
      { tradeId: 8, price: 133.36, qty: 15.13, time: new Date().getTime() - 75000, side: 'buy' },
      { tradeId: 7, price: 133.33, qty: 44.11, time: new Date().getTime() - 85000, side: 'buy' },
      { tradeId: 6, price: 133.31, qty: 64.40, time: new Date().getTime() - 95000, side: 'buy' },
    ];
    
    // Simulate API fetch delay
    setTimeout(() => {
      setTrades(mockTrades);
      setIsLoading(false);
    }, 500);

    // When your API is ready, replace with:
    // fetch('/api/v1/trades')
    //   .then(response => response.json())
    //   .then(data => {
    //     setTrades(data);
    //     setIsLoading(false);
    //   })
    //   .catch(error => {
    //     console.error('Error fetching trades:', error);
    //     setIsLoading(false);
    //   });

    // Set up WebSocket for real-time updates
    // This will need to be integrated with your backend
    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:3001');
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'trades' }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'trade') {
          // Add new trade to the beginning of the list
          setTrades(prevTrades => [data.trade, ...prevTrades.slice(0, 19)]);
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Reconnect after delay
        setTimeout(connectWebSocket, 3000);
      };
      
      return ws;
    };
    
    // Uncomment when WebSocket server is ready
    // const ws = connectWebSocket();
    // return () => {
    //   ws.close();
    // };
  }, []);

  // Format time in HH:MM:SS
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  // Format price with the appropriate color based on side
  const formatPrice = (price, side) => {
    return (
      <span className={side === 'buy' ? 'price-buy' : 'price-sell'}>
        {price.toFixed(2)}
      </span>
    );
  };

  return (
    <div className="trades-tab">
      <div className="trades-header">
        <div className="trades-title">Recent Trades</div>
        <div className="trades-info">BTC/USD</div>
      </div>
      
      <div className="trades-columns">
        <div className="column-header">Price</div>
        <div className="column-header">Size</div>
        <div className="column-header">Time</div>
      </div>
      
      {isLoading ? (
        <div className="trades-loading">Loading trades...</div>
      ) : (
        <div className="trades-list">
          {trades.map(trade => (
            <div key={trade.tradeId} className="trade-row">
              <div className="trade-price">{formatPrice(trade.price, trade.side)}</div>
              <div className="trade-quantity">{trade.qty.toFixed(2)}</div>
              <div className="trade-time">{formatTime(trade.time)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TradesTab;