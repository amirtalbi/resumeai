import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'OLLAMA_BASE_URL',
      'http://localhost:11434',
    );
    this.model = this.configService.get<string>(
      'OLLAMA_MODEL',
      'mistral:7b-instruct',
    );
  }

  async generate(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: 4096,
          },
        },
        {
          timeout: 120000,
        },
      );

      return response.data.response;
    } catch (error) {
      this.logger.error('Ollama API call failed', error);
      throw new Error(
        `Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  buildCvOptimizationPrompt(
    cvContent: Record<string, unknown>,
    jobDescription: string,
    keywords: string[],
    requiredSkills: string[],
  ): string {
    return `Tu es un expert en rédaction de CV et en recrutement. Ta tâche est d'adapter le CV suivant pour qu'il corresponde au mieux à l'offre d'emploi donnée.

INSTRUCTIONS:
1. Conserve la structure du CV
2. Ajoute les mots-clés manquants de manière naturelle
3. Reformule les expériences pour mettre en valeur les compétences demandées
4. Améliore le résumé professionnel pour cibler le poste
5. Ne fabrique PAS de nouvelles expériences ou diplômes
6. Réponds UNIQUEMENT avec un JSON valide

CV ACTUEL:
${JSON.stringify(cvContent, null, 2)}

OFFRE D'EMPLOI:
${jobDescription}

MOTS-CLÉS IMPORTANTS: ${keywords.join(', ')}
COMPÉTENCES REQUISES: ${requiredSkills.join(', ')}

Réponds avec un JSON valide contenant:
{
  "optimizedContent": { /* CV modifié avec la même structure */ },
  "changes": [
    { "section": "nom_section", "description": "description du changement" }
  ],
  "addedKeywords": ["mot1", "mot2"],
  "compatibilityScore": 85
}`;
  }
}
