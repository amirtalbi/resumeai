import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { chunk } from "lodash";
import { ScrapedJobOffer } from "src/job-offer/dto/job-offer.dto";

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

class HttpStatusError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody: string,
  ) {
    super(message);
  }
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly numPredict: number;
  private readonly numCtx: number;
  private readonly numGpu: number;
  private modelPullAttempted = false;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      "OLLAMA_BASE_URL",
      "http://localhost:11434",
    );
    this.model = this.configService.get<string>("OLLAMA_MODEL", "mistral");
    this.timeoutMs = Number(
      this.configService.get<string>("OLLAMA_TIMEOUT_MS", "300000"),
    );
    this.numPredict = Number(
      this.configService.get<string>("OLLAMA_NUM_PREDICT", "1024"),
    );
    this.numCtx = Number(
      this.configService.get<string>("OLLAMA_NUM_CTX", "8192"),
    );
    this.numGpu = Number(
      this.configService.get<string>("OLLAMA_NUM_GPU", "99"),
    );
  }

  async generate(prompt: string): Promise<string> {
    try {
      const response = await this.postJson<{ response: string }>(
        "/api/generate",
        {
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: this.numPredict,
            num_ctx: this.numCtx,
            num_gpu: this.numGpu,
          },
        },
        this.timeoutMs,
      );

      return response.response;
    } catch (error) {
      if (
        !this.modelPullAttempted &&
        error instanceof HttpStatusError &&
        error.status === 404
      ) {
        this.modelPullAttempted = true;
        this.logger.warn(
          `Model ${this.model} not available in Ollama, pulling model and retrying once`,
        );
        await this.pullModel();
        return this.generate(prompt);
      }

      this.logger.error("Ollama API call failed", error);
      throw new Error(
        `Failed to generate AI response: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async llmFilter(
    keywords: string[],
    jobOffers: ScrapedJobOffer[],
  ): Promise<ScrapedJobOffer[]> {
    const scored: { id: string; score: number }[] = [];

    for (const offer of jobOffers) {
      const prompt = this.buildPrompt(keywords, [
        {
          id: offer.uid,
          jd: (offer.description ?? "").slice(0, 1500),
        },
      ]);

      try {
        const response = await this.postJson<{ response: string }>(
          "/api/generate",
          {
            model: this.model,
            prompt,
            stream: false,
            format: "json",
            options: {
              temperature: 0.1,
              num_predict: 256,
              num_ctx: this.numCtx,
              num_gpu: this.numGpu,
            },
          },
          this.timeoutMs,
        );

        const parsed =
          typeof response.response === "string"
            ? JSON.parse(response.response)
            : response.response;

        const result = parsed?.results?.[0];
        if (result?.id && typeof result.score === "number") {
          scored.push({ id: result.id, score: result.score });
          this.logger.log(`Scored ${result.id}: ${result.score}`);
        }
      } catch (error) {
        this.logger.error(`Scoring failed for ${offer.uid}`, error);
        // skip offer, continue
      }
    }

    const scoreMap = new Map(scored.map((r) => [r.id, r.score]));

    return jobOffers
      .filter((o) => (scoreMap.get(o.uid) ?? 0) >= 65)
      .sort((a, b) => (scoreMap.get(b.uid) ?? 0) - (scoreMap.get(a.uid) ?? 0));
  }

  private buildPrompt(
    keywords: string[],
    batch: { id: string; jd: string }[],
  ): string {
    return `
        Analyse ces offres. JSON uniquement, sans markdown.
        Format: {"results":[{"id":"...","score":0-100,"reason":"..."}]}
        Mots-clés: ${keywords.join(", ")}
        Offres:
        ${batch.map((o) => `ID:${o.id}\n${o.jd}`).join("\n---\n")}`
      ;
  }

  private async pullModel(): Promise<void> {
    try {
      await this.postJson(
        "/api/pull",
        {
          model: this.model,
          stream: false,
        },
        600000,
      );
      this.logger.log(`Ollama model pulled successfully: ${this.model}`);
    } catch (error) {
      this.logger.error(`Failed to pull Ollama model: ${this.model}`, error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.getJson("/api/tags", 5000);
      return true;
    } catch {
      return false;
    }
  }

  private async getJson<T = unknown>(
    path: string,
    timeoutMs: number,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseBody = await response.text();
        throw new HttpStatusError(
          `Request failed: GET ${path} (${response.status})`,
          response.status,
          responseBody,
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async postJson<T = unknown>(
    path: string,
    payload: unknown,
    timeoutMs: number,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseBody = await response.text();
        throw new HttpStatusError(
          `Request failed: POST ${path} (${response.status})`,
          response.status,
          responseBody,
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  buildCvOptimizationPrompt(
    cvContent: Record<string, unknown>,
    jobDescription: string,
    keywords: string[],
    requiredSkills: string[],
  ): string {
    const cvLanguage = this.detectCvLanguage(cvContent);

    return `Tu es un expert en rédaction de CV et en recrutement. Ta tâche est d'adapter le CV suivant pour qu'il corresponde au mieux à l'offre d'emploi donnée.

INSTRUCTIONS:
1. Conserve la structure du CV
2. N'ajoute AUCUNE information factuelle absente du CV source
3. N'ajoute PAS de nouvelles compétences, technologies, outils, certifications, diplômes, entreprises, postes, dates ou missions
4. N'invente PAS de projets ni de responsabilités
5. Reformule uniquement le style pour clarifier et mieux cibler le poste
6. Tu peux uniquement améliorer le résumé et la formulation des descriptions d'expériences existantes
7. Si un mot-clé est absent du CV source, ne l'insère pas dans le CV: place-le uniquement dans "addedKeywords"
8. Les champs factuels (noms de technos, entreprises, intitulés de poste, dates, niveaux) doivent rester inchangés
4. Améliore le résumé professionnel pour cibler le poste
9. Ne fabrique PAS de nouvelles expériences ou diplômes
10. Réponds UNIQUEMENT avec un JSON valide
11. N'écris AUCUN texte hors JSON (pas de markdown, pas de commentaire)
12. Limite "changes" à 6 éléments maximum
13. Limite "addedKeywords" à 12 éléments maximum, sans doublons
14. "addedKeywords" doit contenir des termes courts (1 à 3 mots)
15. Conserve STRICTEMENT la langue d'origine du CV
16. N'effectue AUCUNE traduction (ex: français vers anglais ou anglais vers français)
17. Toute reformulation doit rester dans la langue "${cvLanguage}"

CV ACTUEL:
${JSON.stringify(cvContent, null, 2)}

OFFRE D'EMPLOI:
${jobDescription}

MOTS-CLÉS IMPORTANTS: ${keywords.join(", ")}
COMPÉTENCES REQUISES: ${requiredSkills.join(", ")}

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

  private detectCvLanguage(cvContent: Record<string, unknown>): "fr" | "en" {
    const text = JSON.stringify(cvContent).toLowerCase();

    const frenchMarkers = [
      " le ",
      " la ",
      " les ",
      " des ",
      " et ",
      " avec ",
      " pour ",
      " en ",
      "de ",
      "diplome",
      "experience",
      "projet",
      "responsable",
      "developpeur",
      "francais",
    ];
    const englishMarkers = [
      " the ",
      " and ",
      " with ",
      " for ",
      " in ",
      " of ",
      "experience",
      "project",
      "responsible",
      "developer",
      "english",
      "summary",
      "skills",
      "education",
    ];

    const frenchScore = frenchMarkers.reduce(
      (score, marker) => score + (text.includes(marker) ? 1 : 0),
      0,
    );
    const englishScore = englishMarkers.reduce(
      (score, marker) => score + (text.includes(marker) ? 1 : 0),
      0,
    );

    return frenchScore >= englishScore ? "fr" : "en";
  }
}
