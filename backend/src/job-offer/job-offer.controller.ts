import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JobOfferService } from './job-offer.service';
import {
  CreateJobOfferDto,
  UpdateJobOfferDto,
  ImportJobOffersDto,
} from './dto/job-offer.dto';

@ApiTags('Job Offers')
@Controller('job-offer')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobOfferController {
  private static readonly IMPORT_ALLOWED_EMAIL = 'amirotalbi94@gmail.com';

  constructor(private readonly jobOfferService: JobOfferService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new job offer' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateJobOfferDto,
  ) {
    return this.jobOfferService.create(userId, dto);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import job offers from a selected platform' })
  importOffers(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail: string,
    @Body() dto: ImportJobOffersDto,
  ) {
    if (
      userEmail?.toLowerCase() !==
      JobOfferController.IMPORT_ALLOWED_EMAIL.toLowerCase()
    ) {
      throw new ForbiddenException(
        'Only amirotalbi94@gmail.com can manage automatic job imports.',
      );
    }

    return this.jobOfferService.importFromPlatform(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all job offers for current user' })
  findAll(@CurrentUser('id') userId: string) {
    return this.jobOfferService.findAllByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific job offer' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.jobOfferService.findOne(id, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a job offer' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateJobOfferDto,
  ) {
    return this.jobOfferService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a job offer' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.jobOfferService.remove(id, userId);
  }
}
