<template>
  <div class="job-matcher-page">
    <div class="hero">
      <div>
        <p class="eyebrow">Job Matcher</p>
        <h1 class="hero-title">Optimisation CV & Offres</h1>
        <p class="hero-subtitle">
          Centralise l'import des offres et génère tes contenus IA au même
          endroit.
        </p>
      </div>
      <div class="hero-stats">
        <div class="stat-card">
          <p class="stat-label">CV disponibles</p>
          <p class="stat-value">{{ cvStore.cvs.length }}</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">Offres importées</p>
          <p class="stat-value">{{ jobOfferStore.jobOffers.length }}</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="space-y-6 lg:col-span-2">
        <UCard class="panel-card">
          <template #header>
            <div class="panel-header">
              <div>
                <h2>Sources d'offres</h2>
                <p>
                  Import rapide par URL, recherche multi-offres ou saisie
                  manuelle.
                </p>
              </div>
            </div>
          </template>

          <UTabs :items="items">
            <template #urlImport>
              <h3>Importer par URL</h3>
              <p>Colle une offre LinkedIn, Hellowork ou Indeed.</p>
              <div class="flex gap-2">
                <UInput
                  v-model="urlToImport"
                  class="w-full"
                  placeholder="https://..."
                />
                <UButton :loading="importingOffers" @click="importByUrl"
                  >Importer</UButton
                >
              </div>
            </template>

            <template #autoImport v-if="canManageAutoImport">
              <h3>Recherche multi-offres</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <UFormGroup label="Plateforme">
                  <USelect
                    v-model="importForm.platform"
                    :options="platformOptions"
                  />
                </UFormGroup>
                <UFormGroup label="Localisation">
                  <UInput
                    v-model="importForm.location"
                    placeholder="Ex: Paris"
                  />
                </UFormGroup>
                <UFormGroup label="Titre de l'offre">
                  <UInput
                    v-model.number="importForm.title"
                    placeholder="Ex: Développeur backend"
                  />
                </UFormGroup>
                <UFormGroup label="Nombre maximum">
                  <UInput
                    v-model.number="importForm.limit"
                    type="number"
                    min="1"
                    max="25"
                  />
                </UFormGroup>
                <UFormGroup label="Mots-clés" class="md:col-span-2">
                  <UInput
                    v-model="importForm.keywords"
                    placeholder="Ex: nodejs, docker, nest"
                  />
                </UFormGroup>
              </div>
              <UButton :loading="importingOffers" block @click="importOffers">
                Scraper et importer
              </UButton>
            </template>

            <template #manualImport>
              <h3>Saisie manuelle</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <UFormGroup label="Titre du poste">
                  <UInput
                    v-model="jobForm.title"
                    placeholder="Ex: Développeur Full Stack Senior"
                  />
                </UFormGroup>
                <UFormGroup label="Entreprise">
                  <UInput v-model="jobForm.company" placeholder="Ex: Google" />
                </UFormGroup>
                <UFormGroup label="Localisation">
                  <UInput
                    v-model="jobForm.location"
                    placeholder="Ex: Paris, France"
                  />
                </UFormGroup>
                <UFormGroup label="Lien de candidature">
                  <UInput
                    v-model="jobForm.applicationUrl"
                    type="url"
                    placeholder="Ex: https://www.linkedin.com/jobs/view/..."
                  />
                </UFormGroup>
                <UFormGroup label="Description" class="md:col-span-2">
                  <UTextarea
                    v-model="jobForm.description"
                    placeholder="Collez ici la description de l'offre d'emploi..."
                    :rows="6"
                  />
                </UFormGroup>
              </div>
              <UButton
                class="mt-4"
                :loading="addingJob"
                block
                @click="addJobOffer"
              >
                Analyser l'offre
              </UButton>
            </template>
          </UTabs>
        </UCard>

        <UCard v-if="jobOfferStore.jobOffers.length > 0" class="panel-card">
          <template #header>
            <div class="panel-header offer-header">
              <div>
                <h2>Offres enregistrées</h2>
                <p>{{ jobOfferStore.jobOffers.length }} offres disponibles</p>
              </div>
              <div class="offer-actions">
                <label class="offer-select-all">
                  <input
                    type="checkbox"
                    :checked="allOffersSelected"
                    @change="toggleAllOffers"
                  />
                  <span>Tout selectionner</span>
                </label>
                <UButton
                  size="xs"
                  color="red"
                  variant="soft"
                  :disabled="selectedOfferIds.length === 0 || deletingOffers"
                  :loading="deletingOffers"
                  icon="i-heroicons-trash"
                  @click="bulkDeleteOffers"
                >
                  Supprimer ({{ selectedOfferIds.length }})
                </UButton>
              </div>
            </div>
          </template>
          <div class="offer-list">
            <div
              v-for="job in jobOfferStore.jobOffers"
              :key="job.id"
              class="offer-card"
              :class="{ 'is-active': selectedJobId === job.id }"
            >
              <div class="offer-select">
                <input
                  type="checkbox"
                  :checked="selectedOfferIds.includes(job.id)"
                  @change="toggleOffer(job.id)"
                  @click.stop
                />
              </div>
              <button
                type="button"
                class="offer-content"
                @click="selectJob(job)"
              >
                <div class="offer-main">
                  <div>
                    <h3>{{ job.title }}</h3>
                    <p>{{ job.company }} · {{ job.location }}</p>
                  </div>
                  <UButton
                    icon="i-heroicons-trash"
                    size="xs"
                    variant="ghost"
                    color="red"
                    @click.stop="deleteJob(job.id)"
                  />
                </div>
                <div class="offer-meta">
                  <UButton
                    v-if="job.applicationUrl || job.sourceUrl"
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
                  <div class="offer-tags">
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
              </button>
            </div>
          </div>
        </UCard>
      </div>

      <div class="space-y-6">
        <UCard class="panel-card sticky-panel">
          <template #header>
            <div class="panel-header">
              <div>
                <h2>Optimisation</h2>
                <p>Choisis un CV et une offre pour lancer l'IA.</p>
              </div>
            </div>
          </template>

          <div class="panel-stack">
            <div class="panel-block">
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

            <div v-if="aiStore.optimizing" class="panel-block">
              <UProgress :value="aiStore.progress" />
              <p class="text-sm text-gray-500 text-center">
                {{ aiStore.status }} - {{ aiStore.progress }}%
              </p>
            </div>

            <div class="panel-block">
              <h3>Lettre de motivation</h3>
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
                  :rows="10"
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

            <div v-if="aiStore.result" class="panel-block">
              <div v-if="aiStore.result.compatibilityScore" class="score-block">
                <p class="score-value">
                  {{ aiStore.result.compatibilityScore }}%
                </p>
                <p class="score-label">Score de compatibilité</p>
              </div>

              <div v-if="aiStore.result.changes" class="space-y-2">
                <h3>Modifications apportées</h3>
                <ul class="space-y-1">
                  <li
                    v-for="(change, i) in aiStore.result.changes as any[]"
                    :key="i"
                    class="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                  >
                    <UIcon
                      name="i-heroicons-check-circle"
                      class="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"
                    />
                    <span
                      ><strong>{{ change.section }}</strong
                      >: {{ change.description }}</span
                    >
                  </li>
                </ul>
              </div>

              <div v-if="aiStore.result.addedKeywords" class="space-y-2">
                <h3>Mots-clés ajoutés</h3>
                <div class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="kw in aiStore.result.addedKeywords as string[]"
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

            <UAlert
              v-if="aiStore.error"
              color="red"
              variant="soft"
              :title="aiStore.error"
              icon="i-heroicons-exclamation-triangle"
            />
          </div>
        </UCard>
      </div>
    </div>

    <UModal v-model="showJobDetailsModal">
      <UCard v-if="activeJobOffer" class="max-w-3xl w-full">
        <template #header>
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-lg font-semibold">{{ activeJobOffer.title }}</h3>
              <p class="text-sm text-gray-500">
                {{ activeJobOffer.company || "Entreprise non précisée" }}
                <span v-if="activeJobOffer.location">
                  - {{ activeJobOffer.location }}</span
                >
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
            <UBadge
              v-if="activeJobOffer.platform"
              size="sm"
              variant="soft"
              color="primary"
            >
              {{ activeJobOffer.platform }}
            </UBadge>
            <UBadge size="sm" variant="soft" color="gray">
              Créée le {{ formatDate(activeJobOffer.createdAt) }}
            </UBadge>
          </div>

          <div
            v-if="activeJobOffer.applicationUrl || activeJobOffer.sourceUrl"
            class="flex flex-wrap gap-2"
          >
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
              v-if="
                activeJobOffer.sourceUrl &&
                activeJobOffer.sourceUrl !==
                  (activeJobOffer.applicationUrl || activeJobOffer.sourceUrl)
              "
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
            <div
              class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-6"
            >
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
import type { JobOffer } from "~/stores/jobOffer";

