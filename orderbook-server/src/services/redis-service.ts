import Redis from 'redis';
import * as dotenv from 'dotenv';
import { promisify } from 'util';

dotenv.config();

/**
 * Redis Service - Singleton implementation for pub/sub messaging
 */
class RedisService {
  private static instance: RedisService;
  private publisher: Redis.RedisClient;
  private subscriber: Redis.RedisClient;
  private handlers: Map<string, Set<(message: any) => void>>;
  
  // Promisified Redis functions
  private asyncGet: (key: string) => Promise<string | null>;
  private asyncSet: (key: string, value: string) => Promise<string>;
  private asyncDel: (key: string) => Promise<number>;

  private constructor() {
    const redisOptions: Redis.ClientOpts = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          // End reconnection attempts on ECONNREFUSED
          return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          // End reconnection attempts after 1 hour
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          // End reconnection attempts after 10 attempts
          return undefined;
        }
        // Reconnect after increasing delay
        return Math.min(options.attempt * 100, 3000);
      }
    };

    this.publisher = Redis.createClient(redisOptions);
    this.subscriber = Redis.createClient(redisOptions);
    this.handlers = new Map();

    // Promisify Redis methods
    this.asyncGet = promisify(this.publisher.get).bind(this.publisher);
    this.asyncSet = promisify(this.publisher.set).bind(this.publisher);
    this.asyncDel = promisify(this.publisher.del).bind(this.publisher);

    this.subscriber.on('message', (channel, message) => {
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

    // Log Redis errors
    this.publisher.on('error', (error) => {
      console.error('Redis Publisher Error:', error);
    });

    this.subscriber.on('error', (error) => {
      console.error('Redis Subscriber Error:', error);
    });
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
  public subscribe(channel: string, handler: (message: any) => void): void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      this.subscriber.subscribe(channel);
    }
    this.handlers.get(channel)!.add(handler);
  }

  /**
   * Unsubscribe from a Redis channel
   * @param channel Channel to unsubscribe from
   * @param handler Specific handler to remove (if none provided, all handlers for channel will be removed)
   */
  public unsubscribe(channel: string, handler?: (message: any) => void): void {
    if (!this.handlers.has(channel)) {
      return;
    }

    if (handler) {
      this.handlers.get(channel)!.delete(handler);
      if (this.handlers.get(channel)!.size === 0) {
        this.handlers.delete(channel);
        this.subscriber.unsubscribe(channel);
      }
    } else {
      this.handlers.delete(channel);
      this.subscriber.unsubscribe(channel);
    }
  }

  /**
   * Publish a message to a Redis channel
   * @param channel Channel to publish to
   * @param message Message to publish
   */
  public publish(channel: string, message: any): void {
    this.publisher.publish(channel, JSON.stringify(message));
  }

  /**
   * Store a value in Redis
   * @param key Redis key
   * @param value Value to store
   * @param expirySeconds Optional TTL in seconds
   */
  public async set(key: string, value: any, expirySeconds?: number): Promise<string> {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    if (expirySeconds) {
      return new Promise((resolve, reject) => {
        this.publisher.set(key, stringValue, 'EX', expirySeconds, (err, reply) => {
          if (err) reject(err);
          else resolve(reply);
        });
      });
    }
    
    return this.asyncSet(key, stringValue);
  }

  /**
   * Retrieve a value from Redis
   * @param key Redis key
   * @param parse Whether to parse the value as JSON
   */
  public async get(key: string, parse = false): Promise<any> {
    const value = await this.asyncGet(key);
    if (value && parse) {
      try {
        return JSON.parse(value);
      } catch (error) {
        console.error(`Error parsing Redis value for key ${key}:`, error);
        return value;
      }
    }
    return value;
  }

  /**
   * Delete a key from Redis
   * @param key Redis key to delete
   */
  public async delete(key: string): Promise<number> {
    return this.asyncDel(key);
  }

  /**
   * Close Redis connections
   */
  public async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      this.publisher.quit();
      this.subscriber.quit();
      resolve();
    });
  }
}

export const redisService = RedisService.getInstance();
