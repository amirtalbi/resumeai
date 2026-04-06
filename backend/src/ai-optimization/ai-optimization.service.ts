import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CvService } from '../cv/cv.service';
import { JobOfferService } from '../job-offer/job-offer.service';
import { OllamaService } from './ollama.service';
import { OptimizeCvDto } from './dto/ai-optimization.dto';

@Injectable()
export class AiOptimizationService {
  private readonly logger = new Logger(AiOptimizationService.name);

  constructor(
    @InjectQueue('ai-optimization')
    private readonly aiQueue: Queue,
    private readonly cvService: CvService,
    private readonly jobOfferService: JobOfferService,
    private readonly ollamaService: OllamaService,
  ) {}

  async optimizeCv(userId: string, dto: OptimizeCvDto) {
    const cv = await this.cvService.findOne(dto.cvId, userId);
    const jobOffer = await this.jobOfferService.findOne(dto.jobOfferId, userId);

    const job = await this.aiQueue.add('optimize-cv', {
      userId,
      cvId: cv.id,
      cvContent: cv.contentJson,
      jobDescription: jobOffer.description,
      keywords: jobOffer.keywords,
      requiredSkills: jobOffer.requiredSkills,
    });

    this.logger.log(`Created AI optimization job ${job.id} for CV ${cv.id}`);

    return {
      jobId: job.id,
      status: 'queued',
      message: 'CV optimization started',
    };
  }

  async getJobStatus(jobId: string) {
    const job = await this.aiQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress();

    const result: Record<string, unknown> = {
      jobId: job.id,
      status: state,
      progress,
    };

    if (state === 'completed') {
      result.result = job.returnvalue;
    }

    if (state === 'failed') {
      result.error = job.failedReason;
    }

    return result;
  }

  async checkAiHealth() {
    const available = await this.ollamaService.isAvailable();
    return {
      status: available ? 'available' : 'unavailable',
      model: process.env.OLLAMA_MODEL || 'mistral',
    };
  }
}
