import { useState, useEffect, useRef } from 'react';
import { useGraphFilters } from '../hooks/useGraphFilters';

export const SearchBar = () => {
  const { searchQuery, setSearchQuery, searchMatches } = useGraphFilters();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [localQuery, setSearchQuery]);

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && isFocused) {
        inputRef.current?.blur();
        setLocalQuery('');
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, setSearchQuery]);

  const handleClear = () => {
    setLocalQuery('');
    setSearchQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="absolute top-4 right-4 z-10 animate-fade-in">
      <div
        className={`relative flex items-center bg-[#12121a]/90 backdrop-blur-sm rounded-lg border transition-all duration-200 ${
          isFocused
            ? 'border-[#00d4ff]/50 shadow-lg shadow-[#00d4ff]/10'
            : 'border-white/10'
        }`}
      >
        {/* Search icon */}
        <svg
          className="w-4 h-4 ml-3 text-white/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search movies..."
          className="w-64 px-3 py-2.5 bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
        />

        {/* Match count or clear button */}
        {localQuery ? (
          <div className="flex items-center mr-2 gap-2">
            <span className="text-xs text-white/40 tabular-nums">
              {searchMatches.size} found
            </span>
            <button
              onClick={handleClear}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="mr-3 text-xs text-white/30">
            <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px]">⌘</kbd>
            <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] ml-0.5">K</kbd>
          </div>
        )}
      </div>
    </div>
  );
};
