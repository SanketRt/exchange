import WebSocket, { WebSocketServer } from 'ws';
import { Server } from 'http';
import { orderbook } from './orderbook';
import Redis from 'ioredis';

// Initialize Redis connection for pub/sub
const redisPub = new Redis();
const redisSub = new Redis();

// Define stream types
type StreamType = 'trades' | 'depth' | 'ticker';

interface SubscriptionData {
  market: string;
  streamType: StreamType;
}

class WebSocketHandler {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, Set<string>> = new Map();
  private lastTickerData: Map<string, any> = new Map();
  
  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.setupWebSocketServer();
    this.subscribeToRedis();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Client connected');
      this.clients.set(ws, new Set());

      // Send initial data
      this.sendInitialData(ws);

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private sendInitialData(ws: WebSocket) {
    // Send initial orderbook snapshot
    const orderbookSnapshot = orderbook.getSnapshot();
    ws.send(JSON.stringify({
      stream: 'depth@BTC_USDC',
      data: orderbookSnapshot
    }));

    // Send initial ticker data if available
    for (const [market, data] of this.lastTickerData.entries()) {
      ws.send(JSON.stringify({
        stream: `ticker@${market}`,
        data
      }));
    }
  }

  private handleMessage(ws: WebSocket, message: any) {
    if (message.type === 'subscribe') {
      if (!message.streams || !Array.isArray(message.streams)) {
        ws.send(JSON.stringify({ error: 'Invalid subscription format' }));
        return;
      }

      const clientStreams = this.clients.get(ws) || new Set();
      
      message.streams.forEach((stream: string) => {
        clientStreams.add(stream);
      });

      this.clients.set(ws, clientStreams);
      ws.send(JSON.stringify({ 
        type: 'subscribed', 
        streams: Array.from(clientStreams) 
      }));
    } else if (message.type === 'unsubscribe') {
      if (!message.streams || !Array.isArray(message.streams)) {
        ws.send(JSON.stringify({ error: 'Invalid unsubscription format' }));
        return;
      }

      const clientStreams = this.clients.get(ws);
      if (clientStreams) {
        message.streams.forEach((stream: string) => {
          clientStreams.delete(stream);
        });
      }

      ws.send(JSON.stringify({ 
        type: 'unsubscribed', 
        streams: message.streams 
      }));
    }
  }

  private subscribeToRedis() {
    // Subscribe to relevant Redis channels
    redisSub.subscribe('trades@BTC_USDC', 'depth@BTC_USDC', 'ticker@BTC_USDC');

    redisSub.on('message', (channel: string, message: string) => {
      try {
        const data = JSON.parse(message);
        
        // Store latest ticker data
        if (channel.startsWith('ticker@')) {
          const market = channel.split('@')[1];
          this.lastTickerData.set(market, data);
        }
        
        // Broadcast to subscribed clients
        this.broadcastMessage(channel, data);
      } catch (error) {
        console.error('Error processing Redis message:', error);
      }
    });
  }

  private broadcastMessage(channel: string, data: any) {
    for (const [client, streams] of this.clients.entries()) {
      if (streams.has(channel) || streams.has('*')) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            stream: channel,
            data
          }));
        }
      }
    }
  }

  // Method to publish data to Redis
  public publishToStream(stream: string, data: any) {
    redisPub.publish(stream, JSON.stringify(data));
  }
  
  // Method to publish data to a specific user
  public publishToUser(userId: string, eventType: string, data: any) {
    // In a real system, we would have a way to map userId to specific WebSocket connections
    // For now, we'll broadcast to all clients that are subscribed to a user-specific channel
    const userChannel = `user@${userId}`;
    this.publishToStream(userChannel, {
      type: eventType,
      data
    });
  }
}

let websocketHandler: WebSocketHandler | null = null;

export function initializeWebSocketServer(server: Server) {
  websocketHandler = new WebSocketHandler(server);
  return websocketHandler;
}

export function getWebSocketHandler() {
  return websocketHandler;
}