const cvStore = useCvStore();
const jobOfferStore = useJobOfferStore();
const aiStore = useAiStore();
const authStore = useAuthStore();

const AUTO_IMPORT_ALLOWED_EMAIL = "amirotalbi94@gmail.com";

const selectedCvId = ref("");
const selectedJobId = ref("");
const addingJob = ref(false);
const importingOffers = ref(false);
const deletingOffers = ref(false);
const showJobDetailsModal = ref(false);
const activeJobOffer = ref<JobOffer | null>(null);
const selectedOfferIds = ref<string[]>([]);
const importFeedback = ref<{
  color: "green" | "amber" | "red";
  title: string;
  description: string;
} | null>(null);

const items = [
  {
    label: "Importer par URL",
    icon: "i-iconoir:import",
    slot: "urlImport",
  },
  {
    label: "Importer automatiquement",
    icon: "i-mdi:automatic",
    slot: "autoImport",
  },
  {
    label: "Importer manuellement",
    icon: "i-boxicons:hand",
    slot: "manualImport",
  },
];

const jobForm = reactive({
  title: "",
  description: "",
  company: "",
  location: "",
  applicationUrl: "",
});

const importForm = reactive({
  platform: "linkedin" as "linkedin" | "indeed" | "hellowork",
  title: "",
  keywords: "",
  location: "",
  limit: 10,
});

