import { useCallback } from 'react';
import { useGraphFilters } from '../hooks/useGraphFilters';
import { CONNECTION_COLORS, type ConnectionType } from '../types';

interface FilterOption {
  type: ConnectionType;
  label: string;
  description: string;
  color: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  {
    type: 'same_actor',
    label: 'Actor',
    description: 'Movies with shared actors',
    color: CONNECTION_COLORS.same_actor,
  },
  {
    type: 'same_director',
    label: 'Director',
    description: 'Movies by the same director',
    color: CONNECTION_COLORS.same_director,
  },
  {
    type: 'same_genre',
    label: 'Genre',
    description: 'Movies in the same genre',
    color: CONNECTION_COLORS.same_genre,
  },
  {
    type: 'similar_plot',
    label: 'Plot',
    description: 'Movies with similar themes',
    color: CONNECTION_COLORS.similar_plot,
  },
];

export const FilterPanel = () => {
  const {
    activeFilters,
    toggleFilter,
    setAllFilters,
    clearAllFilters,
    isFilterActive,
  } = useGraphFilters();

  const allActive = activeFilters.size === 4;
  const noneActive = activeFilters.size === 0;

  return (
    <div className="absolute top-4 left-4 z-10 bg-[#12121a]/90 backdrop-blur-sm rounded-lg p-4 border border-white/10 shadow-xl animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
          Connections
        </h3>
        <div className="flex gap-1">
          <button
            onClick={setAllFilters}
            disabled={allActive}
            className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors disabled:opacity-30"
          >
            All
          </button>
          <button
            onClick={clearAllFilters}
            disabled={noneActive}
            className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors disabled:opacity-30"
          >
            None
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {FILTER_OPTIONS.map((option) => {
          const isActive = isFilterActive(option.type);

          return (
            <button
              key={option.type}
              onClick={() => toggleFilter(option.type)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-white/10 hover:bg-white/15'
                  : 'bg-white/5 hover:bg-white/10 opacity-50'
              }`}
            >
              {/* Color indicator */}
              <div
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  isActive ? 'ring-2 ring-offset-1 ring-offset-[#12121a]' : ''
                }`}
                style={{
                  backgroundColor: isActive ? option.color : '#444',
                }}
              />

              {/* Label */}
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-white/90">
                  {option.label}
                </div>
                <div className="text-xs text-white/50">
                  {option.description}
                </div>
              </div>

              {/* Toggle indicator */}
              <div
                className={`w-8 h-5 rounded-full transition-all duration-200 ${
                  isActive ? 'bg-[#00d4ff]/30' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full transform transition-all duration-200 ${
                    isActive
                      ? 'translate-x-4 bg-[#00d4ff]'
                      : 'translate-x-0.5 bg-white/50'
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Active count */}
      <div className="mt-3 pt-3 border-t border-white/10 text-center">
        <span className="text-xs text-white/40">
          {activeFilters.size} of 4 connection types active
        </span>
      </div>
    </div>
  );
};
