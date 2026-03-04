import type { Movie, MovieNode, MovieEdge, ConnectionType, GraphData } from '../types';

// Find shared elements between two arrays
const findShared = <T>(arr1: T[], arr2: T[]): T[] => {
  return arr1.filter(item => arr2.includes(item));
};

// Calculate Jaccard similarity for keyword overlap
const calculateKeywordSimilarity = (keywords1: string[], keywords2: string[]): number => {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const set1 = new Set(keywords1.map(k => k.toLowerCase()));
  const set2 = new Set(keywords2.map(k => k.toLowerCase()));

  const intersection = new Set([...set1].filter(k => set2.has(k)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
};

// Determine connection types between two movies
const findConnectionTypes = (movie1: Movie, movie2: Movie): ConnectionType[] => {
  const types: ConnectionType[] = [];

  // Check for shared actors
  const sharedActors = findShared(movie1.leadActors, movie2.leadActors);
  if (sharedActors.length > 0) {
    types.push('same_actor');
  }

  // Check for shared directors
  const sharedDirectors = findShared(movie1.directors, movie2.directors);
  if (sharedDirectors.length > 0) {
    types.push('same_director');
  }

  // Check for shared genres
  const sharedGenres = findShared(movie1.genres, movie2.genres);
  if (sharedGenres.length > 0) {
    types.push('same_genre');
  }

  // Check for similar plot keywords (threshold: 0.3 similarity)
  const keywordSimilarity = calculateKeywordSimilarity(movie1.plotKeywords, movie2.plotKeywords);
  if (keywordSimilarity >= 0.3) {
    types.push('similar_plot');
  }

  return types;
};

// Build graph data from movies
export const buildGraphData = (movies: Movie[]): GraphData => {
  const nodes: MovieNode[] = movies.map(movie => ({
    ...movie,
    // Position will be set by force simulation
  }));

  const edges: MovieEdge[] = [];

  // Compare each pair of movies
  for (let i = 0; i < movies.length; i++) {
    for (let j = i + 1; j < movies.length; j++) {
      const movie1 = movies[i];
      const movie2 = movies[j];

      const types = findConnectionTypes(movie1, movie2);

      if (types.length > 0) {
        edges.push({
          source: movie1.id,
          target: movie2.id,
          types,
          strength: types.length,
        });
      }
    }
  }

  console.log(`Built graph: ${nodes.length} nodes, ${edges.length} edges`);

  // Log connection type distribution
  const typeCounts = {
    same_actor: 0,
    same_director: 0,
    same_genre: 0,
    similar_plot: 0,
  };
  edges.forEach(edge => {
    edge.types.forEach(type => typeCounts[type]++);
  });
  console.log('Connection type distribution:', typeCounts);

  return { nodes, links: edges };
};

// Get edge color based on connection types
export const getEdgeColor = (types: ConnectionType[]): string => {
  const colors: Record<ConnectionType, string> = {
    same_actor: '#f97316',
    same_director: '#3b82f6',
    same_genre: '#22c55e',
    similar_plot: '#a855f7',
  };

  // Return the color of the first (primary) type
  return colors[types[0]] || '#64748b';
};

// Get node color based on primary genre
export const getNodeColor = (genres: string[]): string => {
  const genreColors: Record<string, string> = {
    'Drama': '#f59e0b',
    'Action': '#ef4444',
    'Sci-Fi': '#06b6d4',
    'Comedy': '#eab308',
    'Thriller': '#a855f7',
    'Horror': '#dc2626',
    'Romance': '#ec4899',
    'Animation': '#10b981',
    'Documentary': '#6366f1',
    'Adventure': '#f97316',
    'Crime': '#78716c',
    'Fantasy': '#8b5cf6',
    'Mystery': '#6366f1',
    'War': '#854d0e',
  };

  // Return color of first genre, or default
  return genreColors[genres[0]] || '#64748b';
};

// Calculate node size based on rating
export const getNodeSize = (rating: number): number => {
  // Scale rating (0-10) to size (4-12)
  return 4 + (rating / 10) * 8;
};
