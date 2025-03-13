import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

// This entity will be converted to a TimescaleDB hypertable
@Entity('candles')
@Index(['market', 'timestamp'])
export class Candle {
  @PrimaryColumn()
  market: string;

  @PrimaryColumn()
  timeframe: string; // e.g., '1m', '5m', '15m', '1h', '4h', '1d'

  @PrimaryColumn()
  timestamp: Date;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  open: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  high: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  low: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  close: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  volume: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  quoteVolume: number;

  @Column({ default: 0 })
  trades: number;
}
