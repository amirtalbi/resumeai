import {
  Controller,
  Post,
  Param,
  UseGuards,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PdfExportService } from './pdf-export.service';
import { CvService } from '../cv/cv.service';

@ApiTags('PDF Export')
@Controller('pdf')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PdfExportController {
  constructor(
    private readonly pdfExportService: PdfExportService,
    private readonly cvService: CvService,
  ) {}

  @Post('export/:cvId')
  @ApiOperation({ summary: 'Generate and download ATS-friendly PDF' })
  async exportPdf(
    @Param('cvId', ParseUUIDPipe) cvId: string,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    const cv = await this.cvService.findOne(cvId, userId);
    const pdfBuffer = await this.pdfExportService.generateAtsFriendlyPdf(
      cv.contentJson,
    );

    const sanitizedTitle = cv.title.replace(/[^a-zA-Z0-9_-]/g, '_');

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${sanitizedTitle}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
    });

    res.end(pdfBuffer);
  }
}
