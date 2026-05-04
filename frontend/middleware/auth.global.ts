export default defineNuxtRouteMiddleware(async (to) => {
  if (process.server) {
    return;
  }

  const authStore = useAuthStore();

  const publicPages = ['/', '/login', '/signup'];
  const isPublic = publicPages.includes(to.path);

  if (!isPublic && !authStore.isAuthenticated) {
    const refreshed = await authStore.refreshToken();
    if (!refreshed) {
      return navigateTo('/login');
    }
  }

  if (!isPublic && authStore.isAuthenticated && !authStore.user) {
    await authStore.fetchMe();
  }

  if (isPublic && authStore.isAuthenticated && to.path !== '/') {
    return navigateTo('/dashboard');
  }
});
