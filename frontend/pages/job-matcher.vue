<template>
  <div>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-6">
      Job Matcher - Optimisation IA
    </h1>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Job Offer Input -->
      <div class="space-y-6">
        <UCard v-if="canManageAutoImport">
          <template #header>
            <button
              type="button"
              class="w-full flex items-center justify-between"
              @click="toggleSection('autoImport')"
            >
              <h2 class="font-semibold">Import automatique d'offres</h2>
              <UIcon
                :name="sectionOpen.autoImport ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                class="w-5 h-5 text-gray-500"
              />
            </button>
          </template>
          <div v-show="sectionOpen.autoImport" class="space-y-4">
            <UFormGroup label="Plateforme">
              <USelect
                v-model="importForm.platform"
                :options="platformOptions"
              />
            </UFormGroup>

            <UFormGroup label="Mots-clés (séparés par des virgules)">
              <UInput
                v-model="importForm.keywords"
                placeholder="Ex: nodejs, docker, nest"
              />
            </UFormGroup>

            <UFormGroup label="Localisation (optionnel)">
              <UInput
                v-model="importForm.location"
                placeholder="Ex: Paris"
              />
            </UFormGroup>

            <UFormGroup label="Coller l'URL d'une offre (LinkedIn / Hellowork / Indeed)">
              <div class="flex gap-2">
                <UInput v-model="urlToImport" placeholder="https://..." />
                <UButton :loading="importingOffers" @click="importByUrl">Importer</UButton>
              </div>
            </UFormGroup>

            <UFormGroup label="Nombre maximum d'offres">
              <UInput
                v-model.number="importForm.limit"
                type="number"
                min="1"
                max="25"
              />
            </UFormGroup>

            <UButton :loading="importingOffers" block @click="importOffers">
              Scraper et importer
            </UButton>

            <UAlert
              v-if="importFeedback"
              :color="importFeedback.color"
              variant="soft"
              :title="importFeedback.title"
              :description="importFeedback.description"
            />
          </div>
        </UCard>

        <UAlert
          v-else
          color="amber"
          variant="soft"
          title="Import automatique restreint"
          description="Seul le compte autorisé peut gérer l'import automatique des offres."
        />

        <UCard>
          <template #header>
            <button
              type="button"
              class="w-full flex items-center justify-between"
              @click="toggleSection('manualJob')"
            >
              <h2 class="font-semibold">Ajouter une offre d'emploi</h2>
              <UIcon
                :name="sectionOpen.manualJob ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                class="w-5 h-5 text-gray-500"
              />
            </button>
          </template>
          <div v-show="sectionOpen.manualJob" class="space-y-4">
            <UFormGroup label="Titre du poste">
              <UInput v-model="jobForm.title" placeholder="Ex: Développeur Full Stack Senior" />
            </UFormGroup>
            <UFormGroup label="Entreprise">
              <UInput v-model="jobForm.company" placeholder="Ex: Google" />
            </UFormGroup>
            <UFormGroup label="Localisation">
              <UInput v-model="jobForm.location" placeholder="Ex: Paris, France" />
            </UFormGroup>
            <UFormGroup label="Lien de candidature (optionnel)">
              <UInput
                v-model="jobForm.applicationUrl"
                type="url"
                placeholder="Ex: https://www.linkedin.com/jobs/view/..."
              />
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
            <button
              type="button"
              class="w-full flex items-center justify-between"
              @click="toggleSection('savedJobs')"
            >
              <h2 class="font-semibold">Offres enregistrées</h2>
              <UIcon
                :name="sectionOpen.savedJobs ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                class="w-5 h-5 text-gray-500"
              />
            </button>
          </template>
          <div v-show="sectionOpen.savedJobs" class="space-y-3">
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
                  <div v-if="job.applicationUrl || job.sourceUrl" class="mt-1">
                    <UButton
                      :to="job.applicationUrl || job.sourceUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      icon="i-heroicons-arrow-top-right-on-square"
                      size="xs"
                      variant="ghost"
                      color="primary"
                      @click.stop
                    >
                      Candidater
                    </UButton>
                  </div>
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
            <button
              type="button"
              class="w-full flex items-center justify-between"
              @click="toggleSection('optimize')"
            >
              <h2 class="font-semibold">Optimiser un CV</h2>
              <UIcon
                :name="sectionOpen.optimize ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                class="w-5 h-5 text-gray-500"
              />
            </button>
          </template>
          <div v-show="sectionOpen.optimize" class="space-y-4">
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
            <button
              type="button"
              class="w-full flex items-center justify-between"
              @click="toggleSection('progress')"
            >
              <h2 class="font-semibold">Optimisation en cours...</h2>
              <UIcon
                :name="sectionOpen.progress ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                class="w-5 h-5 text-gray-500"
              />
            </button>
          </template>
          <div v-show="sectionOpen.progress" class="space-y-3">
            <UProgress :value="aiStore.progress" />
            <p class="text-sm text-gray-500 text-center">
              {{ aiStore.status }} - {{ aiStore.progress }}%
            </p>
          </div>
        </UCard>

        <!-- Cover Letter -->
        <UCard>
          <template #header>
            <button
              type="button"
              class="w-full flex items-center justify-between"
              @click="toggleSection('coverLetter')"
            >
              <h2 class="font-semibold">Lettre de motivation</h2>
              <UIcon
                :name="sectionOpen.coverLetter ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                class="w-5 h-5 text-gray-500"
              />
            </button>
          </template>
          <div v-show="sectionOpen.coverLetter" class="space-y-4">
            <UButton
              block
              :loading="aiStore.coverLetterLoading"
              :disabled="!selectedCvId || !selectedJobId"
              icon="i-heroicons-pencil-square"
              @click="generateCoverLetter"
            >
              Générer une lettre de motivation (500 mots)
            </UButton>

            <UAlert
              v-if="aiStore.coverLetterError"
              color="red"
              variant="soft"
              :title="aiStore.coverLetterError"
              icon="i-heroicons-exclamation-triangle"
            />

            <div v-if="aiStore.coverLetter" class="space-y-2">
              <UTextarea
                :model-value="aiStore.coverLetter"
                :rows="14"
                readonly
              />
              <UButton
                size="sm"
                variant="outline"
                icon="i-heroicons-clipboard"
                @click="copyCoverLetter"
              >
                Copier
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Results -->
        <UCard v-if="aiStore.result">
          <template #header>
            <button
              type="button"
              class="w-full flex items-center justify-between"
              @click="toggleSection('results')"
            >
              <h2 class="font-semibold text-green-600">Optimisation terminée</h2>
              <UIcon
                :name="sectionOpen.results ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                class="w-5 h-5 text-gray-500"
              />
            </button>
          </template>
          <div v-show="sectionOpen.results" class="space-y-4">
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

    <UModal v-model="showJobDetailsModal">
      <UCard v-if="activeJobOffer" class="max-w-3xl w-full">
        <template #header>
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-lg font-semibold">{{ activeJobOffer.title }}</h3>
              <p class="text-sm text-gray-500">
                {{ activeJobOffer.company || 'Entreprise non précisée' }}
                <span v-if="activeJobOffer.location"> - {{ activeJobOffer.location }}</span>
              </p>
            </div>
            <UButton
              icon="i-heroicons-x-mark"
              variant="ghost"
              color="gray"
              @click="showJobDetailsModal = false"
            />
          </div>
        </template>

        <div class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <UBadge v-if="activeJobOffer.platform" size="sm" variant="soft" color="primary">
              {{ activeJobOffer.platform }}
            </UBadge>
            <UBadge size="sm" variant="soft" color="gray">
              Créée le {{ formatDate(activeJobOffer.createdAt) }}
            </UBadge>
          </div>

          <div v-if="activeJobOffer.applicationUrl || activeJobOffer.sourceUrl" class="flex flex-wrap gap-2">
            <UButton
              :to="activeJobOffer.applicationUrl || activeJobOffer.sourceUrl"
              target="_blank"
              rel="noopener noreferrer"
              icon="i-heroicons-arrow-top-right-on-square"
              size="sm"
              color="primary"
            >
              Candidater
            </UButton>

            <UButton
              v-if="activeJobOffer.sourceUrl && activeJobOffer.sourceUrl !== (activeJobOffer.applicationUrl || activeJobOffer.sourceUrl)"
              :to="activeJobOffer.sourceUrl"
              target="_blank"
              rel="noopener noreferrer"
              icon="i-heroicons-link"
              size="sm"
              variant="outline"
              color="gray"
            >
              Voir l'annonce source
            </UButton>
          </div>

          <div>
            <h4 class="font-medium mb-2">Description complète</h4>
            <div class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-6">
              {{ activeJobOffer.description }}
            </div>
          </div>

          <div v-if="activeJobOffer.requiredSkills?.length">
            <h4 class="font-medium mb-2">Compétences requises</h4>
            <div class="flex flex-wrap gap-1">
              <UBadge
                v-for="skill in activeJobOffer.requiredSkills"
                :key="skill"
                size="xs"
                variant="soft"
                color="primary"
              >
                {{ skill }}
              </UBadge>
            </div>
          </div>

          <div v-if="activeJobOffer.keywords?.length">
            <h4 class="font-medium mb-2">Mots-clés détectés</h4>
            <div class="flex flex-wrap gap-1">
              <UBadge
                v-for="keyword in activeJobOffer.keywords"
                :key="keyword"
                size="xs"
                variant="soft"
                color="gray"
              >
                {{ keyword }}
              </UBadge>
            </div>
          </div>

          <UButton
            block
            icon="i-heroicons-check"
            @click="useActiveOfferForOptimization"
          >
            Utiliser cette offre pour l'optimisation
          </UButton>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { JobOffer } from '~/stores/jobOffer';

