import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OllamaService } from './ollama.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OllamaService', () => {
  let service: OllamaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OllamaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                OLLAMA_BASE_URL: 'http://localhost:11434',
                OLLAMA_MODEL: 'mistral:7b-instruct',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OllamaService>(OllamaService);
  });

  describe('generate', () => {
    it('should call Ollama API and return response', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { response: 'Generated text', done: true },
      });

      const result = await service.generate('Test prompt');

      expect(result).toBe('Generated text');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          model: 'mistral:7b-instruct',
          prompt: 'Test prompt',
          stream: false,
        }),
        expect.objectContaining({ timeout: 120000 }),
      );
    });

    it('should throw error when API call fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Connection refused'));

      await expect(service.generate('Test prompt')).rejects.toThrow(
        'Failed to generate AI response',
      );
    });
  });

  describe('isAvailable', () => {
    it('should return true when Ollama is available', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });

      const result = await service.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when Ollama is unavailable', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Connection refused'));

      const result = await service.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('buildCvOptimizationPrompt', () => {
    it('should build a prompt with CV content and job info', () => {
      const cvContent = { personalInfo: { firstName: 'John' } };
      const jobDescription = 'Looking for a developer';
      const keywords = ['JavaScript', 'React'];
      const requiredSkills = ['TypeScript'];

      const prompt = service.buildCvOptimizationPrompt(
        cvContent,
        jobDescription,
        keywords,
        requiredSkills,
      );

      expect(prompt).toContain('John');
      expect(prompt).toContain('Looking for a developer');
      expect(prompt).toContain('JavaScript');
      expect(prompt).toContain('React');
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('JSON');
    });
  });
});
