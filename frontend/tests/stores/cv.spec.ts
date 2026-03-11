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
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
};

vi.stubGlobal('useApi', () => mockApi);

describe('CV Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should initialize with empty state', async () => {
    const { useCvStore } = await import('~/stores/cv');
    const store = useCvStore();
    expect(store.cvs).toEqual([]);
    expect(store.currentCv).toBeNull();
    expect(store.loading).toBe(false);
  });

  it('should fetch CVs', async () => {
    const mockCvs = [
      { id: '1', title: 'CV 1', contentJson: {}, createdAt: '2024-01-01' },
      { id: '2', title: 'CV 2', contentJson: {}, createdAt: '2024-01-02' },
    ];
    mockApi.get.mockResolvedValue(mockCvs);

    const { useCvStore } = await import('~/stores/cv');
    const store = useCvStore();
    await store.fetchCvs();

    expect(store.cvs).toEqual(mockCvs);
    expect(store.loading).toBe(false);
  });

  it('should create a CV', async () => {
    const newCv = { id: '3', title: 'New CV', contentJson: {} };
    mockApi.post.mockResolvedValue(newCv);

    const { useCvStore } = await import('~/stores/cv');
    const store = useCvStore();
    const result = await store.createCv('New CV', {} as any);

    expect(result).toEqual(newCv);
    expect(store.cvs).toContainEqual(newCv);
  });

  it('should delete a CV', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    const { useCvStore } = await import('~/stores/cv');
    const store = useCvStore();
    store.cvs = [
      { id: '1', title: 'CV 1' } as any,
      { id: '2', title: 'CV 2' } as any,
    ];

    await store.deleteCv('1');

    expect(store.cvs).toHaveLength(1);
    expect(store.cvs[0].id).toBe('2');
  });

  it('should handle fetch error', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));

    const { useCvStore } = await import('~/stores/cv');
    const store = useCvStore();
    await store.fetchCvs();

    expect(store.error).toBe('Network error');
    expect(store.loading).toBe(false);
  });
});
