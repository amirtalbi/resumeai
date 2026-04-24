import { defineStore } from 'pinia';

export type JobOfferPlatform = 'linkedin' | 'indeed' | 'hellowork';

export interface JobOffer {
  id: string;
  userId: string;
  title: string;
  description: string;
  company?: string;
  location?: string;
  platform?: JobOfferPlatform;
  sourceUrl?: string;
  applicationUrl?: string;
  externalId?: string;
  keywords: string[];
  requiredSkills: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ImportJobOffersResult {
  platform: JobOfferPlatform;
  imported: number;
  skipped: number;
  offers: JobOffer[];
  warnings: string[];
}

interface JobOfferState {
  jobOffers: JobOffer[];
  currentJobOffer: JobOffer | null;
  loading: boolean;
  error: string | null;
}

export const useJobOfferStore = defineStore('jobOffer', {
  state: (): JobOfferState => ({
    jobOffers: [],
    currentJobOffer: null,
    loading: false,
    error: null,
  }),

  actions: {
    async fetchJobOffers() {
      this.loading = true;
      this.error = null;
      try {
        const api = useApi();
        this.jobOffers = await api.get<JobOffer[]>('/job-offer');
      } catch (e: unknown) {
        this.error =
          e instanceof Error ? e.message : 'Failed to fetch job offers';
      } finally {
        this.loading = false;
      }
    },

    async createJobOffer(data: {
      title: string;
      description: string;
      company?: string;
      location?: string;
      applicationUrl?: string;
    }) {
      this.loading = true;
      this.error = null;
      try {
        const api = useApi();
        const jobOffer = await api.post<JobOffer>('/job-offer', data);
        this.jobOffers.unshift(jobOffer);
        return jobOffer;
      } catch (e: unknown) {
        this.error =
          e instanceof Error ? e.message : 'Failed to create job offer';
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async deleteJobOffer(id: string) {
      this.loading = true;
      try {
        const api = useApi();
        await api.delete(`/job-offer/${id}`);
        this.jobOffers = this.jobOffers.filter((j) => j.id !== id);
      } catch (e: unknown) {
        this.error =
          e instanceof Error ? e.message : 'Failed to delete job offer';
      } finally {
        this.loading = false;
      }
    },

    async importJobOffers(data: {
      platform: JobOfferPlatform;
      keywords: string[];
      location?: string;
      limit?: number;
    }) {
      this.loading = true;
      this.error = null;
      try {
        const api = useApi();
        const result = await api.post<ImportJobOffersResult>('/job-offer/import', data);

        if (Array.isArray(result.offers) && result.offers.length > 0) {
          const existingIds = new Set(this.jobOffers.map((offer) => offer.id));
          const imported = result.offers.filter((offer) => !existingIds.has(offer.id));
          this.jobOffers = [...imported, ...this.jobOffers];
        }

        return result;
      } catch (e: unknown) {
        this.error =
          e instanceof Error ? e.message : 'Failed to import job offers';
        throw e;
      } finally {
        this.loading = false;
      }
    },
  },
});
