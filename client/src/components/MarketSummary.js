import React, { useState, useEffect } from 'react';
import './components.css';

const MarketSummary = () => {
  const [marketData, setMarketData] = useState({
    bestBid: null,
    bestAsk: null,
    spread: null,
    lastPrice: null,
    dailyChange: null,
    dailyHigh: null,
    dailyLow: null,
    volume: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMarketSummary = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/market/summary');
        if (!response.ok) throw new Error('Failed to fetch market summary');
        
        const data = await response.json();
        
        // Calculate additional stats based on recent trades
        const tradesResponse = await fetch('http://localhost:3000/api/trades');
        const trades = await tradesResponse.json();
        
        let lastPrice = null;
        let dailyHigh = 0;
        let dailyLow = Number.MAX_VALUE;
        let volume = 0;
        let dailyOpen = null;
        
        if (trades && trades.length > 0) {
          // Get 24h data
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          const recentTrades = trades.filter(t => t.timestamp > oneDayAgo);
          
          if (recentTrades.length > 0) {
            lastPrice = recentTrades[recentTrades.length - 1].price;
            dailyOpen = recentTrades[0].price;
            
            recentTrades.forEach(trade => {
              if (trade.price > dailyHigh) dailyHigh = trade.price;
              if (trade.price < dailyLow) dailyLow = trade.price;
              volume += trade.quantity;
            });
          }
        }
        
        const dailyChange = dailyOpen && lastPrice 
          ? ((lastPrice - dailyOpen) / dailyOpen) * 100 
          : null;
        
        setMarketData({
          bestBid: data.bestBid?.price || null,
          bestAsk: data.bestAsk?.price || null,
          spread: data.spread || null,
          lastPrice,
          dailyChange,
          dailyHigh: dailyHigh || null,
          dailyLow: dailyLow === Number.MAX_VALUE ? null : dailyLow,
          volume
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching market summary:', error);
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchMarketSummary();
    
    // Set up polling
    const interval = setInterval(fetchMarketSummary, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatChange = (change) => {
    if (change === null || change === undefined) return '—';
    return change.toFixed(2) + '%';
  };

  const formatVolume = (volume) => {
    if (volume === null || volume === undefined) return '—';
    return volume.toFixed(4) + ' BTC';
  };

  if (isLoading) {
    return <div className="market-stats loading">Loading market data...</div>;
  }

  return (
    <div className="market-stats">
      <h2>Market Summary</h2>
      <div className="stats-grid">
        <div className="stats-row">
          <div className="stat-item">
            <div className="stat-label">Last Price</div>
            <div className="stat-value">{formatPrice(marketData.lastPrice)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">24h Change</div>
            <div className={`stat-value ${marketData.dailyChange > 0 ? 'positive' : marketData.dailyChange < 0 ? 'negative' : ''}`}>
              {formatChange(marketData.dailyChange)}
            </div>
          </div>
        </div>
        
        <div className="stats-row">
          <div className="stat-item">
            <div className="stat-label">24h High</div>
            <div className="stat-value">{formatPrice(marketData.dailyHigh)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">24h Low</div>
            <div className="stat-value">{formatPrice(marketData.dailyLow)}</div>
          </div>
        </div>
        
        <div className="stats-row">
          <div className="stat-item">
            <div className="stat-label">Best Bid</div>
            <div className="stat-value bid-price">{formatPrice(marketData.bestBid)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Best Ask</div>
            <div className="stat-value ask-price">{formatPrice(marketData.bestAsk)}</div>
          </div>
        </div>
        
        <div className="stats-row">
          <div className="stat-item">
            <div className="stat-label">Spread</div>
            <div className="stat-value">{formatPrice(marketData.spread)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">24h Volume</div>
            <div className="stat-value">{formatVolume(marketData.volume)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketSummary; 