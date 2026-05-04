import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CvService } from '../cv/cv.service';
import { CvContent } from '../cv/entities/cv.entity';
import { JobOfferService } from '../job-offer/job-offer.service';
import { OllamaService } from './ollama.service';
import { OptimizeCvDto, GenerateCoverLetterDto } from './dto/ai-optimization.dto';

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

  async generateCoverLetter(userId: string, dto: GenerateCoverLetterDto) {
    const cv = await this.cvService.findOne(dto.cvId, userId);
    const jobOffer = await this.jobOfferService.findOne(dto.jobOfferId, userId);

    const language = this.resolveLanguage(cv.contentJson);
    const prompt = this.buildCoverLetterPrompt(
      cv.contentJson,
      jobOffer.description,
      jobOffer.title,
      jobOffer.company,
      language,
    );

    const response = await this.ollamaService.generate(prompt);
    const coverLetter = this.trimCoverLetter(response);

    return {
      language,
      coverLetter,
    };
  }

  private resolveLanguage(cvContent: CvContent): 'fr' | 'en' {
    const language = String(cvContent.language || '').toLowerCase();
    return language === 'en' ? 'en' : 'fr';
  }

  private buildCoverLetterPrompt(
    cvContent: CvContent,
    jobDescription: string,
    jobTitle?: string,
    company?: string,
    language: 'fr' | 'en' = 'fr',
  ): string {
    const intro = language === 'en'
      ? 'You are a professional recruiter and copywriter.'
      : 'Tu es un recruteur professionnel et un rédacteur expert.';
    const instructions = language === 'en'
      ? `Write a 500-word cover letter tailored to the job offer below.
1. Use only facts from the CV. Do not invent skills, companies, roles, or dates.
2. Align experience with the job requirements.
3. Keep a confident, professional tone.
4. Do not use bullet points; write in paragraphs.
5. Output only the letter text, no title, no JSON, no markdown.`
      : `Rédige une lettre de motivation d'environ 500 mots, adaptée à l'offre d'emploi ci-dessous.
1. Utilise uniquement les faits présents dans le CV. N'invente aucune compétence, entreprise, poste ou date.
2. Aligne l'expérience sur les exigences du poste.
3. Garde un ton professionnel et convaincant.
4. Pas de puces, uniquement des paragraphes.
5. Réponds uniquement avec le texte de la lettre, sans titre, sans JSON, sans markdown.`;

    return `${intro}

${instructions}

POSTE: ${jobTitle || ''}
ENTREPRISE: ${company || ''}

CV:
${JSON.stringify(cvContent, null, 2)}

OFFRE D'EMPLOI:
${jobDescription}
`;
  }

  private trimCoverLetter(text: string): string {
    return text.replace(/^[\s\r\n]+|[\s\r\n]+$/g, '');
  }
}
