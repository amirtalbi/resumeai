export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore();

  if (authStore.isAuthenticated) {
    if (!authStore.user) {
      await authStore.fetchMe();
    }
    return;
  }

  const refreshed = await authStore.refreshToken();
  if (refreshed && !authStore.user) {
    await authStore.fetchMe();
  }
});
