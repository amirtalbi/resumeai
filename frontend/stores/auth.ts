import { defineStore } from 'pinia';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    accessToken: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.accessToken,
    fullName: (state) => {
      if (!state.user) return '';
      return [state.user.firstName, state.user.lastName]
        .filter(Boolean)
        .join(' ');
    },
  },

  actions: {
    async fetchMe(): Promise<boolean> {
      try {
        const api = useApi();
        const user = await api.get<User>('/auth/me');
        this.user = user;
        return true;
      } catch {
        return false;
      }
    },

    async login(email: string, password: string) {
      const config = useRuntimeConfig();
      const response = await fetch(`${config.public.apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();
      this.user = data.user;
      this.accessToken = data.accessToken;
    },

    async signup(
      email: string,
      password: string,
      firstName?: string,
      lastName?: string,
    ) {
      const config = useRuntimeConfig();
      const response = await fetch(`${config.public.apiBase}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Signup failed');
      }

      const data = await response.json();
      this.user = data.user;
      this.accessToken = data.accessToken;
    },

    async refreshToken(): Promise<boolean> {
      try {
        const config = useRuntimeConfig();
        const response = await fetch(
          `${config.public.apiBase}/auth/refresh`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          },
        );

        if (!response.ok) return false;

        const data = await response.json();
        this.accessToken = data.accessToken;
        if (!this.user) {
          await this.fetchMe();
        }
        return true;
      } catch {
        return false;
      }
    },

    async logout() {
      try {
        const config = useRuntimeConfig();
        await fetch(`${config.public.apiBase}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          credentials: 'include',
        });
      } catch {
        // ignore logout errors
      }
      this.user = null;
      this.accessToken = null;
    },
  },

  persist: true,
});
