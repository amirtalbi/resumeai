import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { JobOfferService } from './job-offer.service';
import { JobOffer } from './entities/job-offer.entity';
import { JobOfferPlatform } from './dto/job-offer.dto';

describe('JobOfferService', () => {
  let service: JobOfferService;
  let repository: Record<string, jest.Mock>;
  let originalFetch: typeof fetch;

  const mockJobOffer: Partial<JobOffer> = {
    id: 'job-uuid-1',
    userId: 'user-uuid-1',
    title: 'Senior Full Stack Developer',
    description:
      'We are looking for a senior full stack developer with experience in React, Node.js, TypeScript, and PostgreSQL. Experience with Docker and AWS is a plus.',
    company: 'Tech Corp',
    location: 'Paris, France',
    keywords: ['senior', 'full', 'stack', 'developer', 'react', 'node.js'],
    requiredSkills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobOfferService,
        { provide: getRepositoryToken(JobOffer), useValue: repository },
      ],
    }).compile();

    service = module.get<JobOfferService>(JobOfferService);
  });

  beforeAll(() => {
    originalFetch = globalThis.fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  describe('create', () => {
    it('should create a job offer with extracted keywords and skills', async () => {
      repository.create.mockReturnValue(mockJobOffer);
      repository.save.mockResolvedValue(mockJobOffer);

      const result = await service.create('user-uuid-1', {
        title: 'Senior Full Stack Developer',
        description: mockJobOffer.description!,
        company: 'Tech Corp',
        location: 'Paris, France',
      });

      expect(result).toEqual(mockJobOffer);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-1',
          title: 'Senior Full Stack Developer',
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return job offer when owned by user', async () => {
      repository.findOne.mockResolvedValue(mockJobOffer);

      const result = await service.findOne('job-uuid-1', 'user-uuid-1');
      expect(result).toEqual(mockJobOffer);
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when not owned', async () => {
      repository.findOne.mockResolvedValue({
        ...mockJobOffer,
        userId: 'other-user',
      });

      await expect(
        service.findOne('job-uuid-1', 'user-uuid-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('extractKeywords', () => {
    it('should extract relevant keywords from text', () => {
      const text = 'We need a developer with experience in JavaScript and React';
      const keywords = service.extractKeywords(text);

      expect(keywords).toBeInstanceOf(Array);
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords).toContain('developer');
    });

    it('should filter out stop words', () => {
      const text = 'We are looking for the best developer in the world';
      const keywords = service.extractKeywords(text);

      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('are');
      expect(keywords).not.toContain('for');
    });

    it('should prioritize technical skills in keywords for long descriptions', () => {
      const text =
        'Nous cherchons un profil backend senior. Le poste couvre architecture, mentoring, delivery, communication, roadmap, product thinking et coordination. Stack: nodejs, docker, postgresql.';
      const keywords = service.extractKeywords(text);

      expect(keywords).toContain('node.js');
      expect(keywords).toContain('docker');
      expect(keywords).toContain('postgresql');
    });
  });

  describe('extractSkills', () => {
    it('should extract known skills from text', () => {
      const text =
        'Experience with React, TypeScript, Node.js, Docker, and PostgreSQL required';
      const skills = service.extractSkills(text);

      expect(skills).toContain('React');
      expect(skills).toContain('TypeScript');
      expect(skills).toContain('Node.js');
      expect(skills).toContain('Docker');
      expect(skills).toContain('PostgreSQL');
    });

    it('should return empty array for text without known skills', () => {
      const text = 'We are looking for a motivated candidate';
      const skills = service.extractSkills(text);

      expect(skills).toEqual([]);
    });

    it('should detect nodejs variant spellings', () => {
      const text = 'Experience required in nodejs, node js, docker and cloud.';
      const skills = service.extractSkills(text);

      expect(skills).toContain('Node.js');
      expect(skills).toContain('Docker');
    });
  });

  describe('analyzeCompatibility', () => {
    it('should calculate compatibility score', () => {
      const cvSkills = ['React', 'TypeScript', 'Node.js'];
      const jobSkills = ['React', 'TypeScript', 'Node.js', 'Docker', 'AWS'];

      const result = service.analyzeCompatibility(cvSkills, jobSkills);

      expect(result.score).toBe(60);
      expect(result.matchedSkills).toEqual(['React', 'TypeScript', 'Node.js']);
      expect(result.missingSkills).toEqual(['Docker', 'AWS']);
    });

    it('should return 0 for no matching skills', () => {
      const cvSkills = ['Python', 'Django'];
      const jobSkills = ['React', 'TypeScript'];

      const result = service.analyzeCompatibility(cvSkills, jobSkills);

      expect(result.score).toBe(0);
      expect(result.matchedSkills).toEqual([]);
    });

    it('should handle empty job skills', () => {
      const result = service.analyzeCompatibility(['React'], []);
      expect(result.score).toBe(0);
    });
  });

  describe('importFromPlatform', () => {
    it('should import LinkedIn offers and save them', async () => {
      repository.find.mockResolvedValue([]);
      repository.create.mockImplementation((payload) => payload);
      repository.save.mockImplementation(async (payload) => ({
        id: 'imported-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...payload,
      }));

      const fetchMock = jest.fn()
        .mockResolvedValueOnce(
          new Response(
            `<li>
              <div class="base-card" data-entity-urn="urn:li:jobPosting:12345">
                <a class="base-card__full-link" href="https://fr.linkedin.com/jobs/view/12345"></a>
                <h3 class="base-search-card__title">Backend Node.js Engineer</h3>
                <h4 class="base-search-card__subtitle"><a>Acme</a></h4>
                <span class="job-search-card__location">Paris</span>
              </div>
            </li>`,
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            `<div class="show-more-less-html__markup">
              Build APIs with Node.js, Docker and PostgreSQL.
            </div>`,
            { status: 200 },
          ),
        );

      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const result = await service.importFromPlatform('user-uuid-1', {
        platform: JobOfferPlatform.LINKEDIN,
        keywords: ['nodejs', 'docker'],
        location: 'Paris',
        limit: 5,
      });

      expect(result.imported).toBe(1);
      expect(result.offers[0].title).toContain('Backend Node.js Engineer');
      expect(result.offers[0].applicationUrl).toContain('linkedin.com/jobs/view');
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('should return warning when Indeed blocks automated access', async () => {
      repository.find.mockResolvedValue([]);

      const fetchMock = jest.fn().mockResolvedValue(
        new Response('Just a moment... Enable JavaScript and cookies to continue', {
          status: 200,
        }),
      );

      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const result = await service.importFromPlatform('user-uuid-1', {
        platform: JobOfferPlatform.INDEED,
        keywords: ['nodejs'],
        location: 'Paris',
        limit: 5,
      });

      expect(result.imported).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
