import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OllamaService } from './ollama.service';

describe('OllamaService', () => {
  let service: OllamaService;
  let mockFetch: jest.Mock;

  const createFetchResponse = (
    status: number,
    jsonData: unknown,
    textData = '',
  ): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(jsonData),
      text: jest.fn().mockResolvedValue(textData),
    }) as unknown as Response;

  beforeEach(async () => {
    mockFetch = jest.fn();
    (global as typeof globalThis & { fetch: jest.Mock }).fetch = mockFetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OllamaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                OLLAMA_BASE_URL: 'http://localhost:11434',
                OLLAMA_MODEL: 'mistral',
                OLLAMA_TIMEOUT_MS: '300000',
                OLLAMA_NUM_PREDICT: '1024',
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
      mockFetch.mockResolvedValue(
        createFetchResponse(200, { response: 'Generated text', done: true }),
      );

      const result = await service.generate('Test prompt');

      expect(result).toBe('Generated text');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
          signal: expect.any(AbortSignal),
        }),
      );

      const requestOptions = mockFetch.mock.calls[0][1] as {
        body: string;
      };
      const payload = JSON.parse(requestOptions.body);
      expect(payload).toMatchObject({
        model: 'mistral',
        prompt: 'Test prompt',
        stream: false,
        options: expect.objectContaining({ num_predict: 1024 }),
      });
    });

    it('should throw error when API call fails', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(service.generate('Test prompt')).rejects.toThrow(
        'Failed to generate AI response',
      );
    });

    it('should pull model and retry once on 404', async () => {
      mockFetch
        .mockResolvedValueOnce(createFetchResponse(404, {}, 'not found'))
        .mockResolvedValueOnce(createFetchResponse(200, { status: 'success' }))
        .mockResolvedValueOnce(
          createFetchResponse(200, { response: 'Generated text', done: true }),
        );

      const result = await service.generate('Test prompt');

      expect(result).toBe('Generated text');
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'http://localhost:11434/api/pull',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('isAvailable', () => {
    it('should return true when Ollama is available', async () => {
      mockFetch.mockResolvedValue(createFetchResponse(200, { models: [] }));

      const result = await service.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when Ollama is unavailable', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await service.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('buildCvOptimizationPrompt', () => {
    it('should build a prompt with CV content and job info', () => {
      const cvContent = {
        personalInfo: { firstName: 'Jean' },
        summary: 'Developpeur full stack avec experience en Node.js',
      };
      const jobDescription = 'Looking for a developer';
      const keywords = ['JavaScript', 'React'];
      const requiredSkills = ['TypeScript'];

      const prompt = service.buildCvOptimizationPrompt(
        cvContent,
        jobDescription,
        keywords,
        requiredSkills,
      );

      expect(prompt).toContain('Jean');
      expect(prompt).toContain('Looking for a developer');
      expect(prompt).toContain('JavaScript');
      expect(prompt).toContain('React');
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('Conserve STRICTEMENT la langue d\'origine du CV');
      expect(prompt).toContain('langue "fr"');
    });
  });
});
