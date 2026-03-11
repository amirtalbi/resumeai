import { defineStore } from 'pinia';

interface AiOptimizationState {
  optimizing: boolean;
  currentJobId: string | null;
  status: string | null;
  progress: number;
  result: Record<string, unknown> | null;
  error: string | null;
}

export const useAiStore = defineStore('ai', {
  state: (): AiOptimizationState => ({
    optimizing: false,
    currentJobId: null,
    status: null,
    progress: 0,
    result: null,
    error: null,
  }),

  actions: {
    async optimizeCv(cvId: string, jobOfferId: string) {
      this.optimizing = true;
      this.error = null;
      this.result = null;
      this.progress = 0;
      try {
        const api = useApi();
        const response = await api.post<{ jobId: string; status: string }>(
          '/ai/optimize',
          { cvId, jobOfferId },
        );
        this.currentJobId = response.jobId;
        this.status = response.status;
        this.pollStatus();
      } catch (e: unknown) {
        this.error =
          e instanceof Error ? e.message : 'Failed to start optimization';
        this.optimizing = false;
      }
    },

    async pollStatus() {
      if (!this.currentJobId) return;

      const api = useApi();
      const maxAttempts = 120; // 2 minutes max
      let attempts = 0;

      const poll = async () => {
        if (attempts >= maxAttempts) {
          this.error = 'Optimization timeout';
          this.optimizing = false;
          return;
        }

        try {
          const data = await api.get<{
            status: string;
            progress: number;
            result?: Record<string, unknown>;
            error?: string;
          }>(`/ai/status/${this.currentJobId}`);

          this.status = data.status;
          this.progress = data.progress;

          if (data.status === 'completed') {
            this.result = data.result || null;
            this.optimizing = false;
            return;
          }

          if (data.status === 'failed') {
            this.error = data.error || 'Optimization failed';
            this.optimizing = false;
            return;
          }

          attempts++;
          setTimeout(poll, 1000);
        } catch {
          this.error = 'Failed to check status';
          this.optimizing = false;
        }
      };

      await poll();
    },

    reset() {
      this.optimizing = false;
      this.currentJobId = null;
      this.status = null;
      this.progress = 0;
      this.result = null;
      this.error = null;
    },
  },
});
