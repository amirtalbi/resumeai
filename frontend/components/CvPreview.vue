<template>
  <div class="cv-preview relative bg-white text-black p-8 text-sm leading-relaxed">
    <div v-if="qrCodeDataUrl" class="absolute top-2 right-4 flex flex-col items-center">
      <img :src="qrCodeDataUrl" alt="QR code" class="w-20 h-20" />
      <p v-if="qrCodeLabel" class="text-[0.65rem] text-gray-500 mt-1">
        {{ qrCodeLabel }}
      </p>
    </div>
    <!-- Header -->
    <div class="text-center mb-4">
      <h1 class="text-[1.35rem] font-bold">
        {{ content.personalInfo.firstName }} {{ content.personalInfo.lastName }}
      </h1>
      <p v-if="content.personalInfo.jobTitle" class="text-sm text-gray-700 mt-0.5">
        {{ content.personalInfo.jobTitle }}
      </p>
      <p class="text-xs text-gray-600 mt-1">
        <template v-for="(item, i) in contactItems" :key="i">
          {{ item }}<span v-if="i < contactItems.length - 1"> | </span>
        </template>
      </p>
    </div>

    <hr class="border-gray-300 mb-3" />

    <!-- Summary -->
    <div v-if="content.summary" class="section-gap">
      <h2 class="text-sm font-bold uppercase tracking-wider mb-1">{{ labels.summary }}</h2>
      <hr class="border-gray-300 mb-2" />
      <p class="text-xs">{{ content.summary }}</p>
    </div>

    <!-- Experience -->
    <div v-if="content.experiences?.length" class="section-gap">
      <h2 class="text-sm font-bold uppercase tracking-wider mb-1">{{ labels.experience }}</h2>
      <hr class="border-gray-300 mb-2" />
      <div v-for="(exp, i) in content.experiences" :key="i" class="mb-3">
        <div class="flex justify-between">
          <strong class="text-xs">{{ exp.position }}</strong>
          <span class="text-xs text-gray-500">
            {{ formatDateRange(exp.startDate, exp.endDate, exp.current) }}
          </span>
        </div>
        <p class="text-xs text-gray-600 italic">{{ exp.company }}</p>
        <p class="text-xs mt-1">{{ exp.description }}</p>
        <p v-if="exp.tags?.length" class="text-xs mt-1 text-gray-700">
          <strong>{{ labels.stack }}:</strong> {{ exp.tags.join(', ') }}
        </p>
        <ul v-if="exp.achievements?.length" class="list-disc list-inside text-xs mt-1">
          <li v-for="(a, j) in exp.achievements" :key="j">{{ a }}</li>
        </ul>
      </div>
    </div>

    <!-- Education -->
    <div v-if="content.education?.length" class="section-gap">
      <h2 class="text-sm font-bold uppercase tracking-wider mb-1">{{ labels.education }}</h2>
      <hr class="border-gray-300 mb-2" />
      <div v-for="(edu, i) in content.education" :key="i" class="mb-2">
        <strong class="text-xs">{{ edu.degree }} - {{ edu.field }}</strong>
        <p class="text-xs text-gray-600">
          {{ edu.institution }}
          <span v-if="formatDateRange(edu.startDate, edu.endDate)">
            | {{ formatDateRange(edu.startDate, edu.endDate) }}
          </span>
        </p>
        <p v-if="edu.tags?.length" class="text-xs mt-1 text-gray-700">
          <strong>{{ labels.modules }}:</strong> {{ edu.tags.join(', ') }}
        </p>
      </div>
    </div>

    <!-- Skills -->
    <div v-if="content.skills?.length" class="section-gap">
      <h2 class="text-sm font-bold uppercase tracking-wider mb-1">{{ labels.skills }}</h2>
      <hr class="border-gray-300 mb-2" />
      <div v-for="(skill, i) in content.skills" :key="i" class="text-xs mb-1">
        <strong>{{ skill.category }}: </strong>{{ skill.items.join(', ') }}
      </div>
    </div>

    <!-- Languages -->
    <div v-if="content.languages?.length" class="section-gap">
      <h2 class="text-sm font-bold uppercase tracking-wider mb-1">{{ labels.languages }}</h2>
      <hr class="border-gray-300 mb-2" />
      <p class="text-xs">
        <span v-for="(lang, i) in content.languages" :key="i">
          {{ lang.name }} ({{ lang.level }})<span v-if="i < content.languages.length - 1">, </span>
        </span>
      </p>
    </div>

    <!-- Certifications -->
    <div v-if="content.certifications?.length">
      <h2 class="text-sm font-bold uppercase tracking-wider mb-1">{{ labels.certifications }}</h2>
      <hr class="border-gray-300 mb-2" />
      <ul class="text-xs">
        <li v-for="(cert, i) in content.certifications" :key="i">
          {{ cert.name }} - {{ cert.issuer }} ({{ cert.date }})
        </li>
      </ul>
    </div>

    <!-- Empty State -->
    <div
      v-if="isEmpty"
      class="text-center py-12 text-gray-400"
    >
      <p>Remplissez le formulaire pour voir la prévisualisation</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import QRCode from 'qrcode';
