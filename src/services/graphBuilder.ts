import type { Movie, MovieNode, MovieEdge, ConnectionType, GraphData } from '../types';

type IndexedConnectionType = Extract<ConnectionType, 'same_actor' | 'same_director' | 'same_genre'>;
type InvertedIndex = Map<string, number[]>;

// 降低连接限制以减少图复杂度，提高性能
const CONNECTION_LIMITS: Record<IndexedConnectionType, { cliqueThreshold: number; maxPeersPerMovie: number }> = {
  same_actor: { cliqueThreshold: 6, maxPeersPerMovie: 4 },
  same_director: { cliqueThreshold: 8, maxPeersPerMovie: 6 },
  same_genre: { cliqueThreshold: 4, maxPeersPerMovie: 3 },
};

const EDGE_TYPE_WEIGHT: Record<ConnectionType, number> = {
  same_director: 5,
  same_actor: 4,
  similar_plot: 3,
  same_genre: 1,
};

// 降低每个节点的最大边数
const MAX_EDGES_PER_NODE = 10;

// Helper to build an inverted index from movies
const buildIndex = (movies: Movie[], accessor: (movie: Movie) => string[]): InvertedIndex => {
  const index = new Map<string, number[]>();
  for (const movie of movies) {
    for (const value of accessor(movie)) {
      if (!index.has(value)) {
        index.set(value, []);
      }
      index.get(value)!.push(movie.id);
    }
  }
  return index;
};

// Calculate Jaccard similarity for keyword overlap
export const calculateKeywordSimilarity = (keywords1: string[], keywords2: string[]): number => {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const set1 = new Set(keywords1.map(k => k.toLowerCase()));
  const set2 = new Set(keywords2.map(k => k.toLowerCase()));

  let intersectionSize = 0;
  for (const keyword of set1) {
    if (set2.has(keyword)) intersectionSize++;
  }

  const unionSize = set1.size + set2.size - intersectionSize;

  return intersectionSize / unionSize;
};

