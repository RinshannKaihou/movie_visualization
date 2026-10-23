import type { ConnectionType } from './types.ts';

/** Display order, strongest signal first. Also the color-priority order. */
export const CONNECTION_TYPES: readonly ConnectionType[] = ['director', 'cast', 'theme', 'genre'];

export const CONNECTION_BIT: Record<ConnectionType, number> = {
  director: 1,
  cast: 2,
  theme: 4,
  genre: 8,
};

export const ALL_CONNECTIONS_MASK = 0b1111;

export const CONNECTION_META: Record<ConnectionType, { label: string; description: string; color: string }> = {
  director: { label: 'Auteur', description: 'Same director', color: '#7ea8ff' },
  cast:     { label: 'Cast', description: 'Shared actors', color: '#ffb36b' },
  theme:    { label: 'Theme', description: 'Shared story keywords', color: '#c99bff' },
  genre:    { label: 'Genre', description: 'Same genre mix', color: '#6fd6c6' },
};

export const typesFromMask = (mask: number): ConnectionType[] =>
  CONNECTION_TYPES.filter(t => (mask & CONNECTION_BIT[t]) !== 0);

/** The strongest connection type present in `mask` (drives edge color). */
export const primaryType = (mask: number): ConnectionType =>
  CONNECTION_TYPES.find(t => (mask & CONNECTION_BIT[t]) !== 0) ?? 'genre';
