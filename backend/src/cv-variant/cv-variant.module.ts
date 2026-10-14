import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CvModule } from '../cv/cv.module';
import { JobOfferModule } from '../job-offer/job-offer.module';
import { PdfExportModule } from '../pdf-export/pdf-export.module';
import { CvVariant } from './entities/cv-variant.entity';
import { CvVariantController } from './cv-variant.controller';
import { CvVariantService } from './cv-variant.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CvVariant]),
    CvModule,
    JobOfferModule,
    PdfExportModule,
  ],
  controllers: [CvVariantController],
  providers: [CvVariantService],
})
export class CvVariantModule {}
