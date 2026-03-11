<template>
  <div class="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
    <header class="p-6">
      <NuxtLink to="/" class="text-2xl font-bold text-primary-600">
        ResumeAI
      </NuxtLink>
    </header>

    <main class="flex-1 flex items-center justify-center px-4">
      <div class="max-w-4xl mx-auto text-center">
        <h1 class="text-5xl font-extrabold text-gray-900 dark:text-white mb-6">
          Créez le CV parfait avec
          <span class="text-primary-600">l'Intelligence Artificielle</span>
        </h1>
        <p class="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto">
          Importez votre CV, collez une offre d'emploi, et laissez notre IA locale
          optimiser votre candidature pour maximiser vos chances. 100% ATS-compatible.
        </p>
        <div class="flex gap-4 justify-center">
          <UButton size="xl" to="/signup">
            Commencer gratuitement
          </UButton>
          <UButton size="xl" variant="outline" to="/login">
            Se connecter
          </UButton>
        </div>

        <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div class="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <UIcon name="i-heroicons-document-text" class="w-6 h-6 text-primary-600" />
            </div>
            <h3 class="text-lg font-semibold mb-2">Import PDF</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              Importez votre CV existant en PDF et modifiez-le directement.
            </p>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div class="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <UIcon name="i-heroicons-cpu-chip" class="w-6 h-6 text-primary-600" />
            </div>
            <h3 class="text-lg font-semibold mb-2">IA Locale</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              Vos données restent privées. L'IA tourne en local sur notre infrastructure.
            </p>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div class="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <UIcon name="i-heroicons-check-badge" class="w-6 h-6 text-primary-600" />
            </div>
            <h3 class="text-lg font-semibold mb-2">ATS-Friendly</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              CV optimisé pour passer les systèmes de tri automatique des recruteurs.
            </p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' });
</script>
