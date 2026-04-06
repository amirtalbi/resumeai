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

      const parsed = this.parseAiResponse(aiResponse, cvContent);

      await job.progress(100);

      this.logger.log(`AI optimization job ${job.id} completed`);
      return parsed;
    } catch (error) {
      this.logger.error(`AI optimization job ${job.id} failed`, error);
      throw error;
    }
  }

  private parseAiResponse(
    response: string,
    originalCvContent: Record<string, unknown>,
  ): Record<string, unknown> {
    try {
      const jsonString = this.extractLargestJsonObject(response);
      if (jsonString) {
        const parsed = JSON.parse(jsonString) as Record<string, unknown>;
        return this.sanitizeResult(parsed, originalCvContent, response);
      }
      throw new Error('No JSON found in AI response');
    } catch {
      const recovered = this.recoverPartialResult(response);
      if (recovered) {
        return this.sanitizeResult(
          {
          ...recovered,
          error: 'AI response was truncated or malformed. Partial result recovered.',
          },
          originalCvContent,
          response,
        );
      }

      return {
        optimizedContent: null,
        changes: [],
        rawResponse: response,
        error: 'Failed to parse AI response as JSON',
      };
    }
  }

  private extractLargestJsonObject(response: string): string | null {
    const firstBraceIndex = response.indexOf('{');
    if (firstBraceIndex === -1) {
      return null;
    }

    const extracted = this.extractBalancedSegment(response, firstBraceIndex, '{', '}');
    return extracted;
  }

  private recoverPartialResult(response: string): Record<string, unknown> | null {
    const optimizedContent = this.extractJsonField(response, 'optimizedContent', '{', '}');
    const changes = this.extractJsonField(response, 'changes', '[', ']');
    const addedKeywords = this.extractJsonField(response, 'addedKeywords', '[', ']');
    const compatibilityScore = this.extractCompatibilityScore(response);

    if (!optimizedContent && !changes && !addedKeywords && compatibilityScore === null) {
      return null;
    }

    return {
      optimizedContent: optimizedContent ?? null,
      changes: Array.isArray(changes) ? changes : [],
      addedKeywords: Array.isArray(addedKeywords) ? addedKeywords : [],
      compatibilityScore: compatibilityScore ?? 0,
      rawResponse: response,
    };
  }

  private extractJsonField(
    response: string,
    fieldName: string,
    openChar: '{' | '[',
    closeChar: '}' | ']',
  ): unknown {
    const keyPattern = `"${fieldName}"`;
    const keyIndex = response.indexOf(keyPattern);
    if (keyIndex === -1) {
      return null;
    }

    const colonIndex = response.indexOf(':', keyIndex + keyPattern.length);
    if (colonIndex === -1) {
      return null;
    }

    const startIndex = response.indexOf(openChar, colonIndex);
    if (startIndex === -1) {
      return null;
    }

    const segment = this.extractBalancedSegment(response, startIndex, openChar, closeChar);
    if (!segment) {
      return null;
    }

    try {
      return JSON.parse(segment);
    } catch {
      return null;
    }
  }

  private extractBalancedSegment(
    text: string,
    startIndex: number,
    openChar: '{' | '[',
    closeChar: '}' | ']',
  ): string | null {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < text.length; index += 1) {
      const character = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === openChar) {
        depth += 1;
      } else if (character === closeChar) {
        depth -= 1;
        if (depth === 0) {
          return text.slice(startIndex, index + 1);
        }
      }
    }

    return null;
  }

  private extractCompatibilityScore(response: string): number | null {
    const match = response.match(/"compatibilityScore"\s*:\s*(\d{1,3})/);
    if (!match) {
      return null;
    }

    const value = Number(match[1]);
    if (Number.isNaN(value)) {
      return null;
    }

    return value;
  }

  private sanitizeResult(
    parsed: Record<string, unknown>,
    originalCvContent: Record<string, unknown>,
    rawResponse: string,
  ): Record<string, unknown> {
    const optimized = this.sanitizeOptimizedContent(
      parsed.optimizedContent,
      originalCvContent,
    );

    return {
      ...parsed,
      optimizedContent: optimized,
      changes: this.sanitizeChanges(parsed.changes),
      addedKeywords: this.sanitizeAddedKeywords(parsed.addedKeywords),
      compatibilityScore: this.sanitizeCompatibilityScore(parsed.compatibilityScore),
      rawResponse,
    };
  }

  private sanitizeOptimizedContent(
    optimizedContent: unknown,
    originalCvContent: Record<string, unknown>,
  ): Record<string, unknown> {
    const base = this.deepClone(originalCvContent);

    if (!this.isRecord(optimizedContent)) {
      return base;
    }

    if (typeof optimizedContent.summary === 'string' && optimizedContent.summary.trim()) {
      const currentSummary = typeof base.summary === 'string' ? base.summary : '';
      if (this.isSameLanguage(currentSummary, optimizedContent.summary)) {
        base.summary = optimizedContent.summary;
      }
    }

    if (Array.isArray(base.experiences) && Array.isArray(optimizedContent.experiences)) {
      const originalExperiences = base.experiences as unknown[];
      const optimizedExperiences = optimizedContent.experiences as unknown[];
      const max = Math.min(originalExperiences.length, optimizedExperiences.length);

      for (let index = 0; index < max; index += 1) {
        const currentOriginal = originalExperiences[index];
        const currentOptimized = optimizedExperiences[index];

        if (!this.isRecord(currentOriginal) || !this.isRecord(currentOptimized)) {
          continue;
        }

        if (
          typeof currentOptimized.description === 'string' &&
          currentOptimized.description.trim() &&
          this.isSameLanguage(
            typeof currentOriginal.description === 'string'
              ? currentOriginal.description
              : '',
            currentOptimized.description,
          )
        ) {
          currentOriginal.description = currentOptimized.description;
        }
      }
    }

    return base;
  }

  private sanitizeChanges(changes: unknown): Array<Record<string, string>> {
    if (!Array.isArray(changes)) {
      return [];
    }

    return changes
      .filter((item): item is Record<string, unknown> => this.isRecord(item))
      .map((item) => ({
        section: typeof item.section === 'string' ? item.section : '',
        description: typeof item.description === 'string' ? item.description : '',
      }))
      .filter((item) => item.section === 'summary' || item.section === 'experiences')
      .slice(0, 6);
  }

  private sanitizeAddedKeywords(addedKeywords: unknown): string[] {
    if (!Array.isArray(addedKeywords)) {
      return [];
    }

    const unique = new Set<string>();

    for (const keyword of addedKeywords) {
      if (typeof keyword !== 'string') {
        continue;
      }

      const value = keyword.trim();
      if (!value) {
        continue;
      }

      unique.add(value);
      if (unique.size >= 12) {
        break;
      }
    }

    return Array.from(unique);
  }

  private sanitizeCompatibilityScore(score: unknown): number {
    if (typeof score !== 'number' || Number.isNaN(score)) {
      return 0;
    }

    if (score < 0) {
      return 0;
    }

    if (score > 100) {
      return 100;
    }

    return Math.round(score);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private isSameLanguage(sourceText: string, candidateText: string): boolean {
    const sourceLanguage = this.detectLanguage(sourceText);
    const candidateLanguage = this.detectLanguage(candidateText);

    if (sourceLanguage === 'unknown' || candidateLanguage === 'unknown') {
      return true;
    }

    return sourceLanguage === candidateLanguage;
  }

  private detectLanguage(text: string): 'fr' | 'en' | 'unknown' {
    const normalized = ` ${text.toLowerCase()} `;
    if (!normalized.trim()) {
      return 'unknown';
    }

    const frenchMarkers = [
      ' le ',
      ' la ',
      ' les ',
      ' des ',
      ' une ',
      ' un ',
      ' et ',
      ' avec ',
      ' pour ',
      ' dans ',
      ' au ',
      ' aux ',
      ' du ',
      ' de ',
      ' d\'',
      ' est ',
      ' sont ',
      ' sur ',
      ' par ',
      ' en ',
      ' que ',
      ' qui ',
      'je ',
      'nous ',
      'vous ',
      ' entreprise ',
      ' projet ',
      ' experience ',
      ' competences ',
      ' francais ',
      ' développé ',
      ' développe ',
      ' ingénieur ',
    ];
    const englishMarkers = [
      ' the ',
      ' and ',
      ' with ',
      ' for ',
      ' in ',
      ' on ',
      ' to ',
      ' of ',
      ' from ',
      ' is ',
      ' are ',
      ' as ',
      ' by ',
      ' this ',
      ' that ',
      ' these ',
      ' those ',
      ' i ',
      ' we ',
      ' you ',
      ' company ',
      ' project ',
      ' experience ',
      ' skills ',
      ' english ',
      ' developed ',
      ' engineer ',
      ' responsible ',
    ];

    const frenchScore = frenchMarkers.reduce(
      (score, marker) => score + (normalized.includes(marker) ? 1 : 0),
      0,
    );
    const englishScore = englishMarkers.reduce(
      (score, marker) => score + (normalized.includes(marker) ? 1 : 0),
      0,
    );

    if (frenchScore === 0 && englishScore === 0) {
      return 'unknown';
    }

    if (frenchScore === englishScore) {
      return 'unknown';
    }

    return frenchScore > englishScore ? 'fr' : 'en';
  }
}
