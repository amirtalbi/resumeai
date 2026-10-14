<template>
  <div>
    <!-- Liste des variantes -->
    <div v-if="!variantId">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Variantes de CV</h1>
      </div>

      <UCard class="mb-6">
        <template #header>
          <h2 class="font-semibold">Nouvelle variante</h2>
        </template>
        <div class="flex gap-3 items-end">
          <UFormGroup label="CV master" class="flex-1">
            <USelect v-model="newCvId" :options="cvOptions" placeholder="Choisir un CV..." />
          </UFormGroup>
          <UFormGroup label="Offre (optionnel)" class="flex-1">
            <USelect
              v-model="newJobOfferId"
              :options="jobOptions"
              placeholder="Aucune offre"
            />
          </UFormGroup>
          <UButton :disabled="!newCvId" :loading="creating" @click="createVariant">
            Créer
          </UButton>
        </div>
      </UCard>

      <UAlert v-if="error" color="red" variant="soft" :title="error" class="mb-4" />

      <div class="space-y-3">
        <UCard v-for="v in variantStore.variants" :key="v.id">
          <div class="flex justify-between items-center">
            <div>
              <p class="font-semibold">{{ v.name }}</p>
              <p class="text-xs text-gray-500">
                {{ cvTitle(v.cvId) }}
                <span v-if="v.jobOfferId"> · liée à une offre</span>
              </p>
            </div>
            <div class="flex gap-2">
              <UButton size="xs" variant="outline" @click="openVariant(v.id)">Ouvrir</UButton>
              <UButton size="xs" variant="outline" @click="duplicate(v.id)">Dupliquer</UButton>
              <UButton size="xs" color="red" variant="ghost" @click="remove(v.id)">
                Supprimer
              </UButton>
            </div>
          </div>
        </UCard>
        <p v-if="!variantStore.variants.length && !variantStore.loading" class="text-gray-500">
          Aucune variante. Crée-en une depuis un CV ou depuis une offre du Job Matcher.
        </p>
      </div>
    </div>

    <!-- Édition d'une variante -->
    <div v-else-if="detail && resolved">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Variante</h1>
        <div class="flex gap-3">
          <UButton variant="outline" @click="backToList">Liste</UButton>
          <UButton icon="i-heroicons-check" variant="outline" :loading="saving" @click="save">
            Sauvegarder
          </UButton>
          <UButton icon="i-heroicons-arrow-down-tray" :loading="exporting" @click="exportPdf">
            Télécharger PDF
          </UButton>
        </div>
      </div>

      <UAlert v-if="error" color="red" variant="soft" :title="error" class="mb-4" />

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-6">
          <UCard>
            <template #header><h2 class="font-semibold">Nom</h2></template>
            <UInput v-model="name" />
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-semibold">Mots-clés</h2>
              <p class="text-xs text-gray-500 mt-1">
                Clic : neutre → mis en avant → masqué. Les compétences et les tags des
                expériences suivent la même règle.
              </p>
            </template>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tag in knownTags"
                :key="tag"
                type="button"
                class="px-2 py-1 rounded-md text-xs border"
                :class="tagClass(tag)"
                @click="cycleTag(tag)"
              >
                <span v-if="tagState(tag) === 'include'">★ </span>
                <span :class="{ 'line-through': tagState(tag) === 'exclude' }">{{ tag }}</span>
              </button>
            </div>
          </UCard>

          <UCard v-if="detail.master.experiences.length">
            <template #header><h2 class="font-semibold">Expériences</h2></template>
            <div class="space-y-2">
              <UCheckbox
                v-for="exp in detail.master.experiences"
                :key="exp.id"
                :model-value="isVisible(exp.id)"
                :label="`${exp.position} — ${exp.company}`"
                @update:model-value="(val: boolean) => setVisible(exp.id, val)"
              />
            </div>
          </UCard>

          <UCard v-if="detail.master.education.length">
            <template #header><h2 class="font-semibold">Formations</h2></template>
            <div class="space-y-2">
              <UCheckbox
                v-for="edu in detail.master.education"
                :key="edu.id"
                :model-value="isVisible(edu.id)"
                :label="`${edu.degree} — ${edu.institution}`"
                @update:model-value="(val: boolean) => setVisible(edu.id, val)"
              />
            </div>
          </UCard>

          <UCard>
            <template #header><h2 class="font-semibold">Textes spécifiques</h2></template>
            <div class="space-y-3">
              <UFormGroup label="Intitulé du poste">
                <UInput
                  v-model="rules.overrides.jobTitle"
                  :placeholder="detail.master.personalInfo.jobTitle || ''"
                />
              </UFormGroup>
              <UFormGroup label="Résumé">
                <UTextarea
                  v-model="rules.overrides.summary"
                  :rows="4"
                  :placeholder="detail.master.summary || ''"
                />
              </UFormGroup>
            </div>
          </UCard>
        </div>

        <div class="lg:sticky lg:top-4 lg:self-start">
          <UCard class="overflow-hidden">
            <template #header><h2 class="font-semibold">Prévisualisation</h2></template>
            <CvPreview :content="resolved" />
          </UCard>
        </div>
      </div>
    </div>

    <p v-else class="text-gray-500">Chargement...</p>
  </div>
