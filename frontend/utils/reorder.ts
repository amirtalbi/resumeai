/**
 * Déplace l'élément `from` vers la position `to`, en place.
 * Retourne false si l'un des indices est hors limites ou identique.
 */
export function moveItem<T>(list: T[], from: number, to: number): boolean {
  if (from === to) return false;
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return false;

  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return true;
}

/**
 * Trie `items` selon la liste d'ids `order`. Les éléments absents de la liste
 * passent après, dans leur ordre d'origine (même règle que le backend).
 */
export function applyOrder<T extends { id?: string }>(items: T[], order: string[]): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));

  return items
    .map((item, index) => ({
      item,
      index,
      rank: item.id && rank.has(item.id) ? rank.get(item.id)! : Infinity,
    }))
    .sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank - b.rank))
    .map(({ item }) => item);
}
