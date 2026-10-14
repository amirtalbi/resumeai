import { CvContent } from '../cv/entities/cv.entity';
import { emptyRules, VariantRules } from './cv-variant.types';

export interface OfferSignals {
  title?: string;
  description?: string;
  requiredSkills?: string[];
  keywords?: string[];
}

const norm = (value: string) => value.trim().toLowerCase();
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Tous les tags/compétences connus du CV master, dédoublonnés (casse d'origine). */
export function collectKnownTags(master: CvContent): string[] {
  const known = new Map<string, string>();
  const add = (value?: string) => {
    if (value && value.trim() && !known.has(norm(value))) {
      known.set(norm(value), value.trim());
    }
  };

  (master.skills ?? []).forEach((category) => (category.items ?? []).forEach(add));
  (master.experiences ?? []).forEach((exp) => (exp.tags ?? []).forEach(add));
  (master.education ?? []).forEach((edu) => (edu.tags ?? []).forEach(add));

  return Array.from(known.values());
}

/**
 * Pré-sélection déterministe : les tags du CV qui apparaissent dans l'offre
 * (compétences requises, mots-clés, titre ou description) sont mis en avant.
 * Rien n'est supprimé automatiquement.
 */
export function suggestRules(master: CvContent, offer: OfferSignals): VariantRules {
  const signals = new Set(
    [...(offer.requiredSkills ?? []), ...(offer.keywords ?? [])].map(norm),
  );
  const text = norm(`${offer.title ?? ''}\n${offer.description ?? ''}`);

  const matched = collectKnownTags(master).filter((tag) => {
    const key = norm(tag);
    if (signals.has(key)) return true;
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(key)}(?![\\p{L}\\p{N}])`,
      'u',
    );
    return pattern.test(text);
  });

  return { ...emptyRules(), includeTags: matched };
}
