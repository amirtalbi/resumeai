import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { OllamaService } from "../ai-optimization/ollama.service";
import { JobOfferPlatform, ScrapedJobOffer } from "./dto/job-offer.dto";
import { JobOfferService } from "./job-offer.service";

export interface JobOfferImportData {
  offers: ScrapedJobOffer[];
  keywords: string[];
  userId: string;
  platform: JobOfferPlatform;
  limit: number;
}

@Processor("job-offer-import")
export class JobOfferImportProcessor {
  private readonly logger = new Logger(JobOfferImportProcessor.name);

  constructor(
    private readonly ollamaService: OllamaService,
    private readonly jobOfferService: JobOfferService,
  ) {}

  @Process("import-offers")
  async handleImport(job: Job<JobOfferImportData>) {
    this.logger.log(`Import job ${job.id} — ${job.data.offers.length} offers`);

    const { offers, keywords, userId, platform, limit } = job.data;

    await job.progress(10);

    const filtered = await this.ollamaService.llmFilter(keywords, offers);

    await job.progress(60);

    this.logger.log(`${filtered.length}/${offers.length} passed LLM filter`);

    const existingOffers = await this.jobOfferService.findAllByUser(userId);
    const existingSourceUrls = new Set(
      existingOffers
        .map((o) => this.jobOfferService.normalizeSourceUrl(o.sourceUrl))
        .filter(Boolean),
    );
    const existingExternalKeys = new Set(
      existingOffers
        .map((o) =>
          this.jobOfferService.buildExternalKey(o.platform, o.externalId),
        )
        .filter(Boolean),
    );
    const existingFingerprints = new Set(
      existingOffers.map((o) =>
        this.jobOfferService.buildFingerprint(o.title, o.company, o.location),
      ),
    );

    let saved = 0;
    let skipped = 0;

    for (const scraped of filtered.slice(0, limit)) {
      const normalizedTitle = scraped.title.trim();
      const normalizedDescription = scraped.description.trim();

      if (!normalizedTitle || !normalizedDescription) {
        skipped++;
        continue;
      }

      const sourceKey = this.jobOfferService.normalizeSourceUrl(
        scraped.sourceUrl,
      );
      const externalKey = this.jobOfferService.buildExternalKey(
        platform,
        scraped.externalId,
      );
      const fingerprint = this.jobOfferService.buildFingerprint(
        normalizedTitle,
        scraped.company,
        scraped.location,
      );

      if (
        (sourceKey && existingSourceUrls.has(sourceKey)) ||
        (externalKey && existingExternalKeys.has(externalKey)) ||
        existingFingerprints.has(fingerprint)
      ) {
        skipped++;
        continue;
      }

      const savedOffer = await this.jobOfferService.createFromScraped(userId, platform, scraped);
      this.jobOfferService.emitOffer(userId, savedOffer);
      saved++;

      if (sourceKey) existingSourceUrls.add(sourceKey);
      if (externalKey) existingExternalKeys.add(externalKey);
      existingFingerprints.add(fingerprint);
    }

    await job.progress(100);
    this.logger.log(
      `Import job ${job.id} done — saved: ${saved}, skipped: ${skipped}`,
    );

    return { total: offers.length, filtered: filtered.length, saved, skipped };
  }
}
