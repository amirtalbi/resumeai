import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AiOptimizationController } from './ai-optimization.controller';
import { AiOptimizationService } from './ai-optimization.service';
import { AiOptimizationProcessor } from './ai-optimization.processor';
import { OllamaService } from './ollama.service';
import { CvModule } from '../cv/cv.module';
import { JobOfferModule } from '../job-offer/job-offer.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'ai-optimization',
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: false,
        removeOnFail: false,
      },
    }),
    CvModule,
    JobOfferModule,
  ],
  controllers: [AiOptimizationController],
  providers: [AiOptimizationService, AiOptimizationProcessor, OllamaService],
  exports: [AiOptimizationService],
})
export class AiOptimizationModule {}
