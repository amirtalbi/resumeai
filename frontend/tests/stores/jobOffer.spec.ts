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

describe('Job Offer Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should initialize with empty state', async () => {
    const { useJobOfferStore } = await import('~/stores/jobOffer');
    const store = useJobOfferStore();
    expect(store.jobOffers).toEqual([]);
    expect(store.loading).toBe(false);
  });

  it('should fetch job offers', async () => {
    const mockOffers = [
      { id: '1', title: 'Dev Senior', requiredSkills: ['React'] },
    ];
    mockApi.get.mockResolvedValue(mockOffers);

    const { useJobOfferStore } = await import('~/stores/jobOffer');
    const store = useJobOfferStore();
    await store.fetchJobOffers();

    expect(store.jobOffers).toEqual(mockOffers);
  });

  it('should create a job offer', async () => {
    const newOffer = {
      id: '1',
      title: 'Full Stack Dev',
      description: 'We need...',
      requiredSkills: ['React', 'Node.js'],
    };
    mockApi.post.mockResolvedValue(newOffer);

    const { useJobOfferStore } = await import('~/stores/jobOffer');
    const store = useJobOfferStore();
    const result = await store.createJobOffer({
      title: 'Full Stack Dev',
      description: 'We need...',
    });

    expect(result).toEqual(newOffer);
    expect(store.jobOffers).toContainEqual(newOffer);
  });

  it('should delete a job offer', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    const { useJobOfferStore } = await import('~/stores/jobOffer');
    const store = useJobOfferStore();
    store.jobOffers = [{ id: '1' } as any, { id: '2' } as any];

    await store.deleteJobOffer('1');

    expect(store.jobOffers).toHaveLength(1);
  });

  it('should import job offers', async () => {
    const importedOffer = {
      id: 'import-1',
      title: 'Node.js Developer',
      description: 'Build APIs',
      requiredSkills: ['Node.js', 'Docker'],
    };

    mockApi.post.mockResolvedValue({
      platform: 'linkedin',
      imported: 1,
      skipped: 0,
      offers: [importedOffer],
      warnings: [],
    });

    const { useJobOfferStore } = await import('~/stores/jobOffer');
    const store = useJobOfferStore();

    const result = await store.importJobOffers({
      platform: 'linkedin',
      keywords: ['nodejs', 'docker'],
      location: 'Paris',
      limit: 10,
    });

    expect(result.imported).toBe(1);
    expect(store.jobOffers[0].id).toBe('import-1');
  });
});
