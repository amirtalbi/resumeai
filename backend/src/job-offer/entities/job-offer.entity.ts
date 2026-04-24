import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('job_offers')
export class JobOffer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  company: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  platform: string;

  @Column({ type: 'text', nullable: true })
  sourceUrl: string;

  @Column({ type: 'text', nullable: true })
  applicationUrl: string;

  @Column({ nullable: true })
  externalId: string;

  @Column({ type: 'jsonb', default: [] })
  keywords: string[];

  @Column({ type: 'jsonb', default: [] })
  requiredSkills: string[];

  @Column({ type: 'jsonb', nullable: true })
  analysisResult: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.jobOffers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
