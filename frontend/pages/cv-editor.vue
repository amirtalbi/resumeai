<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        {{ isEditing ? 'Modifier le CV' : 'Nouveau CV' }}
      </h1>
      <div class="flex gap-3">
        <UButton
          v-if="isEditing"
          icon="i-heroicons-arrow-down-tray"
          variant="outline"
          @click="exportPdf"
        >
          Télécharger PDF
        </UButton>
        <UButton icon="i-heroicons-check" :loading="saving" @click="saveCv">
          {{ isEditing ? 'Sauvegarder' : 'Créer' }}
        </UButton>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Editor Form -->
      <div class="space-y-6">
        <!-- Title -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">Titre du CV</h2>
          </template>
          <UInput v-model="cvTitle" placeholder="Mon CV professionnel" />
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold">Langue du CV</h2>
          </template>
          <UFormGroup label="Langue d'affichage">
            <USelect v-model="cvContent.language" :options="languageOptions" />
          </UFormGroup>
        </UCard>

        <!-- Personal Info -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">Informations personnelles</h2>
          </template>
          <div class="grid grid-cols-2 gap-4">
            <UFormGroup label="Prénom">
              <UInput v-model="cvContent.personalInfo.firstName" />
            </UFormGroup>
            <UFormGroup label="Nom">
              <UInput v-model="cvContent.personalInfo.lastName" />
            </UFormGroup>
            <UFormGroup label="Poste" class="col-span-2">
              <UInput
                v-model="cvContent.personalInfo.jobTitle"
                placeholder="Ex: Développeur Full Stack"
              />
            </UFormGroup>
            <UFormGroup label="Email">
              <UInput v-model="cvContent.personalInfo.email" type="email" />
            </UFormGroup>
            <UFormGroup label="Téléphone">
              <UInput v-model="cvContent.personalInfo.phone" />
            </UFormGroup>
            <UFormGroup label="Adresse">
              <UInput v-model="cvContent.personalInfo.address" />
            </UFormGroup>
            <UFormGroup label="LinkedIn">
              <UInput v-model="cvContent.personalInfo.linkedin" />
            </UFormGroup>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold">QR code</h2>
          </template>
          <div class="space-y-3">
            <UCheckbox v-model="cvContent.qrCode.enabled" label="Afficher un QR code" />
            <div v-if="cvContent.qrCode.enabled" class="grid grid-cols-2 gap-4">
              <UFormGroup label="Lien cible">
                <UInput
                  v-model="cvContent.qrCode.url"
                  type="url"
                  placeholder="https://portfolio.example.com"
                />
              </UFormGroup>
            </div>
          </div>
        </UCard>

        <!-- Summary -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">Résumé professionnel</h2>
          </template>
          <UTextarea
            v-model="cvContent.summary"
            placeholder="Décrivez votre profil en quelques lignes..."
            :rows="4"
          />
        </UCard>

        <!-- Experiences -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">Expériences</h2>
          </template>
          <div class="space-y-6">
            <div
              v-for="(exp, index) in cvContent.experiences"
              :key="index"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 relative"
            >
              <div class="absolute top-2 right-2 flex gap-1">
                <UButton
                  icon="i-heroicons-arrow-up"
                  size="xs"
                  variant="ghost"
                  aria-label="Monter"
                  :disabled="index === 0"
                  @click="moveExperience(index, -1)"
                />
                <UButton
                  icon="i-heroicons-arrow-down"
                  size="xs"
                  variant="ghost"
                  aria-label="Descendre"
                  :disabled="index === cvContent.experiences.length - 1"
                  @click="moveExperience(index, 1)"
                />
                <UButton
                  icon="i-heroicons-x-mark"
                  size="xs"
                  color="red"
                  variant="ghost"
                  aria-label="Supprimer"
                  @click="removeExperience(index)"
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <UFormGroup label="Poste">
                  <UInput v-model="exp.position" />
                </UFormGroup>
                <UFormGroup label="Entreprise">
                  <UInput v-model="exp.company" />
                </UFormGroup>
                <UFormGroup label="Date début">
                  <UInput v-model="exp.startDate" type="month" />
                </UFormGroup>
                <UFormGroup label="Date fin">
                  <UInput v-model="exp.endDate" type="month" :disabled="exp.current" />
                </UFormGroup>
              </div>
              <div class="mt-3">
                <UCheckbox v-model="exp.current" label="Poste actuel" />
              </div>
              <UFormGroup label="Description" class="mt-3">
                <UTextarea v-model="exp.description" :rows="3" />
              </UFormGroup>
              <UFormGroup label="Stack (séparés par des virgules)" class="mt-3">
                <UInput
                  :model-value="(exp.tags || []).join(', ')"
                  @update:model-value="(val: string) => exp.tags = val.split(',').map((s: string) => s.trim()).filter(Boolean)"
                />
              </UFormGroup>
            </div>

            <div class="pt-1">
              <UButton size="xs" icon="i-heroicons-plus" @click="addExperience">
                Ajouter
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Education -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">Formation</h2>
          </template>
          <div class="space-y-6">
            <div
              v-for="(edu, index) in cvContent.education"
              :key="index"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 relative"
            >
              <div class="absolute top-2 right-2 flex gap-1">
                <UButton
                  icon="i-heroicons-arrow-up"
                  size="xs"
                  variant="ghost"
                  aria-label="Monter"
                  :disabled="index === 0"
                  @click="moveEducation(index, -1)"
                />
                <UButton
                  icon="i-heroicons-arrow-down"
                  size="xs"
                  variant="ghost"
                  aria-label="Descendre"
                  :disabled="index === cvContent.education.length - 1"
                  @click="moveEducation(index, 1)"
                />
                <UButton
                  icon="i-heroicons-x-mark"
                  size="xs"
                  color="red"
                  variant="ghost"
                  aria-label="Supprimer"
                  @click="removeEducation(index)"
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <UFormGroup label="Établissement">
                  <UInput v-model="edu.institution" />
                </UFormGroup>
                <UFormGroup label="Diplôme">
                  <UInput v-model="edu.degree" />
                </UFormGroup>
                <UFormGroup label="Domaine">
                  <UInput v-model="edu.field" />
                </UFormGroup>
                <UFormGroup label="Période">
                  <div class="flex gap-2">
                    <UInput v-model="edu.startDate" placeholder="2015" class="flex-1" />
                    <UInput v-model="edu.endDate" placeholder="2020" class="flex-1" />
                  </div>
                </UFormGroup>
              </div>
              <UFormGroup label="Stack (séparés par des virgules)" class="mt-3">
                <UInput
                  :model-value="(edu.tags || []).join(', ')"
                  @update:model-value="(val: string) => edu.tags = val.split(',').map((s: string) => s.trim()).filter(Boolean)"
                />
              </UFormGroup>
            </div>

            <div class="pt-1">
              <UButton size="xs" icon="i-heroicons-plus" @click="addEducation">
                Ajouter
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Skills -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">Compétences</h2>
          </template>
          <div class="space-y-4">
            <div
              v-for="(skill, index) in cvContent.skills"
              :key="index"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 relative"
            >
              <div class="absolute top-2 right-2 flex gap-1">
                <UButton
                  icon="i-heroicons-arrow-up"
                  size="xs"
                  variant="ghost"
                  aria-label="Monter"
                  :disabled="index === 0"
                  @click="moveSkillCategory(index, -1)"
                />
                <UButton
                  icon="i-heroicons-arrow-down"
                  size="xs"
                  variant="ghost"
                  aria-label="Descendre"
                  :disabled="index === cvContent.skills.length - 1"
                  @click="moveSkillCategory(index, 1)"
                />
                <UButton
                  icon="i-heroicons-x-mark"
                  size="xs"
                  color="red"
                  variant="ghost"
                  aria-label="Supprimer"
                  @click="removeSkillCategory(index)"
                />
              </div>
              <UFormGroup label="Catégorie">
                <UInput v-model="skill.category" class="mb-2" />
              </UFormGroup>
              <UFormGroup label="Compétences (séparées par des virgules)">
                <UInput
                  :model-value="skill.items.join(', ')"
                  @update:model-value="(val: string) => skill.items = val.split(',').map((s: string) => s.trim()).filter(Boolean)"
                />
              </UFormGroup>
            </div>

            <div class="pt-1">
              <UButton size="xs" icon="i-heroicons-plus" @click="addSkillCategory">
                Ajouter catégorie
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Languages -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">Langues</h2>
          </template>
          <div class="space-y-3">
            <div
              v-for="(lang, index) in cvContent.languages"
              :key="index"
              class="flex gap-3 items-end"
            >
              <UFormGroup label="Langue" class="flex-1">
                <UInput v-model="lang.name" />
              </UFormGroup>
              <UFormGroup label="Niveau" class="flex-1">
                <USelect
                  v-model="lang.level"
                  :options="['Débutant', 'Intermédiaire', 'Avancé', 'Courant', 'Bilingue', 'Natif']"
                />
              </UFormGroup>
              <UButton
                icon="i-heroicons-x-mark"
                size="xs"
                color="red"
                variant="ghost"
                @click="removeLanguage(index)"
              />
            </div>

            <div class="pt-1">
              <UButton size="xs" icon="i-heroicons-plus" @click="addLanguage">
                Ajouter
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Preview Panel -->
      <div class="lg:sticky lg:top-4 lg:self-start">
        <UCard class="overflow-hidden">
          <template #header>
            <h2 class="font-semibold">Prévisualisation</h2>
          </template>
          <CvPreview :content="cvContent" />
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CvContent } from '~/stores/cv';
import { moveItem } from '~/utils/reorder';