const urlToImport = ref("");

const platformOptions = [
  { label: "LinkedIn", value: "linkedin" },
  { label: "Indeed", value: "indeed" },
  { label: "Hellowork", value: "hellowork" },
];

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
    label: `${j.title} - ${j.company || "N/A"}`,
    value: j.id,
  })),
);

const allOffersSelected = computed(
  () =>
    jobOfferStore.jobOffers.length > 0 &&
    selectedOfferIds.value.length === jobOfferStore.jobOffers.length,
);

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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
      color: "red",
      title: "Accès refusé",
      description: "Vous n'êtes pas autorisé à gérer l'import automatique.",
    };
    return;
  }

  const keywords = importForm.keywords
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  if (!keywords.length) {
    importFeedback.value = {
      color: "red",
      title: "Import impossible",
      description: "Ajoutez au moins un mot-clé.",
    };
    return;
  }

  importingOffers.value = true;
  importFeedback.value = null;

  try {
    const result = await jobOfferStore.importJobOffers({
      platform: importForm.platform,
      title: importForm.title,
      keywords,
      location: importForm.location.trim() || undefined,
      limit: Math.max(1, Math.min(importForm.limit || 10, 25)),
    });

    const es = jobOfferStore.startOffersStream(authStore.user?.id || '');
    // Ferme le stream quand le composant est démonté
    onUnmounted(() => es.close());

    if (result.offers.length > 0) {
      selectedJobId.value = result.offers[0].id;
    }

    const warnings = result.warnings?.length
      ? ` Avertissements: ${result.warnings.join(" | ")}`
      : "";

    importFeedback.value = {
      color: result.imported > 0 ? "green" : "amber",
      title: `${result.imported} offre(s) importée(s), ${result.skipped} ignorée(s)`,
      description:
        warnings || "Les offres importées sont prêtes pour l’optimisation IA.",
    };
  } catch (error) {
    importFeedback.value = {
      color: "red",
      title: "Erreur pendant l’import",
      description:
        error instanceof Error
          ? error.message
          : "Échec de l’import automatique",
    };
  } finally {
    importingOffers.value = false;
  }
};

