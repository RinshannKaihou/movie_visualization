import { decodeDataset, encodeDataset } from '../core/dataset';
import type { Dataset, Movie } from '../core/types';
import { CONNECTION_BIT } from '../core/connections';

const movie = (id: number, title: string, over: Partial<Movie> = {}): Movie => ({
  id,
  title,
  year: 1950 + id,
  posterPath: '',
  rating: 8,
  genres: ['Drama'],
  directors: [],
  cast: [],
  keywords: [],
  overview: `${title} overview.`,
  ...over,
});

/** Three Kurosawa films and one unrelated film, two edges. */
export const smallDataset = (): Dataset =>
  decodeDataset(
    encodeDataset({
      movies: [
        movie(1, 'Seven Samurai', { directors: ['Akira Kurosawa'], cast: ['Toshiro Mifune', 'Takashi Shimura'], keywords: ['samurai'] }),
        movie(2, 'Yojimbo', { directors: ['Akira Kurosawa'], cast: ['Toshiro Mifune'], keywords: ['samurai'] }),
        movie(3, 'Ikiru', { directors: ['Akira Kurosawa'], cast: ['Takashi Shimura'] }),
        movie(4, 'Amélie', { directors: ['Jean-Pierre Jeunet'], genres: ['Comedy', 'Romance'] }),
      ],
      positions: [0, 0, 10, 0, 0, 10, 100, 100],
      edges: [
        { source: 0, target: 1, mask: CONNECTION_BIT.director | CONNECTION_BIT.cast | CONNECTION_BIT.theme, weight: 0.9 },
        { source: 0, target: 2, mask: CONNECTION_BIT.director | CONNECTION_BIT.cast, weight: 0.6 },
      ],
      fetchedAt: '2026-04-10T00:00:00.000Z',
      source: 'fixture',
    }),
  );
