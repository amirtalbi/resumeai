import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CvService } from './cv.service';
import { OllamaService } from '../ai-optimization/ollama.service';
import { Cv } from './entities/cv.entity';
import { CvVersion } from './entities/cv-version.entity';

describe('CvService', () => {
  let service: CvService;
  let cvRepository: Record<string, jest.Mock>;
  let cvVersionRepository: Record<string, jest.Mock>;
  let ollamaService: { generate: jest.Mock };

  const mockCvContent = {
    personalInfo: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+33 6 12 34 56 78',
    },
    summary: 'Experienced developer',
    experiences: [
      {
        company: 'Tech Corp',
        position: 'Senior Developer',
        startDate: '2020-01',
        endDate: '2023-12',
        description: 'Built web applications',
        achievements: ['Increased performance by 50%'],
      },
    ],
    education: [
      {
        institution: 'University',
        degree: 'Master',
        field: 'Computer Science',
        startDate: '2015',
        endDate: '2020',
      },
    ],
    skills: [
      {
        category: 'Frontend',
        items: ['React', 'TypeScript', 'Vue.js'],
      },
    ],
    languages: [{ name: 'French', level: 'Native' }],
    certifications: [],
  };

  const mockCv: Partial<Cv> = {
    id: 'cv-uuid-1',
    userId: 'user-uuid-1',
    title: 'My CV',
    contentJson: mockCvContent,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    cvRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    cvVersionRepository = {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    ollamaService = {
      generate: jest.fn().mockRejectedValue(new Error('no ai')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvService,
        { provide: getRepositoryToken(Cv), useValue: cvRepository },
        { provide: getRepositoryToken(CvVersion), useValue: cvVersionRepository },
        { provide: OllamaService, useValue: ollamaService },
      ],
    }).compile();

    service = module.get<CvService>(CvService);
  });

  describe('create', () => {
    it('should create a new CV and version', async () => {
      cvRepository.create.mockReturnValue(mockCv);
      cvRepository.save.mockResolvedValue(mockCv);
      cvVersionRepository.save.mockResolvedValue({});

      const result = await service.create('user-uuid-1', {
        title: 'My CV',
        contentJson: mockCvContent,
      });

      expect(result).toEqual(mockCv);
      expect(cvRepository.create).toHaveBeenCalledWith({
        userId: 'user-uuid-1',
        title: 'My CV',
        contentJson: mockCvContent,
      });
      expect(cvVersionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          versionNumber: 1,
          modificationsHistory: { action: 'created' },
        }),
      );
    });
  });

  describe('findAllByUser', () => {
    it('should return all CVs for a user', async () => {
      cvRepository.find.mockResolvedValue([mockCv]);

      const result = await service.findAllByUser('user-uuid-1');

      expect(result).toEqual([mockCv]);
      expect(cvRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
        order: { updatedAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return CV when owned by user', async () => {
      cvRepository.findOne.mockResolvedValue(mockCv);

      const result = await service.findOne('cv-uuid-1', 'user-uuid-1');
      expect(result).toEqual(mockCv);
    });

    it('should throw NotFoundException when CV not found', async () => {
      cvRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when CV not owned by user', async () => {
      cvRepository.findOne.mockResolvedValue({
        ...mockCv,
        userId: 'other-user',
      });

      await expect(
        service.findOne('cv-uuid-1', 'user-uuid-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update CV and create new version', async () => {
      cvRepository.findOne.mockResolvedValue({ ...mockCv });
      cvRepository.save.mockResolvedValue({
        ...mockCv,
        title: 'Updated CV',
      });
      cvVersionRepository.findOne.mockResolvedValue({ versionNumber: 1 });
      cvVersionRepository.save.mockResolvedValue({});

      const result = await service.update('cv-uuid-1', 'user-uuid-1', {
        title: 'Updated CV',
      });

      expect(result.title).toBe('Updated CV');
      expect(cvVersionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ versionNumber: 2 }),
      );
    });
  });

  describe('remove', () => {
    it('should remove CV', async () => {
      cvRepository.findOne.mockResolvedValue(mockCv);
      cvRepository.remove.mockResolvedValue(undefined);

      await service.remove('cv-uuid-1', 'user-uuid-1');

      expect(cvRepository.remove).toHaveBeenCalledWith(mockCv);
    });
  });

  describe('getVersions', () => {
    it('should return version history', async () => {
      cvRepository.findOne.mockResolvedValue(mockCv);
      const versions = [
        { id: 'v1', versionNumber: 1 },
        { id: 'v2', versionNumber: 2 },
      ];
      cvVersionRepository.find.mockResolvedValue(versions);

      const result = await service.getVersions('cv-uuid-1', 'user-uuid-1');

      expect(result).toEqual(versions);
    });
  });

  describe('importFromPdfText', () => {
    it('should create CV from extracted text', async () => {
      cvRepository.create.mockReturnValue(mockCv);
      cvRepository.save.mockResolvedValue(mockCv);
      cvVersionRepository.save.mockResolvedValue({});

      const text = 'John Doe\njohn@example.com\n+33 6 12 34 56 78\nReact TypeScript Docker';
      const result = await service.importFromPdfText('user-uuid-1', 'Imported', text);

      expect(result).toEqual(mockCv);
      expect(cvRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-1',
          title: 'Imported',
        }),
      );
    });

    it('should prefer AI parsed content when available', async () => {
      cvRepository.create.mockReturnValue(mockCv);
      cvRepository.save.mockResolvedValue(mockCv);
      cvVersionRepository.save.mockResolvedValue({});
      ollamaService.generate.mockResolvedValue(
        JSON.stringify({
          personalInfo: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
          summary: 'Summary',
          experiences: [],
          education: [],
          skills: [],
          languages: [],
          certifications: [],
        }),
      );

      const result = await service.importFromPdfText('user-uuid-1', 'Imported', 'Jane Doe');

      expect(result).toEqual(mockCv);
      expect(ollamaService.generate).toHaveBeenCalled();
    });

    it('should parse structured CV exported by the tool', async () => {
      const text = [
        'Amir Talbi',
        'Fullstack Web Developer',
        'amir@example.com | 06 64 76 70 40 | France',
        'PROFESSIONAL SUMMARY',
        'Passionate developer working with NestJS and Nuxt.',
        'PROFESSIONAL EXPERIENCE',
        'Motux.fr',
        'Freelance | Nov 2025 - Mar 2026',
        'Design and development of a wordle mobile game.',
        'Stack: Flutter, NestJS, Docker',
        'EDUCATION',
        'Master 2 - Dev. Manager Web Fullstack',
        'Efrei Paris',
        'SKILLS',
        'Backend: NestJS, PostgreSQL',
        'Frontend: Nuxt, Vue.js',
      ].join('\n');

      cvRepository.create.mockReturnValue(mockCv);
      cvRepository.save.mockResolvedValue(mockCv);
      cvVersionRepository.save.mockResolvedValue({});

      const result = await service.importFromPdfText('user-uuid-1', 'Imported', text);

      expect(result).toEqual(mockCv);
      expect(cvRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-1',
          title: 'Imported',
          contentJson: expect.objectContaining({
            personalInfo: expect.objectContaining({
              firstName: 'Amir',
              lastName: 'Talbi',
              jobTitle: 'Fullstack Web Developer',
              email: 'amir@example.com',
            }),
          }),
        }),
      );
    });
  });
});