const route = useRoute();
const cvStore = useCvStore();

const isEditing = computed(() => !!route.query.id);
const saving = ref(false);

const cvTitle = ref('Mon CV');

const cvContent = reactive<CvContent>({
  language: 'fr',
  qrCode: {
    enabled: false,
    url: '',
  },
  personalInfo: {
    firstName: '',
    lastName: '',
    jobTitle: '',
    email: '',
    phone: '',
    address: '',
    linkedin: '',
    website: '',
  },
  summary: '',
  experiences: [],
  education: [],
  skills: [],
  languages: [],
  certifications: [],
});

const languageOptions = [
  { label: 'Français', value: 'fr' },
  { label: 'English', value: 'en' },
];

onMounted(async () => {
  if (route.query.id) {
    await cvStore.fetchCv(route.query.id as string);
    if (cvStore.currentCv) {
      cvTitle.value = cvStore.currentCv.title;
      Object.assign(cvContent, cvStore.currentCv.contentJson);
    }
  }
});

const addExperience = () => {
  cvContent.experiences.push({
    company: '',
    position: '',
    startDate: '',
    endDate: '',
    current: false,
    description: '',
    achievements: [],
    tags: [],
  });
};

const moveExperience = (index: number, delta: number) => {
  moveItem(cvContent.experiences, index, index + delta);
};