const cvStore = useCvStore();
const jobOfferStore = useJobOfferStore();
const aiStore = useAiStore();
const authStore = useAuthStore();

const AUTO_IMPORT_ALLOWED_EMAIL = 'amirotalbi94@gmail.com';

const selectedCvId = ref('');
const selectedJobId = ref('');
const addingJob = ref(false);
const importingOffers = ref(false);
const showJobDetailsModal = ref(false);
const activeJobOffer = ref<JobOffer | null>(null);
const importFeedback = ref<{
  color: 'green' | 'amber' | 'red';
  title: string;
  description: string;
} | null>(null);

const jobForm = reactive({
  title: '',
  description: '',
  company: '',
  location: '',
  applicationUrl: '',
});

const importForm = reactive({
  platform: 'linkedin' as 'linkedin' | 'indeed' | 'hellowork',
  keywords: '',
  location: '',
  limit: 10,
});

const urlToImport = ref('');

const platformOptions = [
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Indeed', value: 'indeed' },
  { label: 'Hellowork', value: 'hellowork' },
];

type JobMatcherSection =
  | 'autoImport'
  | 'manualJob'
  | 'savedJobs'
  | 'optimize'
  | 'progress'
  | 'results'
  | 'coverLetter';

const sectionOpen = reactive<Record<JobMatcherSection, boolean>>({
  autoImport: true,
  manualJob: true,
  savedJobs: true,
  optimize: true,
  progress: true,
  results: true,
  coverLetter: true,
});

