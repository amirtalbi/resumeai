import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Cv } from '../../cv/entities/cv.entity';
import { VariantRules } from '../cv-variant.types';

@Entity('cv_variants')
export class CvVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Index()
  @Column()
  cvId: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  jobOfferId: string | null;

  @Column({ type: 'jsonb' })
  rules: VariantRules;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Cv, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cvId' })
  cv: Cv;
}