const importByUrl = async () => {
  if (!canManageAutoImport.value) {
    importFeedback.value = {
      color: "red",
      title: "Accès refusé",
      description: "Vous n'êtes pas autorisé à gérer l'import automatique.",
    };
    return;
  }

  if (!urlToImport.value || !/^https?:\/\//i.test(urlToImport.value.trim())) {
    importFeedback.value = {
      color: "red",
      title: "URL invalide",
      description: "Veuillez coller une URL valide.",
    };
    return;
  }

  importingOffers.value = true;
  importFeedback.value = null;

  try {
    const job = await jobOfferStore.importJobOfferByUrl({
      url: urlToImport.value.trim(),
    });

    if (job) {
      selectedJobId.value = job.id;
      importFeedback.value = {
        color: "green",
        title: "Offre importée",
        description: "L'offre a été ajoutée et est prête pour l'optimisation.",
      };
      urlToImport.value = "";
    }
  } catch (error) {
    importFeedback.value = {
      color: "red",
      title: "Erreur pendant l'import",
      description:
        error instanceof Error
          ? error.message
          : "Échec de l'import depuis l'URL",
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
    jobForm.title = "";
    jobForm.description = "";
    jobForm.company = "";
    jobForm.location = "";
    jobForm.applicationUrl = "";
  } catch {
    // error handled by store
  } finally {
    addingJob.value = false;
  }
};

const deleteJob = async (id: string) => {
  await jobOfferStore.deleteJobOffer(id);
  if (selectedJobId.value === id) selectedJobId.value = "";
  selectedOfferIds.value = selectedOfferIds.value.filter(
    (offerId) => offerId !== id,
  );
  await Promise.all([cvStore.fetchCvs(), jobOfferStore.fetchJobOffers()]);
};

const toggleOffer = (id: string) => {
  if (selectedOfferIds.value.includes(id)) {
    selectedOfferIds.value = selectedOfferIds.value.filter(
      (offerId) => offerId !== id,
    );
    return;
  }
  selectedOfferIds.value = [...selectedOfferIds.value, id];
};

const toggleAllOffers = () => {
  if (allOffersSelected.value) {
    selectedOfferIds.value = [];
    return;
  }
  selectedOfferIds.value = jobOfferStore.jobOffers.map((offer) => offer.id);
};

const bulkDeleteOffers = async () => {
  if (selectedOfferIds.value.length === 0) return;
  deletingOffers.value = true;
  const idsToDelete = [...selectedOfferIds.value];
  try {
    await jobOfferStore.deleteJobOffers(idsToDelete);
    if (selectedJobId.value && idsToDelete.includes(selectedJobId.value)) {
      selectedJobId.value = "";
    }
    selectedOfferIds.value = [];
    await Promise.all([cvStore.fetchCvs(), jobOfferStore.fetchJobOffers()]);
  } finally {
    deletingOffers.value = false;
  }
};

const optimize = async () => {
  aiStore.reset();
  await aiStore.optimizeCv(selectedCvId.value, selectedJobId.value);
};

const applyOptimization = async () => {
  if (!aiStore.result?.optimizedContent || !selectedCvId.value) return;

  const sourceCv = cvStore.cvs.find((cv) => cv.id === selectedCvId.value);
  const selectedJob = jobOfferStore.jobOffers.find(
    (job) => job.id === selectedJobId.value,
  );

  const baseTitle = (sourceCv?.title || "CV").trim();
  const companyOrJob =
    (selectedJob?.company && selectedJob.company.trim()) ||
    (selectedJob?.title && selectedJob.title.trim()) ||
    "Optimisation IA";

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

<style scoped>
.job-matcher-page {
  @apply rounded-lg py-4;
  font-family: inherit;
  padding: 0 clamp(16px, 2vw, 32px) 32px;
  margin: 0 calc(-1 * clamp(16px, 2vw, 32px));
  background: radial-gradient(
    circle at top,
    #111a2e 0%,
    #0b1220 60%,
    #0a0f1c 100%
  );
  min-height: 100vh;
  width: 100%;
}

.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 28px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.3em;
  font-size: 0.72rem;
  color: #94a3b8;
  margin-bottom: 8px;
}

.hero-title {
  font-size: clamp(2rem, 2.6vw, 2.8rem);
  line-height: 1.1;
  color: #f8fafc;
  margin-bottom: 8px;
}

.hero-subtitle {
  max-width: 520px;
  color: #94a3b8;
  font-size: 1rem;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  min-width: 260px;
}

.stat-card {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 10px 24px rgba(2, 6, 23, 0.35);
}

.stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: #f8fafc;
}