</template>

<script setup lang="ts">
import type { Ref } from 'vue';
import type { CvContent } from '~/stores/cv';
import { emptyRules } from '~/stores/cvVariant';
import type { VariantDetail, VariantRules } from '~/stores/cvVariant';

const route = useRoute();
const router = useRouter();
const cvStore = useCvStore();
const jobOfferStore = useJobOfferStore();
const variantStore = useCvVariantStore();

const variantId = computed(() => (route.query.id as string | undefined) || '');

const newCvId = ref('');
const newJobOfferId = ref('');
const creating = ref(false);
const saving = ref(false);
const exporting = ref(false);
const error = ref<string | null>(null);

const detail = ref<VariantDetail | null>(null);
const name = ref('');
const rules = reactive<VariantRules>(emptyRules());
const resolved = ref<CvContent | null>(null) as Ref<CvContent>;

const cvOptions = computed(() =>
  cvStore.cvs.map((cv) => ({ label: cv.title, value: cv.id })),
);
const jobOptions = computed(() => [
  { label: 'Aucune offre', value: '' },
  ...jobOfferStore.jobOffers.map((job) => ({
    label: [job.company, job.title].filter(Boolean).join(' - '),
    value: job.id,
  })),
]);
const cvTitle = (cvId: string) => cvStore.cvs.find((cv) => cv.id === cvId)?.title ?? 'CV';

const norm = (value: string) => value.trim().toLowerCase();

const knownTags = computed(() => {
  const master = detail.value?.master;
  if (!master) return [];
  const known = new Map<string, string>();
  const add = (value?: string) => {
    if (value && value.trim() && !known.has(norm(value))) known.set(norm(value), value.trim());
  };
  master.skills.forEach((category) => category.items.forEach(add));
  master.experiences.forEach((exp) => (exp.tags ?? []).forEach(add));
  master.education.forEach((edu) => (edu.tags ?? []).forEach(add));
  return Array.from(known.values());
});

type TagState = 'neutral' | 'include' | 'exclude';

const tagState = (tag: string): TagState => {
  const key = norm(tag);
  if (rules.excludeTags.some((t) => norm(t) === key)) return 'exclude';
  if (rules.includeTags.some((t) => norm(t) === key)) return 'include';
  return 'neutral';
};

const tagClass = (tag: string) => {
  const state = tagState(tag);
  if (state === 'include') return 'bg-primary-50 border-primary-500 text-primary-700';
  if (state === 'exclude') return 'bg-gray-100 border-gray-300 text-gray-400';
  return 'border-gray-300 text-gray-700 dark:text-gray-300';
};

