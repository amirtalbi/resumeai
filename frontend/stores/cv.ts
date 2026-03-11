import { defineStore } from 'pinia';

export interface CvContent {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    linkedin?: string;
    website?: string;
  };
  summary?: string;
  experiences: {
    company: string;
    position: string;
    startDate: string;
    endDate?: string;
    current?: boolean;
    description: string;
    achievements?: string[];
  }[];
  education: {
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate?: string;
    description?: string;
  }[];
  skills: {
    category: string;
    items: string[];
  }[];
  languages?: {
    name: string;
    level: string;
  }[];
  certifications?: {
    name: string;
    issuer: string;
    date: string;
  }[];
}

export interface Cv {
  id: string;
  userId: string;
  title: string;
  contentJson: CvContent;
  createdAt: string;
  updatedAt: string;
}

interface CvState {
  cvs: Cv[];
  currentCv: Cv | null;
  loading: boolean;
  error: string | null;
}

export const useCvStore = defineStore('cv', {
  state: (): CvState => ({
    cvs: [],
    currentCv: null,
    loading: false,
    error: null,
  }),

  actions: {
    async fetchCvs() {
      this.loading = true;
      this.error = null;
      try {
        const api = useApi();
        this.cvs = await api.get<Cv[]>('/cv');
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Failed to fetch CVs';
      } finally {
        this.loading = false;
      }
    },

    async fetchCv(id: string) {
      this.loading = true;
      this.error = null;
      try {
        const api = useApi();
        this.currentCv = await api.get<Cv>(`/cv/${id}`);
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Failed to fetch CV';
      } finally {
        this.loading = false;
      }
    },

    async createCv(title: string, contentJson: CvContent) {
      this.loading = true;
      this.error = null;
      try {
        const api = useApi();
        const cv = await api.post<Cv>('/cv', { title, contentJson });
        this.cvs.unshift(cv);
        return cv;
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Failed to create CV';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async updateCv(id: string, data: { title?: string; contentJson?: CvContent }) {
      this.loading = true;
      this.error = null;
      try {
        const api = useApi();
        const cv = await api.put<Cv>(`/cv/${id}`, data);
        const index = this.cvs.findIndex((c) => c.id === id);
        if (index !== -1) this.cvs[index] = cv;
        if (this.currentCv?.id === id) this.currentCv = cv;
        return cv;
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Failed to update CV';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async deleteCv(id: string) {
      this.loading = true;
      this.error = null;
      try {
        const api = useApi();
        await api.delete(`/cv/${id}`);
        this.cvs = this.cvs.filter((c) => c.id !== id);
        if (this.currentCv?.id === id) this.currentCv = null;
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Failed to delete CV';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async importPdf(file: File) {
      this.loading = true;
      this.error = null;
      try {
        const api = useApi();
        const cv = await api.upload<Cv>('/cv/import-pdf', file);
        this.cvs.unshift(cv);
        return cv;
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Failed to import PDF';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async exportPdf(cvId: string) {
      try {
        const api = useApi();
        const blob = await api.download(`/pdf/export/${cvId}`);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cv-${cvId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Failed to export PDF';
        throw e;
      }
    },
  },
});
