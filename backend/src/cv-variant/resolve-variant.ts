import { CvContent } from '../cv/entities/cv.entity';
import { VariantRules } from './cv-variant.types';

const norm = (value: string) => value.trim().toLowerCase();

/**
 * Applique les règles d'une variante au CV master.
 * Fonction pure : ne modifie pas `master`, retourne un nouveau CvContent
 * consommable tel quel par CvPreview et PdfExportService.
 */
export function resolveVariant(master: CvContent, rules: VariantRules): CvContent {
  const content: CvContent = JSON.parse(JSON.stringify(master));

  const order = rules.skillOrder.map(norm);
  const include = rules.includeTags.map(norm);
  const exclude = new Set(rules.excludeTags.map(norm));
  const hidden = new Set(rules.hiddenItemIds);
  const itemRank = new Map((rules.itemOrder ?? []).map((id, index) => [id, index]));

  // Tri stable : éléments listés dans itemOrder d'abord, les autres gardent leur ordre.
  const sortByItemOrder = <T extends { id?: string }>(items: T[]): T[] =>
    items
      .map((item, index) => ({
        item,
        index,
        rank: item.id && itemRank.has(item.id) ? itemRank.get(item.id)! : Infinity,
      }))
      .sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank - b.rank))
      .map(({ item }) => item);

  const rank = (name: string): number => {
    const key = norm(name);
    const orderIndex = order.indexOf(key);
    if (orderIndex >= 0) return orderIndex;
    const includeIndex = include.indexOf(key);
    if (includeIndex >= 0) return order.length + includeIndex;
    return order.length + include.length;
  };

  const sortByRank = (items: string[]): string[] =>
    items
      .map((item, index) => ({ item, index, rank: rank(item) }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map(({ item }) => item);

  const prepareTags = (tags?: string[]): string[] | undefined =>
    tags ? sortByRank(tags.filter((tag) => !exclude.has(norm(tag)))) : tags;

  content.skills = (content.skills ?? [])
    .map((category) => ({
      ...category,
      items: sortByRank(
        (category.items ?? []).filter((item) => !exclude.has(norm(item))),
      ),
    }))
    .filter((category) => category.items.length > 0);

  content.experiences = sortByItemOrder(
    (content.experiences ?? [])
      .filter((experience) => !experience.id || !hidden.has(experience.id))
      .map((experience) => ({ ...experience, tags: prepareTags(experience.tags) })),
  );

  content.education = sortByItemOrder(
    (content.education ?? [])
      .filter((education) => !education.id || !hidden.has(education.id))
      .map((education) => ({ ...education, tags: prepareTags(education.tags) })),
  );

  const { jobTitle, summary, language } = rules.overrides ?? {};
  if (jobTitle?.trim()) content.personalInfo.jobTitle = jobTitle.trim();
  if (summary?.trim()) content.summary = summary.trim();
  if (language?.trim()) content.language = language.trim();

  return content;
}