const cycleTag = (tag: string) => {
  const key = norm(tag);
  const without = (list: string[]) => list.filter((t) => norm(t) !== key);
  const state = tagState(tag);
  rules.includeTags = without(rules.includeTags);
  rules.excludeTags = without(rules.excludeTags);
  if (state === 'neutral') rules.includeTags.push(tag);
  else if (state === 'include') rules.excludeTags.push(tag);
};

const isVisible = (id?: string) => !!id && !rules.hiddenItemIds.includes(id);
const setVisible = (id: string | undefined, visible: boolean) => {
  if (!id) return;
  rules.hiddenItemIds = rules.hiddenItemIds.filter((h) => h !== id);
  if (!visible) rules.hiddenItemIds.push(id);
};

const applyRules = (value: VariantRules) => {
  rules.includeTags = [...value.includeTags];
  rules.excludeTags = [...value.excludeTags];
  rules.hiddenItemIds = [...value.hiddenItemIds];
  rules.skillOrder = [...value.skillOrder];
  rules.overrides = { ...value.overrides };
};

const loadDetail = async (id: string) => {
  error.value = null;
  try {
    detail.value = await variantStore.fetchDetail(id);
    name.value = detail.value.variant.name;
    applyRules(detail.value.variant.rules);
    resolved.value = detail.value.resolved;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Variante introuvable';
  }
};

let previewTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  rules,
  () => {
    if (!detail.value) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      try {
        resolved.value = await variantStore.preview(
          detail.value!.variant.cvId,
          JSON.parse(JSON.stringify(rules)),
        );
      } catch {
        // l'aperçu garde la dernière valeur valide
      }
    }, 300);
  },
  { deep: true },
);

const persist = async () => {
  if (!detail.value) return;
  await variantStore.updateVariant(detail.value.variant.id, {
    name: name.value,
    rules: JSON.parse(JSON.stringify(rules)),
  });
};

const save = async () => {
  saving.value = true;
  error.value = null;
  try {
    await persist();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Échec de la sauvegarde';
  } finally {
    saving.value = false;
  }
};

const exportPdf = async () => {
  if (!detail.value) return;
  exporting.value = true;
  error.value = null;
  try {
    await persist();
    await variantStore.exportPdf(detail.value.variant.id);
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : "Échec de l'export";
  } finally {
    exporting.value = false;
  }
};

const openVariant = (id: string) => router.push({ path: '/variant', query: { id } });
const backToList = () => {
  detail.value = null;
  router.push({ path: '/variant' });
};

const createVariant = async () => {
  creating.value = true;
  error.value = null;
  try {
    const variant = await variantStore.createVariant({
      cvId: newCvId.value,
      jobOfferId: newJobOfferId.value || undefined,
    });
    openVariant(variant.id);
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Création impossible';
  } finally {
    creating.value = false;
  }
};

const duplicate = async (id: string) => {
  try {
    const variant = await variantStore.duplicateVariant(id);
    openVariant(variant.id);
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Duplication impossible';
  }
};

const remove = async (id: string) => {
  try {
    await variantStore.deleteVariant(id);
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Suppression impossible';
  }
};

watch(
  variantId,
  async (id) => {
    detail.value = null;
    if (id) await loadDetail(id);
  },
  { immediate: false },
);

onMounted(async () => {
  await Promise.all([
    cvStore.fetchCvs(),
    jobOfferStore.fetchJobOffers(),
    variantStore.fetchVariants(),
  ]);

  const cvId = route.query.cvId as string | undefined;
  const jobOfferId = route.query.jobOfferId as string | undefined;

  if (!variantId.value && cvId) {
    // Arrivée depuis le Job Matcher : crée la variante pré-sélectionnée et l'ouvre.
    try {
      const variant = await variantStore.createVariant({ cvId, jobOfferId });
      await router.replace({ path: '/variant', query: { id: variant.id } });
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Création impossible';
    }
    return;
  }

  if (variantId.value) await loadDetail(variantId.value);
});
</script>
