// WebSocket service for real-time market data
class WebSocketService {
  constructor() {
    this.ws = null;
    this.subscribers = new Map();
    this.isConnected = false;
    this.reconnectInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    try {
      // Try to connect to WebSocket server
      this.ws = new WebSocket('ws://localhost:3000');
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Subscribe to market data streams
        this.subscribe('ticker');
        this.subscribe('trades');
        this.subscribe('orderbook');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.warn('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnected = false;
      };

    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      this.isConnected = false;
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, 5000); // Retry after 5 seconds
    } else {
      console.log('Max reconnection attempts reached');
    }
  }

  subscribe(channel) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'subscribe',
        channel: channel
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  handleMessage(data) {
    const { type, channel } = data;
    
    if (this.subscribers.has(channel)) {
      const callbacks = this.subscribers.get(channel);
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in subscriber callback:', error);
        }
      });
    }
  }

  addSubscriber(channel, callback) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    
    this.subscribers.get(channel).add(callback);
    
    // Return unsubscribe function
    return () => {
      const channelSubscribers = this.subscribers.get(channel);
      if (channelSubscribers) {
        channelSubscribers.delete(callback);
        if (channelSubscribers.size === 0) {
          this.subscribers.delete(channel);
        }
      }
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
    
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    
    this.subscribers.clear();
    this.isConnected = false;
  }

  // Send message to server
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;