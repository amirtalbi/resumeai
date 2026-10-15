import { CvContent } from '../cv/entities/cv.entity';
import { emptyRules, normalizeRules } from './cv-variant.types';
import { resolveVariant } from './resolve-variant';
import { suggestRules, collectKnownTags } from './suggest-rules';
import { buildExportFileName } from './export-file-name';

const master = (): CvContent => ({
  personalInfo: {
    firstName: 'Amir',
    lastName: 'Talbi',
    jobTitle: 'Développeur Full Stack',
    email: 'a@b.fr',
  },
  summary: 'Résumé générique',
  experiences: [
    {
      id: 'exp-1',
      company: 'BenchDATA',
      position: 'Dev',
      startDate: '2022',
      description: 'x',
      tags: ['NestJS', 'TypeScript', 'Symfony', 'PHP'],
    },
    {
      id: 'exp-2',
      company: 'Autre',
      position: 'Dev',
      startDate: '2021',
      description: 'y',
      tags: ['Vue.js'],
    },
  ],
  education: [
    { id: 'edu-1', institution: 'Ecole', degree: 'M', field: 'Info', startDate: '2019' },
  ],
  skills: [
    { category: 'Backend', items: ['NestJS', 'Symfony', 'PHP', 'TypeScript'] },
    { category: 'Outils', items: ['Docker'] },
  ],
});

describe('resolveVariant', () => {
  it('ne modifie pas le master', () => {
    const m = master();
    const copy = JSON.stringify(m);
    resolveVariant(m, { ...emptyRules(), excludeTags: ['nestjs'] });
    expect(JSON.stringify(m)).toBe(copy);
  });

  it('retourne le master tel quel avec des règles vides', () => {
    expect(resolveVariant(master(), emptyRules())).toEqual(master());
  });

  it('retire une compétence et un tag (insensible à la casse)', () => {
    const out = resolveVariant(master(), { ...emptyRules(), excludeTags: ['NESTJS'] });
    expect(out.skills[0].items).toEqual(['Symfony', 'PHP', 'TypeScript']);
    expect(out.experiences[0].tags).toEqual(['TypeScript', 'Symfony', 'PHP']);
  });

  it('met en avant includeTags puis conserve l\'ordre d\'origine', () => {
    const out = resolveVariant(master(), { ...emptyRules(), includeTags: ['php', 'symfony'] });
    expect(out.skills[0].items).toEqual(['PHP', 'Symfony', 'NestJS', 'TypeScript']);
    expect(out.experiences[0].tags).toEqual(['PHP', 'Symfony', 'NestJS', 'TypeScript']);
  });

  it('skillOrder passe avant includeTags', () => {
    const out = resolveVariant(master(), {
      ...emptyRules(),
      includeTags: ['php'],
      skillOrder: ['typescript'],
    });
    expect(out.skills[0].items).toEqual(['TypeScript', 'PHP', 'NestJS', 'Symfony']);
  });

  it('supprime les catégories vides', () => {
    const out = resolveVariant(master(), { ...emptyRules(), excludeTags: ['docker'] });
    expect(out.skills.map((c) => c.category)).toEqual(['Backend']);
  });

  it('masque expériences et formations par id', () => {
    const out = resolveVariant(master(), { ...emptyRules(), hiddenItemIds: ['exp-2', 'edu-1'] });
    expect(out.experiences.map((e) => e.id)).toEqual(['exp-1']);
    expect(out.education).toEqual([]);
  });

  it('réordonne expériences et formations selon itemOrder', () => {
    const out = resolveVariant(master(), { ...emptyRules(), itemOrder: ['exp-2', 'exp-1'] });
    expect(out.experiences.map((e) => e.id)).toEqual(['exp-2', 'exp-1']);
    expect(out.education.map((e) => e.id)).toEqual(['edu-1']);
  });

  it('place après les éléments listés ceux absents de itemOrder, ordre d\'origine conservé', () => {
    const m = master();
    m.experiences.push({
      id: 'exp-3',
      company: 'C',
      position: 'Dev',
      startDate: '2020',
      description: 'z',
    });
    const out = resolveVariant(m, { ...emptyRules(), itemOrder: ['exp-3'] });
    expect(out.experiences.map((e) => e.id)).toEqual(['exp-3', 'exp-1', 'exp-2']);
  });

  it('ignore les ids inconnus et masque avant de trier', () => {
    const out = resolveVariant(master(), {
      ...emptyRules(),
      itemOrder: ['inconnu', 'exp-2', 'exp-1'],
      hiddenItemIds: ['exp-2'],
    });
    expect(out.experiences.map((e) => e.id)).toEqual(['exp-1']);
  });

  it('accepte des règles stockées sans itemOrder', () => {
    const legacy = { ...emptyRules() } as Partial<ReturnType<typeof emptyRules>>;
    delete legacy.itemOrder;
    const out = resolveVariant(master(), legacy as ReturnType<typeof emptyRules>);
    expect(out.experiences.map((e) => e.id)).toEqual(['exp-1', 'exp-2']);
  });

  it('applique les overrides non vides uniquement', () => {
    const out = resolveVariant(master(), {
      ...emptyRules(),
      overrides: { jobTitle: 'Dev Symfony', summary: '  ', language: 'en' },
    });
    expect(out.personalInfo.jobTitle).toBe('Dev Symfony');
    expect(out.summary).toBe('Résumé générique');
    expect(out.language).toBe('en');
  });
});

describe('suggestRules', () => {
  it('met en avant les tags du CV présents dans l\'offre', () => {
    const rules = suggestRules(master(), {
      title: 'Développeur Symfony',
      description: 'Stack: PHP 8, Docker. Pas de Java.',
      requiredSkills: ['symfony'],
      keywords: [],
    });
    expect(rules.includeTags).toEqual(expect.arrayContaining(['Symfony', 'PHP', 'Docker']));
    expect(rules.includeTags).not.toContain('NestJS');
    expect(rules.excludeTags).toEqual([]);
  });

  it('ne matche pas une sous-chaîne de mot', () => {
    const rules = suggestRules(master(), {
      description: 'Nous aimons le phpunit et le typescripting',
    });
    expect(rules.includeTags).toEqual([]);
  });

  it('collectKnownTags dédoublonne', () => {
    const tags = collectKnownTags(master());
    expect(tags.filter((t) => t.toLowerCase() === 'nestjs')).toHaveLength(1);
  });
});

describe('normalizeRules', () => {
  it('nettoie, dédoublonne et complète', () => {
    const rules = normalizeRules({ includeTags: [' a ', 'a', ''] });
    expect(rules).toEqual({ ...emptyRules(), includeTags: ['a'] });
    expect(normalizeRules({ itemOrder: ['x', 'x', ' y '] }).itemOrder).toEqual(['x', 'y']);
  });
});

describe('buildExportFileName', () => {
  it('utilise entreprise et poste de l\'offre', () => {
    expect(
      buildExportFileName(
        { firstName: 'Amir', lastName: 'Talbi' },
        { company: 'Société Générale', title: 'Développeur Symfony (H/F)' },
        'x',
      ),
    ).toBe('Amir_Talbi_CV_Societe-Generale_Developpeur-Symfony-H-F.pdf');
  });

  it('retombe sur le nom de la variante sans offre', () => {
    expect(
      buildExportFileName({ firstName: 'Amir', lastName: 'Talbi' }, {}, 'Backend Symfony'),
    ).toBe('Amir_Talbi_CV_Backend-Symfony.pdf');
  });
});
