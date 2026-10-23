import { describe, expect, it } from 'vitest';
import { familyOf, GENRE_FAMILIES, genreLabel, KNOWN_GENRES } from './genres.ts';

describe('familyOf', () => {
  it('picks the most distinctive genre, not the first', () => {
    expect(familyOf(['Drama', 'Science Fiction'])).toBe('scifi');
    expect(familyOf(['Drama', 'Crime'])).toBe('crime');
    expect(familyOf(['Comedy', 'Family'])).toBe('romance');
    expect(familyOf(['Family', 'Animation', 'Fantasy'])).toBe('animation');
  });

  it('keeps war and history films with drama', () => {
    expect(familyOf(['Drama', 'History', 'War'])).toBe('drama');
    expect(familyOf(['Drama', 'Music'])).toBe('drama');
  });

  it('falls back to "other" for empty or unknown genres', () => {
    expect(familyOf([])).toBe('other');
    expect(familyOf(['Telenovela'])).toBe('other');
  });

  it('maps every known TMDB genre to a family', () => {
    for (const genre of KNOWN_GENRES) {
      expect(GENRE_FAMILIES.map(f => f.id)).toContain(familyOf([genre]));
    }
  });
});

describe('GENRE_FAMILIES', () => {
  it('has unique ids and unique colors', () => {
    expect(new Set(GENRE_FAMILIES.map(f => f.id)).size).toBe(GENRE_FAMILIES.length);
    expect(new Set(GENRE_FAMILIES.map(f => f.color)).size).toBe(GENRE_FAMILIES.length);
  });
});

describe('genreLabel', () => {
  it('shortens Science Fiction and passes others through', () => {
    expect(genreLabel('Science Fiction')).toBe('Sci-Fi');
    expect(genreLabel('Drama')).toBe('Drama');
  });
});
