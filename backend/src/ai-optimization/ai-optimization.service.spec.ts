import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { NotFoundException } from '@nestjs/common';
import { AiOptimizationService } from './ai-optimization.service';
import { CvService } from '../cv/cv.service';
import { JobOfferService } from '../job-offer/job-offer.service';
import { OllamaService } from './ollama.service';

describe('AiOptimizationService', () => {
  let service: AiOptimizationService;
  let mockQueue: Record<string, jest.Mock>;

  const mockCv = {
    id: 'cv-uuid-1',
    userId: 'user-uuid-1',
    title: 'My CV',
    contentJson: {
      personalInfo: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
      summary: 'Experienced developer',
      experiences: [],
      education: [],
      skills: [{ category: 'Tech', items: ['React', 'TypeScript'] }],
    },
  };

  const mockJobOffer = {
    id: 'job-uuid-1',
    userId: 'user-uuid-1',
    title: 'Senior Developer',
    description: 'We need a senior developer',
    keywords: ['senior', 'developer'],
    requiredSkills: ['React', 'Node.js'],
  };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      getJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiOptimizationService,
        { provide: getQueueToken('ai-optimization'), useValue: mockQueue },
        {
          provide: CvService,
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockCv),
          },
        },
        {
          provide: JobOfferService,
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockJobOffer),
          },
        },
        {
          provide: OllamaService,
          useValue: {
            isAvailable: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<AiOptimizationService>(AiOptimizationService);
  });

  describe('optimizeCv', () => {
    it('should queue an AI optimization job', async () => {
      const result = await service.optimizeCv('user-uuid-1', {
        cvId: 'cv-uuid-1',
        jobOfferId: 'job-uuid-1',
      });

      expect(result).toHaveProperty('jobId', 'job-1');
      expect(result).toHaveProperty('status', 'queued');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'optimize-cv',
        expect.objectContaining({
          userId: 'user-uuid-1',
          cvId: 'cv-uuid-1',
        }),
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return job status when found', async () => {
      const mockJob = {
        id: 'job-1',
        getState: jest.fn().mockResolvedValue('completed'),
        progress: jest.fn().mockReturnValue(100),
        returnvalue: { optimizedContent: {} },
        failedReason: null,
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJobStatus('job-1');

      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);
      expect(result.result).toBeDefined();
    });

    it('should throw NotFoundException when job not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await expect(service.getJobStatus('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should include error for failed jobs', async () => {
      const mockJob = {
        id: 'job-1',
        getState: jest.fn().mockResolvedValue('failed'),
        progress: jest.fn().mockReturnValue(10),
        returnvalue: null,
        failedReason: 'Connection timeout',
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJobStatus('job-1');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Connection timeout');
    });
  });

  describe('checkAiHealth', () => {
    it('should return availability status', async () => {
      const result = await service.checkAiHealth();

      expect(result).toHaveProperty('status', 'available');
      expect(result).toHaveProperty('model');
    });
  });
});
