import { defineStore } from 'pinia';
import type { CvContent } from './cv';

export interface VariantRules {
  includeTags: string[];
  excludeTags: string[];
  hiddenItemIds: string[];
  skillOrder: string[];
  itemOrder: string[];
  overrides: { jobTitle?: string; summary?: string; language?: string };
}

export interface CvVariant {
  id: string;
  cvId: string;
  name: string;
  jobOfferId: string | null;
  rules: VariantRules;
  createdAt: string;
  updatedAt: string;
}

export interface VariantDetail {
  variant: CvVariant;
  master: CvContent;
  resolved: CvContent;
}

export const emptyRules = (): VariantRules => ({
  includeTags: [],
  excludeTags: [],
  hiddenItemIds: [],
  skillOrder: [],
  itemOrder: [],
  overrides: {},
});

interface CvVariantState {
  variants: CvVariant[];
  loading: boolean;
  error: string | null;
}

export const useCvVariantStore = defineStore('cvVariant', {
  state: (): CvVariantState => ({
    variants: [],
    loading: false,
    error: null,
  }),

  actions: {
    async fetchVariants(cvId?: string) {
      this.loading = true;
      this.error = null;
      try {
        const api = useApi();
        const query = cvId ? `?cvId=${encodeURIComponent(cvId)}` : '';
        this.variants = await api.get<CvVariant[]>(`/cv-variants${query}`);
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Failed to fetch variants';
      } finally {
        this.loading = false;
      }
    },

    async fetchDetail(id: string) {
      const api = useApi();
      return api.get<VariantDetail>(`/cv-variants/${id}`);
    },

    async createVariant(data: {
      cvId: string;
      name?: string;
      jobOfferId?: string;
      rules?: VariantRules;
    }) {
      const api = useApi();
      const variant = await api.post<CvVariant>('/cv-variants', data);
      this.variants.unshift(variant);
      return variant;
    },

    async updateVariant(
      id: string,
      data: { name?: string; jobOfferId?: string; rules?: VariantRules },
    ) {
      const api = useApi();
      const variant = await api.put<CvVariant>(`/cv-variants/${id}`, data);
      const index = this.variants.findIndex((v) => v.id === id);
      if (index !== -1) this.variants[index] = variant;
      return variant;
    },

    async deleteVariant(id: string) {
      const api = useApi();
      await api.delete(`/cv-variants/${id}`);
      this.variants = this.variants.filter((v) => v.id !== id);
    },

    async duplicateVariant(id: string, data: { name?: string; jobOfferId?: string } = {}) {
      const api = useApi();
      const variant = await api.post<CvVariant>(`/cv-variants/${id}/duplicate`, data);
      this.variants.unshift(variant);
      return variant;
    },

    async preview(cvId: string, rules: VariantRules) {
      const api = useApi();
      return api.post<CvContent>('/cv-variants/preview', { cvId, rules });
    },

    async exportPdf(id: string) {
      const api = useApi();
      const { blob, filename } = await api.downloadFile(`/cv-variants/${id}/export`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'cv.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  },
});
