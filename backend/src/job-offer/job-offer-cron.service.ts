import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Repository } from "typeorm";
import { User } from "../auth/entities/user.entity";
import { JobOfferService } from "./job-offer.service";
import { JobOfferPlatform } from "./dto/job-offer.dto";

// Compte dont les imports automatiques sont autorisés (cf. JobOfferController.IMPORT_ALLOWED_EMAIL).
const AUTO_IMPORT_EMAIL = "amirotalbi94@gmail.com";

const PLATFORMS: JobOfferPlatform[] = [
  JobOfferPlatform.LINKEDIN,
  JobOfferPlatform.HELLOWORK,
  JobOfferPlatform.INDEED,
  JobOfferPlatform.WTTJ,
];

const SEARCHES: Array<{ title: string; keywords: string[] }> = [
  {
    title: "Développeur web",
    keywords: ["nodejs", "typescript", "javascript"],
  },
  {
    title: "Développeur full-stack",
    keywords: ["nodejs", "typescript", "javascript"],
  },
];

const LOCATION = "France";
const LIMIT_PER_QUERY = 15;
// Délai entre deux requêtes de scraping pour rester discret vis-à-vis des plateformes.
const THROTTLE_MS = 4000;

@Injectable()
export class JobOfferCronService {
  private readonly logger = new Logger(JobOfferCronService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jobOfferService: JobOfferService,
  ) {}

  // Tous les jours à 02h00 et 10h00 (heure du serveur / container).
  @Cron("0 2,10 * * *", { name: "job-offer-auto-scrape" })
  async handleScheduledScrape(): Promise<void> {
    await this.runAutoScrape();
  }

  async runAutoScrape(): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email: AUTO_IMPORT_EMAIL },
    });

    if (!user) {
      this.logger.warn(
        `Auto-scrape skipped: no user found for ${AUTO_IMPORT_EMAIL}`,
      );
      return;
    }

    this.logger.log("Starting scheduled job offer scrape");

    for (const search of SEARCHES) {
      for (const platform of PLATFORMS) {
        try {
          const result = await this.jobOfferService.importFromPlatform(
            user.id,
            {
              platform,
              title: search.title,
              keywords: search.keywords,
              location: LOCATION,
              limit: LIMIT_PER_QUERY,
            },
          );

          if (result.warnings.length) {
            this.logger.warn(
              `[${platform}] "${search.title}": ${result.warnings.join(" | ")}`,
            );
          }

          this.logger.log(
            `[${platform}] "${search.title}": ${result.queued} offer(s) queued`,
          );
        } catch (error) {
          this.logger.error(
            `[${platform}] "${search.title}" failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }

        await this.sleep(THROTTLE_MS);
      }
    }

    this.logger.log("Scheduled job offer scrape finished");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
