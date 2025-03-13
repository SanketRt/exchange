import React, { useState, useEffect, useRef } from 'react';
import './DepthChart.css';

const DepthChart = () => {
  const [depthData, setDepthData] = useState({ bids: [], asks: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(133.48);
  const canvasRef = useRef(null);
  
  // Fetch depth data on component mount
  useEffect(() => {
    // Mock data for development - replace with actual API call
    const generateMockDepthData = () => {
      const bids = [];
      const asks = [];
      
      // Generate some sample data points
      // Starting from current price and going down for bids
      let bidPrice = currentPrice;
      let bidCumulative = 0;
      for (let i = 0; i < 50; i++) {
        bidPrice -= 0.05 + (Math.random() * 0.05);
        const quantity = 50 + Math.random() * 150;
        bidCumulative += quantity;
        bids.push({ price: bidPrice, quantity, cumulative: bidCumulative });
      }
      
      // Starting from current price and going up for asks
      let askPrice = currentPrice;
      let askCumulative = 0;
      for (let i = 0; i < 50; i++) {
        askPrice += 0.05 + (Math.random() * 0.05);
        const quantity = 50 + Math.random() * 150;
        askCumulative += quantity;
        asks.push({ price: askPrice, quantity, cumulative: askCumulative });
      }
      
      // Sort bids in descending order (highest price first)
      bids.sort((a, b) => b.price - a.price);
      
      // Sort asks in ascending order (lowest price first)
      asks.sort((a, b) => a.price - b.price);
      
      return { bids, asks };
    };
    
    setTimeout(() => {
      setDepthData(generateMockDepthData());
      setIsLoading(false);
    }, 500);
    
    // When your API is ready, replace with:
    // fetch('/api/v1/depth')
    //   .then(response => response.json())
    //   .then(data => {
    //     setDepthData(data);
    //     setIsLoading(false);
    //   })
    //   .catch(error => {
    //     console.error('Error fetching depth data:', error);
    //     setIsLoading(false);
    //   });
  }, [currentPrice]);
  
  // Draw the depth chart when data or canvas changes
  useEffect(() => {
    if (isLoading || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Get canvas dimensions
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Find max values for scaling
    const maxBidCumulative = depthData.bids.length > 0 
      ? depthData.bids[depthData.bids.length - 1].cumulative 
      : 0;
    
    const maxAskCumulative = depthData.asks.length > 0 
      ? depthData.asks[depthData.asks.length - 1].cumulative 
      : 0;
    
    const maxCumulative = Math.max(maxBidCumulative, maxAskCumulative);
    
    // Find min and max prices for x-axis scaling
    const minPrice = depthData.bids.length > 0 
      ? depthData.bids[depthData.bids.length - 1].price 
      : currentPrice * 0.95;
    
    const maxPrice = depthData.asks.length > 0 
      ? depthData.asks[depthData.asks.length - 1].price 
      : currentPrice * 1.05;
    
    // Padding for the chart
    const padding = 40;
    
    // Calculate scale functions
    const xScale = (price) => {
      return padding + ((price - minPrice) / (maxPrice - minPrice)) * (width - padding * 2);
    };
    
    const yScale = (cumulative) => {
      return height - padding - (cumulative / maxCumulative) * (height - padding * 2);
    };
    
    // Draw axes
    ctx.beginPath();
    ctx.strokeStyle = '#2a2e39';
    ctx.lineWidth = 1;
    
    // X-axis
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    
    // Y-axis
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    
    ctx.stroke();
    
    // Draw grid lines
    ctx.beginPath();
    ctx.strokeStyle = '#2a2e39';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines
    for (let i = 1; i <= 4; i++) {
      const y = padding + (i * (height - padding * 2) / 4);
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
    }
    
    // Vertical grid lines
    for (let i = 1; i <= 4; i++) {
      const x = padding + (i * (width - padding * 2) / 4);
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
    }
    
    ctx.stroke();
    
    // Draw axes labels
    ctx.fillStyle = '#8c8e94';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    // X-axis labels
    for (let i = 0; i <= 4; i++) {
      const x = padding + (i * (width - padding * 2) / 4);
      const price = minPrice + (i * (maxPrice - minPrice) / 4);
      ctx.fillText(price.toFixed(2), x, height - padding + 15);
    }
    
    // Y-axis labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = height - padding - (i * (height - padding * 2) / 4);
      const value = (i * maxCumulative / 4).toFixed(0);
      ctx.fillText(value, padding - 5, y + 3);
    }
    
    // Draw bids (buy orders) - green area
    if (depthData.bids.length > 0) {
      ctx.beginPath();
      ctx.moveTo(xScale(depthData.bids[0].price), height - padding);
      
      for (let i = 0; i < depthData.bids.length; i++) {
        const { price, cumulative } = depthData.bids[i];
        ctx.lineTo(xScale(price), yScale(cumulative));
      }
      
      ctx.lineTo(xScale(depthData.bids[depthData.bids.length - 1].price), height - padding);
      ctx.closePath();
      
      ctx.fillStyle = 'rgba(0, 192, 118, 0.2)';
      ctx.fill();
      
      // Draw bid line
      ctx.beginPath();
      ctx.moveTo(xScale(depthData.bids[0].price), yScale(depthData.bids[0].cumulative));
      
      for (let i = 1; i < depthData.bids.length; i++) {
        const { price, cumulative } = depthData.bids[i];
        ctx.lineTo(xScale(price), yScale(cumulative));
      }
      
      ctx.strokeStyle = '#00c076';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Draw asks (sell orders) - red area
    if (depthData.asks.length > 0) {
      ctx.beginPath();
      ctx.moveTo(xScale(depthData.asks[0].price), height - padding);
      
      for (let i = 0; i < depthData.asks.length; i++) {
        const { price, cumulative } = depthData.asks[i];
        ctx.lineTo(xScale(price), yScale(cumulative));
      }
      
      ctx.lineTo(xScale(depthData.asks[depthData.asks.length - 1].price), height - padding);
      ctx.closePath();
      
      ctx.fillStyle = 'rgba(248, 73, 96, 0.2)';
      ctx.fill();
      
      // Draw ask line
      ctx.beginPath();
      ctx.moveTo(xScale(depthData.asks[0].price), yScale(depthData.asks[0].cumulative));
      
      for (let i = 1; i < depthData.asks.length; i++) {
        const { price, cumulative } = depthData.asks[i];
        ctx.lineTo(xScale(price), yScale(cumulative));
      }
      
      ctx.strokeStyle = '#f84960';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Draw current price line
    ctx.beginPath();
    ctx.moveTo(xScale(currentPrice), padding);
    ctx.lineTo(xScale(currentPrice), height - padding);
    ctx.strokeStyle = '#8c8e94';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Add chart title and labels
    ctx.fillStyle = '#f0f4f8';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('BTC/USD Market Depth', padding, 20);
    
    // Add legend
    ctx.fillStyle = '#00c076';
    ctx.fillRect(width - 100, 15, 10, 10);
    ctx.fillStyle = '#f84960';
    ctx.fillRect(width - 100, 35, 10, 10);
    
    ctx.fillStyle = '#8c8e94';
    ctx.textAlign = 'left';
    ctx.fillText('Bids', width - 85, 23);
    ctx.fillText('Asks', width - 85, 43);
  }, [depthData, isLoading, currentPrice]);
  
  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const container = canvas.parentElement;
        
        if (container) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
          
          // Redraw chart after resize
          // This will trigger the drawing effect due to the dependency
          // on canvas width/height changes
          const tempData = {...depthData};
          setDepthData(tempData);
        }
      }
    };
    
    // Initial size
    handleResize();
    
    // Add resize event listener
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [depthData]);
  
  return (
    <div className="depth-chart">
      {isLoading ? (
        <div className="depth-loading">Loading depth chart...</div>
      ) : (
        <canvas ref={canvasRef} className="depth-canvas"></canvas>
      )}
    </div>
  );
};

export default DepthChart;