.panel-card {
  /* background: #0f172a; */
  border: 1px solid #1e293b;
  box-shadow: 0 16px 32px rgba(2, 6, 23, 0.4);
  border-radius: 18px;
}

.panel-header h2 {
  font-size: 1.25rem;
  color: #f8fafc;
}

.panel-header p {
  color: #94a3b8;
  font-size: 0.9rem;
  margin-top: 4px;
}

.panel-grid {
  display: grid;
  gap: 16px;
}

.panel-stack {
  display: grid;
  gap: 18px;
}

.panel-block {
  padding: 16px;
  border-radius: 14px;
  background: #101a2f;
  border: 1px solid #1f2a44;
  display: grid;
  gap: 12px;
}

.panel-block h3 {
  font-weight: 600;
  color: #e2e8f0;
}

.offer-list {
  display: grid;
  gap: 12px;
}

.offer-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.offer-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.offer-select-all {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #cbd5f5;
}

.offer-select {
  display: flex;
  align-items: flex-start;
  padding-top: 4px;
}

.offer-select input,
.offer-select-all input {
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
}

.offer-content {
  text-align: left;
}

.offer-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: flex-start;
  text-align: left;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid #1f2a44;
  background: #0f172a;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.offer-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(2, 6, 23, 0.4);
  border-color: rgba(59, 130, 246, 0.45);
}

.offer-card.is-active {
  border-color: rgba(59, 130, 246, 0.7);
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.2);
  background: rgba(30, 58, 138, 0.35);
}

.offer-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.offer-main h3 {
  font-weight: 600;
  color: #f8fafc;
}

.offer-main p {
  color: #94a3b8;
  font-size: 0.9rem;
}

.offer-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.offer-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.score-block {
  text-align: center;
  padding: 12px;
  border-radius: 14px;
  background: rgba(37, 99, 235, 0.18);
  border: 1px solid rgba(59, 130, 246, 0.4);
}

.score-value {
  font-size: 2rem;
  font-weight: 700;
  color: #bfdbfe;
}

.score-label {
  font-size: 0.85rem;
  color: #93c5fd;
}

.job-matcher-page :deep(input),
.job-matcher-page :deep(textarea),
.job-matcher-page :deep(select) {
  background-color: #0b1220;
  border-color: #1f2a44;
  color: #e2e8f0;
}

.job-matcher-page :deep(input::placeholder),
.job-matcher-page :deep(textarea::placeholder) {
  color: #64748b;
}

.job-matcher-page :deep(.text-gray-500),
.job-matcher-page :deep(.text-gray-600),
.job-matcher-page :deep(.text-gray-700) {
  color: #94a3b8;
}

.sticky-panel {
  position: sticky;
  top: 24px;
}

@media (max-width: 1024px) {
  .sticky-panel {
    position: static;
  }
}
</style>
