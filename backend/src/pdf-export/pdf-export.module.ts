import { Module } from '@nestjs/common';
import { PdfExportController } from './pdf-export.controller';
import { PdfExportService } from './pdf-export.service';
import { CvModule } from '../cv/cv.module';

@Module({
  imports: [CvModule],
  controllers: [PdfExportController],
  providers: [PdfExportService],
  exports: [PdfExportService],
})
export class PdfExportModule {}
