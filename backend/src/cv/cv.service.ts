import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cv } from './entities/cv.entity';
import { CvVersion } from './entities/cv-version.entity';
import { CreateCvDto, UpdateCvDto } from './dto/cv.dto';

@Injectable()
export class CvService {
  constructor(
    @InjectRepository(Cv)
    private readonly cvRepository: Repository<Cv>,
    @InjectRepository(CvVersion)
    private readonly cvVersionRepository: Repository<CvVersion>,
  ) {}

  async create(userId: string, createCvDto: CreateCvDto): Promise<Cv> {
    const cv = this.cvRepository.create({
      userId,
      title: createCvDto.title,
      contentJson: createCvDto.contentJson,
    });

    const savedCv = await this.cvRepository.save(cv);

    await this.cvVersionRepository.save({
      cvId: savedCv.id,
      versionNumber: 1,
      contentJson: savedCv.contentJson as unknown as Record<string, unknown>,
      modificationsHistory: { action: 'created' },
    });

    return savedCv;
  }

  async findAllByUser(userId: string): Promise<Cv[]> {
    return this.cvRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Cv> {
    const cv = await this.cvRepository.findOne({
      where: { id },
      relations: ['versions'],
    });

    if (!cv) {
      throw new NotFoundException('CV not found');
    }

    if (cv.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return cv;
  }

  async update(id: string, userId: string, updateCvDto: UpdateCvDto): Promise<Cv> {
    const cv = await this.findOne(id, userId);

    const latestVersion = await this.cvVersionRepository.findOne({
      where: { cvId: id },
      order: { versionNumber: 'DESC' },
    });

    const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    if (updateCvDto.title) cv.title = updateCvDto.title;
    if (updateCvDto.contentJson) cv.contentJson = updateCvDto.contentJson;

    const savedCv = await this.cvRepository.save(cv);

    await this.cvVersionRepository.save({
      cvId: savedCv.id,
      versionNumber: nextVersionNumber,
      contentJson: savedCv.contentJson as unknown as Record<string, unknown>,
      modificationsHistory: {
        action: 'updated',
        changes: updateCvDto,
      },
    });

    return savedCv;
  }

  async remove(id: string, userId: string): Promise<void> {
    const cv = await this.findOne(id, userId);
    await this.cvRepository.remove(cv);
  }

  async getVersions(cvId: string, userId: string): Promise<CvVersion[]> {
    await this.findOne(cvId, userId);
    return this.cvVersionRepository.find({
      where: { cvId },
      order: { versionNumber: 'DESC' },
    });
  }

  async importFromPdfText(
    userId: string,
    title: string,
    extractedText: string,
  ): Promise<Cv> {
    const contentJson = this.parseExtractedText(extractedText);
    return this.create(userId, { title, contentJson });
  }

  private parseExtractedText(text: string) {
    const lines = text.split('\n').filter((l) => l.trim());

    return {
      personalInfo: {
        firstName: '',
        lastName: '',
        email: this.extractEmail(text) || '',
        phone: this.extractPhone(text),
      },
      summary: lines.slice(0, 3).join(' '),
      experiences: [],
      education: [],
      skills: [
        {
          category: 'Extracted',
          items: this.extractSkillKeywords(text),
        },
      ],
      languages: [],
      certifications: [],
    };
  }

  private extractEmail(text: string): string | undefined {
    const match = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    return match?.[0];
  }

  private extractPhone(text: string): string | undefined {
    const match = text.match(
      /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}/,
    );
    return match?.[0];
  }

  private extractSkillKeywords(text: string): string[] {
    const commonSkills = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'React', 'Angular',
      'Vue', 'Node.js', 'NestJS', 'Express', 'Django', 'Flask', 'Spring',
      'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'SQL', 'MongoDB',
      'PostgreSQL', 'Redis', 'Git', 'CI/CD', 'Agile', 'Scrum',
      'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch',
    ];

    return commonSkills.filter((skill) =>
      text.toLowerCase().includes(skill.toLowerCase()),
    );
  }
}
