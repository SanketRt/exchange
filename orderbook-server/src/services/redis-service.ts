import { createClient, RedisClientType } from 'redis';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Redis Service - Singleton implementation for pub/sub messaging
 */
class RedisService {
  private static instance: RedisService;
  private publisher: RedisClientType;
  private subscriber: RedisClientType;
  private handlers: Map<string, Set<(message: any) => void>>;
  private isConnected: boolean = false;

  private constructor() {
    const redisConfig = {
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            console.error('Redis connection failed after 10 retries');
            return new Error('Retry time exhausted');
          }
          // Reconnect after increasing delay
          return Math.min(retries * 100, 3000);
        }
      },
      password: process.env.REDIS_PASSWORD || undefined
    };

    this.publisher = createClient(redisConfig);
    this.subscriber = createClient(redisConfig);
    this.handlers = new Map();

    this.setupEventHandlers();
    this.initializeConnections();
  }

  private setupEventHandlers(): void {
    // Publisher error handling
    this.publisher.on('error', (error: Error) => {
      console.error('Redis Publisher Error:', error);
    });

    // Subscriber error handling
    this.subscriber.on('error', (error: Error) => {
      console.error('Redis Subscriber Error:', error);
    });

    // Connection event handlers
    this.publisher.on('connect', () => {
      console.log('Redis publisher connected');
    });

    this.subscriber.on('connect', () => {
      console.log('Redis subscriber connected');
    });

    this.publisher.on('end', () => {
      console.log('Redis publisher connection ended');
      this.isConnected = false;
    });

    this.subscriber.on('end', () => {
      console.log('Redis subscriber connection ended');
    });
  }

  private async initializeConnections(): Promise<void> {
    try {
      await Promise.all([
        this.publisher.connect(),
        this.subscriber.connect()
      ]);
      this.isConnected = true;
      console.log('Redis clients connected successfully');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
    }
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * Subscribe to a Redis channel
   * @param channel Channel to subscribe to
   * @param handler Handler function to process received messages
   */
  public async subscribe(channel: string, handler: (message: any) => void): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }

    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      
      await this.subscriber.subscribe(channel, (message: string) => {
        try {
          const parsedMessage = JSON.parse(message);
          const handlers = this.handlers.get(channel);
          if (handlers) {
            handlers.forEach(handler => handler(parsedMessage));
          }
        } catch (error) {
          console.error(`Error handling message from channel ${channel}:`, error);
        }
      });
    }
    
    this.handlers.get(channel)!.add(handler);
  }

  /**
   * Unsubscribe from a Redis channel
   * @param channel Channel to unsubscribe from
   * @param handler Specific handler to remove (if none provided, all handlers for channel will be removed)
   */
  public async unsubscribe(channel: string, handler?: (message: any) => void): Promise<void> {
    if (!this.handlers.has(channel)) {
      return;
    }

    if (handler) {
      this.handlers.get(channel)!.delete(handler);
      if (this.handlers.get(channel)!.size === 0) {
        this.handlers.delete(channel);
        await this.subscriber.unsubscribe(channel);
      }
    } else {
      this.handlers.delete(channel);
      await this.subscriber.unsubscribe(channel);
    }
  }

  /**
   * Publish a message to a Redis channel
   * @param channel Channel to publish to
   * @param message Message to publish
   */
  public async publish(channel: string, message: any): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }

    try {
      await this.publisher.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error('Failed to publish message:', error);
      throw error;
    }
  }

  /**
   * Store a value in Redis
   * @param key Redis key
   * @param value Value to store
   * @param expirySeconds Optional TTL in seconds
   */
  public async set(key: string, value: any, expirySeconds?: number): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }

    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    try {
      if (expirySeconds) {
        await this.publisher.setEx(key, expirySeconds, stringValue);
        return 'OK';
      } else {
        return await this.publisher.set(key, stringValue) || 'OK';
      }
    } catch (error) {
      console.error('Failed to set value:', error);
      throw error;
    }
  }

  /**
   * Retrieve a value from Redis
   * @param key Redis key
   * @param parse Whether to parse the value as JSON
   */
  public async get(key: string, parse = false): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }

    try {
      const value = await this.publisher.get(key);
      if (value && parse) {
        try {
          return JSON.parse(value);
        } catch (error) {
          console.error(`Error parsing Redis value for key ${key}:`, error);
          return value;
        }
      }
      return value;
    } catch (error) {
      console.error('Failed to get value:', error);
      throw error;
    }
  }

  /**
   * Delete a key from Redis
   * @param key Redis key to delete
   */
  public async delete(key: string): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }

    try {
      return await this.publisher.del(key);
    } catch (error) {
      console.error('Failed to delete key:', error);
      throw error;
    }
  }

  /**
   * Check if Redis is connected
   */
  public isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Close Redis connections
   */
  public async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.publisher.quit(),
        this.subscriber.quit()
      ]);
      this.isConnected = false;
      console.log('Redis clients disconnected');
    } catch (error) {
      console.error('Error disconnecting Redis clients:', error);
    }
  }
}

export const redisService = RedisService.getInstance();