<template>
  <div>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-6">
      Job Matcher - Optimisation IA
    </h1>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Job Offer Input -->
      <div class="space-y-6">
        <UCard>
          <template #header>
            <h2 class="font-semibold">Ajouter une offre d'emploi</h2>
          </template>
          <div class="space-y-4">
            <UFormGroup label="Titre du poste">
              <UInput v-model="jobForm.title" placeholder="Ex: Développeur Full Stack Senior" />
            </UFormGroup>
            <UFormGroup label="Entreprise">
              <UInput v-model="jobForm.company" placeholder="Ex: Google" />
            </UFormGroup>
            <UFormGroup label="Localisation">
              <UInput v-model="jobForm.location" placeholder="Ex: Paris, France" />
            </UFormGroup>
            <UFormGroup label="Description de l'offre">
              <UTextarea
                v-model="jobForm.description"
                placeholder="Collez ici la description de l'offre d'emploi..."
                :rows="10"
              />
            </UFormGroup>
            <UButton :loading="addingJob" block @click="addJobOffer">
              Analyser l'offre
            </UButton>
          </div>
        </UCard>

        <!-- Saved Job Offers -->
        <UCard v-if="jobOfferStore.jobOffers.length > 0">
          <template #header>
            <h2 class="font-semibold">Offres enregistrées</h2>
          </template>
          <div class="space-y-3">
            <div
              v-for="job in jobOfferStore.jobOffers"
              :key="job.id"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
              :class="{ 'ring-2 ring-primary-500': selectedJobId === job.id }"
              @click="selectJob(job)"
            >
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="font-medium">{{ job.title }}</h3>
                  <p class="text-sm text-gray-500">{{ job.company }} - {{ job.location }}</p>
                  <div class="flex flex-wrap gap-1 mt-2">
                    <UBadge
                      v-for="skill in job.requiredSkills.slice(0, 5)"
                      :key="skill"
                      size="xs"
                      variant="soft"
                    >
                      {{ skill }}
                    </UBadge>
                    <UBadge
                      v-if="job.requiredSkills.length > 5"
                      size="xs"
                      variant="soft"
                      color="gray"
                    >
                      +{{ job.requiredSkills.length - 5 }}
                    </UBadge>
                  </div>
                </div>
                <UButton
                  icon="i-heroicons-trash"
                  size="xs"
                  variant="ghost"
                  color="red"
                  @click.stop="deleteJob(job.id)"
                />
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Optimization Panel -->
      <div class="space-y-6">
        <!-- CV Selection -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">Optimiser un CV</h2>
          </template>
          <div class="space-y-4">
            <UFormGroup label="Sélectionner un CV">
              <USelect
                v-model="selectedCvId"
                :options="cvOptions"
                placeholder="Choisir un CV..."
              />
            </UFormGroup>
            <UFormGroup label="Offre d'emploi">
              <USelect
                v-model="selectedJobId"
                :options="jobOptions"
                placeholder="Choisir une offre..."
              />
            </UFormGroup>
            <UButton
              block
              :loading="aiStore.optimizing"
              :disabled="!selectedCvId || !selectedJobId"
              icon="i-heroicons-cpu-chip"
              @click="optimize"
            >
              Optimiser avec l'IA
            </UButton>
          </div>
        </UCard>

        <!-- Progress -->
        <UCard v-if="aiStore.optimizing">
          <template #header>
            <h2 class="font-semibold">Optimisation en cours...</h2>
          </template>
          <div class="space-y-3">
            <UProgress :value="aiStore.progress" />
            <p class="text-sm text-gray-500 text-center">
              {{ aiStore.status }} - {{ aiStore.progress }}%
            </p>
          </div>
        </UCard>

        <!-- Results -->
        <UCard v-if="aiStore.result">
          <template #header>
            <h2 class="font-semibold text-green-600">Optimisation terminée</h2>
          </template>
          <div class="space-y-4">
            <div v-if="aiStore.result.compatibilityScore" class="text-center">
              <p class="text-4xl font-bold text-primary-600">
                {{ aiStore.result.compatibilityScore }}%
              </p>
              <p class="text-sm text-gray-500">Score de compatibilité</p>
            </div>

            <div v-if="aiStore.result.changes">
              <h3 class="font-medium mb-2">Modifications apportées :</h3>
              <ul class="space-y-1">
                <li
                  v-for="(change, i) in (aiStore.result.changes as any[])"
                  :key="i"
                  class="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                >
                  <UIcon name="i-heroicons-check-circle" class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>{{ change.section }}</strong>: {{ change.description }}</span>
                </li>
              </ul>
            </div>

            <div v-if="aiStore.result.addedKeywords">
              <h3 class="font-medium mb-2">Mots-clés ajoutés :</h3>
              <div class="flex flex-wrap gap-1">
                <UBadge
                  v-for="kw in (aiStore.result.addedKeywords as string[])"
                  :key="kw"
                  size="xs"
                  color="green"
                >
                  {{ kw }}
                </UBadge>
              </div>
            </div>

            <UButton
              v-if="aiStore.result.optimizedContent"
              block
              variant="outline"
              @click="applyOptimization"
            >
              Créer une copie optimisée du CV
            </UButton>
          </div>
        </UCard>

        <!-- Error -->
        <UAlert
          v-if="aiStore.error"
          color="red"
          variant="soft"
          :title="aiStore.error"
          icon="i-heroicons-exclamation-triangle"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const cvStore = useCvStore();
