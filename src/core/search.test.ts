import { describe, expect, it } from 'vitest';
import { buildSearchIndex, normalizeText } from './search.ts';
import type { MovieNode } from './types.ts';

const node = (index: number, over: Partial<MovieNode>): MovieNode => ({
  id: index + 1, index, title: '', year: 2000, posterPath: '', rating: 8, genres: [], directors: [],
  cast: [], keywords: [], overview: '', x: 0, y: 0, family: 'drama', radius: 3, degree: 1,
  ...over,
});

const nodes = [
  node(0, { title: 'Seven Samurai', directors: ['Akira Kurosawa'], cast: ['Toshiro Mifune'], keywords: ['samurai'], year: 1954, genres: ['Action', 'Drama'] }),
  node(1, { title: 'Amélie', directors: ['Jean-Pierre Jeunet'], cast: ['Audrey Tautou'], genres: ['Comedy', 'Romance'], year: 2001 }),
  node(2, { title: 'Harakiri', directors: ['Masaki Kobayashi'], cast: ['Tatsuya Nakadai'], keywords: ['samurai', 'feudal japan'], year: 1962 }),
  node(3, { title: 'Interstellar', directors: ['Christopher Nolan'], genres: ['Science Fiction'], keywords: ['space travel'], year: 2014 }),
  node(4, { title: '千と千尋の神隠し', directors: ['Hayao Miyazaki'], year: 2001 }),
  node(5, { title: 'WALL·E', directors: ['Andrew Stanton'], year: 2008 }),
  node(6, { title: 'Spider-Man: Into the Spider-Verse', year: 2018 }),
];
const index = buildSearchIndex(nodes);

describe('search', () => {
  it('ranks title matches above keyword matches', () => {
    expect(index.search('samurai')).toEqual([0, 2]);
  });

  it('ignores accents and case', () => {
    expect(normalizeText('Amélie')).toBe('amelie');
    expect(index.search('AMELIE')).toEqual([1]);
  });

  it('matches people by any name part', () => {
    expect(index.search('kurosawa')).toEqual([0]);
    expect(index.search('mifune')).toEqual([0]);
  });

  it('requires every word to match', () => {
    expect(index.search('samurai feudal')).toEqual([2]);
    expect(index.search('samurai nolan')).toEqual([]);
  });

  it('understands short genre names and years', () => {
    expect(index.search('sci-fi')).toEqual([3]);
    expect(index.search('2001')).toEqual([1, 4]);
  });

  it('returns null for empty, single-letter, or punctuation-only queries but accepts one CJK character', () => {
    expect(index.search('')).toBeNull();
    expect(index.search('a')).toBeNull();
    expect(index.search(' - ')).toBeNull();
    expect(index.search('千')).toEqual([4]);
  });

  it('splits punctuation in the query like in the data', () => {
    expect(index.search('wall-e')).toEqual([5]);
    expect(index.search('jean-pierre jeunet')).toEqual([1]);
  });

  it('matches titles with their punctuation removed', () => {
    expect(index.search('walle')).toEqual([5]);
    expect(index.search('spiderman')).toEqual([6]);
  });
});
