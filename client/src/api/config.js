// API Configuration - Create this as a new file: src/api/config.js
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-domain.com' 
  : 'http://localhost:3000';

export const API_ENDPOINTS = {
  orderbook: (symbol) => `${API_BASE_URL}/api/v1/orderbook/${symbol}`,
  trades: (symbol) => `${API_BASE_URL}/api/v1/trades/${symbol}`,
  order: () => `${API_BASE_URL}/api/v1/order`
};

// Helper function for API calls
export const apiCall = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};