const jobOfferStore = useJobOfferStore();
const aiStore = useAiStore();

const selectedCvId = ref('');
const selectedJobId = ref('');
const addingJob = ref(false);

const jobForm = reactive({
  title: '',
  description: '',
  company: '',
  location: '',
});

onMounted(async () => {
  await Promise.all([cvStore.fetchCvs(), jobOfferStore.fetchJobOffers()]);
});

const cvOptions = computed(() =>
  cvStore.cvs.map((cv) => ({ label: cv.title, value: cv.id })),
);

const jobOptions = computed(() =>
  jobOfferStore.jobOffers.map((j) => ({
    label: `${j.title} - ${j.company || 'N/A'}`,
    value: j.id,
  })),
);

const selectJob = (job: { id: string }) => {
  selectedJobId.value = job.id;
};

const addJobOffer = async () => {
  if (!jobForm.title || !jobForm.description) return;
  addingJob.value = true;
  try {
    const job = await jobOfferStore.createJobOffer({
      title: jobForm.title,
      description: jobForm.description,
      company: jobForm.company,
      location: jobForm.location,
    });
    selectedJobId.value = job.id;
    jobForm.title = '';
    jobForm.description = '';
    jobForm.company = '';
    jobForm.location = '';
  } catch {
    // error handled by store
  } finally {
    addingJob.value = false;
  }
};

const deleteJob = async (id: string) => {
  await jobOfferStore.deleteJobOffer(id);
  if (selectedJobId.value === id) selectedJobId.value = '';
};

const optimize = async () => {
  aiStore.reset();
  await aiStore.optimizeCv(selectedCvId.value, selectedJobId.value);
};

const applyOptimization = async () => {
  if (!aiStore.result?.optimizedContent || !selectedCvId.value) return;

  const sourceCv = cvStore.cvs.find((cv) => cv.id === selectedCvId.value);
  const selectedJob = jobOfferStore.jobOffers.find((job) => job.id === selectedJobId.value);

  const baseTitle = (sourceCv?.title || 'CV').trim();
  const companyOrJob =
    (selectedJob?.company && selectedJob.company.trim()) ||
    (selectedJob?.title && selectedJob.title.trim()) ||
    'Optimisation IA';

  const nextTitle = `${baseTitle} - ${companyOrJob}`.slice(0, 200);

  const createdCv = await cvStore.createCv(
    nextTitle,
    aiStore.result.optimizedContent as any,
  );

  navigateTo(`/cv-editor?id=${createdCv.id}`);
};
</script>
