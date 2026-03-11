export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore();

  const publicPages = ['/', '/login', '/signup'];
  const isPublic = publicPages.includes(to.path);

  if (!isPublic && !authStore.isAuthenticated) {
    return navigateTo('/login');
  }

  if (isPublic && authStore.isAuthenticated && to.path !== '/') {
    return navigateTo('/dashboard');
  }
});
