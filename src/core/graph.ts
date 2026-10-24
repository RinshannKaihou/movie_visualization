import type { Edge, Movie } from './types.ts';
import { CONNECTION_BIT } from './connections.ts';

/**
 * Similarity graph: every pair of movies that shares a director, an actor,
 * or story keywords gets a score; each movie then keeps its strongest few
 * neighbors. Candidate pairs come from inverted indexes, so the cost is
 * proportional to shared attributes rather than n².
 *
 *   score = w.director · [shares a director]
 *         + w.cast     · (1 − e^(−Σ billing weight of shared actors))
 *         + w.theme    · cosine(IDF-weighted keyword vectors)
 *         + w.genre    · Jaccard(genre sets)
 *
 * Genre alone never creates a candidate (Drama alone has ~1300 members);
 * it only sharpens scores, plus a fallback so no movie ends up isolated.
 */

export interface GraphParams {
  /** Strongest neighbors each movie proposes. */
  neighbors: number;
  /** Degree cap. A movie's own best edge is always kept regardless. */
  maxDegree: number;
  /** Pairs scoring below this are never connected. */
  minScore: number;
  /** Keywords on more than this fraction of movies are too common to matter. */
  keywordMaxDf: number;
  weights: { director: number; cast: number; theme: number; genre: number };
}

export const DEFAULT_GRAPH_PARAMS: GraphParams = {
  neighbors: 5,
  maxDegree: 12,
  minScore: 0.3,
  keywordMaxDf: 0.08,
  weights: { director: 1.0, cast: 0.9, theme: 1.8, genre: 0.35 },
};

/**
 * TMDB mixes mood tags ("excited", "admiring") and trivia ("duringcreditsstinger")
 * into keywords. They describe tone or production, not story, and would tie
 * together films that have nothing else in common.
 */
export const STOP_KEYWORDS: ReadonlySet<string> = new Set([
  'duringcreditsstinger', 'aftercreditsstinger', 'woman director', 'black and white',
  'remake', 'sequel', 'biography', 'casual', 'short film',
  'excited', 'dramatic', 'amused', 'aggressive', 'admiring', 'suspenseful', 'cheerful',
  'inspirational', 'thoughtful', 'melancholy', 'romantic', 'angry', 'hopeful', 'playful',
  'shocking', 'anxious', 'audacious', 'hilarious', 'reflective', 'depressing', 'nostalgic',
  'comforting', 'philosophical', 'loving', 'sentimental', 'mysterious', 'adoring', 'curious',
  'vibrant', 'lighthearted', 'whimsical', 'introspective', 'appreciative', 'cautionary',
  'disturbed', 'cynical', 'compassionate', 'wistful', 'biting', 'empathetic', 'dreary',
  'tragic', 'assertive', 'defiant', 'complicated', 'ambiguous', 'enchant', 'questioning',
  'melodramatic', 'antagonistic', 'joyful', 'joyous', 'intimate', 'frantic', 'factual',
  'horrified', 'desperate', 'relaxed', 'callous', 'exhilarated', 'critical', 'ambivalent',
  'sympathetic', 'zealous', 'meditative', 'understated', 'mischievous', 'powerful',
  'provocative', 'irreverent', 'commanding', 'taunting', 'celebratory', 'intense', 'complex',
  'sad', 'tense', 'awestruck', 'bewildered', 'bold', 'candid', 'earnest', 'familiar',
  'frightened', 'humorous', 'informative', 'inquisitive', 'serious', 'witty', 'sarcastic',
  'regretful', 'approving', 'disgusted', 'harsh', 'absurd', 'arrogant', 'dignified',
  'distressing', 'embarrassed', 'enthusiastic', 'grim', 'hateful', 'malicious', 'pessimistic',
  'pretentious', 'sincere', 'skeptical', 'urgent', 'vindictive',
]);

const THEME_MIN_COSINE = 0.1;   // weaker keyword overlap is coincidence, not a theme
const GENRE_MIN_JACCARD = 0.5;  // "same genre mix" means sharing most genres
const FALLBACK_NEIGHBORS = 2;
// TMDB location tags read "city, country". A shared setting is a weaker
// signal than a shared story, so it counts half.
const LOCATION_KEYWORD_WEIGHT = 0.5;

