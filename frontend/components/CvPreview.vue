<template>
  <div class="cv-preview bg-white text-black p-8 text-sm leading-relaxed">
    <!-- Header -->
    <div class="text-center mb-4">
      <h1 class="text-2xl font-bold">
        {{ content.personalInfo.firstName }} {{ content.personalInfo.lastName }}
      </h1>
      <p class="text-xs text-gray-600 mt-1">
        <template v-for="(item, i) in contactItems" :key="i">
          {{ item }}<span v-if="i < contactItems.length - 1"> | </span>
        </template>
      </p>
    </div>

    <hr class="border-gray-300 mb-3" />

    <!-- Summary -->
    <div v-if="content.summary" class="mb-4">
      <h2 class="text-sm font-bold uppercase tracking-wider mb-1">Profil Professionnel</h2>
      <hr class="border-gray-300 mb-2" />
      <p class="text-xs">{{ content.summary }}</p>
    </div>

    <!-- Experience -->
    <div v-if="content.experiences?.length" class="mb-4">
      <h2 class="text-sm font-bold uppercase tracking-wider mb-1">Expérience Professionnelle</h2>
      <hr class="border-gray-300 mb-2" />
      <div v-for="(exp, i) in content.experiences" :key="i" class="mb-3">
        <div class="flex justify-between">
          <strong class="text-xs">{{ exp.position }}</strong>
          <span class="text-xs text-gray-500">{{ exp.startDate }} - {{ exp.current ? 'Présent' : exp.endDate }}</span>
        </div>
        <p class="text-xs text-gray-600 italic">{{ exp.company }}</p>
        <p class="text-xs mt-1">{{ exp.description }}</p>
        <ul v-if="exp.achievements?.length" class="list-disc list-inside text-xs mt-1">
          <li v-for="(a, j) in exp.achievements" :key="j">{{ a }}</li>
        </ul>
      </div>
    </div>

    <!-- Education -->
    <div v-if="content.education?.length" class="mb-4">
      <h2 class="text-sm font-bold uppercase tracking-wider mb-1">Formation</h2>
      <hr class="border-gray-300 mb-2" />
      <div v-for="(edu, i) in content.education" :key="i" class="mb-2">
        <strong class="text-xs">{{ edu.degree }} - {{ edu.field }}</strong>
        <p class="text-xs text-gray-600">{{ edu.institution }} | {{ edu.startDate }} - {{ edu.endDate }}</p>
      </div>
    </div>

    <!-- Skills -->
    <div v-if="content.skills?.length" class="mb-4">
      <h2 class="text-sm font-bold uppercase tracking-wider mb-1">Compétences</h2>
      <hr class="border-gray-300 mb-2" />
      <div v-for="(skill, i) in content.skills" :key="i" class="text-xs mb-1">
        <strong>{{ skill.category }}: </strong>{{ skill.items.join(', ') }}
      </div>
    </div>

    <!-- Languages -->
    <div v-if="content.languages?.length" class="mb-4">
      <h2 class="text-sm font-bold uppercase tracking-wider mb-1">Langues</h2>
      <hr class="border-gray-300 mb-2" />
      <p class="text-xs">
        <span v-for="(lang, i) in content.languages" :key="i">
          {{ lang.name }} ({{ lang.level }})<span v-if="i < content.languages.length - 1">, </span>
        </span>
      </p>
    </div>

    <!-- Certifications -->
    <div v-if="content.certifications?.length">
      <h2 class="text-sm font-bold uppercase tracking-wider mb-1">Certifications</h2>
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
import { computed } from 'vue';
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
  return items;
});

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
</script>