import type { CvContent } from '~/stores/cv';

const props = defineProps<{
  content: CvContent;
}>();

const contactItems = computed(() => {
  const items: string[] = [];
  if (props.content.personalInfo.email) items.push(props.content.personalInfo.email);
  if (props.content.personalInfo.phone) items.push(props.content.personalInfo.phone);
  if (props.content.personalInfo.address) items.push(props.content.personalInfo.address);
  if (props.content.personalInfo.linkedin) items.push(props.content.personalInfo.linkedin);
  if (props.content.personalInfo.website) items.push(props.content.personalInfo.website);
  return items;
});

const translations = {
  fr: {
    summary: 'Profil Professionnel',
    experience: 'Expérience Professionnelle',
    education: 'Formation',
    skills: 'Compétences',
    languages: 'Langues',
    certifications: 'Certifications',
    present: 'Présent',
    stack: 'Stack',
    modules: 'Modules',
  },
  en: {
    summary: 'Professional Summary',
    experience: 'Professional Experience',
    education: 'Education',
    skills: 'Skills',
    languages: 'Languages',
    certifications: 'Certifications',
    present: 'Present',
    stack: 'Stack',
    modules: 'Modules',
  },
} as const;

const language = computed(() => (props.content.language || 'fr').toLowerCase());
const labels = computed(() => translations[language.value as 'fr' | 'en'] || translations.fr);

const isEmpty = computed(() => {
  return (
    !props.content.personalInfo.firstName &&
    !props.content.personalInfo.lastName &&
    !props.content.summary &&
    !props.content.experiences?.length &&
    !props.content.education?.length &&
    !props.content.skills?.length
  );
});

const formatMonthYear = (value?: string) => {
  if (!value) {
    return '';
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month] = isoMatch;
    if (language.value === 'en') {
      const date = new Date(Number(year), Number(month) - 1, 1);
      return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
    }
    return `${month}/${year}`;
  }

  return value;
};

const formatDateRange = (start?: string, end?: string, isCurrent?: boolean) => {
  const startFormatted = formatMonthYear(start);
  const endFormatted = isCurrent ? labels.value.present : formatMonthYear(end);

  if (startFormatted && endFormatted) {
    return `${startFormatted} - ${endFormatted}`;
  }
  return startFormatted || endFormatted || '';
};

const qrCodeDataUrl = ref('');
const qrCodeLabel = computed(() => props.content.qrCode?.label?.trim() || '');

watch(
  () => [props.content.qrCode?.enabled, props.content.qrCode?.url],
  async ([enabled, url]) => {
    if (!enabled || !url || !process.client) {
      qrCodeDataUrl.value = '';
      return;
    }

    try {
      qrCodeDataUrl.value = await QRCode.toDataURL(url, {
        margin: 1,
        width: 128,
      });
    } catch {
      qrCodeDataUrl.value = '';
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.section-gap {
  margin-bottom: 0.95rem;
}
</style>
