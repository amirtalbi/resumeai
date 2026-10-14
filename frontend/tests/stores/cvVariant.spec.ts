import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  downloadFile: vi.fn(),
};

vi.stubGlobal('useApi', () => mockApi);

const rules = {
  includeTags: ['symfony'],
  excludeTags: [],
  hiddenItemIds: [],
  skillOrder: [],
  overrides: {},
};

describe('CvVariant Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('crée une variante depuis une offre', async () => {
    const { useCvVariantStore } = await import('~/stores/cvVariant');
    const store = useCvVariantStore();
    mockApi.post.mockResolvedValue({ id: 'v1', cvId: 'cv1', name: 'Acme - Dev', rules });

    const variant = await store.createVariant({ cvId: 'cv1', jobOfferId: 'o1' });

    expect(mockApi.post).toHaveBeenCalledWith('/cv-variants', { cvId: 'cv1', jobOfferId: 'o1' });
    expect(variant.id).toBe('v1');
    expect(store.variants).toHaveLength(1);
  });

  it('met à jour la liste locale après update', async () => {
    const { useCvVariantStore } = await import('~/stores/cvVariant');
    const store = useCvVariantStore();
    store.variants = [{ id: 'v1', cvId: 'cv1', name: 'a', jobOfferId: null, rules } as never];
    mockApi.put.mockResolvedValue({ id: 'v1', cvId: 'cv1', name: 'b', jobOfferId: null, rules });

    await store.updateVariant('v1', { name: 'b' });

    expect(store.variants[0].name).toBe('b');
  });

  it('télécharge avec le nom de fichier fourni par le serveur', async () => {
    const { useCvVariantStore } = await import('~/stores/cvVariant');
    const store = useCvVariantStore();
    mockApi.downloadFile.mockResolvedValue({
      blob: new Blob(['x']),
      filename: 'Amir_Talbi_CV_Acme_Dev.pdf',
    });

    const anchor = { href: '', download: '', click: vi.fn() };
    vi.stubGlobal('window', { URL: { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() } });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });

    await store.exportPdf('v1');

    expect(mockApi.downloadFile).toHaveBeenCalledWith('/cv-variants/v1/export');
    expect(anchor.download).toBe('Amir_Talbi_CV_Acme_Dev.pdf');
    expect(anchor.click).toHaveBeenCalled();
  });
});
