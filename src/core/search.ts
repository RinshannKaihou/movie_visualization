import type { MovieNode } from './types.ts';
import { genreLabel } from './genres.ts';

/**
 * In-memory search over titles, people, genres, keywords, and years.
 * Accent- and case-insensitive ("amelie" finds "Amélie"); every word of the
 * query must match somewhere; the best field per word sets the score.
 */

export const normalizeText = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().trim();

const wordsOf = (s: string) => normalizeText(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

interface Entry {
  title: string;
  /** Letters and digits only, so "walle" finds WALL·E and "spiderman" Spider-Man. */
  compact: string;
  titleWords: string[];
  directors: string[][];
  cast: string[][];
  genres: string[][];
  keywords: string[][];
  year: string;
}

// Field weights: what a match in each field is worth for one query word.
const W = {
  titlePrefix: 120,
  titleWord: 90,
  titleInfix: 45,
  director: 70,
  leadCast: 55,
  cast: 40,
  year: 60,
  genre: 25,
  keyword: 22,
};

const anyWordStarts = (words: readonly string[], token: string) => words.some(w => w.startsWith(token));

const scoreToken = (e: Entry, token: string): number => {
  let best = 0;
  if (e.title.startsWith(token) || e.compact.startsWith(token)) best = W.titlePrefix;
  else if (anyWordStarts(e.titleWords, token)) best = W.titleWord;
  else if (token.length >= 3 && e.title.includes(token)) best = W.titleInfix;
  if (best < W.director && e.directors.some(d => anyWordStarts(d, token))) best = W.director;
  if (best < W.leadCast && e.cast.slice(0, 3).some(c => anyWordStarts(c, token))) best = W.leadCast;
  if (best < W.cast && e.cast.some(c => anyWordStarts(c, token))) best = W.cast;
  if (best < W.year && e.year === token) best = W.year;
  if (best < W.genre && e.genres.some(g => anyWordStarts(g, token))) best = W.genre;
  if (best < W.keyword && e.keywords.some(k => anyWordStarts(k, token))) best = W.keyword;
  return best;
};

export interface SearchIndex {
  /** Ranked node indices, or null when the query is too short to mean anything. */
  search(query: string): number[] | null;
}

export const buildSearchIndex = (nodes: readonly MovieNode[]): SearchIndex => {
  const entries: Entry[] = nodes.map(n => ({
    title: normalizeText(n.title),
    compact: normalizeText(n.title).replace(/[^\p{L}\p{N}]+/gu, ''),
    titleWords: wordsOf(n.title),
    directors: n.directors.map(wordsOf),
    cast: n.cast.map(wordsOf),
    genres: [...new Set(n.genres.flatMap(g => [g, genreLabel(g)]))].map(wordsOf),
    keywords: n.keywords.map(wordsOf),
    year: String(n.year),
  }));

  return {
    search(query) {
      const q = normalizeText(query);
      // Split the query exactly like the fields, so "wall-e" and
      // "jean-pierre" match. One Latin letter matches half the catalog, and
      // punctuation alone matches nothing; one CJK character can be a word.
      const tokens = wordsOf(query);
      if (tokens.length === 0 || (q.length < 2 && /^[\p{Script=Latin}\p{N}]$/u.test(q))) return null;

      const scored: { index: number; score: number }[] = [];
      entries.forEach((e, index) => {
        let score = e.title === q ? 1000 : 0;
        for (const token of tokens) {
          const s = scoreToken(e, token);
          if (s === 0) return; // every word must match
          score += s;
        }
        scored.push({ index, score: score + nodes[index].rating * 2 });
      });
      scored.sort((a, b) => b.score - a.score || a.index - b.index);
      return scored.map(s => s.index);
    },
  };
};
