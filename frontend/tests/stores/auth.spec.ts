import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Mock useRuntimeConfig
vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBase: 'http://localhost:3001/api' },
}));

// Mock useAuthStore for useApi
vi.stubGlobal('useAuthStore', () => ({
  accessToken: null,
  refreshToken: vi.fn(),
  logout: vi.fn(),
}));

// Mock navigateTo
vi.stubGlobal('navigateTo', vi.fn());

// Mock useApi
vi.stubGlobal('useApi', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
}));

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should initialize with no user', async () => {
    // Import after stubs
    const { useAuthStore: createAuthStore } = await import('~/stores/auth');
    const store = createAuthStore();
    expect(store.user).toBeNull();
    expect(store.accessToken).toBeNull();
    expect(store.isAuthenticated).toBe(false);
  });

  it('should compute fullName correctly', async () => {
    const { useAuthStore: createAuthStore } = await import('~/stores/auth');
    const store = createAuthStore();
    store.user = { id: '1', email: 'test@test.com', firstName: 'John', lastName: 'Doe' };
    expect(store.fullName).toBe('John Doe');
  });

  it('should be authenticated when token exists', async () => {
    const { useAuthStore: createAuthStore } = await import('~/stores/auth');
    const store = createAuthStore();
    store.accessToken = 'some-token';
    expect(store.isAuthenticated).toBe(true);
  });

  it('should clear state on logout', async () => {
    const { useAuthStore: createAuthStore } = await import('~/stores/auth');
    const store = createAuthStore();
    store.user = { id: '1', email: 'test@test.com' };
    store.accessToken = 'token';

    // Mock fetch for logout
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as any;

    await store.logout();

    expect(store.user).toBeNull();
    expect(store.accessToken).toBeNull();
  });
});
