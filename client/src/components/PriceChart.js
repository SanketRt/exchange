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
  const [priceChange, setPriceChange] = useState(null);
  const [trades, setTrades] = useState([]);
  const [candlesticks, setCandlesticks] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const chartRef = useRef(null);

  // API calls with full URLs for development
  const fetchOrderBook = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/orderbook/BTC-USD');
      if (!response.ok) throw new Error('Failed to fetch order book');
      setIsConnected(true);
      return await response.json();
    } catch (error) {
      console.error('Error fetching order book:', error);
      setIsConnected(false);
      return { bids: [], asks: [] };
    }
  };

  const fetchTrades = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/trades/BTC-USD');
      if (!response.ok) throw new Error('Failed to fetch trades');
      setIsConnected(true);
      return await response.json();
    } catch (error) {
      console.error('Error fetching trades:', error);
      setIsConnected(false);
      return [];
    }
  };

  useEffect(() => {
    // Generate initial candlesticks
    generateInitialCandlesticks();
    
    // Set up polling for real data
    const interval = setInterval(fetchLatestData, 3000); // Faster updates
    
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
      
      // Update last price and calculate change
      if (recentTrades && recentTrades.length > 0) {
        const latestTrade = recentTrades[recentTrades.length - 1];
        const newPrice = parseFloat(latestTrade.price);
        
        // Calculate price change from previous price
        if (lastPrice && lastPrice !== newPrice) {
          const change = newPrice - lastPrice;
          const changePercent = (change / lastPrice) * 100;
          setPriceChange({ change, changePercent });
        }
        
        setLastPrice(newPrice);
        setLastUpdate(Date.now());
        
        // Update trades state with animation trigger
        setTrades(prev => {
          const newTrades = [...prev];
          let hasNewTrades = false;
          
          recentTrades.forEach(trade => {
            if (!newTrades.some(t => t.tradeId === trade.tradeId)) {
              newTrades.push(trade);
              hasNewTrades = true;
            }
          });
          
          if (hasNewTrades) {
            // Trigger a subtle chart animation
            triggerChartUpdate();
          }
          
          return newTrades.slice(-200);
        });
        
        // Update candlesticks with new trades
        updateCandlesticks(recentTrades);
      } else if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
        // Use mid-price if no trades
        const bestBid = parseFloat(orderBook.bids[0][0] || orderBook.bids[0].price);
        const bestAsk = parseFloat(orderBook.asks[0][0] || orderBook.asks[0].price);
        const midPrice = (bestBid + bestAsk) / 2;
        
        if (lastPrice && lastPrice !== midPrice) {
          const change = midPrice - lastPrice;
          const changePercent = (change / lastPrice) * 100;
          setPriceChange({ change, changePercent });
        }
        
        setLastPrice(midPrice);
        setLastUpdate(Date.now());
      }
    } catch (error) {
      console.error('Error fetching latest data:', error);
      setIsConnected(false);
    }
  };

  const triggerChartUpdate = () => {
    if (chartRef.current && chartRef.current.chartInstance) {
      chartRef.current.chartInstance.update('none'); // Update without animation
    }
  };

  const generateInitialCandlesticks = () => {
    const now = new Date();
    const data = [];
    
    // Start with a realistic BTC price
    let basePrice = 45000 + Math.random() * 10000; // Between 45k-55k
    
    const numCandles = 120;
    for (let i = numCandles - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - (i * 1 * 60 * 1000)); // 1-minute candles
      
      // Add multiple layers of noise for realistic movement
      const microNoise = (Math.random() - 0.5) * 0.003; // 0.3% micro movements
      const smallNoise = (Math.random() - 0.5) * 0.008; // 0.8% small movements  
      const mediumNoise = (Math.random() - 0.5) * 0.015; // 1.5% medium movements
      
      // Occasional large moves (5% chance of 2-4% move)
      const largeMove = Math.random() < 0.05 ? (Math.random() - 0.5) * 0.04 : 0;
      
      // Trend bias (very weak, changes randomly)
      const trendBias = Math.random() < 0.1 ? (Math.random() - 0.5) * 0.01 : 0;
      
      // Combine all noise sources
      const totalChange = microNoise + smallNoise + mediumNoise + largeMove + trendBias;
      
      const open = basePrice;
      const close = basePrice * (1 + totalChange);
      
      // Generate realistic high/low with multiple random factors
      const wickNoise1 = Math.random() * 0.004; // 0.4% wick extension
      const wickNoise2 = Math.random() * 0.003; // 0.3% additional wick
      const wickBias = Math.random() < 0.3 ? Math.random() * 0.006 : 0; // 30% chance of longer wick
      
      // Separate noise for high and low
      const highWick = Math.max(open, close) * (1 + wickNoise1 + wickBias);
      const lowWick = Math.min(open, close) * (1 - wickNoise2 - wickBias);
      
      // Add some asymmetric wick noise
      const asymmetricHigh = Math.random() < 0.2 ? highWick * (1 + Math.random() * 0.002) : highWick;
      const asymmetricLow = Math.random() < 0.2 ? lowWick * (1 - Math.random() * 0.002) : lowWick;
      
      data.push({
        x: date.getTime(),
        o: parseFloat(open.toFixed(2)),
        h: parseFloat(asymmetricHigh.toFixed(2)),
        l: parseFloat(asymmetricLow.toFixed(2)),
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
      const candlePeriod = 1 * 60 * 1000; // 1 minute
      
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
      
      // Keep optimal number of candles for performance
      if (updated.length > 120) {
        return updated.slice(-120);
      }
      
      return updated;
    });
  };

  const updateChartData = () => {
    if (candlesticks.length === 0) return;
    
    const sma9Data = calculateSMA(candlesticks, 9);
    const sma21Data = calculateSMA(candlesticks, 21);
    
    const datasets = [
      {
        label: 'BTC/USD',
        data: candlesticks,
        type: 'candlestick',
        candlestick: {
          color: {
            up: '#00d4aa',
            down: '#ff6b6b',
            unchanged: '#888',
          },
          borderColor: {
            up: '#00d4aa',
            down: '#ff6b6b',
            unchanged: '#888',
          },
          wickColor: {
            up: '#00d4aa',
            down: '#ff6b6b',
            unchanged: '#888',
          }
        },
      }
    ];
    
    if (showSMA) {
      datasets.push({
        label: 'SMA(9)',
        data: sma9Data,
        type: 'line',
        borderColor: '#ffd93d',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
        fill: false,
        pointHoverRadius: 0,
        z: 1
      });
      
      datasets.push({
        label: 'SMA(21)',
        data: sma21Data,
        type: 'line',
        borderColor: '#6bcf7f',
        borderWidth: 2,
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
      animation: {
        duration: 750,
        easing: 'easeInOutQuart'
      },
      layout: {
        padding: {
          left: 0,
          right: 50,
          top: 20,
          bottom: 10
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'start',
          labels: {
            boxWidth: 8,
            boxHeight: 8,
            borderRadius: 4,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            color: '#e0e0e0',
            font: {
              size: 12,
              family: 'Inter',
              weight: '500'
            }
          }
        },
        title: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(30, 30, 30, 0.95)',
          titleColor: '#fff',
          bodyColor: '#e0e0e0',
          borderColor: '#555',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: (tooltipItems) => {
              const date = new Date(tooltipItems[0].raw.x);
              return date.toLocaleString();
            },
            label: (context) => {
              const point = context.raw;
              if (point.o !== undefined) {
                return [
                  `Open: $${point.o.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
                  `High: $${point.h.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
                  `Low: $${point.l.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
                  `Close: $${point.c.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                ];
              } else if (point.y !== null) {
                return `${context.dataset.label}: $${point.y.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
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
            maxTicksLimit: 8,
            color: '#888',
            font: {
              size: 11
            }
          },
          grid: {
            display: true,
            drawBorder: false,
            drawOnChartArea: true,
            drawTicks: false,
            color: 'rgba(255, 255, 255, 0.08)'
          }
        },
        y: {
          position: 'right',
          min: function(context) {
            // Dynamic Y-axis scaling - focus on recent data
            const data = context.chart.data.datasets[0].data;
            if (!data || data.length === 0) return undefined;
            
            // Get last 40 candles for better scaling
            const recentData = data.slice(-40);
            const allPrices = recentData.flatMap(candle => [candle.h, candle.l, candle.o, candle.c]);
            const minPrice = Math.min(...allPrices);
            const maxPrice = Math.max(...allPrices);
            const range = maxPrice - minPrice;
            
            // Add 5% padding below minimum
            return Math.max(0, minPrice - (range * 0.05));
          },
          max: function(context) {
            // Dynamic Y-axis scaling - focus on recent data  
            const data = context.chart.data.datasets[0].data;
            if (!data || data.length === 0) return undefined;
            
            // Get last 40 candles for better scaling
            const recentData = data.slice(-40);
            const allPrices = recentData.flatMap(candle => [candle.h, candle.l, candle.o, candle.c]);
            const minPrice = Math.min(...allPrices);
            const maxPrice = Math.max(...allPrices);
            const range = maxPrice - minPrice;
            
            // Add 5% padding above maximum
            return maxPrice + (range * 0.05);
          },
          ticks: {
            maxTicksLimit: 8,
            color: '#888',
            callback: function(value) {
              return '$' + value.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});
            },
            font: {
              size: 11
            }
          },
          grid: {
            drawBorder: false,
            drawTicks: false,
            color: 'rgba(255, 255, 255, 0.08)'
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

  const formatLastUpdate = () => {
    const now = Date.now();
    const diff = now - lastUpdate;
    if (diff < 5000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    return `${Math.floor(diff / 60000)}m ago`;
  };

  return (
    <div className="price-chart-container">
      <div className="chart-header">
        <div className="symbol-info">
          <h2>BTC/USD</h2>
          <div className="price-info">
            <span className={`last-price ${priceChange?.change >= 0 ? 'positive' : 'negative'}`}>
              ${lastPrice ? lastPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '—'}
            </span>
            {priceChange && (
              <span className={`price-change ${priceChange.change >= 0 ? 'positive' : 'negative'}`}>
                {priceChange.change >= 0 ? '+' : ''}${priceChange.change.toFixed(2)} ({priceChange.changePercent.toFixed(2)}%)
              </span>
            )}
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
              SMA
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
          <div className="loading">
            <div className="loading-spinner"></div>
            <span>Loading chart data...</span>
          </div>
        )}
      </div>
      <div className="chart-footer">
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">
            {isConnected ? `Live • ${formatLastUpdate()}` : 'Disconnected'}
          </span>
        </div>
        <div className="chart-info">
          <span>{candlesticks.length} candles • 1m intervals</span>
        </div>
      </div>
    </div>
  );
};

export default PriceChart;