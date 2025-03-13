import React, { useState, useEffect } from 'react';
import './OrderBook.css';

const OrderBook = () => {
  const [orderbook, setOrderbook] = useState({ bids: [], asks: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [precision, setPrecision] = useState(2); // Decimal precision for price display

  useEffect(() => {
    // Mock data for development - replace with actual API call
    const mockOrderbook = {
      bids: [
        { price: 133.48, quantity: 54.72 },
        { price: 133.47, quantity: 117.22 },
        { price: 133.46, quantity: 37.44 },
        { price: 133.44, quantity: 150.17 },
        { price: 133.43, quantity: 172.19 },
        { price: 133.40, quantity: 153.81 },
        { price: 133.38, quantity: 22.07 },
        { price: 133.37, quantity: 7.33 },
        { price: 133.36, quantity: 15.13 },
        { price: 133.33, quantity: 44.11 }
      ],
      asks: [
        { price: 133.49, quantity: 72.43 },
        { price: 133.50, quantity: 36.95 },
        { price: 133.51, quantity: 149.80 },
        { price: 133.52, quantity: 85.05 },
        { price: 133.53, quantity: 37.44 },
        { price: 133.54, quantity: 149.77 },
        { price: 133.55, quantity: 149.91 },
        { price: 133.59, quantity: 58.66 },
        { price: 133.64, quantity: 52.80 },
        { price: 133.66, quantity: 11.51 }
      ]
    };
    
    setTimeout(() => {
      setOrderbook(mockOrderbook);
      setIsLoading(false);
    }, 500);

    // When your API is ready, replace with:
    // fetch('/api/v1/orderbook')
    //   .then(response => response.json())
    //   .then(data => {
    //     setOrderbook(data);
    //     setIsLoading(false);
    //   })
    //   .catch(error => {
    //     console.error('Error fetching orderbook:', error);
    //     setIsLoading(false);
    //   });
    
    // WebSocket subscription for real-time updates
    // (Same structure as in TradesTab, adapted for orderbook updates)
  }, []);

  // Calculate maximum quantity for visualization
  const maxQuantity = Math.max(
    ...orderbook.bids.map(b => b.quantity),
    ...orderbook.asks.map(a => a.quantity)
  );

  // Calculate depth percentage for visualization bars
  const getDepthPercentage = (quantity) => {
    return (quantity / maxQuantity) * 100;
  };

  // Change precision handler
  const handlePrecisionChange = (newPrecision) => {
    setPrecision(newPrecision);
  };

  return (
    <div className="orderbook">
      <div className="orderbook-header">
        <div className="precision-controls">
          <button 
            className={precision === 0 ? 'active' : ''} 
            onClick={() => handlePrecisionChange(0)}
          >
            0
          </button>
          <button 
            className={precision === 1 ? 'active' : ''} 
            onClick={() => handlePrecisionChange(1)}
          >
            1
          </button>
          <button 
            className={precision === 2 ? 'active' : ''} 
            onClick={() => handlePrecisionChange(2)}
          >
            2
          </button>
        </div>
      </div>

      <div className="orderbook-columns">
        <div className="column-header">Price</div>
        <div className="column-header">Size</div>
        <div className="column-header">Total</div>
      </div>
      
      {isLoading ? (
        <div className="orderbook-loading">Loading order book...</div>
      ) : (
        <>
          <div className="asks">
            {orderbook.asks.slice().reverse().map((ask, index) => (
              <div key={`ask-${index}`} className="order-row ask-row">
                <div className="depth-visualization">
                  <div 
                    className="depth-bar ask-bar" 
                    style={{ width: `${getDepthPercentage(ask.quantity)}%` }}
                  />
                </div>
                <div className="price ask-price">{ask.price.toFixed(precision)}</div>
                <div className="quantity">{ask.quantity.toFixed(2)}</div>
                <div className="total">{(ask.price * ask.quantity).toFixed(2)}</div>
              </div>
            ))}
          </div>
          
          <div className="spread">
            <span>Spread: {(orderbook.asks[0].price - orderbook.bids[0].price).toFixed(precision)}</span>
            <span>({((orderbook.asks[0].price / orderbook.bids[0].price - 1) * 100).toFixed(2)}%)</span>
          </div>
          
          <div className="bids">
            {orderbook.bids.map((bid, index) => (
              <div key={`bid-${index}`} className="order-row bid-row">
                <div className="depth-visualization">
                  <div 
                    className="depth-bar bid-bar" 
                    style={{ width: `${getDepthPercentage(bid.quantity)}%` }}
                  />
                </div>
                <div className="price bid-price">{bid.price.toFixed(precision)}</div>
                <div className="quantity">{bid.quantity.toFixed(2)}</div>
                <div className="total">{(bid.price * bid.quantity).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default OrderBook;