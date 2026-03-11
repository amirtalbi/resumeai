<template>
  <div>
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p class="text-gray-500 mt-1">Gérez vos CV et offres d'emploi</p>
      </div>
      <div class="flex gap-3">
        <UButton icon="i-heroicons-arrow-up-tray" variant="outline" @click="showImportModal = true">
          Importer PDF
        </UButton>
        <UButton icon="i-heroicons-plus" @click="navigateTo('/cv-editor')">
          Nouveau CV
        </UButton>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <UCard>
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
            <UIcon name="i-heroicons-document-text" class="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <p class="text-2xl font-bold">{{ cvStore.cvs.length }}</p>
            <p class="text-sm text-gray-500">CV créés</p>
          </div>
        </div>
      </UCard>
      <UCard>
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
            <UIcon name="i-heroicons-briefcase" class="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p class="text-2xl font-bold">{{ jobOfferStore.jobOffers.length }}</p>
            <p class="text-sm text-gray-500">Offres analysées</p>
          </div>
        </div>
      </UCard>
      <UCard>
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
            <UIcon name="i-heroicons-cpu-chip" class="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p class="text-2xl font-bold">{{ optimizationCount }}</p>
            <p class="text-sm text-gray-500">Optimisations IA</p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- CV List -->
    <div class="mb-8">
      <h2 class="text-xl font-semibold mb-4">Mes CV</h2>
      <div v-if="cvStore.loading" class="flex justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>
      <div v-else-if="cvStore.cvs.length === 0" class="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
        <UIcon name="i-heroicons-document-text" class="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <p class="text-gray-500 mb-4">Aucun CV créé pour le moment</p>
        <UButton @click="navigateTo('/cv-editor')">Créer mon premier CV</UButton>
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <UCard
          v-for="cv in cvStore.cvs"
          :key="cv.id"
          class="hover:shadow-md transition-shadow cursor-pointer"
          @click="navigateTo(`/cv-editor?id=${cv.id}`)"
        >
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-semibold text-lg">{{ cv.title }}</h3>
              <p class="text-sm text-gray-500 mt-1">
                {{ cv.contentJson.personalInfo.firstName }}
                {{ cv.contentJson.personalInfo.lastName }}
              </p>
              <p class="text-xs text-gray-400 mt-2">
                Modifié le {{ formatDate(cv.updatedAt) }}
              </p>
            </div>
            <div class="flex gap-1">
              <UButton
                icon="i-heroicons-arrow-down-tray"
                size="xs"
                variant="ghost"
                color="gray"
                @click.stop="cvStore.exportPdf(cv.id)"
              />
              <UButton
                icon="i-heroicons-trash"
                size="xs"
                variant="ghost"
                color="red"
                @click.stop="deleteCv(cv.id)"
              />
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Import Modal -->
    <UModal v-model="showImportModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Importer un CV (PDF)</h3>
        </template>
        <div class="space-y-4">
          <div
            class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center"
            @drop.prevent="handleDrop"
            @dragover.prevent
          >
            <UIcon name="i-heroicons-cloud-arrow-up" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p class="text-gray-500 mb-2">Glissez votre PDF ici ou</p>
            <UButton variant="outline" @click="fileInput?.click()">
              Parcourir
            </UButton>
            <input
              ref="fileInput"
              type="file"
              accept=".pdf"
              class="hidden"
              @change="handleFileSelect"
            />
          </div>
          <p v-if="selectedFile" class="text-sm text-green-600">
            {{ selectedFile.name }} sélectionné
          </p>
          <UButton
            block
            :loading="importing"
            :disabled="!selectedFile"
            @click="importPdf"
          >
            Importer
          </UButton>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const cvStore = useCvStore();
const jobOfferStore = useJobOfferStore();

const showImportModal = ref(false);
const selectedFile = ref<File | null>(null);
const importing = ref(false);
const fileInput = ref<HTMLInputElement>();
const optimizationCount = ref(0);

onMounted(async () => {
  await Promise.all([cvStore.fetchCvs(), jobOfferStore.fetchJobOffers()]);
});

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files?.[0]) {
    selectedFile.value = input.files[0];
  }
};

const handleDrop = (event: DragEvent) => {
  const file = event.dataTransfer?.files[0];
  if (file?.type === 'application/pdf') {
    selectedFile.value = file;
  }
};

const importPdf = async () => {
  if (!selectedFile.value) return;
  importing.value = true;
  try {
    await cvStore.importPdf(selectedFile.value);
    showImportModal.value = false;
    selectedFile.value = null;
  } catch {
    // Error handled by store
  } finally {
    importing.value = false;
  }
};

const deleteCv = async (id: string) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce CV ?')) {
    await cvStore.deleteCv(id);
  }
};
</script>
