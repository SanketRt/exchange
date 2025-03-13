// // src/OrderForm.js
// import React, { useState } from 'react';

// const OrderForm = () => {
//   const [orderData, setOrderData] = useState({
//     baseAsset: 'BTC',
//     quoteAsset: 'USD',
//     price: '',
//     quantity: '',
//     side: 'buy',
//     type: 'limit',
//     // Optionally, add kind: 'ioc' if needed
//   });

//   const [result, setResult] = useState(null);
//   const [error, setError] = useState('');

//   const handleChange = (e) => {
//     setOrderData({ ...orderData, [e.target.name]: e.target.value });
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError('');
//     try {
//       const response = await fetch('/api/v1/order', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         // Convert string values for price and quantity to numbers
//         body: JSON.stringify({
//           ...orderData,
//           price: parseFloat(orderData.price),
//           quantity: parseFloat(orderData.quantity),
//         }),
//       });
//       if (!response.ok) {
//         const errorMsg = await response.text();
//         throw new Error(errorMsg);
//       }
//       const data = await response.json();
//       setResult(data);
//     } catch (err) {
//       setError(err.message);
//     }
//   };

//   return (
//     <div>
//       <h2>Submit Order</h2>
//       <form onSubmit={handleSubmit}>
//         <div>
//           <label>Price:</label>
//           <input
//             type="number"
//             name="price"
//             value={orderData.price}
//             onChange={handleChange}
//             required
//           />
//         </div>
//         <div>
//           <label>Quantity:</label>
//           <input
//             type="number"
//             name="quantity"
//             value={orderData.quantity}
//             onChange={handleChange}
//             required
//           />
//         </div>
//         <div>
//           <label>Side:</label>
//           <select name="side" value={orderData.side} onChange={handleChange}>
//             <option value="buy">Buy</option>
//             <option value="sell">Sell</option>
//           </select>
//         </div>
//         <div>
//           <label>Type:</label>
//           <select name="type" value={orderData.type} onChange={handleChange}>
//             <option value="limit">Limit</option>
//             <option value="market">Market</option>
//           </select>
//         </div>
//         {/* Optionally, include kind if needed */}
//         <button type="submit">Submit Order</button>
//       </form>
//       {error && <p style={{ color: 'red' }}>Error: {error}</p>}
//       {result && (
//         <div>
//           <h3>Order Response</h3>
//           <p>Order ID: {result.orderId}</p>
//           <p>Executed Quantity: {result.executedQty}</p>
//           {result.fills && result.fills.length > 0 && (
//             <div>
//               <h4>Fills</h4>
//               <ul>
//                 {result.fills.map((fill, index) => (
//                   <li key={index}>
//                     Price: {fill.price}, Qty: {fill.qty}, Trade ID: {fill.tradeId}
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// };

// export default OrderForm;
