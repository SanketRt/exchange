import React, { useState } from 'react';
import './components.css';

const OrderForm = () => {
  const [orderData, setOrderData] = useState({
    baseAsset: 'BTC',
    quoteAsset: 'USD',
    price: '',
    quantity: '',
    side: 'buy',
    type: 'limit',
  });

  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setOrderData({ ...orderData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setIsSubmitting(true);

    try {
      // Validate inputs
      const price = parseFloat(orderData.price);
      const quantity = parseFloat(orderData.quantity);

      if (isNaN(price) || price <= 0) {
        throw new Error('Please enter a valid price');
      }
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error('Please enter a valid quantity');
      }

      // Fixed: Use the correct API endpoint
      const response = await fetch('http://localhost:3000/api/v1/order', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseAsset: orderData.baseAsset,
          quoteAsset: orderData.quoteAsset,
          price: price,
          quantity: quantity,
          side: orderData.side,
          type: orderData.type,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${errorText}`);
      }

      const data = await response.json();
      setResult(data);
      
      // Clear form on success
      setOrderData({
        ...orderData,
        price: '',
        quantity: ''
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAmount = (percentage) => {
    // Quick amount buttons for convenience
    const baseAmount = 1.0; // 1 BTC as base
    const amount = (baseAmount * percentage / 100).toFixed(4);
    setOrderData({ ...orderData, quantity: amount });
  };

  return (
    <div className="order-form-container">
      <h2>Place Order</h2>
      <form onSubmit={handleSubmit} className="order-form">
        
        {/* Order Side Selector */}
        <div className="form-row">
          <div className="side-selector">
            <button
              type="button"
              className={`side-button ${orderData.side === 'buy' ? 'buy active' : 'buy'}`}
              onClick={() => setOrderData({ ...orderData, side: 'buy' })}
            >
              Buy
            </button>
            <button
              type="button"
              className={`side-button ${orderData.side === 'sell' ? 'sell active' : 'sell'}`}
              onClick={() => setOrderData({ ...orderData, side: 'sell' })}
            >
              Sell
            </button>
          </div>
        </div>

        {/* Order Type */}
        <div className="form-row">
          <label>Order Type:</label>
          <select 
            name="type" 
            value={orderData.type} 
            onChange={handleChange}
            className="form-select"
          >
            <option value="limit">Limit Order</option>
            <option value="market">Market Order</option>
          </select>
        </div>

        {/* Price Input (only for limit orders) */}
        {orderData.type === 'limit' && (
          <div className="form-row">
            <label>Price (USD):</label>
            <input
              type="number"
              name="price"
              value={orderData.price}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="form-input"
              required={orderData.type === 'limit'}
            />
          </div>
        )}

        {/* Quantity Input */}
        <div className="form-row">
          <label>Quantity (BTC):</label>
          <input
            type="number"
            name="quantity"
            value={orderData.quantity}
            onChange={handleChange}
            placeholder="0.0000"
            step="0.0001"
            min="0"
            className="form-input"
            required
          />
          
          {/* Quick amount buttons */}
          <div className="quick-amounts">
            <button type="button" onClick={() => handleQuickAmount(25)}>25%</button>
            <button type="button" onClick={() => handleQuickAmount(50)}>50%</button>
            <button type="button" onClick={() => handleQuickAmount(75)}>75%</button>
            <button type="button" onClick={() => handleQuickAmount(100)}>100%</button>
          </div>
        </div>

        {/* Trading Pair Display */}
        <div className="form-row">
          <div className="trading-pair">
            <span>Trading Pair: {orderData.baseAsset}/{orderData.quoteAsset}</span>
          </div>
        </div>

        {/* Order Summary */}
        {orderData.price && orderData.quantity && (
          <div className="order-summary">
            <div className="summary-row">
              <span>Total:</span>
              <span>${(parseFloat(orderData.price || 0) * parseFloat(orderData.quantity || 0)).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button 
          type="submit" 
          className={`submit-button ${orderData.side}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Placing Order...' : `${orderData.side.toUpperCase()} ${orderData.baseAsset}`}
        </button>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div className="order-response">
            <h3>Order Placed Successfully!</h3>
            <div className="result-details">
              <p><strong>Order ID:</strong> {result.orderId}</p>
              <p><strong>Side:</strong> {result.side?.toUpperCase()}</p>
              <p><strong>Type:</strong> {result.type?.toUpperCase()}</p>
              <p><strong>Price:</strong> ${result.price}</p>
              <p><strong>Quantity:</strong> {result.quantity} BTC</p>
              <p><strong>Status:</strong> {result.status}</p>
              {result.total && <p><strong>Total:</strong> ${result.total}</p>}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default OrderForm;