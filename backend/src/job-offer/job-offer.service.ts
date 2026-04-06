import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobOffer } from './entities/job-offer.entity';
import { CreateJobOfferDto, UpdateJobOfferDto } from './dto/job-offer.dto';

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
}
