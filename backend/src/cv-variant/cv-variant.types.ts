export interface VariantOverrides {
  jobTitle?: string;
  summary?: string;
  language?: string;
}

/**
 * Règles de sélection appliquées au CV master pour produire une variante.
 *
 * - includeTags : tags mis en avant (passent en premier dans les compétences
 *   et dans la ligne "Stack" des expériences/formations).
 * - excludeTags : tags / compétences retirés (comparaison insensible à la casse).
 * - hiddenItemIds : expériences ou formations masquées en entier (par id).
 * - skillOrder : compétences à placer tout en haut, dans cet ordre.
 * - overrides : titre, résumé, langue spécifiques à la variante.
 *
 * Une compétence est identifiée par son nom : "NestJS" dans skills[].items
 * correspond au tag "nestjs".
 */
export interface VariantRules {
  includeTags: string[];
  excludeTags: string[];
  hiddenItemIds: string[];
  skillOrder: string[];
  overrides: VariantOverrides;
}

export const emptyRules = (): VariantRules => ({
  includeTags: [],
  excludeTags: [],
  hiddenItemIds: [],
  skillOrder: [],
  overrides: {},
});

export function normalizeRules(input?: Partial<VariantRules> | null): VariantRules {
  const list = (value?: string[]) =>
    Array.from(
      new Set((value ?? []).map((v) => String(v).trim()).filter(Boolean)),
    );

  return {
    includeTags: list(input?.includeTags),
    excludeTags: list(input?.excludeTags),
    hiddenItemIds: list(input?.hiddenItemIds),
    skillOrder: list(input?.skillOrder),
    overrides: { ...(input?.overrides ?? {}) },
  };
}
