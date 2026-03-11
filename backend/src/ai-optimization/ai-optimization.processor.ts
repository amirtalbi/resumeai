import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { OllamaService } from './ollama.service';

export interface AiOptimizationJobData {
  userId: string;
  cvId: string;
  cvContent: Record<string, unknown>;
  jobDescription: string;
  keywords: string[];
  requiredSkills: string[];
}

@Processor('ai-optimization')
export class AiOptimizationProcessor {
  private readonly logger = new Logger(AiOptimizationProcessor.name);

  constructor(private readonly ollamaService: OllamaService) {}

  @Process('optimize-cv')
  async handleOptimization(job: Job<AiOptimizationJobData>) {
    this.logger.log(`Processing AI optimization job ${job.id}`);

    try {
      const { cvContent, jobDescription, keywords, requiredSkills } = job.data;

      const prompt = this.ollamaService.buildCvOptimizationPrompt(
        cvContent,
        jobDescription,
        keywords,
        requiredSkills,
      );

      await job.progress(10);

      const aiResponse = await this.ollamaService.generate(prompt);

      await job.progress(80);

      const parsed = this.parseAiResponse(aiResponse);

      await job.progress(100);

      this.logger.log(`AI optimization job ${job.id} completed`);
      return parsed;
    } catch (error) {
      this.logger.error(`AI optimization job ${job.id} failed`, error);
      throw error;
    }
  }

  private parseAiResponse(response: string): Record<string, unknown> {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No JSON found in AI response');
    } catch {
      return {
        optimizedContent: null,
        changes: [],
        rawResponse: response,
        error: 'Failed to parse AI response as JSON',
      };
    }
  }
}
