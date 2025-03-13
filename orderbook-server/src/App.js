import React, { useState } from 'react';
import OrderForm from './OF';
import TradesTab from './TradesTab';
import OrderBook from './OrderBook';
import DepthChart from './DepthChart';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('orderbook');
  
  return (
    <div className="exchange-app">
      <header className="app-header">
        <div className="market-info">
          <h1>BTC/USD</h1>
          <div className="price-info">
            <span className="current-price">$133.48</span>
            <span className="price-change negative">-0.71 (-0.01%)</span>
          </div>
        </div>
        <div className="user-controls">
          <button className="login-button">Login</button>
          <button className="settings-button">Settings</button>
        </div>
      </header>
      
      <div className="main-content">
        <div className="chart-container">
          {/* Placeholder for price chart */}
          <div className="price-chart">
            <h3>Price Chart</h3>
            {/* Price chart component will go here */}
          </div>
        </div>
        
        <div className="trading-panel">
          <div className="market-data">
            <div className="tabs">
              <button 
                className={activeTab === 'orderbook' ? 'tab-active' : ''}
                onClick={() => setActiveTab('orderbook')}
              >
                Order Book
              </button>
              <button 
                className={activeTab === 'trades' ? 'tab-active' : ''}
                onClick={() => setActiveTab('trades')}
              >
                Trades
              </button>
              <button 
                className={activeTab === 'depth' ? 'tab-active' : ''}
                onClick={() => setActiveTab('depth')}
              >
                Depth
              </button>
            </div>
            
            <div className="tab-content">
              {activeTab === 'orderbook' && <OrderBook />}
              {activeTab === 'trades' && <TradesTab />}
              {activeTab === 'depth' && <DepthChart />}
            </div>
          </div>
          
          <div className="order-panel">
            <OrderForm />
          </div>
        </div>
      </div>
      
      <div className="user-orders">
        <div className="orders-tabs">
          <button className="tab-active">Open Orders</button>
          <button>Order History</button>
          <button>Trade History</button>
        </div>
        <div className="orders-content">
          <p>You have no open orders</p>
        </div>
      </div>
    </div>
  );
}

export default App;