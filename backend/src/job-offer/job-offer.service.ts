import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobOffer } from './entities/job-offer.entity';
import {
  CreateJobOfferDto,
  UpdateJobOfferDto,
  ImportJobOffersDto,
  JobOfferPlatform,
} from './dto/job-offer.dto';

interface ScrapedJobOffer {
  externalId?: string;
  title: string;
  description: string;
  company?: string;
  location?: string;
  sourceUrl?: string;
  applicationUrl?: string;
}

export interface ImportJobOffersResult {
  platform: JobOfferPlatform;
  imported: number;
  skipped: number;
  offers: JobOffer[];
  warnings: string[];
}

@Injectable()
export class JobOfferService {
  constructor(
    @InjectRepository(JobOffer)
    private readonly jobOfferRepository: Repository<JobOffer>,
  ) {}

  async create(userId: string, dto: CreateJobOfferDto): Promise<JobOffer> {
    const keywords = this.extractKeywords(dto.description);
    const requiredSkills = this.extractSkills(dto.description);

    const jobOffer = this.jobOfferRepository.create({
      userId,
      title: dto.title,
      description: dto.description,
      company: dto.company,
      location: dto.location,
      applicationUrl: dto.applicationUrl,
      keywords,
      requiredSkills,
    });

    return this.jobOfferRepository.save(jobOffer);
  }