const toggleSection = (section: JobMatcherSection) => {
  sectionOpen[section] = !sectionOpen[section];
};

const canManageAutoImport = computed(
  () =>
    authStore.user?.email?.toLowerCase() ===
    AUTO_IMPORT_ALLOWED_EMAIL.toLowerCase(),
);

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

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const selectJob = (job: JobOffer) => {
  selectedJobId.value = job.id;
  activeJobOffer.value = job;
  showJobDetailsModal.value = true;
};

const useActiveOfferForOptimization = () => {
  if (!activeJobOffer.value) {
    return;
  }

  selectedJobId.value = activeJobOffer.value.id;
  showJobDetailsModal.value = false;
};

const importOffers = async () => {
  if (!canManageAutoImport.value) {
    importFeedback.value = {
      color: 'red',
      title: 'Accès refusé',
      description: 'Vous n\'êtes pas autorisé à gérer l\'import automatique.',
    };
    return;
  }

  const keywords = importForm.keywords
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  if (!keywords.length) {
    importFeedback.value = {
      color: 'red',
      title: 'Import impossible',
      description: 'Ajoutez au moins un mot-clé.',
    };
    return;
  }

  importingOffers.value = true;
  importFeedback.value = null;

  try {
    const result = await jobOfferStore.importJobOffers({
      platform: importForm.platform,
      keywords,
      location: importForm.location.trim() || undefined,
      limit: Math.max(1, Math.min(importForm.limit || 10, 25)),
    });

    if (result.offers.length > 0) {
      selectedJobId.value = result.offers[0].id;
    }

    const warnings = result.warnings?.length
      ? ` Avertissements: ${result.warnings.join(' | ')}`
      : '';

    importFeedback.value = {
      color: result.imported > 0 ? 'green' : 'amber',
      title: `${result.imported} offre(s) importée(s), ${result.skipped} ignorée(s)`,
      description: warnings || 'Les offres importées sont prêtes pour l’optimisation IA.',
    };
  } catch (error) {
    importFeedback.value = {
      color: 'red',
      title: 'Erreur pendant l’import',
      description: error instanceof Error ? error.message : 'Échec de l’import automatique',
    };
  } finally {
    importingOffers.value = false;
  }
};

const importByUrl = async () => {
  if (!canManageAutoImport.value) {
    importFeedback.value = {
      color: 'red',
      title: 'Accès refusé',
      description: 'Vous n\'êtes pas autorisé à gérer l\'import automatique.',
    };
    return;
  }

  if (!urlToImport.value || !/^https?:\/\//i.test(urlToImport.value.trim())) {
    importFeedback.value = {
      color: 'red',
      title: 'URL invalide',
      description: 'Veuillez coller une URL valide.',
    };
    return;
  }

  importingOffers.value = true;
  importFeedback.value = null;

  try {
    const job = await jobOfferStore.importJobOfferByUrl({ url: urlToImport.value.trim() });

    if (job) {
      selectedJobId.value = job.id;
      importFeedback.value = {
        color: 'green',
        title: 'Offre importée',
        description: 'L\'offre a été ajoutée et est prête pour l\'optimisation.',
      };
      urlToImport.value = '';
    }
  } catch (error) {
    importFeedback.value = {
      color: 'red',
      title: 'Erreur pendant l\'import',
      description: error instanceof Error ? error.message : 'Échec de l\'import depuis l\'URL',
    };
  } finally {
    importingOffers.value = false;
  }
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
      applicationUrl: jobForm.applicationUrl.trim() || undefined,
    });
    selectedJobId.value = job.id;
    jobForm.title = '';
    jobForm.description = '';
    jobForm.company = '';
    jobForm.location = '';
    jobForm.applicationUrl = '';
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

const generateCoverLetter = async () => {
  await aiStore.generateCoverLetter(selectedCvId.value, selectedJobId.value);
};

const copyCoverLetter = async () => {
  if (!aiStore.coverLetter) return;
  try {
    await navigator.clipboard.writeText(aiStore.coverLetter);
  } catch {
    // ignore clipboard errors
  }
};
</script>
