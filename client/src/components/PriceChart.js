import React, { useEffect, useState, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  BarElement,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import webSocketService from '../services/WebSocketService';

// Register the components we need from Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

// Import and register the candlestick chart components
import { CandlestickController, CandlestickElement, OhlcController, OhlcElement } from 'chartjs-chart-financial';

// Register the candlestick controller and element
ChartJS.register(CandlestickController, CandlestickElement, OhlcController, OhlcElement);

// Function to calculate Simple Moving Average (SMA)
const calculateSMA = (data, period) => {
  const smaData = [];
  
  // Need at least 'period' number of data points to calculate SMA
  if (data.length < period) {
    return [];
  }
  
  // Calculate SMA for each point where we have enough previous data
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      // Not enough previous data points
      smaData.push({ x: data[i].x, y: null });
    } else {
      // Calculate average of last 'period' closes
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].c;
      }
      const average = sum / period;
      smaData.push({ x: data[i].x, y: parseFloat(average.toFixed(2)) });
    }
  }
  
  return smaData;
};

const PriceChart = () => {
  const [chartData, setChartData] = useState({
    datasets: [],
  });
  const [chartOptions, setChartOptions] = useState({});
  const [timeframe, setTimeframe] = useState('1d'); // Default to 1 day
  const [showSMA, setShowSMA] = useState(true); // Toggle for SMA
  const [lastPrice, setLastPrice] = useState(null);
  const [trades, setTrades] = useState([]);
  const [candlesticks, setCandlesticks] = useState([]);

  // Function to fetch order book data from the API
  const fetchOrderBook = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/orderbook');
      return await response.json();
    } catch (error) {
      console.error('Error fetching order book:', error);
      return { bids: [], asks: [] };
    }
  };

  // Function to fetch recent trades from the API
  const fetchTrades = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/trades');
      return await response.json();
    } catch (error) {
      console.error('Error fetching trades:', error);
      return [];
    }
  };

  // Function to fetch market summary data from the API
  const fetchMarketSummary = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/market/summary');
      return await response.json();
    } catch (error) {
      console.error('Error fetching market summary:', error);
      return {};
    }
  };

  // Initialize with mock data, will be replaced with real data
  // Reference to the chart component
  const chartRef = useRef(null);

  useEffect(() => {
    // Generate initial candlesticks just once when the component mounts
    generateInitialCandlesticks();
    
    // Connect to WebSocket for live updates
    webSocketService.connect();

    // Subscribe to ticker and trade updates
    const tickerUnsubscribe = webSocketService.addSubscriber('ticker', handleTickerUpdate);
    const tradesUnsubscribe = webSocketService.addSubscriber('trades', handleTradesUpdate);
    
    // Set up a fallback polling mechanism in case WebSocket fails
    const interval = setInterval(fetchLatestData, 5000);
    
    return () => {
      // Clean up
      clearInterval(interval);
      tickerUnsubscribe();
      tradesUnsubscribe();
    };
  }, []);

  // Update chart data when candlesticks or timeframe change
  useEffect(() => {
    updateChartData();
  }, [candlesticks, timeframe, showSMA]);

    // Handle ticker updates from WebSocket
  const handleTickerUpdate = (update) => {
    if (update && update.data) {
      const tickerData = update.data;
      setLastPrice(tickerData.lastPrice);
      
      // Add trade to the list
      const newTrade = {
        tradeId: Date.now(), // Use timestamp as ID since we might not have a real ID
        price: tickerData.lastPrice,
        quantity: tickerData.lastQty,
        timestamp: tickerData.timestamp,
        side: tickerData.side
      };
      
      setTrades(prev => {
        const newTrades = [...prev, newTrade];
        return newTrades.slice(-200); // Keep last 200 trades
      });
      
      // Update chart with new price data
      updateCandlesticksWithTrade(newTrade);
    }
  };
  
  // Handle trades updates from WebSocket
  const handleTradesUpdate = (update) => {
    if (update && update.data && Array.isArray(update.data) && update.data.length > 0) {
      const newTrades = update.data;
      
      setTrades(prev => {
        const updatedTrades = [...prev];
        newTrades.forEach(trade => {
          if (!updatedTrades.some(t => t.tradeId === trade.tradeId)) {
            updatedTrades.push(trade);
          }
        });
        return updatedTrades.slice(-200); // Keep last 200 trades
      });
      
      // Apply all new trades to candlesticks
      updateCandlesticks(newTrades);
    }
  };

  // Function to fetch latest data as a fallback when WebSocket is not available
  const fetchLatestData = async () => {
    try {
      // Only fetch if we haven't received WebSocket updates in the last 5 seconds
      const lastUpdateTime = localStorage.getItem('lastWebSocketUpdate');
      const now = Date.now();
      
      if (!lastUpdateTime || (now - parseInt(lastUpdateTime)) > 5000) {
        // Fetch market data
        const [orderBook, recentTrades, marketSummary] = await Promise.all([
          fetchOrderBook(),
          fetchTrades(),
          fetchMarketSummary()
        ]);
        
        // Update last price if available
        if (marketSummary && (marketSummary.bestBid || marketSummary.bestAsk)) {
          if (marketSummary.bestBid && marketSummary.bestAsk) {
            setLastPrice((marketSummary.bestBid.price + marketSummary.bestAsk.price) / 2);
          } else if (marketSummary.bestBid) {
            setLastPrice(marketSummary.bestBid.price);
          } else if (marketSummary.bestAsk) {
            setLastPrice(marketSummary.bestAsk.price);
          }
        }
        
        // Update trades and candlesticks
        if (recentTrades && recentTrades.length > 0) {
          setTrades(prev => {
            const newTrades = [...prev];
            recentTrades.forEach(trade => {
              if (!newTrades.some(t => t.tradeId === trade.tradeId)) {
                newTrades.push(trade);
              }
            });
            return newTrades.slice(-200); // Keep last 200 trades
          });
          
          // Update candlesticks with new trades
          updateCandlesticks(recentTrades);
        }
      }
    } catch (error) {
      console.error('Error fetching latest data:', error);
    }
  };

  // Generate initial candlesticks with realistic-looking data
  const generateInitialCandlesticks = () => {
    const now = new Date();
    const data = [];
    
    // Base price with trend and volatility components
    let basePrice = 50000; // Bitcoin price around $50k
    let trend = 0; // Used for trending patterns
    
    // Define a set of patterns to make data look more natural
    const patterns = [
      { type: 'uptrend', length: 15, strength: 0.3 },
      { type: 'downtrend', length: 12, strength: 0.25 },
      { type: 'consolidation', length: 20, strength: 0.1 },
      { type: 'volatility', length: 8, strength: 0.4 }
    ];
    
    let patternIndex = 0;
    let patternProgress = 0;
    
    // Generate 100 candles
    const numCandles = 100;
    for (let i = numCandles - 1; i >= 0; i--) {
      // Determine the current pattern
      if (patternProgress >= patterns[patternIndex].length) {
        patternIndex = (patternIndex + 1) % patterns.length;
        patternProgress = 0;
      }
      
      const currentPattern = patterns[patternIndex];
      patternProgress++;
      
      // Apply pattern effect on trend
      switch(currentPattern.type) {
        case 'uptrend':
          trend = currentPattern.strength * (1 - Math.cos(patternProgress / currentPattern.length * Math.PI)) / 2;
          break;
        case 'downtrend':
          trend = -currentPattern.strength * (1 - Math.cos(patternProgress / currentPattern.length * Math.PI)) / 2;
          break;
        case 'consolidation':
          trend = trend * 0.7 + (Math.random() - 0.5) * 0.05;
          break;
        case 'volatility':
          trend = (Math.random() - 0.5) * currentPattern.strength;
          break;
      }
      
      // Create date for this candle (15-minute candles)
      const date = new Date(now.getTime() - (i * 15 * 60 * 1000));
      
      // Generate price changes
      const dailyVolatility = 0.02; // Base volatility of 2%
      const patternVolatility = currentPattern.type === 'volatility' ? 0.03 : 0.01;
      const totalVolatility = dailyVolatility + patternVolatility;
      
      // Calculate OHLC values
      const randomFactor = (Math.random() - 0.5) * totalVolatility;
      const trendFactor = trend;
      const totalChange = trendFactor + randomFactor;
      
      const open = basePrice;
      const close = basePrice * (1 + totalChange);
      
      // Generate realistic high/low values
      const rangeFactor = (0.2 + Math.random() * 0.3) * totalVolatility; // More natural range
      const high = Math.max(open, close) * (1 + rangeFactor);
      const low = Math.min(open, close) * (1 - rangeFactor);
      
      // Add candle to data array
      data.push({
        x: date.getTime(),
        o: parseFloat(open.toFixed(2)),
        h: parseFloat(high.toFixed(2)),
        l: parseFloat(low.toFixed(2)),
        c: parseFloat(close.toFixed(2))
      });
      
      // Update base price for next candle
      basePrice = close;
    }
    
    setCandlesticks(data);
    setLastPrice(data[data.length - 1].c);
  };

  // Update candlesticks with new trade data - batch version
  const updateCandlesticks = (newTrades) => {
    if (!newTrades || newTrades.length === 0) return;
    
    // Record last update time for WebSocket fallback mechanism
    localStorage.setItem('lastWebSocketUpdate', Date.now().toString());
    
    setCandlesticks(prev => {
      // Make a copy of existing candlesticks
      const updated = [...prev];
      
      // Get the most recent candle
      const lastCandle = updated[updated.length - 1];
      const candlePeriod = 15 * 60 * 1000; // 15 minutes in ms
      
      // Track which candles need animation updates
      const animatedCandles = new Set();
      
      // Process each new trade
      newTrades.forEach(trade => {
        const tradeTime = trade.timestamp;
        const tradePrice = trade.price;
        
        if (!tradeTime || !tradePrice) return; // Skip invalid trades
        
        // Determine which candle period this trade belongs to
        const candleTime = Math.floor(tradeTime / candlePeriod) * candlePeriod;
        
        // Find if we already have a candle for this period
        const candleIndex = updated.findIndex(c => c.x === candleTime);
        
        if (candleIndex >= 0) {
          // Update existing candle
          const candle = updated[candleIndex];
          let updated = false;
          
          // Update high and low if needed
          if (tradePrice > candle.h) {
            candle.h = parseFloat(tradePrice.toFixed(2));
            updated = true;
          }
          if (tradePrice < candle.l) {
            candle.l = parseFloat(tradePrice.toFixed(2));
            updated = true;
          }
          
          // Update close price
          if (candle.c !== parseFloat(tradePrice.toFixed(2))) {
            candle.c = parseFloat(tradePrice.toFixed(2));
            updated = true;
          }
          
          if (updated) {
            // Update the candle in the array
            updated[candleIndex] = candle;
            animatedCandles.add(candleIndex);
          }
        } else if (candleTime > lastCandle.x) {
          // This is a new candle period after the last one
          const newCandle = {
            x: candleTime,
            o: parseFloat(lastCandle.c.toFixed(2)), // Open at the last candle's close
            h: parseFloat(tradePrice.toFixed(2)),
            l: parseFloat(tradePrice.toFixed(2)),
            c: parseFloat(tradePrice.toFixed(2))
          };
          
          updated.push(newCandle);
          animatedCandles.add(updated.length - 1);
        }
      });
      
      // Apply a subtle animation for updated candles if chart exists
      if (chartRef.current && chartRef.current.chartInstance) {
        animatedCandles.forEach(index => {
          try {
            const dataset = chartRef.current.chartInstance.data.datasets[0];
            const meta = chartRef.current.chartInstance.getDatasetMeta(0);
            if (meta.data[index]) {
              meta.data[index].transition = {
                x: { duration: 300, easing: 'easeOutCubic' },
                y: { duration: 300, easing: 'easeOutCubic' }
              };
            }
          } catch (error) {
            console.warn('Animation error:', error);
          }
        });
      }
      
      // Ensure we don't have too many candles (keep last 100)
      if (updated.length > 100) {
        return updated.slice(-100);
      }
      
      return updated;
    });
  };
  
  // Update candlesticks with a single trade - optimized for real-time updates
  const updateCandlesticksWithTrade = (trade) => {
    if (!trade || !trade.price) return;
    
    // Record last update time
    localStorage.setItem('lastWebSocketUpdate', Date.now().toString());
    
    setCandlesticks(prev => {
      // Make a copy of existing candlesticks
      const updated = [...prev];
      
      // Get the most recent candle
      const lastCandle = updated[updated.length - 1];
      const candlePeriod = 15 * 60 * 1000; // 15 minutes in ms
      
      const tradeTime = trade.timestamp || Date.now();
      const tradePrice = parseFloat(trade.price);
      
      // Determine which candle period this trade belongs to
      const candleTime = Math.floor(tradeTime / candlePeriod) * candlePeriod;
      
      // Find if we already have a candle for this period
      const candleIndex = updated.findIndex(c => c.x === candleTime);
      
      // Add a small random movement to make candlesticks look more natural
      const jitter = (Math.random() - 0.5) * 0.001 * tradePrice;
      const adjustedPrice = tradePrice + jitter;
      
      if (candleIndex >= 0) {
        // Update existing candle
        const candle = updated[candleIndex];
        
        // Update high and low if needed
        if (adjustedPrice > candle.h) {
          candle.h = parseFloat(adjustedPrice.toFixed(2));
        }
        if (adjustedPrice < candle.l) {
          candle.l = parseFloat(adjustedPrice.toFixed(2));
        }
        
        // Update close price
        candle.c = parseFloat(adjustedPrice.toFixed(2));
        
        // Apply a subtle price movement animation
        if (chartRef.current && chartRef.current.chartInstance) {
          try {
            const dataset = chartRef.current.chartInstance.data.datasets[0];
            const meta = chartRef.current.chartInstance.getDatasetMeta(0);
            if (meta.data[candleIndex]) {
              meta.data[candleIndex].transition = {
                y: { duration: 200, easing: 'easeOutQuad' }
              };
            }
          } catch (error) {
            // Silently ignore animation errors
          }
        }
        
        // Update the candle in the array
        updated[candleIndex] = candle;
      } else if (candleTime > lastCandle.x) {
        // This is a new candle period after the last one
        const newCandle = {
          x: candleTime,
          o: parseFloat(lastCandle.c.toFixed(2)), // Open at the last candle's close
          h: parseFloat(adjustedPrice.toFixed(2)),
          l: parseFloat(adjustedPrice.toFixed(2)),
          c: parseFloat(adjustedPrice.toFixed(2))
        };
        
        updated.push(newCandle);
      }
      
      // Ensure we don't have too many candles (keep last 100)
      if (updated.length > 100) {
        return updated.slice(-100);
      }
      
      return updated;
    });
  };

  // Update chart data with current candlesticks
  const updateChartData = () => {
    if (candlesticks.length === 0) return;
    
    // Calculate SMA
    const sma9Data = calculateSMA(candlesticks, 9);
    
    // Create datasets array
    const datasets = [
      {
        label: 'BTC/USD',
        data: candlesticks,
        type: 'candlestick',
        candlestick: {
          color: {
            up: '#26a69a',
            down: '#ef5350',
            unchanged: '#999',
          },
          width: 3,
          priceLineWidth: 2,
        },
        borderColor: context => {
          const c = context.parsed?.c;
          const o = context.parsed?.o;
          return c >= o ? '#26a69a' : '#ef5350';
        },
        backgroundColor: context => {
          const c = context.parsed?.c;
          const o = context.parsed?.o;
          return c >= o ? 'rgba(38, 166, 154, 0.4)' : 'rgba(239, 83, 80, 0.4)';
        },
      }
    ];
    
    // Add SMA if enabled
    if (showSMA) {
      datasets.push({
        label: '9-period SMA',
        data: sma9Data,
        type: 'line',
        borderColor: '#f5a623',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.1,
        fill: false,
        pointHoverRadius: 0,
        z: 1
      });
    }
    
    setChartData({
      datasets: datasets,
    });

    // Determine time format based on timeframe
    let timeUnitFormat;
    if (timeframe === '1h') {
      timeUnitFormat = 'HH:mm';
    } else if (timeframe === '1d') {
      timeUnitFormat = 'HH:mm';
    } else if (timeframe === '1w' || timeframe === '1m') {
      timeUnitFormat = 'MMM dd';
    }

    setChartOptions({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: {
          left: 0,
          right: 48,
          top: 20,
          bottom: 0
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'start',
          labels: {
            boxWidth: 6,
            boxHeight: 6,
            borderRadius: 3,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 15,
            color: '#e0e0e0',
            font: {
              size: 11,
              family: 'Inter'
            }
          }
        },
        title: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: (tooltipItems) => {
              const date = new Date(tooltipItems[0].raw.x);
              return date.toLocaleString();
            },
            label: (context) => {
              const point = context.raw;
              if (point.o !== undefined) {
                return [
                  `O: $${point.o.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
                  `H: $${point.h.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
                  `L: $${point.l.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
                  `C: $${point.c.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                ];
              } else if (point.y !== null) {
                return `SMA: $${point.y.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
              }
              return null;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          distribution: 'linear',
          time: {
            unit: timeframe === '1h' ? 'minute' : 
                  timeframe === '1d' ? 'hour' : 'day',
            displayFormats: {
              minute: 'HH:mm',
              hour: 'HH:mm',
              day: 'MMM dd',
            },
          },
          ticks: {
            maxRotation: 0,
            maxTicksLimit: 6,
            font: {
              size: 10
            }
          },
          grid: {
            display: true,
            drawBorder: false,
            drawOnChartArea: true,
            drawTicks: false,
            color: 'rgba(150, 150, 150, 0.2)'
          }
        },
        y: {
          position: 'right',
          ticks: {
            maxTicksLimit: 6,
            callback: function(value) {
              return '$' + value.toLocaleString();
            },
            font: {
              size: 11
            }
          },
          grid: {
            drawBorder: false,
            drawTicks: false,
            color: 'rgba(150, 150, 150, 0.2)'
          }
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      }
    });
  };

  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
  };

  const toggleSMA = () => {
    setShowSMA(!showSMA);
  };

  return (
    <div className="price-chart-container">
      <div className="chart-header">
        <div className="symbol-info">
          <h2>BTC/USDC</h2>
          <div className="last-price">
            <span className={lastPrice > 0 ? 'price positive' : 'price negative'}>
              ${lastPrice ? lastPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '—'}
            </span>
          </div>
        </div>
        <div className="chart-controls">
          <div className="timeframe-selectors">
            <button 
              className={timeframe === '1h' ? 'active' : ''} 
              onClick={() => handleTimeframeChange('1h')}
            >
              1H
            </button>
            <button 
              className={timeframe === '1d' ? 'active' : ''} 
              onClick={() => handleTimeframeChange('1d')}
            >
              1D
            </button>
            <button 
              className={timeframe === '1w' ? 'active' : ''} 
              onClick={() => handleTimeframeChange('1w')}
            >
              1W
            </button>
            <button 
              className={timeframe === '1m' ? 'active' : ''} 
              onClick={() => handleTimeframeChange('1m')}
            >
              1M
            </button>
          </div>
          <div className="indicator-toggles">
            <button 
              className={showSMA ? 'active' : ''}
              onClick={toggleSMA}
            >
              SMA(9)
            </button>
          </div>
        </div>
      </div>
      <div className="chart-wrapper">
        {chartData.datasets.length ? (
          <Chart 
            type="candlestick" 
            options={chartOptions} 
            data={chartData} 
          />
        ) : (
          <div className="loading">Loading chart data...</div>
        )}
      </div>
      <div className="chart-footer">
        <div className="connection-status">
          <span className={"status-indicator" + (webSocketService.isConnected ? ' connected' : '')}></span>
          <span>{webSocketService.isConnected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>
    </div>
  );
};

export default PriceChart;