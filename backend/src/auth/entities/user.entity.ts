import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Cv } from '../../cv/entities/cv.entity';
import { JobOffer } from '../../job-offer/entities/job-offer.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  refreshToken: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Cv, (cv) => cv.user)
  cvs: Cv[];

  @OneToMany(() => JobOffer, (jobOffer) => jobOffer.user)
  jobOffers: JobOffer[];
}
