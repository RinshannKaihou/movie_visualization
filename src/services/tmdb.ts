import type { TMDBMovie, TMDBMovieDetails, TMDBResponse, Movie } from '../types';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Get API key from environment
const getApiKey = (): string => {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_TMDB_API_KEY is not set. Please add it to your .env file.');
  }
  return apiKey;
};

// Fetch with authentication
const fetchTMDB = async <T>(endpoint: string, params: Record<string, string> = {}): Promise<T> => {
  const apiKey = getApiKey();
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);

  url.searchParams.set('api_key', apiKey);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid TMDB API key. Please check your VITE_TMDB_API_KEY.');
    }
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

// Fetch top rated movies (paginated)
export const fetchTopRatedMovies = async (page: number = 1): Promise<TMDBResponse<TMDBMovie>> => {
  return fetchTMDB<TMDBResponse<TMDBMovie>>('/movie/top_rated', { page: page.toString() });
};

// Fetch detailed movie info including credits and keywords
export const fetchMovieDetails = async (movieId: number): Promise<TMDBMovieDetails> => {
  return fetchTMDB<TMDBMovieDetails>(`/movie/${movieId}`, {
    append_to_response: 'credits,keywords'
  });
};

// Get all top rated movies (fetches multiple pages)
export const fetchAllTopRatedMovies = async (maxMovies: number = 250): Promise<TMDBMovie[]> => {
  const allMovies: TMDBMovie[] = [];
  const totalPages = Math.ceil(maxMovies / 20); // TMDB returns 20 per page

  for (let page = 1; page <= totalPages; page++) {
    try {
      const response = await fetchTopRatedMovies(page);
      allMovies.push(...response.results);

      if (allMovies.length >= maxMovies) {
        break;
      }

      // Longer delay for large batches to avoid rate limiting
      // TMDB limit: ~40 requests per 10 seconds
      if (page < totalPages) {
        const delay = maxMovies > 1500 ? 300 : maxMovies > 500 ? 250 : 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`Failed to fetch page ${page}:`, error);
      // Continue with what we have
      break;
    }
  }

  return allMovies.slice(0, maxMovies);
};

// Transform TMDB movie details to our Movie type
export const transformToMovie = (details: TMDBMovieDetails): Movie => {
  const directors = details.credits.crew
    .filter(person => person.job === 'Director')
    .map(person => person.name);

  const leadActors = details.credits.cast
    .slice(0, 10)
    .map(actor => actor.name);

  const plotKeywords = details.keywords.keywords
    .slice(0, 20)
    .map(kw => kw.name);

  const genres = details.genres.map(g => g.name);

  return {
    id: details.id,
    title: details.title,
    year: parseInt(details.release_date?.substring(0, 4) || '0'),
    poster: details.poster_path
      ? `${TMDB_IMAGE_BASE}${details.poster_path}`
      : '',
    rating: details.vote_average,
    genres,
    directors,
    leadActors,
    plotKeywords,
    overview: details.overview,
  };
};

// Fetch and transform movies with full details
export const fetchMoviesWithDetails = async (
  maxMovies: number = 250,
  onProgress?: (loaded: number, total: number) => void
): Promise<Movie[]> => {
  // First, get the list of top rated movies
  const basicMovies = await fetchAllTopRatedMovies(maxMovies);

  const movies: Movie[] = [];

  // Then fetch details for each movie
  for (let i = 0; i < basicMovies.length; i++) {
    try {
      const details = await fetchMovieDetails(basicMovies[i].id);
      const movie = transformToMovie(details);
      movies.push(movie);

      onProgress?.(i + 1, basicMovies.length);

      // Longer delay for large batches to avoid rate limiting
      // TMDB limit: ~40 requests per 10 seconds
      if (i < basicMovies.length - 1) {
        const delay = maxMovies > 1500 ? 200 : maxMovies > 500 ? 150 : 50;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`Failed to fetch details for movie ${basicMovies[i].id}:`, error);
    }
  }

  return movies;
};
