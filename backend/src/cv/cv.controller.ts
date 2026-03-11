import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CvService } from './cv.service';
import { CreateCvDto, UpdateCvDto } from './dto/cv.dto';
import * as pdfParse from 'pdf-parse';

@ApiTags('CV')
@Controller('cv')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CvController {
  constructor(private readonly cvService: CvService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new CV' })
  create(@CurrentUser('id') userId: string, @Body() createCvDto: CreateCvDto) {
    return this.cvService.create(userId, createCvDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all CVs for current user' })
  findAll(@CurrentUser('id') userId: string) {
    return this.cvService.findAllByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific CV' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.cvService.findOne(id, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a CV' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() updateCvDto: UpdateCvDto,
  ) {
    return this.cvService.update(id, userId, updateCvDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a CV' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.cvService.remove(id, userId);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get CV version history' })
  getVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.cvService.getVersions(id, userId);
  }

  @Post('import-pdf')
  @ApiOperation({ summary: 'Import CV from PDF file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async importPdf(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }

    const pdfData = await pdfParse(file.buffer);
    const extractedText = pdfData.text;

    const title = `Imported CV - ${new Date().toLocaleDateString()}`;
    return this.cvService.importFromPdfText(userId, title, extractedText);
  }
}
