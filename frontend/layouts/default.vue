<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center gap-4">
            <NuxtLink to="/dashboard" class="flex items-center gap-2">
              <span class="text-xl font-bold text-primary-600">ResumeAI</span>
            </NuxtLink>
            <nav class="hidden md:flex items-center gap-1">
              <NuxtLink
                to="/dashboard"
                class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                active-class="bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
              >
                Dashboard
              </NuxtLink>
              <NuxtLink
                to="/cv-editor"
                class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                active-class="bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
              >
                CV Editor
              </NuxtLink>
              <NuxtLink
                to="/job-matcher"
                class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                active-class="bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
              >
                Job Matcher
              </NuxtLink>
            </nav>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm text-gray-600 dark:text-gray-400">
              {{ authStore.fullName || authStore.user?.email }}
            </span>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-heroicons-arrow-right-on-rectangle"
              @click="handleLogout"
            >
              Logout
            </UButton>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore();
const router = useRouter();

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};
</script>
