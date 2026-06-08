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
      ? `Write a cover letter strictly based on the CV and the job offer below.
1. Use ONLY facts present in the CV. Do not invent skills, companies, roles, dates, projects, certifications, or achievements.
2. If a detail is missing from the CV, do not mention it.
3. Align existing experience with the job requirements without adding new facts.
4. Keep a confident, professional tone.
5. No bullet points; write in paragraphs.
6. Output only the letter text, no title, no JSON, no markdown.
7. HARD LIMIT: maximum 500 words.`
      : `Rédige une lettre de motivation strictement basée sur le CV et l'offre d'emploi ci-dessous.
1. Utilise UNIQUEMENT les faits présents dans le CV. N'invente aucune compétence, entreprise, poste, date, projet, certification ou réalisation.
2. Si un détail n'est pas dans le CV, ne le mentionne pas.
3. Aligne l'expérience existante sur les exigences du poste sans ajouter de faits.
4. Garde un ton professionnel et convaincant.
5. Pas de puces, uniquement des paragraphes.
6. Réponds uniquement avec le texte de la lettre, sans titre, sans JSON, sans markdown.
7. LIMITE STRICTE: maximum 500 mots.`;

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
    const cleaned = text.replace(/^[\s\r\n]+|[\s\r\n]+$/g, '');
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length <= 500) {
      return cleaned;
    }

    return words.slice(0, 500).join(' ');
  }
}
