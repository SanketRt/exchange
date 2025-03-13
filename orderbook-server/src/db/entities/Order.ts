import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './User';
import { Trade } from './Trade';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  market: string; // Format: BTC_USDC

  @Column()
  side: 'buy' | 'sell';

  @Column()
  type: 'limit' | 'market';

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  price: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  quantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  filledQuantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  remainingQuantity: number;

  @Column()
  status: 'new' | 'partially_filled' | 'filled' | 'canceled' | 'rejected';

  @Column({ nullable: true })
  reason: string;

  @OneToMany(() => Trade, trade => trade.order)
  trades: Trade[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
