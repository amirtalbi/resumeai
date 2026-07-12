import { defineStore } from "pinia";

export type JobOfferPlatform = "linkedin" | "indeed" | "hellowork" | "wttj";

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

export const useJobOfferStore = defineStore("jobOffer", {
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
        this.jobOffers = await api.get<JobOffer[]>("/job-offer");
      } catch (e: unknown) {
        this.error =
          e instanceof Error ? e.message : "Failed to fetch job offers";
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
        const jobOffer = await api.post<JobOffer>("/job-offer", data);
        this.jobOffers.unshift(jobOffer);
        return jobOffer;
      } catch (e: unknown) {
        this.error =
          e instanceof Error ? e.message : "Failed to create job offer";
        throw e;
      } finally {
        this.loading = false;
      }
    },

    async deleteJobOffer(id: string) {
      this.loading = true;
      this.error = null;
      try {
        const api = useApi();
        await api.delete(`/job-offer/${id}`);
        this.jobOffers = this.jobOffers.filter((j) => j.id !== id);
        if (this.currentJobOffer?.id === id) this.currentJobOffer = null;
        await this.fetchJobOffers();
      } catch (e: unknown) {
        this.error =
          e instanceof Error ? e.message : "Failed to delete job offer";
      } finally {
        this.loading = false;
      }
    },

    async deleteJobOffers(ids: string[]) {
      if (ids.length === 0) return;
      this.loading = true;
      this.error = null;
      try {
        const api = useApi();
        await Promise.all(ids.map((id) => api.delete(`/job-offer/${id}`)));
        const idSet = new Set(ids);
        this.jobOffers = this.jobOffers.filter((offer) => !idSet.has(offer.id));
        if (this.currentJobOffer && idSet.has(this.currentJobOffer.id)) {
          this.currentJobOffer = null;
        }
        await this.fetchJobOffers();
      } catch (e: unknown) {
        this.error =
          e instanceof Error ? e.message : "Failed to delete job offers";
      } finally {
        this.loading = false;
      }
    },

    async importJobOffers(data: {
      platform: JobOfferPlatform;
      title: string;
      keywords: string[];
      location?: string;
      limit?: number;
    }) {
      this.loading = true;
      this.error = null;
      try {
        const api = useApi();
        const result = await api.post<ImportJobOffersResult>(
          "/job-offer/import",
          data,
        );

        if (Array.isArray(result.offers) && result.offers.length > 0) {
          const existingIds = new Set(this.jobOffers.map((offer) => offer.id));
          const imported = result.offers.filter(
            (offer) => !existingIds.has(offer.id),
          );
          this.jobOffers = [...imported, ...this.jobOffers];
        }

        return result;
      } catch (e: unknown) {
        this.error =
          e instanceof Error ? e.message : "Failed to import job offers";
        throw e;
      } finally {
        this.loading = false;
      }
    },
    async importJobOfferByUrl(data: { url: string }) {
      this.loading = true;
      this.error = null;
      try {
        const api = useApi();
        const job = await api.post<JobOffer>("/job-offer/import/url", data);

        const existingIds = new Set(this.jobOffers.map((offer) => offer.id));
        if (!existingIds.has(job.id)) {
          this.jobOffers.unshift(job);
        }

        return job;
      } catch (e: unknown) {
        this.error =
          e instanceof Error ? e.message : "Failed to import job offer by URL";
        throw e;
      } finally {
        this.loading = false;
      }
    },
    startOffersStream(userId: string) {
      const api = useApi();
      const { connect, abort } = api.stream(`/job-offer/stream/${userId}`);

      const run = async () => {
        const response = await connect();
        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data:")) continue;
            try {
              const offer: JobOffer = JSON.parse(line.slice(5).trim());
              const existingIds = new Set(this.jobOffers.map((o) => o.id));
              if (!existingIds.has(offer.id)) this.jobOffers.unshift(offer);
            } catch {}
          }
        }
      };

      run().catch(() => {});
      return abort;
    },
  },
});
