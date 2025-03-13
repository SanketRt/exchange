import React, { useState, useEffect } from 'react';
import './OrderForm.css';

const OrderForm = () => {
  const [orderType, setOrderType] = useState('limit');
  const [side, setSide] = useState('buy');
  const [price, setPrice] = useState('133.48');
  const [quantity, setQuantity] = useState('');
  const [total, setTotal] = useState('0.00');
  const [iocEnabled, setIocEnabled] = useState(false);
  const [postOnlyEnabled, setPostOnlyEnabled] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null);
  
  // Available balance - in a real app, this would come from your API
  const availableBalance = 36.94;
  
  // Update price from market data (in a real app, this would be from a WebSocket)
  useEffect(() => {
    // Simulate WebSocket updates
    const interval = setInterval(() => {
      // Small random price fluctuation for demonstration
      const priceChange = (Math.random() - 0.5) * 0.02;
      const newMarketPrice = (parseFloat(price) + priceChange).toFixed(2);
      
      // Only update price if market order selected or no price entered yet
      if (orderType === 'market') {
        setPrice(newMarketPrice);
        updateTotal(newMarketPrice, quantity);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [orderType, price, quantity]);
  
  // Calculate total when price or quantity changes
  const updateTotal = (newPrice, newQuantity) => {
    const calculatedTotal = parseFloat(newPrice) * parseFloat(newQuantity || 0);
    return isNaN(calculatedTotal) ? '0.00' : calculatedTotal.toFixed(2);
  };
  
  const handlePriceChange = (e) => {
    const newPrice = e.target.value;
    setPrice(newPrice);
    setTotal(updateTotal(newPrice, quantity));
  };
  
  const handleQuantityChange = (e) => {
    const newQuantity = e.target.value;
    setQuantity(newQuantity);
    setTotal(updateTotal(price, newQuantity));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate input
    if (!quantity || parseFloat(quantity) <= 0) {
      setOrderStatus({ type: 'error', message: 'Please enter a valid quantity.' });
      return;
    }
    
    if (orderType === 'limit' && (!price || parseFloat(price) <= 0)) {
      setOrderStatus({ type: 'error', message: 'Please enter a valid price.' });
      return;
    }
    
    // Clear previous status
    setOrderStatus(null);
    
    // Create order object matching your API schema
    const order = {
      baseAsset: 'BTC',
      quoteAsset: 'USD',
      price: parseFloat(price),
      quantity: parseFloat(quantity),
      side: side,
      type: orderType
    };
    
    // Add optional IOC parameter if enabled
    if (iocEnabled) {
      order.kind = 'ioc';
    }
    
    // Log the order (replace with API call)
    console.log('Submitting order:', order);
    
    // Set loading status
    setOrderStatus({ type: 'loading', message: 'Placing order...' });
    
    // Call your API endpoint (this is for demonstration - adjust to your actual API)
    fetch('/api/v1/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Order placement failed. Please try again.');
        }
        return response.json();
      })
      .then(data => {
        console.log('Order placed successfully:', data);
        
        // Set success status
        setOrderStatus({ 
          type: 'success', 
          message: `Order placed successfully. Order ID: ${data.orderId}`
        });
        
        // Reset form
        setQuantity('');
        setTotal('0.00');
        
        // Clear success message after a few seconds
        setTimeout(() => {
          setOrderStatus(null);
        }, 5000);
      })
      .catch(error => {
        console.error('Error placing order:', error);
        
        // Set error status
        setOrderStatus({ 
          type: 'error', 
          message: error.message || 'Failed to place order. Please try again.'
        });
      });
  };
  
  // Handle percentage buttons (25%, 50%, 75%, Max)
  const handlePercentage = (percent) => {
    if (side === 'buy') {
      // For buy orders, calculate max quantity based on available USDC
      const maxAmount = availableBalance * (percent / 100);
      const maxQuantity = maxAmount / parseFloat(price);
      const formattedQuantity = maxQuantity.toFixed(5);
      setQuantity(formattedQuantity);
      setTotal(updateTotal(price, formattedQuantity));
    } else {
      // For sell orders, we would calculate based on available BTC
      // This is just a placeholder - in a real app, you'd get the BTC balance from your API
      const availableBTC = 0.25; // Example value
      const maxQuantity = availableBTC * (percent / 100);
      const formattedQuantity = maxQuantity.toFixed(5);
      setQuantity(formattedQuantity);
      setTotal(updateTotal(price, formattedQuantity));
    }
  };
  
  // Handle order type change
  const handleOrderTypeChange = (type) => {
    setOrderType(type);
    
    // For market orders, disable IOC and Post Only options
    if (type === 'market') {
      setIocEnabled(false);
      setPostOnlyEnabled(false);
    }
  };
  
  return (
    <div className="order-form">
      <div className="order-type-tabs">
        <button 
          className={orderType === 'limit' ? 'active' : ''}
          onClick={() => handleOrderTypeChange('limit')}
        >
          Limit
        </button>
        <button 
          className={orderType === 'market' ? 'active' : ''}
          onClick={() => handleOrderTypeChange('market')}
        >
          Market
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="buy-sell-tabs">
          <button 
            type="button"
            className={`buy-tab ${side === 'buy' ? 'active' : ''}`}
            onClick={() => setSide('buy')}
          >
            Buy
          </button>
          <button 
            type="button"
            className={`sell-tab ${side === 'sell' ? 'active' : ''}`}
            onClick={() => setSide('sell')}
          >
            Sell
          </button>
        </div>
        
        <div className="balance-info">
          <span>Available Balance</span>
          <span>{availableBalance} USDC</span>
        </div>
        
        <div className="form-group">
          <label>Price</label>
          <div className="input-with-suffix">
            <input
              type="text"
              value={price}
              onChange={handlePriceChange}
              disabled={orderType === 'market'}
              placeholder="0.00"
            />
            <span className="input-suffix">USDC</span>
          </div>
        </div>
        
        <div className="form-group">
          <label>Quantity</label>
          <div className="input-with-suffix">
            <input
              type="text"
              value={quantity}
              onChange={handleQuantityChange}
              placeholder="0.00"
            />
            <span className="input-suffix">BTC</span>
          </div>
        </div>
        
        <div className="percentage-buttons">
          <button type="button" onClick={() => handlePercentage(25)}>25%</button>
          <button type="button" onClick={() => handlePercentage(50)}>50%</button>
          <button type="button" onClick={() => handlePercentage(75)}>75%</button>
          <button type="button" onClick={() => handlePercentage(100)}>Max</button>
        </div>
        
        {orderType === 'limit' && (
          <div className="order-options">
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="ioc-option"
                checked={iocEnabled}
                onChange={() => setIocEnabled(!iocEnabled)}
              />
              <label htmlFor="ioc-option">IOC</label>
            </div>
            
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="post-only-option"
                checked={postOnlyEnabled && !iocEnabled}
                onChange={() => setPostOnlyEnabled(!postOnlyEnabled)}
                disabled={iocEnabled}
              />
              <label htmlFor="post-only-option">Post Only</label>
            </div>
          </div>
        )}
        
        <div className="order-summary">
          <div className="summary-row">
            <span className="label">Total</span>
            <span className="value">{total} USDC</span>
          </div>
        </div>
        
        {orderStatus && (
          <div className={`order-status ${orderStatus.type}`}>
            {orderStatus.message}
          </div>
        )}
        
        <button
          type="submit"
          className={`submit-button ${side}`}
        >
          {side === 'buy' ? 'Buy BTC' : 'Sell BTC'}
        </button>
      </form>
    </div>
  );
};

export default OrderForm;