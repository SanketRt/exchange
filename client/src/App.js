import React from 'react';
import './App.css';
import PriceChart from './components/PriceChart';
import OrderBook from './components/OrderBook';
import TradeHistory from './components/TradeHistory';
import MarketSummary from './components/MarketSummary';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Crypto Exchange</h1>
      </header>
      
      <div className="exchange-container">
        <div className="left-panel">
          <MarketSummary />
          <TradeHistory />
        </div>
        
        <div className="center-panel">
          <PriceChart />
        </div>
        
        <div className="right-panel">
          <OrderBook />
        </div>
      </div>
    </div>
  );
}

export default App;