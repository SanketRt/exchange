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
  
  if (data.length < period) {
    return [];
  }
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      smaData.push({ x: data[i].x, y: null });
    } else {
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
  const [timeframe, setTimeframe] = useState('1d');
  const [showSMA, setShowSMA] = useState(true);
  const [lastPrice, setLastPrice] = useState(null);
  const [trades, setTrades] = useState([]);
  const [candlesticks, setCandlesticks] = useState([]);

  // Fixed: Use correct API endpoints
  const fetchOrderBook = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/orderbook/BTC-USD');
      if (!response.ok) throw new Error('Failed to fetch order book');
      return await response.json();
    } catch (error) {
      console.error('Error fetching order book:', error);
      return { bids: [], asks: [] };
    }
  };

  const fetchTrades = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/trades/BTC-USD');
      if (!response.ok) throw new Error('Failed to fetch trades');
      return await response.json();
    } catch (error) {
      console.error('Error fetching trades:', error);
      return [];
    }
  };

  const chartRef = useRef(null);

  useEffect(() => {
    // Generate initial candlesticks
    generateInitialCandlesticks();
    
    // Set up polling for real data
    const interval = setInterval(fetchLatestData, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    updateChartData();
  }, [candlesticks, timeframe, showSMA]);

  const fetchLatestData = async () => {
    try {
      const [orderBook, recentTrades] = await Promise.all([
        fetchOrderBook(),
        fetchTrades()
      ]);
      
      // Update last price from order book or trades
      if (recentTrades && recentTrades.length > 0) {
        const latestTrade = recentTrades[recentTrades.length - 1];
        setLastPrice(parseFloat(latestTrade.price));
        
        // Update trades state
        setTrades(prev => {
          const newTrades = [...prev];
          recentTrades.forEach(trade => {
            if (!newTrades.some(t => t.tradeId === trade.tradeId)) {
              newTrades.push(trade);
            }
          });
          return newTrades.slice(-200);
        });
        
        // Update candlesticks with new trades
        updateCandlesticks(recentTrades);
      } else if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
        // Use mid-price if no trades
        const bestBid = parseFloat(orderBook.bids[0][0] || orderBook.bids[0].price);
        const bestAsk = parseFloat(orderBook.asks[0][0] || orderBook.asks[0].price);
        setLastPrice((bestBid + bestAsk) / 2);
      }
    } catch (error) {
      console.error('Error fetching latest data:', error);
    }
  };

  const generateInitialCandlesticks = () => {
    const now = new Date();
    const data = [];
    
    let basePrice = 50000;
    let trend = 0;
    
    const patterns = [
      { type: 'uptrend', length: 15, strength: 0.3 },
      { type: 'downtrend', length: 12, strength: 0.25 },
      { type: 'consolidation', length: 20, strength: 0.1 },
      { type: 'volatility', length: 8, strength: 0.4 }
    ];
    
    let patternIndex = 0;
    let patternProgress = 0;
    
    const numCandles = 100;
    for (let i = numCandles - 1; i >= 0; i--) {
      if (patternProgress >= patterns[patternIndex].length) {
        patternIndex = (patternIndex + 1) % patterns.length;
        patternProgress = 0;
      }
      
      const currentPattern = patterns[patternIndex];
      patternProgress++;
      
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
      
      const date = new Date(now.getTime() - (i * 15 * 60 * 1000));
      const dailyVolatility = 0.02;
      const patternVolatility = currentPattern.type === 'volatility' ? 0.03 : 0.01;
      const totalVolatility = dailyVolatility + patternVolatility;
      
      const randomFactor = (Math.random() - 0.5) * totalVolatility;
      const trendFactor = trend;
      const totalChange = trendFactor + randomFactor;
      
      const open = basePrice;
      const close = basePrice * (1 + totalChange);
      
      const rangeFactor = (0.2 + Math.random() * 0.3) * totalVolatility;
      const high = Math.max(open, close) * (1 + rangeFactor);
      const low = Math.min(open, close) * (1 - rangeFactor);
      
      data.push({
        x: date.getTime(),
        o: parseFloat(open.toFixed(2)),
        h: parseFloat(high.toFixed(2)),
        l: parseFloat(low.toFixed(2)),
        c: parseFloat(close.toFixed(2))
      });
      
      basePrice = close;
    }
    
    setCandlesticks(data);
    setLastPrice(data[data.length - 1].c);
  };

  const updateCandlesticks = (newTrades) => {
    if (!newTrades || newTrades.length === 0) return;
    
    setCandlesticks(prev => {
      const updated = [...prev];
      const lastCandle = updated[updated.length - 1];
      const candlePeriod = 15 * 60 * 1000; // 15 minutes
      
      newTrades.forEach(trade => {
        const tradeTime = new Date(trade.timestamp).getTime();
        const tradePrice = parseFloat(trade.price);
        
        if (!tradeTime || !tradePrice) return;
        
        const candleTime = Math.floor(tradeTime / candlePeriod) * candlePeriod;
        const candleIndex = updated.findIndex(c => c.x === candleTime);
        
        if (candleIndex >= 0) {
          const candle = updated[candleIndex];
          if (tradePrice > candle.h) candle.h = parseFloat(tradePrice.toFixed(2));
          if (tradePrice < candle.l) candle.l = parseFloat(tradePrice.toFixed(2));
          candle.c = parseFloat(tradePrice.toFixed(2));
          updated[candleIndex] = candle;
        } else if (candleTime > lastCandle.x) {
          const newCandle = {
            x: candleTime,
            o: parseFloat(lastCandle.c.toFixed(2)),
            h: parseFloat(tradePrice.toFixed(2)),
            l: parseFloat(tradePrice.toFixed(2)),
            c: parseFloat(tradePrice.toFixed(2))
          };
          updated.push(newCandle);
        }
      });
      
      if (updated.length > 100) {
        return updated.slice(-100);
      }
      
      return updated;
    });
  };

  const updateChartData = () => {
    if (candlesticks.length === 0) return;
    
    const sma9Data = calculateSMA(candlesticks, 9);
    
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
    
    setChartData({ datasets });

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
          <h2>BTC/USD</h2>
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
            ref={chartRef}
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
          <span className="status-indicator connected"></span>
          <span>Live</span>
        </div>
      </div>
    </div>
  );
};

export default PriceChart;