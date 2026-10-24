import type { GenreFamilyId } from './types.ts';

/**
 * Genre families: the single source of truth for star colors, the legend,
 * and the layout's family anchors.
 *
 * TMDB lists genres in no meaningful order (Drama comes first on a third of
 * the catalog), so a movie's family is the most *distinctive* genre it has,
 * picked by GENRE_PRIORITY rather than by genres[0].
 */

export interface GenreFamily {
  id: GenreFamilyId;
  label: string;
  color: string;
}

/**
 * Listed in angular order around the galaxy: neighbors here share borders
 * in the layout, so related families sit side by side.
 */
export const GENRE_FAMILIES: readonly GenreFamily[] = [
  { id: 'drama',     label: 'Drama & History',    color: '#f2c67a' },
  { id: 'romance',   label: 'Romance & Comedy',   color: '#ff9cbd' },
  { id: 'animation', label: 'Animation & Family', color: '#6fe0b2' },
  { id: 'scifi',     label: 'Sci-Fi & Fantasy',   color: '#62c6ff' },
  { id: 'action',    label: 'Action & Adventure', color: '#ff8a62' },
  { id: 'horror',    label: 'Horror',             color: '#bde06a' },
  { id: 'crime',     label: 'Crime & Thriller',   color: '#a99cff' },
  { id: 'other',     label: 'Other',              color: '#9aa3b8' },
];

export const FAMILY_BY_ID = new Map(GENRE_FAMILIES.map(f => [f.id, f]));

/** First match wins. Every TMDB movie genre appears exactly once. */
const GENRE_PRIORITY: readonly [string, GenreFamilyId][] = [
  ['Animation', 'animation'],
  ['Documentary', 'other'],
  ['Horror', 'horror'],
  ['Science Fiction', 'scifi'],
  ['Fantasy', 'scifi'],
  ['Western', 'action'],
  ['Crime', 'crime'],
  ['Mystery', 'crime'],
  ['Thriller', 'crime'],
  ['Action', 'action'],
  ['Adventure', 'action'],
  ['War', 'drama'],
  ['History', 'drama'],
  ['Romance', 'romance'],
  ['Comedy', 'romance'],
  ['Family', 'animation'],
  ['Drama', 'drama'],
  ['Music', 'drama'],
  ['TV Movie', 'other'],
];

const PRIORITY_RANK = new Map(GENRE_PRIORITY.map(([genre], i) => [genre, i]));
const FAMILY_OF_GENRE = new Map(GENRE_PRIORITY);

export const familyOf = (genres: readonly string[]): GenreFamilyId => {
  let best: string | null = null;
  for (const g of genres) {
    const rank = PRIORITY_RANK.get(g);
    if (rank != null && (best == null || rank < PRIORITY_RANK.get(best)!)) best = g;
  }
  return best ? FAMILY_OF_GENRE.get(best)! : 'other';
};

export const familyColor = (id: GenreFamilyId): string => FAMILY_BY_ID.get(id)!.color;

/** Short display names for long TMDB genre names. */
export const genreLabel = (genre: string): string =>
  genre === 'Science Fiction' ? 'Sci-Fi' : genre;

/** TMDB genres that map to a family (used by tests to guard coverage). */
export const KNOWN_GENRES: readonly string[] = GENRE_PRIORITY.map(([genre]) => genre);