const moveEducation = (index: number, delta: number) => {
  moveItem(cvContent.education, index, index + delta);
};

const moveSkillCategory = (index: number, delta: number) => {
  moveItem(cvContent.skills, index, index + delta);
};

const removeExperience = (index: number) => {
  cvContent.experiences.splice(index, 1);
};

const addEducation = () => {
  cvContent.education.push({
    institution: '',
    degree: '',
    field: '',
    startDate: '',
    endDate: '',
    tags: [],
  });
};

const removeEducation = (index: number) => {
  cvContent.education.splice(index, 1);
};

const addSkillCategory = () => {
  cvContent.skills.push({ category: '', items: [] });
};

const removeSkillCategory = (index: number) => {
  cvContent.skills.splice(index, 1);
};

const addLanguage = () => {
  if (!cvContent.languages) cvContent.languages = [];
  cvContent.languages.push({ name: '', level: '' });
};

const removeLanguage = (index: number) => {
  cvContent.languages?.splice(index, 1);
};

const saveCv = async () => {
  saving.value = true;
  try {
    if (isEditing.value && route.query.id) {
      await cvStore.updateCv(route.query.id as string, {
        title: cvTitle.value,
        contentJson: cvContent,
      });
    } else {
      const cv = await cvStore.createCv(cvTitle.value, cvContent);
      navigateTo(`/cv-editor?id=${cv.id}`);
    }
  } catch {
    // error handled by store
  } finally {
    saving.value = false;
  }
};

const exportPdf = () => {
  if (route.query.id) {
    cvStore.exportPdf(route.query.id as string, cvTitle.value);
  }
};
</script>
