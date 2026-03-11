import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobOfferController } from './job-offer.controller';
import { JobOfferService } from './job-offer.service';
import { JobOffer } from './entities/job-offer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([JobOffer])],
  controllers: [JobOfferController],
  providers: [JobOfferService],
  exports: [JobOfferService],
})
export class JobOfferModule {}
