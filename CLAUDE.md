# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production (runs TypeScript check then Vite build)
- `npm run lint` - Run ESLint on the codebase
- `npm run preview` - Preview production build locally

## Environment Setup

This project requires a TMDB API key. Create a `.env` file in the project root:

```
VITE_TMDB_API_KEY=your_api_key_here
```

Get your free API key at https://www.themoviedb.org/settings/api

## Project Architecture

### Data Flow Overview

1. **Data Fetching** (`src/services/tmdb.ts`): Fetches top-rated movies from TMDB API with pagination handling, rate limiting delays, and detail enrichment (credits, keywords).

2. **Graph Building** (`src/services/graphBuilder.ts`): Transforms movie data into nodes/edges using **inverted indexes** for O(n*k) complexity instead of O(n²). Builds maps from actors/directors/genres → movie IDs, then directly finds connections. Plot keyword similarity (Jaccard ≥0.3) only runs on unconnected pairs.

3. **State Management** (`src/stores/graphStore.ts`): Zustand store manages movies, graph nodes/edges, UI state (selected movie, filters), and loading states.

4. **Caching** (`src/utils/cache.ts`): IndexedDB caches API responses for 24 hours to avoid repeated fetches during development.

5. **Rendering** (`src/components/MovieGraph.tsx`): Uses `react-force-graph` with 2D canvas rendering (custom paint/paintLink functions). Nodes sized by rating, colored by primary genre.

### Key Type Definitions

- `Movie`: Core movie data (id, title, year, poster, rating, genres, directors, leadActors, plotKeywords, overview)
- `MovieNode`: Extends Movie with x/y/z position properties for graph simulation
- `MovieEdge`: Connections between movies with source/target IDs and connection types
- `ConnectionType`: Union of `'same_actor' | 'same_director' | 'same_genre' | 'similar_plot'`
- `GraphData`: Container for nodes array and links array

### Component Structure

- `App.tsx` → `GraphScene.tsx` (main container)
  - `MovieGraph.tsx` (force graph visualization)
  - `FilterPanel.tsx` (connection type toggles)
  - `SearchBar.tsx` (search movies by title, actor, director, genre)
  - `MovieDetailsPanel.tsx` (shows selected movie info)
  - `LoadingScreen.tsx` / `ErrorScreen.tsx` (loading/error states)

### 2D/3D Mode System

`src/hooks/useGraphMode.ts` detects:
- WebGL support via canvas context check
- Mobile devices via user agent and touch detection
- Screen width (breakpoint: 768px)

3D mode is only enabled when: WebGL is available AND not mobile AND screen width ≥ 768px. Currently defaults to 2D mode (ForceGraph2D component).

### Hooks

- `useMovieData.ts`: Loads movies from cache or API, builds graph data, handles refresh
- `useGraphFilters.ts`: Filters edges by connection type, search query, selected movie connections
- `useGraphMode.ts`: Determines 2D vs 3D rendering based on device capabilities

## Tech Stack

- **Build**: Vite with React plugin and Tailwind CSS Vite plugin
- **State**: Zustand for global state management
- **Graph**: react-force-graph (2D canvas mode)
- **Storage**: idb for IndexedDB caching
- **TypeScript**: Project references setup with `tsconfig.app.json` and `tsconfig.node.json`
