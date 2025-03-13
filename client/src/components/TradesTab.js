import React from 'react';

const TradesTab = () => {
  // Mock trades data - in a real app, this would come from a WebSocket connection
  const trades = [
    { id: 1, price: 133.41, quantity: 0.0234, side: 'buy', time: '12:30:45' },
    { id: 2, price: 133.55, quantity: 0.1, side: 'sell', time: '12:30:30' },
    { id: 3, price: 133.50, quantity: 0.05, side: 'buy', time: '12:29:45' },
    { id: 4, price: 133.48, quantity: 0.0756, side: 'buy', time: '12:29:28' },
    { id: 5, price: 133.47, quantity: 0.2, side: 'sell', time: '12:28:55' },
  ];

  return (
    <div className="trades-tab">
      <table className="trades-table">
        <thead>
          <tr>
            <th>Price</th>
            <th>Amount</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {trades.map(trade => (
            <tr key={trade.id} className={trade.side === 'buy' ? 'buy-row' : 'sell-row'}>
              <td className={trade.side === 'buy' ? 'buy-price' : 'sell-price'}>
                {trade.price.toFixed(2)}
              </td>
              <td>{trade.quantity.toFixed(4)}</td>
              <td>{trade.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TradesTab; 