export const normalizeKeyword = (k: string): string => k.trim().toLowerCase();

/** Leads count fully, supporting roles less, bit parts least. */
const billingWeight = (position: number): number => (position < 3 ? 1 : position < 6 ? 0.6 : 0.3);

const popcount = (x: number): number => {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

const jaccard = (a: number, b: number): number => {
  const union = popcount(a | b);
  return union === 0 ? 0 : popcount(a & b) / union;
};

interface Scored {
  a: number;      // smaller node index
  b: number;      // larger node index
  score: number;
  mask: number;
}

const byScore = (l: Scored, r: Scored) => r.score - l.score || l.a - r.a || l.b - r.b;

const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

export const buildGraph = (movies: readonly Movie[], params: GraphParams = DEFAULT_GRAPH_PARAMS): Edge[] => {
  const n = movies.length;
  const { weights } = params;

  // --- inverted indexes -------------------------------------------------
  const directorPosts = new Map<string, number[]>();
  const castPosts = new Map<string, [movie: number, billing: number][]>();
  const keywordDf = new Map<string, number>();
  const genreBit = new Map<string, number>();
  const genreMasks = new Int32Array(n);

  movies.forEach((m, i) => {
    for (const d of new Set(m.directors)) push(directorPosts, d, i);
    const seen = new Set<string>();
    m.cast.forEach((actor, billing) => {
      if (seen.has(actor)) return;
      seen.add(actor);
      push(castPosts, actor, [i, billing]);
    });
    for (const k of new Set(m.keywords.map(normalizeKeyword))) {
      keywordDf.set(k, (keywordDf.get(k) ?? 0) + 1);
    }
    for (const g of m.genres) {
      if (!genreBit.has(g)) genreBit.set(g, genreBit.size);
      genreMasks[i] |= 1 << genreBit.get(g)!;
    }
  });

  // Unit-length IDF vectors, so a dot product is a cosine similarity.
  const maxDf = Math.max(2, Math.floor(n * params.keywordMaxDf));
  const keywordPosts = new Map<string, [movie: number, weight: number][]>();
  const keywordVectors: [keyword: string, weight: number][][] = movies.map((m, i) => {
    const terms = [...new Set(m.keywords.map(normalizeKeyword))].filter(k => {
      const df = keywordDf.get(k)!;
      return df >= 2 && df <= maxDf && !STOP_KEYWORDS.has(k);
    });
    const raw = terms.map(k => {
      const idf = Math.log(n / keywordDf.get(k)!);
      return [k, k.includes(',') ? idf * LOCATION_KEYWORD_WEIGHT : idf] as [string, number];
    });
    const norm = Math.hypot(...raw.map(([, w]) => w)) || 1;
    const vector = raw.map(([k, w]) => [k, w / norm] as [string, number]);
    for (const [k, w] of vector) push(keywordPosts, k, [i, w]);
    return vector;
  });

  // --- score candidates, keep each movie's top proposals ------------------
  const proposals = new Map<number, Scored>();
  const bestOf: (Scored | null)[] = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    const movie = movies[i];
    const director = new Map<number, number>();
    const cast = new Map<number, number>();
    const theme = new Map<number, number>();

    for (const d of new Set(movie.directors)) {
      for (const j of directorPosts.get(d)!) if (j !== i) director.set(j, 1);
    }
    const seen = new Set<string>();
    movie.cast.forEach((actor, billing) => {
      if (seen.has(actor)) return;
      seen.add(actor);
      for (const [j, other] of castPosts.get(actor)!) {
        if (j === i) continue;
        cast.set(j, (cast.get(j) ?? 0) + Math.min(billingWeight(billing), billingWeight(other)));
      }
    });
    for (const [k, w] of keywordVectors[i]) {
      for (const [j, wj] of keywordPosts.get(k)!) {
        if (j !== i) theme.set(j, (theme.get(j) ?? 0) + w * wj);
      }
    }

    const candidates = new Set<number>([...director.keys(), ...cast.keys(), ...theme.keys()]);
    const scored: Scored[] = [];
    for (const j of candidates) {
      const sharesDirector = director.has(j);
      const castSum = cast.get(j) ?? 0;
      const cosine = theme.get(j) ?? 0;
      const genre = jaccard(genreMasks[i], genreMasks[j]);
      const score =
        (sharesDirector ? weights.director : 0) +
        weights.cast * (1 - Math.exp(-castSum)) +
        weights.theme * cosine +
        weights.genre * genre;
      if (score < params.minScore) continue;

      let mask = 0;
      if (sharesDirector) mask |= CONNECTION_BIT.director;
      if (castSum > 0) mask |= CONNECTION_BIT.cast;
      if (cosine >= THEME_MIN_COSINE) mask |= CONNECTION_BIT.theme;
      if (genre >= GENRE_MIN_JACCARD) mask |= CONNECTION_BIT.genre;
      if (mask === 0) continue; // no reason we could show the user

      scored.push({ a: Math.min(i, j), b: Math.max(i, j), score, mask });
    }

    scored.sort(byScore);
    bestOf[i] = scored[0] ?? null;
    for (const s of scored.slice(0, params.neighbors)) proposals.set(s.a * n + s.b, s);
  }

  // --- fallback: genre-only links for movies with nothing in common --------
  for (let i = 0; i < n; i++) {
    if (bestOf[i]) continue;
    const ranked: { j: number; genre: number; gap: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const genre = jaccard(genreMasks[i], genreMasks[j]);
      if (genre > 0) ranked.push({ j, genre, gap: Math.abs(movies[i].year - movies[j].year) });
    }
    ranked.sort((l, r) => r.genre - l.genre || l.gap - r.gap || l.j - r.j);
    for (const { j, genre } of ranked.slice(0, FALLBACK_NEIGHBORS)) {
      const s: Scored = { a: Math.min(i, j), b: Math.max(i, j), score: weights.genre * genre, mask: CONNECTION_BIT.genre };
      proposals.set(s.a * n + s.b, s);
      bestOf[i] ??= s;
    }
  }

  // --- degree-capped selection ------------------------------------------
  const degree = new Int32Array(n);
  const chosen = new Map<number, Scored>();
  const take = (s: Scored) => {
    const key = s.a * n + s.b;
    if (chosen.has(key)) return;
    chosen.set(key, s);
    degree[s.a]++;
    degree[s.b]++;
  };
  // Every movie keeps its single best link, even if the partner is a hub.
  for (const best of bestOf) if (best) take(best);
  for (const s of [...proposals.values()].sort(byScore)) {
    if (degree[s.a] < params.maxDegree && degree[s.b] < params.maxDegree) take(s);
  }

  // Normalize against the 99th percentile so one outlier pair (a sequel that
  // shares everything) does not compress every other weight toward zero.
  // Small graphs have no meaningful percentile; use the max there.
  const scores = [...chosen.values()].map(s => s.score).sort((l, r) => l - r);
  const reference = (scores.length >= 100 ? scores[Math.floor((scores.length - 1) * 0.99)] : scores.at(-1)) || 1;

  return [...chosen.values()]
    .sort((l, r) => l.a - r.a || l.b - r.b)
    .map(s => ({
      source: s.a,
      target: s.b,
      mask: s.mask,
      weight: Math.round(Math.min(1, s.score / reference) * 1000) / 1000,
    }));
};

export interface SharedAttributes {
  directors: string[];
  cast: string[];
  keywords: string[];
  genres: string[];
}

type Credits = Pick<Movie, 'directors' | 'cast' | 'keywords' | 'genres'>;

/** What two movies have in common — the human-readable "why" of an edge. */
export const sharedAttributes = (a: Credits, b: Credits): SharedAttributes => {
  const otherKeywords = new Set(b.keywords.map(normalizeKeyword));
  return {
    directors: a.directors.filter(d => b.directors.includes(d)),
    cast: a.cast.filter(c => b.cast.includes(c)),
    keywords: a.keywords.filter(k => {
      const norm = normalizeKeyword(k);
      return otherKeywords.has(norm) && !STOP_KEYWORDS.has(norm);
    }),
    genres: a.genres.filter(g => b.genres.includes(g)),
  };
};
