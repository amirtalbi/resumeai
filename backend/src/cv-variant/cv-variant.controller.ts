import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CvVariantService } from './cv-variant.service';
import {
  CreateVariantDto,
  DuplicateVariantDto,
  PreviewVariantDto,
  UpdateVariantDto,
} from './dto/cv-variant.dto';

@ApiTags('CV Variants')
@Controller('cv-variants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CvVariantController {
  constructor(private readonly variantService: CvVariantService) {}

  @Post()
  @ApiOperation({ summary: 'Create a variant (auto-selected from a job offer if provided)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateVariantDto) {
    return this.variantService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List variants, optionally for one master CV' })
  findAll(
    @CurrentUser('id') userId: string,
    @Query('cvId') cvId?: string,
  ) {
    return this.variantService.findAll(userId, cvId);
  }

  @Post('preview')
  @ApiOperation({ summary: 'Resolve rules against a master CV without saving' })
  preview(@CurrentUser('id') userId: string, @Body() dto: PreviewVariantDto) {
    return this.variantService.preview(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Variant with master content and resolved content' })
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.variantService.detail(id, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a variant' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.variantService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a variant' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.variantService.remove(id, userId);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a variant, optionally targeting a job offer' })
  duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: DuplicateVariantDto,
  ) {
    return this.variantService.duplicate(id, userId, dto);
  }

  @Post(':id/export')
  @ApiOperation({ summary: 'Download the variant as an ATS-friendly PDF (auto-named)' })
  async exportPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.variantService.exportPdf(id, userId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length.toString(),
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });

    res.end(buffer);
  }
}