// Build graph data from movies using inverted indexes for O(n*k) instead of O(n²)
export const buildGraphData = (movies: Movie[]): GraphData => {
  const startTime = performance.now();

  const nodes: MovieNode[] = movies.map(movie => ({ ...movie }));
  const movieById = new Map(movies.map(movie => [movie.id, movie]));

  // Build inverted indexes for fast lookups
  const actorIndex = buildIndex(movies, m => m.leadActors);
  const directorIndex = buildIndex(movies, m => m.directors);
  const genreIndex = buildIndex(movies, m => m.genres);

  // Map to track edges by key (smallerId-largerId) to avoid duplicates
  const edgeMap = new Map<string, MovieEdge>();

  // Helper to add or update an edge
  const addEdge = (sourceId: number, targetId: number, type: ConnectionType) => {
    const key = sourceId < targetId ? `${sourceId}-${targetId}` : `${targetId}-${sourceId}`;
    let edge = edgeMap.get(key);

    if (edge) {
      // Edge exists, just add the type if not already present
      if (!edge.types.includes(type)) {
        edge.types.push(type);
        edge.strength = edge.types.length;
      }
    } else {
      // Create new edge
      edge = {
        source: sourceId,
        target: targetId,
        types: [type],
        strength: 1,
      };
      edgeMap.set(key, edge);
    }
  };

  const rankMovieIds = (movieIds: number[]) => {
    return [...new Set(movieIds)].sort((leftId, rightId) => {
      const left = movieById.get(leftId)!;
      const right = movieById.get(rightId)!;

      return right.rating - left.rating || right.year - left.year || leftId - rightId;
    });
  };

  const connectIndex = (index: InvertedIndex, type: IndexedConnectionType) => {
    const { cliqueThreshold, maxPeersPerMovie } = CONNECTION_LIMITS[type];

    for (const movieIds of index.values()) {
      const rankedIds = rankMovieIds(movieIds);

      if (rankedIds.length < 2) {
        continue;
      }

      if (rankedIds.length <= cliqueThreshold) {
        for (let i = 0; i < rankedIds.length; i++) {
          for (let j = i + 1; j < rankedIds.length; j++) {
            addEdge(rankedIds[i], rankedIds[j], type);
          }
        }
        continue;
      }

      for (let i = 0; i < rankedIds.length; i++) {
        const upperBound = Math.min(rankedIds.length, i + maxPeersPerMovie + 1);
        for (let j = i + 1; j < upperBound; j++) {
          addEdge(rankedIds[i], rankedIds[j], type);
        }
      }
    }
  };

  connectIndex(actorIndex, 'same_actor');
  connectIndex(directorIndex, 'same_director');
  connectIndex(genreIndex, 'same_genre');

  const pruneEdges = (allEdges: MovieEdge[]) => {
    const sortedEdges = [...allEdges].sort((left, right) => {
      const leftWeight = left.types.reduce((total, type) => total + EDGE_TYPE_WEIGHT[type], 0);
      const rightWeight = right.types.reduce((total, type) => total + EDGE_TYPE_WEIGHT[type], 0);

      return (
        right.strength - left.strength ||
        rightWeight - leftWeight ||
        (right.source as number) - (left.source as number) ||
        (right.target as number) - (left.target as number)
      );
    });

    const degrees = new Map<number, number>();
    const prunedEdges: MovieEdge[] = [];

    for (const edge of sortedEdges) {
      const sourceId = edge.source as number;
      const targetId = edge.target as number;
      const sourceDegree = degrees.get(sourceId) ?? 0;
      const targetDegree = degrees.get(targetId) ?? 0;

      if (sourceDegree >= MAX_EDGES_PER_NODE || targetDegree >= MAX_EDGES_PER_NODE) {
        continue;
      }

      degrees.set(sourceId, sourceDegree + 1);
      degrees.set(targetId, targetDegree + 1);
      prunedEdges.push(edge);
    }

    return prunedEdges;
  };

  // Plot similarity disabled for performance - O(n²) is too expensive
  // Uncomment below to re-enable (will be slow with 100+ movies)
  /*
  const connectedPairs = new Set(edgeMap.keys());
  const keywordSets = new Map(
    movies.map(m => [m.id, new Set(m.plotKeywords.map(k => k.toLowerCase()))])
  );

  for (let i = 0; i < movies.length; i++) {
    for (let j = i + 1; j < movies.length; j++) {
      const pairKey = `${movies[i].id}-${movies[j].id}`;
      if (connectedPairs.has(pairKey)) continue;

      const set1 = keywordSets.get(movies[i].id)!;
      const set2 = keywordSets.get(movies[j].id)!;

      if (set1.size === 0 || set2.size === 0) continue;

      let hasIntersection = false;
      for (const keyword of set1) {
        if (set2.has(keyword)) {
          hasIntersection = true;
          break;
        }
      }
      if (!hasIntersection) continue;

      let intersectionSize = 0;
      for (const keyword of set1) {
        if (set2.has(keyword)) intersectionSize++;
      }
      const unionSize = set1.size + set2.size - intersectionSize;
      const similarity = intersectionSize / unionSize;

      if (similarity >= 0.3) {
        addEdge(movies[i].id, movies[j].id, 'similar_plot');
      }
    }
  }
  */

  const rawEdges = Array.from(edgeMap.values());
  const edges = pruneEdges(rawEdges);
  const buildTime = performance.now() - startTime;

  console.log(
    `Built graph: ${nodes.length} nodes, ${edges.length}/${rawEdges.length} edges kept in ${buildTime.toFixed(2)}ms`
  );

  // Log connection type distribution
  const typeCounts = { same_actor: 0, same_director: 0, same_genre: 0, similar_plot: 0 };
  edges.forEach(edge => {
    edge.types.forEach(type => typeCounts[type]++);
  });
  console.log('Connection type distribution:', typeCounts);

  return { nodes, links: edges };
};

// Gravitational (edge) colors — threads of light between bodies
const GRAV_COLORS: Record<ConnectionType, string> = {
  same_actor:    '#ffb066', // ember
  same_director: '#7ba2ff', // periwinkle
  same_genre:    '#7cffd4', // aurora
  similar_plot:  '#b68cff', // violet
};

// Get edge color based on connection types
export const getEdgeColor = (types: ConnectionType[]): string => {
  return GRAV_COLORS[types[0]] || '#8891a6';
};

// Spectral class → each genre is assigned a star color mapped to
// real stellar classification (O/B/A/F/G/K/M + peculiar classes).
// These are intentionally warmer and softer than the previous
// hyper-saturated palette so many stars can coexist on one sky.
export const SPECTRAL_COLORS: Record<string, string> = {
  'Drama':       '#ffd27a', // G-type sun-amber
  'Action':      '#ff5a3d', // M-type red giant
  'Sci-Fi':      '#6edcff', // B-type blue
  'Comedy':      '#ffe96b', // F-type yellow
  'Thriller':    '#b68cff', // peculiar violet
  'Horror':      '#d8344a', // carbon-star crimson
  'Romance':     '#ff8fc4', // rose dwarf
  'Animation':   '#8cf2c5', // cyan-green
  'Documentary': '#9aa8ff', // faint giant
  'Adventure':   '#ffb066', // ember orange
  'Crime':       '#8891a6', // cool gray-blue
  'Fantasy':     '#a57bff', // lilac
  'Mystery':     '#7ba2ff', // periwinkle
  'War':         '#b37a4a', // rust
};

// Get node color based on primary genre
export const getNodeColor = (genres: string[]): string => {
  return SPECTRAL_COLORS[genres[0]] || '#bcbfd0';
};

// Calculate node size based on rating
// Scale rating (0-10) to star magnitude (4.5 - 13)
export const getNodeSize = (rating: number): number => {
  return 4.5 + (rating / 10) * 8.5;
};
