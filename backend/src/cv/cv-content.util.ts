import { randomUUID } from 'crypto';
import { CvContent } from './entities/cv.entity';

/**
 * Assigne un id stable aux expériences et formations qui n'en ont pas.
 * Mute le contenu en place. Retourne true si au moins un id a été ajouté.
 */
export function ensureItemIds(content: CvContent): boolean {
  let changed = false;

  for (const item of [...(content.experiences ?? []), ...(content.education ?? [])]) {
    if (!item.id) {
      item.id = randomUUID();
      changed = true;
    }
  }

  return changed;
}
