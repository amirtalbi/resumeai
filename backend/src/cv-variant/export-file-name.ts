const slug = (value: string, max = 40): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');

/**
 * Prenom_Nom_CV_Entreprise_Poste.pdf (ou ..._CV_NomVariante.pdf sans offre).
 */
export function buildExportFileName(
  person: { firstName?: string; lastName?: string },
  target: { company?: string | null; title?: string | null },
  variantName: string,
): string {
  const targetParts = [target.company, target.title]
    .filter((part): part is string => !!part && !!part.trim())
    .map((part) => slug(part));

  const parts = [
    slug(person.firstName ?? ''),
    slug(person.lastName ?? ''),
    'CV',
    ...(targetParts.length ? targetParts : [slug(variantName)]),
  ].filter(Boolean);

  return `${parts.join('_')}.pdf`;
}
