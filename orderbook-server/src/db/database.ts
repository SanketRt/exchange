import { DataSource } from 'typeorm';
import { User } from './entities/User';
import { Order } from './entities/Order';
import { Trade } from './entities/Trade';
import { Candle } from './entities/Candle';
import * as dotenv from 'dotenv';

dotenv.config();

// Database instance as a Singleton
class Database {
  private static instance: Database;
  private dataSource: DataSource | null = null;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async initialize(): Promise<DataSource> {
    if (this.dataSource && this.dataSource.isInitialized) {
      return this.dataSource;
    }

    this.dataSource = new DataSource({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'password',
      database: process.env.POSTGRES_DB || 'exchange',
      entities: [User, Order, Trade, Candle],
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
    });

    await this.dataSource.initialize();
    
    // Initialize TimescaleDB hypertables after connection
    await this.initializeTimescaleDB();
    
    console.log('Database connection established');
    return this.dataSource;
  }

  private async initializeTimescaleDB(): Promise<void> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      throw new Error('Database is not initialized');
    }

    try {
      // Check if TimescaleDB extension is installed
      await this.dataSource.query(`
        CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
      `);

      // Convert candles table to a hypertable if it's not already
      const isHypertable = await this.dataSource.query(`
        SELECT * FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'candles';
      `);

      if (isHypertable.length === 0) {
        await this.dataSource.query(`
          SELECT create_hypertable('candles', 'timestamp', 
            chunk_time_interval => interval '1 day', 
            if_not_exists => TRUE);
        `);
        console.log('Candles hypertable created');
      }

      // Convert trades table to a hypertable if it's not already
      const tradesIsHypertable = await this.dataSource.query(`
        SELECT * FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'trades';
      `);

      if (tradesIsHypertable.length === 0) {
        await this.dataSource.query(`
          SELECT create_hypertable('trades', 'timestamp', 
            chunk_time_interval => interval '1 day', 
            if_not_exists => TRUE);
        `);
        console.log('Trades hypertable created');
      }

      // Add retention policies (for example, keep data for 90 days)
      await this.dataSource.query(`
        SELECT add_retention_policy('candles', INTERVAL '90 days', if_not_exists => TRUE);
        SELECT add_retention_policy('trades', INTERVAL '90 days', if_not_exists => TRUE);
      `);

      console.log('TimescaleDB initialized successfully');
    } catch (error) {
      console.error('Error initializing TimescaleDB:', error);
      throw error;
    }
  }

  public getDataSource(): DataSource {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      throw new Error('Database is not initialized');
    }
    return this.dataSource;
  }

  public async disconnect(): Promise<void> {
    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      console.log('Database connection closed');
    }
  }
}

export const database = Database.getInstance();
export const getDataSource = async (): Promise<DataSource> => {
  return await database.initialize();
};
