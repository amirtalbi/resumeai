<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Connexion</h1>
          <p class="text-sm text-gray-500 mt-1">
            Connectez-vous à votre compte ResumeAI
          </p>
        </div>
      </template>

      <UForm :state="form" :validate="validate" @submit="handleLogin">
        <div class="space-y-4">
          <UFormGroup label="Email" name="email">
            <UInput
              v-model="form.email"
              type="email"
              placeholder="vous@exemple.com"
              icon="i-heroicons-envelope"
            />
          </UFormGroup>

          <UFormGroup label="Mot de passe" name="password">
            <UInput
              v-model="form.password"
              type="password"
              placeholder="••••••••"
              icon="i-heroicons-lock-closed"
            />
          </UFormGroup>

          <UButton
            type="submit"
            block
            :loading="loading"
          >
            Se connecter
          </UButton>

          <UAlert
            v-if="error"
            color="red"
            variant="soft"
            :title="error"
            icon="i-heroicons-exclamation-triangle"
          />
        </div>
      </UForm>

      <template #footer>
        <p class="text-center text-sm text-gray-500">
          Pas encore de compte ?
          <NuxtLink to="/signup" class="text-primary-600 hover:underline font-medium">
            Créer un compte
          </NuxtLink>
        </p>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const authStore = useAuthStore();
const router = useRouter();

const form = reactive({
  email: '',
  password: '',
});

const loading = ref(false);
const error = ref('');

const validate = (state: typeof form) => {
  const errors = [];
  if (!state.email) errors.push({ path: 'email', message: 'Email requis' });
  if (!state.password)
    errors.push({ path: 'password', message: 'Mot de passe requis' });
  return errors;
};

const handleLogin = async () => {
  loading.value = true;
  error.value = '';
  try {
    await authStore.login(form.email, form.password);
    router.push('/dashboard');
  } catch (e: unknown) {
    error.value =
      e instanceof Error ? e.message : 'Identifiants invalides';
  } finally {
    loading.value = false;
  }
};
</script>
