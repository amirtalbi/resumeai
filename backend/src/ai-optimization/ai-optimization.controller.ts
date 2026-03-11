import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiOptimizationService } from './ai-optimization.service';
import { OptimizeCvDto } from './dto/ai-optimization.dto';

@ApiTags('AI Optimization')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiOptimizationController {
  constructor(
    private readonly aiOptimizationService: AiOptimizationService,
  ) {}

  @Post('optimize')
  @ApiOperation({ summary: 'Start CV optimization via AI (async)' })
  optimize(
    @CurrentUser('id') userId: string,
    @Body() dto: OptimizeCvDto,
  ) {
    return this.aiOptimizationService.optimizeCv(userId, dto);
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Get AI optimization job status' })
  getStatus(@Param('jobId') jobId: string) {
    return this.aiOptimizationService.getJobStatus(jobId);
  }

  @Get('health')
  @ApiOperation({ summary: 'Check AI service health' })
  healthCheck() {
    return this.aiOptimizationService.checkAiHealth();
  }
}
