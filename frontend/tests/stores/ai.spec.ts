import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBase: 'http://localhost:3001/api' },
}));

vi.stubGlobal('useAuthStore', () => ({
  accessToken: 'test-token',
  refreshToken: vi.fn(),
  logout: vi.fn(),
}));

vi.stubGlobal('navigateTo', vi.fn());

const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
};

vi.stubGlobal('useApi', () => mockApi);

describe('AI Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should initialize with default state', async () => {
    const { useAiStore } = await import('~/stores/ai');
    const store = useAiStore();
    expect(store.optimizing).toBe(false);
    expect(store.currentJobId).toBeNull();
    expect(store.result).toBeNull();
    expect(store.error).toBeNull();
  });

  it('should start optimization and set job id', async () => {
    mockApi.post.mockResolvedValue({ jobId: 'job-1', status: 'queued' });
    mockApi.get.mockResolvedValue({
      status: 'completed',
      progress: 100,
      result: { optimizedContent: {}, changes: [] },
    });

    const { useAiStore } = await import('~/stores/ai');
    const store = useAiStore();
    await store.optimizeCv('cv-1', 'job-1');

    expect(store.currentJobId).toBe('job-1');
  });

  it('should handle optimization error', async () => {
    mockApi.post.mockRejectedValue(new Error('AI service unavailable'));

    const { useAiStore } = await import('~/stores/ai');
    const store = useAiStore();
    await store.optimizeCv('cv-1', 'job-1');

    expect(store.error).toBe('AI service unavailable');
    expect(store.optimizing).toBe(false);
  });

  it('should reset state', async () => {
    const { useAiStore } = await import('~/stores/ai');
    const store = useAiStore();
    store.optimizing = true;
    store.currentJobId = 'job-1';
    store.result = { data: 'test' };

    store.reset();

    expect(store.optimizing).toBe(false);
    expect(store.currentJobId).toBeNull();
    expect(store.result).toBeNull();
  });
});
