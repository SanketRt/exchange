import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Order } from './Order';

@Entity('trades')
@Index(['market', 'timestamp']) // Index for TimescaleDB hypertable
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tradeId: string;

  @Column()
  market: string;

  @Column()
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  side: 'buy' | 'sell';

  @Column()
  makerOrderId: string;

  @Column()
  takerOrderId: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  price: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  quantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  value: number; // price * quantity

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  fee: number;

  @Column()
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}
