<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Créer un compte</h1>
          <p class="text-sm text-gray-500 mt-1">
            Rejoignez ResumeAI et créez votre CV optimisé
          </p>
        </div>
      </template>

      <UForm :state="form" :validate="validate" @submit="handleSignup">
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormGroup label="Prénom" name="firstName">
              <UInput v-model="form.firstName" placeholder="John" />
            </UFormGroup>
            <UFormGroup label="Nom" name="lastName">
              <UInput v-model="form.lastName" placeholder="Doe" />
            </UFormGroup>
          </div>

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
              placeholder="Min. 8 caractères"
              icon="i-heroicons-lock-closed"
            />
          </UFormGroup>

          <UFormGroup label="Confirmer le mot de passe" name="confirmPassword">
            <UInput
              v-model="form.confirmPassword"
              type="password"
              placeholder="Confirmez votre mot de passe"
              icon="i-heroicons-lock-closed"
            />
          </UFormGroup>

          <UButton type="submit" block :loading="loading">
            Créer mon compte
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
          Déjà un compte ?
          <NuxtLink to="/login" class="text-primary-600 hover:underline font-medium">
            Se connecter
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
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
});

const loading = ref(false);
const error = ref('');

const validate = (state: typeof form) => {
  const errors = [];
  if (!state.email) errors.push({ path: 'email', message: 'Email requis' });
  if (!state.password)
    errors.push({ path: 'password', message: 'Mot de passe requis' });
  if (state.password.length < 8)
    errors.push({
      path: 'password',
      message: 'Min. 8 caractères',
    });
  if (state.password !== state.confirmPassword)
    errors.push({
      path: 'confirmPassword',
      message: 'Les mots de passe ne correspondent pas',
    });
  return errors;
};

const handleSignup = async () => {
  loading.value = true;
  error.value = '';
  try {
    await authStore.signup(
      form.email,
      form.password,
      form.firstName,
      form.lastName,
    );
    router.push('/dashboard');
  } catch (e: unknown) {
    error.value =
      e instanceof Error ? e.message : 'Erreur lors de la création du compte';
  } finally {
    loading.value = false;
  }
};
</script>
