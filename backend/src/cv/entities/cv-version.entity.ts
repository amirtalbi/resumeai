import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Cv } from './cv.entity';

@Entity('cv_versions')
export class CvVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  cvId: string;

  @Column()
  versionNumber: number;

  @Column({ type: 'jsonb' })
  contentJson: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  modificationsHistory: Record<string, unknown>;

  @Column({ nullable: true })
  jobOfferId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Cv, (cv) => cv.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cvId' })
  cv: Cv;
}
