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
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    const frequency: Record<string, number> = {};
    words.forEach((word) => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word]) => word);
  }

  extractSkills(text: string): string[] {
    const skillPatterns = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C\\+\\+', 'Go', 'Rust',
      'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala',
      'React', 'Angular', 'Vue\\.js', 'Vue', 'Next\\.js', 'Nuxt', 'Svelte',
      'Node\\.js', 'NestJS', 'Express', 'Django', 'Flask', 'FastAPI',
      'Spring Boot', 'Spring', 'Rails', 'Laravel', 'ASP\\.NET',
      'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Terraform',
      'CI/CD', 'Jenkins', 'GitLab CI', 'GitHub Actions',
      'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
      'GraphQL', 'REST', 'gRPC', 'WebSocket',
      'Git', 'Linux', 'Agile', 'Scrum', 'Kanban',
      'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision',
      'TensorFlow', 'PyTorch', 'Pandas', 'NumPy',
      'HTML', 'CSS', 'SASS', 'LESS', 'TailwindCSS', 'Bootstrap',
      'Figma', 'Sketch', 'Adobe XD',
      'Jira', 'Confluence', 'Notion',
    ];

    const foundSkills: string[] = [];
    const lowerText = text.toLowerCase();

    for (const pattern of skillPatterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(text) || lowerText.includes(pattern.toLowerCase().replace(/\\/g, ''))) {
        const cleanPattern = pattern.replace(/\\/g, '');
        if (!foundSkills.includes(cleanPattern)) {
          foundSkills.push(cleanPattern);
        }
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
