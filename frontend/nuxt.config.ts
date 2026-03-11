export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxtjs/tailwindcss'],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api',
    },
  },

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
  },

  app: {
    head: {
      title: 'ResumeAI - CV Builder',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'AI-powered CV builder with ATS optimization',
        },
      ],
    },
  },

  compatibilityDate: '2024-01-01',
});
