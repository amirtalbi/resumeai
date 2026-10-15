import { describe, it, expect } from 'vitest';
import { moveItem, applyOrder } from '~/utils/reorder';

describe('moveItem', () => {
  it('descend un élément', () => {
    const list = ['a', 'b', 'c'];
    expect(moveItem(list, 0, 1)).toBe(true);
    expect(list).toEqual(['b', 'a', 'c']);
  });

  it('monte un élément', () => {
    const list = ['a', 'b', 'c'];
    moveItem(list, 2, 1);
    expect(list).toEqual(['a', 'c', 'b']);
  });

  it('ignore les déplacements hors limites ou nuls', () => {
    const list = ['a', 'b'];
    expect(moveItem(list, 0, -1)).toBe(false);
    expect(moveItem(list, 1, 2)).toBe(false);
    expect(moveItem(list, 1, 1)).toBe(false);
    expect(list).toEqual(['a', 'b']);
  });
});

describe('applyOrder', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, {}];

  it('trie selon la liste, les non listés suivent dans leur ordre', () => {
    expect(applyOrder(items, ['c', 'a']).map((i) => i.id)).toEqual(['c', 'a', 'b', undefined]);
  });

  it('ne modifie pas la liste d\'origine et ignore les ids inconnus', () => {
    const out = applyOrder(items, ['zzz', 'b']);
    expect(out.map((i) => i.id)).toEqual(['b', 'a', 'c', undefined]);
    expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c', undefined]);
  });
});
