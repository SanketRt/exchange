import React from 'react';

const DepthChart = () => {
  // This is a placeholder for the depth chart
  // In a real implementation, you would use a charting library like Chart.js or D3.js
  // to visualize the order book depth

  return (
    <div className="depth-chart">
      <div className="chart-placeholder">
        <h3>Depth Chart</h3>
        <p>This would be a visualization of the order book depth</p>
        <div className="mock-chart">
          <div className="chart-legend">
            <div className="legend-item">
              <div className="color-box bid-color"></div>
              <span>Bids</span>
            </div>
            <div className="legend-item">
              <div className="color-box ask-color"></div>
              <span>Asks</span>
            </div>
          </div>
          <div className="chart-visual">
            <div className="bid-area"></div>
            <div className="price-line"></div>
            <div className="ask-area"></div>
          </div>
          <div className="chart-x-axis">
            <span>131.00</span>
            <span>132.00</span>
            <span>133.48</span>
            <span>134.00</span>
            <span>135.00</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepthChart; 