  async findAllByUser(userId: string): Promise<JobOffer[]> {
    return this.jobOfferRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<JobOffer> {
    const jobOffer = await this.jobOfferRepository.findOne({
      where: { id },
    });

    if (!jobOffer) {
      throw new NotFoundException('Job offer not found');
    }

    if (jobOffer.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return jobOffer;
  }

  async update(id: string, userId: string, dto: UpdateJobOfferDto): Promise<JobOffer> {
    const jobOffer = await this.findOne(id, userId);

    if (dto.title) jobOffer.title = dto.title;
    if (dto.company) jobOffer.company = dto.company;
    if (dto.location) jobOffer.location = dto.location;
    if (dto.applicationUrl !== undefined) {
      jobOffer.applicationUrl = dto.applicationUrl;
    }
    if (dto.description) {
      jobOffer.description = dto.description;
      jobOffer.keywords = this.extractKeywords(dto.description);
      jobOffer.requiredSkills = this.extractSkills(dto.description);
    }

    return this.jobOfferRepository.save(jobOffer);
  }

  async remove(id: string, userId: string): Promise<void> {
    const jobOffer = await this.findOne(id, userId);
    await this.jobOfferRepository.remove(jobOffer);
  }

  async importFromPlatform(
    userId: string,
    dto: ImportJobOffersDto,
  ): Promise<ImportJobOffersResult> {
    const keywords = dto.keywords.map((keyword) => keyword.trim()).filter(Boolean);
    const limit = Math.min(Math.max(dto.limit ?? 10, 1), 25);

    if (!keywords.length) {
      throw new BadRequestException('At least one keyword is required');
    }

    const warnings: string[] = [];
    let scrapedOffers: ScrapedJobOffer[] = [];

    try {
      scrapedOffers = await this.scrapeOffers(dto.platform, keywords, dto.location, limit);
    } catch (error) {
      warnings.push(this.getErrorMessage(error));
      return {
        platform: dto.platform,
        imported: 0,
        skipped: 0,
        offers: [],
        warnings,
      };
    }

    if (!scrapedOffers.length) {
      warnings.push('No offers were found for this query.');
    }

    const existingOffers = await this.jobOfferRepository.find({ where: { userId } });
    const existingSourceUrls = new Set(
      existingOffers
        .map((offer) => this.normalizeSourceUrl(offer.sourceUrl))
        .filter((value): value is string => Boolean(value)),
    );
    const existingExternalKeys = new Set(
      existingOffers
        .map((offer) => this.buildExternalKey(offer.platform, offer.externalId))
        .filter((value): value is string => Boolean(value)),
    );
    const existingFingerprints = new Set(
      existingOffers.map((offer) => this.buildFingerprint(offer.title, offer.company, offer.location)),
    );

    const savedOffers: JobOffer[] = [];
    let skipped = 0;

    for (const scraped of scrapedOffers.slice(0, limit)) {
      const normalizedTitle = scraped.title.trim();
      const normalizedDescription = scraped.description.trim();

      if (!normalizedTitle || !normalizedDescription) {
        skipped += 1;
        continue;
      }

      const sourceKey = this.normalizeSourceUrl(scraped.sourceUrl);
      const externalKey = this.buildExternalKey(dto.platform, scraped.externalId);
      const fingerprint = this.buildFingerprint(
        normalizedTitle,
        scraped.company,
        scraped.location,
      );

      if (
        (sourceKey && existingSourceUrls.has(sourceKey)) ||
        (externalKey && existingExternalKeys.has(externalKey)) ||
        existingFingerprints.has(fingerprint)
      ) {
        skipped += 1;
        continue;
      }

      const keywordsFromDescription = this.extractKeywords(normalizedDescription);
      const requiredSkills = this.extractSkills(normalizedDescription);

      const created = this.jobOfferRepository.create({
        userId,
        title: normalizedTitle,
        description: normalizedDescription,
        company: scraped.company?.trim() || undefined,
        location: scraped.location?.trim() || undefined,
        platform: dto.platform,
        sourceUrl: scraped.sourceUrl?.trim() || undefined,
        applicationUrl:
          scraped.applicationUrl?.trim() || scraped.sourceUrl?.trim() || undefined,
        externalId: scraped.externalId?.trim() || undefined,
        keywords: keywordsFromDescription,
        requiredSkills,
      });

      const saved = await this.jobOfferRepository.save(created);
      savedOffers.push(saved);

      if (sourceKey) {
        existingSourceUrls.add(sourceKey);
      }
      if (externalKey) {
        existingExternalKeys.add(externalKey);
      }
      existingFingerprints.add(fingerprint);
    }

    return {
      platform: dto.platform,
      imported: savedOffers.length,
      skipped,
      offers: savedOffers,
      warnings,
    };
  }

  async importFromUrl(userId: string, url: string): Promise<JobOffer> {
    const trimmed = (url || '').trim();
    if (!trimmed) {
      throw new BadRequestException('A valid URL is required');
    }

    let platform: JobOfferPlatform | undefined;
    if (/linkedin\.com/i.test(trimmed)) {
      platform = JobOfferPlatform.LINKEDIN;
    } else if (/hellowork\.com/i.test(trimmed)) {
      platform = JobOfferPlatform.HELLOWORK;
    } else if (/indeed\.com/i.test(trimmed) || /indeed\.fr/i.test(trimmed)) {
      platform = JobOfferPlatform.INDEED;
    } else {
      throw new BadRequestException('Unsupported job platform in URL');
    }

    let scraped: ScrapedJobOffer | null = null;

    try {
      const pageHtml = await this.fetchText(trimmed, 20000);

      const posting = this.extractJsonLdJobPosting(pageHtml);
      if (posting) {
        const title = this.normalizeText(this.toStringValue(posting.title)) || '';
        const description = this.normalizeText(
          this.stripHtml(this.toStringValue(posting.description)),
        );
        const company = this.normalizeText(
          this.toStringValue(this.getNestedValue(posting, ['hiringOrganization', 'name'])),
        ) || undefined;
        const location = this.normalizeText(
          this.toStringValue(
            this.getNestedValue(posting, ['jobLocation', 'address', 'addressLocality']),
          ),
        ) || undefined;
        const applicationUrl =
          this.normalizeText(this.toStringValue(posting.url)) || trimmed;

        scraped = {
          title,
          description: description || title,
          company,
          location,
          sourceUrl: trimmed,
          applicationUrl,
        };
      } else if (platform === JobOfferPlatform.LINKEDIN) {
        const externalIdMatch = trimmed.match(/(?:jobs\/view\/(\d+)|jobPosting\/(\d+)|urn:li:jobPosting:(\d+))/i);
        const externalId = externalIdMatch && externalIdMatch.slice(1).find(Boolean);

        if (externalId) {
          const details = await this.fetchLinkedInDetails(externalId as string);
          const metaTitle = this.extractFirstMatch(pageHtml, /<meta property="og:title" content="([^"]+)"/i)
            || this.extractFirstMatch(pageHtml, /<title>([\s\S]*?)<\/title>/i) || '';

          scraped = {
            externalId: externalId as string,
            title: this.normalizeText(metaTitle) || details.description.slice(0, 200) || '',
            description: details.description || metaTitle || '',
            company: undefined,
            location: undefined,
            sourceUrl: details.sourceUrl || trimmed,
            applicationUrl: details.applicationUrl || trimmed,
          };
        }
      } else if (platform === JobOfferPlatform.HELLOWORK) {
        const details = await this.fetchHelloworkDetails(trimmed, undefined);
        scraped = {
          title: details.title || '',
          description: details.description || details.title || '',
          company: details.company || undefined,
          location: details.location || undefined,
          sourceUrl: trimmed,
          applicationUrl: details.applicationUrl || trimmed,
        };
      } else if (platform === JobOfferPlatform.INDEED) {
        const title =
          this.extractFirstMatch(pageHtml, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
          this.extractFirstMatch(pageHtml, /<title>([\s\S]*?)<\/title>/i) ||
          '';

        scraped = {
          title: this.normalizeText(title) || 'Offre',
          description: '',
          company: undefined,
          location: undefined,
          sourceUrl: trimmed,
          applicationUrl: trimmed,
        };
      }
    } catch (err) {
      throw new BadRequestException('Failed to fetch or parse the provided URL');
    }

    if (!scraped || !scraped.title) {
      throw new BadRequestException('Could not extract job details from the provided URL');
    }

    const existingOffers = await this.jobOfferRepository.find({ where: { userId } });
    const existingSourceUrls = new Set(
      existingOffers
        .map((offer) => this.normalizeSourceUrl(offer.sourceUrl))
        .filter((v): v is string => Boolean(v)),
    );
    const existingExternalKeys = new Set(
      existingOffers
        .map((offer) => this.buildExternalKey(offer.platform, offer.externalId))
        .filter((v): v is string => Boolean(v)),
    );
    const existingFingerprints = new Set(
      existingOffers.map((offer) => this.buildFingerprint(offer.title, offer.company, offer.location)),
    );

    const sourceKey = this.normalizeSourceUrl(scraped.sourceUrl);
    const externalKey = this.buildExternalKey(platform, scraped.externalId);
    const fingerprint = this.buildFingerprint(scraped.title, scraped.company, scraped.location);

    if (
      (sourceKey && existingSourceUrls.has(sourceKey)) ||
      (externalKey && existingExternalKeys.has(externalKey)) ||
      existingFingerprints.has(fingerprint)
    ) {
      throw new BadRequestException('This job offer appears to already exist in your collection');
    }

    const keywordsFromDescription = this.extractKeywords(scraped.description || scraped.title);
    const requiredSkills = this.extractSkills(scraped.description || scraped.title);

    const created = this.jobOfferRepository.create({
      userId,
      title: scraped.title.trim(),
      description: (scraped.description || scraped.title).trim(),
      company: scraped.company?.trim() || undefined,
      location: scraped.location?.trim() || undefined,
      platform,
      sourceUrl: scraped.sourceUrl?.trim() || undefined,
      applicationUrl: scraped.applicationUrl?.trim() || scraped.sourceUrl?.trim() || undefined,
      externalId: scraped.externalId?.trim() || undefined,
      keywords: keywordsFromDescription,
      requiredSkills,
    });

    const saved = await this.jobOfferRepository.save(created);
    return saved;
  }

  extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
      'dare', 'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those',
      'we', 'you', 'he', 'she', 'they', 'them', 'their', 'our', 'your',
      'my', 'his', 'her', 'not', 'no', 'nor', 'as', 'if', 'then', 'else',
      'when', 'up', 'out', 'so', 'than', 'too', 'very', 'just', 'about',
      'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'mais',
      'dans', 'sur', 'pour', 'par', 'avec', 'est', 'sont', 'nous', 'vous',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9àâçéèêëîïôùûüÿñæœ\s+#.-]/g, ' ')
      .match(/[a-z0-9àâçéèêëîïôùûüÿñæœ+#.-]+/g)
      ?.filter((word) => word.length > 1 && !stopWords.has(word)) ?? [];

    const frequency: Record<string, number> = {};
    words.forEach((word) => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    const rankedWords = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word]) => word);

    // Always prioritize known technical skills in keywords so they are not lost in long descriptions.
    const prioritizedSkills = this.extractSkills(text).map((skill) => skill.toLowerCase());
    return Array.from(new Set([...prioritizedSkills, ...rankedWords])).slice(0, 30);
  }

  extractSkills(text: string): string[] {
    const skillPatterns: Array<{ canonical: string; aliases: RegExp[] }> = [
      { canonical: 'JavaScript', aliases: [/\bjavascript\b/i, /\bjs\b/i] },
      { canonical: 'TypeScript', aliases: [/\btypescript\b/i, /\bts\b/i] },
      { canonical: 'Python', aliases: [/\bpython\b/i] },
      { canonical: 'Java', aliases: [/\bjava\b/i] },
      { canonical: 'C#', aliases: [/\bc#\b/i, /\bcsharp\b/i] },
      { canonical: 'C++', aliases: [/\bc\+\+\b/i] },
      { canonical: 'Go', aliases: [/\bgo\b/i, /\bgolang\b/i] },
      { canonical: 'Rust', aliases: [/\brust\b/i] },
      { canonical: 'Ruby', aliases: [/\bruby\b/i] },
      { canonical: 'PHP', aliases: [/\bphp\b/i] },
      { canonical: 'Swift', aliases: [/\bswift\b/i] },
      { canonical: 'Kotlin', aliases: [/\bkotlin\b/i] },
      { canonical: 'Scala', aliases: [/\bscala\b/i] },
      { canonical: 'React', aliases: [/\breact\b/i] },
      { canonical: 'Angular', aliases: [/\bangular\b/i] },
      { canonical: 'Vue.js', aliases: [/\bvue\.js\b/i, /\bvuejs\b/i, /\bvue\b/i] },
      { canonical: 'Next.js', aliases: [/\bnext\.js\b/i, /\bnextjs\b/i, /\bnext\b/i] },
      { canonical: 'Nuxt', aliases: [/\bnuxt\b/i, /\bnuxtjs\b/i] },
      { canonical: 'Svelte', aliases: [/\bsvelte\b/i] },
      { canonical: 'Node.js', aliases: [/\bnode\.js\b/i, /\bnodejs\b/i, /\bnode\s+js\b/i] },
      { canonical: 'NestJS', aliases: [/\bnest\s*js\b/i, /\bnestjs\b/i] },
      { canonical: 'Express', aliases: [/\bexpress\b/i, /\bexpressjs\b/i] },
      { canonical: 'Django', aliases: [/\bdjango\b/i] },
      { canonical: 'Flask', aliases: [/\bflask\b/i] },
      { canonical: 'FastAPI', aliases: [/\bfastapi\b/i] },
      { canonical: 'Spring Boot', aliases: [/\bspring\s+boot\b/i] },
      { canonical: 'Spring', aliases: [/\bspring\b/i] },
      { canonical: 'Rails', aliases: [/\brails\b/i, /\bruby\s+on\s+rails\b/i] },
      { canonical: 'Laravel', aliases: [/\blaravel\b/i] },
      { canonical: 'ASP.NET', aliases: [/\basp\.net\b/i, /\baspnet\b/i] },
      { canonical: 'Docker', aliases: [/\bdocker\b/i] },
      { canonical: 'Kubernetes', aliases: [/\bkubernetes\b/i, /\bk8s\b/i] },
      { canonical: 'AWS', aliases: [/\baws\b/i, /\bamazon\s+web\s+services\b/i] },
      { canonical: 'Azure', aliases: [/\bazure\b/i] },
      { canonical: 'GCP', aliases: [/\bgcp\b/i, /\bgoogle\s+cloud\b/i] },
      { canonical: 'Terraform', aliases: [/\bterraform\b/i] },
      { canonical: 'CI/CD', aliases: [/\bci\/?cd\b/i, /\bcontinuous\s+integration\b/i] },
      { canonical: 'Jenkins', aliases: [/\bjenkins\b/i] },
      { canonical: 'GitLab CI', aliases: [/\bgitlab\s+ci\b/i] },
      { canonical: 'GitHub Actions', aliases: [/\bgithub\s+actions\b/i] },
      { canonical: 'SQL', aliases: [/\bsql\b/i] },
      { canonical: 'PostgreSQL', aliases: [/\bpostgresql\b/i, /\bpostgres\b/i] },
      { canonical: 'MySQL', aliases: [/\bmysql\b/i] },
      { canonical: 'MongoDB', aliases: [/\bmongodb\b/i, /\bmongo\b/i] },
      { canonical: 'Redis', aliases: [/\bredis\b/i] },
      { canonical: 'Elasticsearch', aliases: [/\belasticsearch\b/i] },
      { canonical: 'GraphQL', aliases: [/\bgraphql\b/i] },
      { canonical: 'REST', aliases: [/\brest\b/i, /\brestful\b/i] },
      { canonical: 'gRPC', aliases: [/\bgrpc\b/i] },
      { canonical: 'WebSocket', aliases: [/\bwebsocket\b/i, /\bweb\s*socket\b/i] },
      { canonical: 'Git', aliases: [/\bgit\b/i] },
      { canonical: 'Linux', aliases: [/\blinux\b/i] },
      { canonical: 'Agile', aliases: [/\bagile\b/i] },
      { canonical: 'Scrum', aliases: [/\bscrum\b/i] },
      { canonical: 'Kanban', aliases: [/\bkanban\b/i] },
      { canonical: 'Machine Learning', aliases: [/\bmachine\s+learning\b/i, /\bml\b/i] },
      { canonical: 'Deep Learning', aliases: [/\bdeep\s+learning\b/i] },
      { canonical: 'NLP', aliases: [/\bnlp\b/i, /\bnatural\s+language\s+processing\b/i] },
      { canonical: 'Computer Vision', aliases: [/\bcomputer\s+vision\b/i] },
      { canonical: 'TensorFlow', aliases: [/\btensorflow\b/i] },
      { canonical: 'PyTorch', aliases: [/\bpytorch\b/i] },
      { canonical: 'Pandas', aliases: [/\bpandas\b/i] },
      { canonical: 'NumPy', aliases: [/\bnumpy\b/i] },
      { canonical: 'HTML', aliases: [/\bhtml\b/i] },
      { canonical: 'CSS', aliases: [/\bcss\b/i] },
      { canonical: 'SASS', aliases: [/\bsass\b/i] },
      { canonical: 'LESS', aliases: [/\bless\b/i] },
      { canonical: 'TailwindCSS', aliases: [/\btailwind\s*css\b/i, /\btailwindcss\b/i, /\btailwind\b/i] },
      { canonical: 'Bootstrap', aliases: [/\bbootstrap\b/i] },
      { canonical: 'Figma', aliases: [/\bfigma\b/i] },
      { canonical: 'Sketch', aliases: [/\bsketch\b/i] },
      { canonical: 'Adobe XD', aliases: [/\badobe\s+xd\b/i] },
      { canonical: 'Jira', aliases: [/\bjira\b/i] },
      { canonical: 'Confluence', aliases: [/\bconfluence\b/i] },
      { canonical: 'Notion', aliases: [/\bnotion\b/i] },
    ];

    const foundSkills: string[] = [];

    for (const skill of skillPatterns) {
      const hasMatch = skill.aliases.some((regex) => regex.test(text));
      if (hasMatch) {
        foundSkills.push(skill.canonical);
      }
    }

    return foundSkills;
  }

  analyzeCompatibility(
    cvSkills: string[],
    jobSkills: string[],
  ): { score: number; matchedSkills: string[]; missingSkills: string[] } {
    const normalizedCvSkills = cvSkills.map((s) => s.toLowerCase());
    const matchedSkills = jobSkills.filter((skill) =>
      normalizedCvSkills.includes(skill.toLowerCase()),
    );
    const missingSkills = jobSkills.filter(
      (skill) => !normalizedCvSkills.includes(skill.toLowerCase()),
    );

    const score =
      jobSkills.length > 0
        ? Math.round((matchedSkills.length / jobSkills.length) * 100)
        : 0;

    return { score, matchedSkills, missingSkills };
  }

  private async scrapeOffers(
    platform: JobOfferPlatform,
    keywords: string[],
    location: string | undefined,
    limit: number,
  ): Promise<ScrapedJobOffer[]> {
    switch (platform) {
      case JobOfferPlatform.LINKEDIN:
        return this.scrapeLinkedIn(keywords, location, limit);
      case JobOfferPlatform.HELLOWORK:
        return this.scrapeHellowork(keywords, location, limit);
      case JobOfferPlatform.INDEED:
        return this.scrapeIndeed(keywords, location, limit);
      default:
        return [];
    }
  }

  private async scrapeLinkedIn(
    keywords: string[],
    location: string | undefined,
    limit: number,
  ): Promise<ScrapedJobOffer[]> {
    const encodedKeywords = encodeURIComponent(keywords.join(' '));
    const encodedLocation = encodeURIComponent(location?.trim() || 'France');
    const pageSize = 25;
    const results: ScrapedJobOffer[] = [];
    const seenExternalIds = new Set<string>();

    for (let start = 0; results.length < limit; start += pageSize) {
      const searchUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodedKeywords}&location=${encodedLocation}&start=${start}`;
      const searchHtml = await this.fetchText(searchUrl);
      const cards = this.parseLinkedInCards(searchHtml);

      if (!cards.length) {
        break;
      }

      for (const card of cards) {
        if (!card.externalId || seenExternalIds.has(card.externalId)) {
          continue;
        }

        seenExternalIds.add(card.externalId);
        const details = await this.fetchLinkedInDetails(card.externalId);

        results.push({
          ...card,
          description:
            details.description ||
            `${card.title} chez ${card.company || 'une entreprise'} (${card.location || 'localisation non renseignée'}).`,
          sourceUrl: card.sourceUrl || details.sourceUrl,
          applicationUrl: details.applicationUrl || card.sourceUrl || details.sourceUrl,
        });

        if (results.length >= limit) {
          break;
        }
      }

      if (cards.length < pageSize) {
        break;
      }
    }

    return results;
  }

  private parseLinkedInCards(
    html: string,
  ): Array<Omit<ScrapedJobOffer, 'description'>> {
    const cards: Array<Omit<ScrapedJobOffer, 'description'>> = [];
    const listItemRegex = /<li>\s*([\s\S]*?)<\/li>/gi;

    for (const match of html.matchAll(listItemRegex)) {
      const block = match[1];
      const externalId = this.extractFirstMatch(
        block,
        /data-entity-urn="urn:li:jobPosting:(\d+)"/i,
      );

      if (!externalId) {
        continue;
      }

      const title = this.normalizeText(
        this.stripHtml(
          this.extractFirstMatch(block, /<h3[^>]*base-search-card__title[^>]*>([\s\S]*?)<\/h3>/i) ||
            '',
        ),
      );

      const company = this.normalizeText(
        this.stripHtml(
          this.extractFirstMatch(
            block,
            /<h4[^>]*base-search-card__subtitle[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
          ) || '',
        ),
      );

      const cardLocation = this.normalizeText(
        this.stripHtml(
          this.extractFirstMatch(
            block,
            /<span[^>]*job-search-card__location[^>]*>([\s\S]*?)<\/span>/i,
          ) || '',
        ),
      );

      const relativeOrAbsoluteUrl = this.extractFirstMatch(
        block,
        /<a[^>]*base-card__full-link[^>]*href="([^"]+)"/i,
      );

      const fallbackLinkedInUrl = this.extractFirstMatch(
        block,
        /<a[^>]*href="([^"]*\/jobs\/view\/\d+[^"]*)"/i,
      );

      cards.push({
        externalId,
        title,
        company: company || undefined,
        location: cardLocation || undefined,
        sourceUrl: this.toAbsoluteUrl(
          relativeOrAbsoluteUrl || fallbackLinkedInUrl,
          'https://www.linkedin.com',
        ),
      });
    }

    return cards;
  }

  private async fetchLinkedInDetails(
    externalId: string,
  ): Promise<Pick<ScrapedJobOffer, 'description' | 'sourceUrl' | 'applicationUrl'>> {
    try {
      const detailsUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${externalId}`;
      const detailsHtml = await this.fetchText(detailsUrl);
      const descriptionHtml =
        this.extractFirstMatch(
          detailsHtml,
          /<div class="show-more-less-html__markup[^"]*">([\s\S]*?)<\/div>/i,
        ) ||
        this.extractFirstMatch(
          detailsHtml,
          /<section[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
        ) ||
        '';

      const sourceUrl =
        this.extractFirstMatch(
          detailsHtml,
          /<a[^>]*href="([^"]*\/jobs\/view\/[^"]+)"[^>]*>/i,
        ) || '';

      const applicationUrl =
        this.extractFirstMatch(
          detailsHtml,
          /data-tracking-control-name="public_jobs_apply-link"[^>]*href="([^"]+)"/i,
        ) ||
        this.extractFirstMatch(
          detailsHtml,
          /<a[^>]*class="[^"]*apply-button[^"]*"[^>]*href="([^"]+)"/i,
        ) ||
        this.extractFirstMatch(
          detailsHtml,
          /"applyUrl"\s*:\s*"([^"]+)"/i,
        ) ||
        '';

      return {
        description: this.normalizeText(this.stripHtml(descriptionHtml)),
        sourceUrl: this.toAbsoluteUrl(sourceUrl, 'https://www.linkedin.com') || '',
        applicationUrl:
          this.toAbsoluteUrl(applicationUrl, 'https://www.linkedin.com') || '',
      };
    } catch {
      return {
        description: '',
        sourceUrl: '',
        applicationUrl: '',
      };
    }
  }

  private async scrapeHellowork(
    keywords: string[],
    location: string | undefined,
    limit: number,
  ): Promise<ScrapedJobOffer[]> {
    const encodedKeywords = encodeURIComponent(keywords.join(' '));
    const searchUrl = `https://www.hellowork.com/fr-fr/emploi/recherche.html?k=${encodedKeywords}`;
    const searchHtml = await this.fetchText(searchUrl);

    const cards: Array<Omit<ScrapedJobOffer, 'description'>> = [];
    const cardRegex = /<input type="hidden" name="title" value="([^"]*)"[\s\S]*?<input type="hidden" name="company" value="([^"]*)"[\s\S]*?<input type="hidden" name="idOffre" value="(\d+)"/gi;

    for (const match of searchHtml.matchAll(cardRegex)) {
      const title = this.normalizeText(this.decodeHtmlEntities(match[1] || ''));
      const company = this.normalizeText(this.decodeHtmlEntities(match[2] || ''));
      const externalId = match[3];

      if (!externalId || !title) {
        continue;
      }

      cards.push({
        externalId,
        title,
        company: company || undefined,
        sourceUrl: `https://www.hellowork.com/fr-fr/emplois/${externalId}.html`,
      });

      if (cards.length >= limit) {
        break;
      }
    }

    const results: ScrapedJobOffer[] = [];
    for (const card of cards) {
      const details = await this.fetchHelloworkDetails(card.sourceUrl || '', location);
      results.push({
        ...card,
        title: details.title || card.title,
        company: details.company || card.company,
        location: details.location || location,
        description:
          details.description ||
          `${card.title} chez ${card.company || 'une entreprise'} (${location || 'France'}).`,
        applicationUrl: details.applicationUrl || card.sourceUrl,
      });
    }

    return results;
  }

  private async fetchHelloworkDetails(
    detailsUrl: string,
    locationFallback: string | undefined,
  ): Promise<
    Pick<ScrapedJobOffer, 'title' | 'company' | 'location' | 'description' | 'applicationUrl'>
  > {
    try {
      const detailsHtml = await this.fetchText(detailsUrl);
      const posting = this.extractJsonLdJobPosting(detailsHtml);

      if (!posting) {
        return {
          title: '',
          company: '',
          location: locationFallback || '',
          description: '',
          applicationUrl: detailsUrl,
        };
      }

      const title = this.normalizeText(this.toStringValue(posting.title));
      const description = this.normalizeText(
        this.stripHtml(this.toStringValue(posting.description)),
      );
      const company = this.normalizeText(
        this.toStringValue(this.getNestedValue(posting, ['hiringOrganization', 'name'])),
      );
      const location = this.normalizeText(
        this.toStringValue(
          this.getNestedValue(posting, ['jobLocation', 'address', 'addressLocality']),
        ),
      );
      const applicationUrl =
        this.normalizeText(this.toStringValue(posting.url)) || detailsUrl;

      return {
        title,
        company,
        location: location || locationFallback || '',
        description,
        applicationUrl,
      };
    } catch {
      return {
        title: '',
        company: '',
        location: locationFallback || '',
        description: '',
        applicationUrl: detailsUrl,
      };
    }
  }

  private async scrapeIndeed(
    keywords: string[],
    location: string | undefined,
    limit: number,
  ): Promise<ScrapedJobOffer[]> {
    const encodedKeywords = encodeURIComponent(keywords.join(' '));
    const encodedLocation = encodeURIComponent(location?.trim() || 'France');
    const searchUrl = `https://fr.indeed.com/jobs?q=${encodedKeywords}&l=${encodedLocation}`;
    const searchHtml = await this.fetchText(searchUrl);

    if (
      /Just a moment/i.test(searchHtml) ||
      /Enable JavaScript and cookies to continue/i.test(searchHtml) ||
      /cf_chl_opt/i.test(searchHtml)
    ) {
      throw new Error(
        'Indeed currently blocks automated server requests (anti-bot challenge). Try LinkedIn/Hellowork or import manually.',
      );
    }

    const offers: ScrapedJobOffer[] = [];
    const titleRegex = /<h2[^>]*class="[^"]*jobTitle[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi;

    for (const match of searchHtml.matchAll(titleRegex)) {
      const title = this.normalizeText(this.stripHtml(match[1] || ''));
      if (!title) {
        continue;
      }

      offers.push({
        title,
        company: 'Indeed',
        location: location || undefined,
        description: `${title}. Offre récupérée depuis Indeed pour ${keywords.join(', ')}.`,
        sourceUrl: searchUrl,
        applicationUrl: searchUrl,
      });

      if (offers.length >= limit) {
        break;
      }
    }

    return offers;
  }

  private async fetchText(url: string, timeoutMs = 15000): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} while fetching ${url}`);
      }

      return response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractJsonLdJobPosting(html: string): Record<string, unknown> | null {
    const scriptRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;

    for (const match of html.matchAll(scriptRegex)) {
      const raw = match[1]?.trim();
      if (!raw) {
        continue;
      }

      const parsed = this.safeJsonParse(raw);
      const found = this.findJobPosting(parsed);

      if (found) {
        return found;
      }
    }

    return null;
  }

  private findJobPosting(value: unknown): Record<string, unknown> | null {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = this.findJobPosting(item);
        if (found) {
          return found;
        }
      }
      return null;
    }

    if (!this.isRecord(value)) {
      return null;
    }

    const type = this.toStringValue(value['@type']);
    if (type.toLowerCase() === 'jobposting') {
      return value;
    }

    return null;
  }

  private safeJsonParse(raw: string): unknown | null {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private getNestedValue(
    record: Record<string, unknown>,
    path: string[],
  ): unknown {
    let current: unknown = record;

    for (const key of path) {
      if (!this.isRecord(current)) {
        return undefined;
      }

      current = current[key];
    }

    return current;
  }

  private buildExternalKey(platform?: string, externalId?: string): string | null {
    if (!platform || !externalId) {
      return null;
    }

    return `${platform.toLowerCase()}:${externalId.trim()}`;
  }

  private normalizeSourceUrl(url?: string): string | null {
    if (!url) {
      return null;
    }

    return url.trim().replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }

  private buildFingerprint(
    title: string,
    company?: string,
    location?: string,
  ): string {
    const normalizedTitle = this.normalizeForFingerprint(title);
    const normalizedCompany = this.normalizeForFingerprint(company || '');
    const normalizedLocation = this.normalizeForFingerprint(location || '');
    return `${normalizedTitle}::${normalizedCompany}::${normalizedLocation}`;
  }

  private normalizeForFingerprint(value: string): string {
    return this.normalizeText(this.decodeHtmlEntities(value))
      .toLowerCase()
      .replace(/[^a-z0-9àâçéèêëîïôùûüÿñæœ\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toAbsoluteUrl(url: string | undefined, origin: string): string | undefined {
    if (!url) {
      return undefined;
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return this.decodeHtmlEntities(url);
    }

    return `${origin}${this.decodeHtmlEntities(url)}`;
  }

  private stripHtml(value: string): string {
    return value
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
  }

  private decodeHtmlEntities(value: string): string {
    const namedReplacements: Record<string, string> = {
      '&amp;': '&',
      '&quot;': '"',
      '&#39;': "'",
      '&lt;': '<',
      '&gt;': '>',
      '&nbsp;': ' ',
      '&apos;': "'",
      '&eacute;': 'é',
      '&Eacute;': 'É',
      '&egrave;': 'è',
      '&agrave;': 'à',
      '&ccedil;': 'ç',
    };

    let output = value;
    for (const [entity, replacement] of Object.entries(namedReplacements)) {
      output = output.split(entity).join(replacement);
    }

    output = output.replace(/&#(x?[0-9a-fA-F]+);/g, (_, code: string) => {
      const parsed = code.startsWith('x') || code.startsWith('X')
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);

      if (Number.isNaN(parsed)) {
        return _;
      }

      return String.fromCodePoint(parsed);
    });

    return output;
  }

  private normalizeText(value: string): string {
    return this.decodeHtmlEntities(value)
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractFirstMatch(source: string, regex: RegExp): string | undefined {
    const match = source.match(regex);
    if (!match || !match[1]) {
      return undefined;
    }

    return this.normalizeText(match[1]);
  }

  private toStringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Failed to import job offers from selected platform.';
  }
}
