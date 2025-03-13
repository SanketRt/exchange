/**
 * WebSocket service for real-time data streaming
 */
class WebSocketService {
  constructor() {
    this.socket = null;
    this.subscribers = {
      'trades': new Set(),
      'depth': new Set(),
      'ticker': new Set(),
      'connectionStatus': new Set()
    };
    this.isConnected = false;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.lastMessages = new Map(); // Cache for last message per stream
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = 'ws://localhost:3000/ws';
    
    this.socket = new WebSocket(wsUrl);
    
    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.notifySubscribers('connectionStatus', { connected: true });

      // Resubscribe to previous streams if any
      const streams = this.getActiveStreams();
      if (streams.length > 0) {
        this.subscribe(streams);
      }
    };
    
    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.stream) {
          // Extract stream type (trades, depth, ticker)
          const streamParts = message.stream.split('@');
          const streamType = streamParts[0];
          
          // Store the latest message for this stream
          this.lastMessages.set(message.stream, message.data);
          
          // Notify subscribers
          if (this.subscribers[streamType]) {
            this.notifySubscribers(streamType, {
              stream: message.stream,
              data: message.data
            });
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    this.socket.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
      this.isConnected = false;
      this.notifySubscribers('connectionStatus', { connected: false });
      
      // Attempt to reconnect
      this.attemptReconnect();
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`Attempting to reconnect in ${delay}ms`);
    
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    clearTimeout(this.reconnectTimeout);
  }
  
  subscribe(streams) {
    if (!Array.isArray(streams)) {
      streams = [streams];
    }
    
    if (!this.isConnected) {
      console.warn('WebSocket not connected, attempting to connect first');
      this.connect();
      return;
    }
    
    const message = {
      type: 'subscribe',
      streams: streams
    };
    
    this.socket.send(JSON.stringify(message));
  }
  
  unsubscribe(streams) {
    if (!Array.isArray(streams)) {
      streams = [streams];
    }
    
    if (!this.isConnected) {
      console.warn('WebSocket not connected');
      return;
    }
    
    const message = {
      type: 'unsubscribe',
      streams: streams
    };
    
    this.socket.send(JSON.stringify(message));
  }
  
  addSubscriber(streamType, callback) {
    if (!this.subscribers[streamType]) {
      this.subscribers[streamType] = new Set();
    }
    
    this.subscribers[streamType].add(callback);
    
    // Send the last message for this stream type if available
    if (streamType !== 'connectionStatus') {
      for (const [stream, data] of this.lastMessages.entries()) {
        if (stream.startsWith(streamType)) {
          callback({
            stream,
            data
          });
        }
      }
    } else {
      // Send current connection status
      callback({ connected: this.isConnected });
    }
    
    return () => this.removeSubscriber(streamType, callback);
  }
  
  removeSubscriber(streamType, callback) {
    if (this.subscribers[streamType]) {
      this.subscribers[streamType].delete(callback);
    }
  }
  
  notifySubscribers(streamType, data) {
    if (this.subscribers[streamType]) {
      this.subscribers[streamType].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket subscriber callback:', error);
        }
      });
    }
  }
  
  getActiveStreams() {
    const activeStreams = [];
    
    if (this.subscribers['trades'].size > 0) {
      activeStreams.push('trades@BTC_USDC');
    }
    
    if (this.subscribers['depth'].size > 0) {
      activeStreams.push('depth@BTC_USDC');
    }
    
    if (this.subscribers['ticker'].size > 0) {
      activeStreams.push('ticker@BTC_USDC');
    }
    
    return activeStreams;
  }
}

// Create a singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;
