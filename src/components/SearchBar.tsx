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
    <div style={{
      position: 'absolute',
      top: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
    }}>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: isFocused ? 'rgba(13, 13, 21, 0.95)' : 'rgba(13, 13, 21, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 14,
        border: isFocused 
          ? '1px solid rgba(0, 212, 255, 0.4)' 
          : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isFocused 
          ? '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 4px rgba(0, 212, 255, 0.1)' 
          : '0 8px 32px rgba(0, 0, 0, 0.3)',
        transition: 'all 200ms ease',
        width: 360,
      }}>
        {/* Search icon */}
        <svg
          style={{
            width: 18,
            height: 18,
            marginLeft: 16,
            color: isFocused ? '#00d4ff' : 'rgba(255, 255, 255, 0.4)',
            transition: 'color 200ms',
          }}
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
          style={{
            flex: 1,
            padding: '14px 12px',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 14,
            color: '#ffffff',
            fontFamily: 'inherit',
          }}
        />

        {/* Match count or keyboard shortcut */}
        {localQuery ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginRight: 12,
          }}>
            <span style={{
              fontSize: 12,
              color: '#00d4ff',
              fontWeight: 500,
            }}>
              {searchMatches.size} found
            </span>
            <button
              onClick={handleClear}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'rgba(255, 255, 255, 0.6)',
                transition: 'all 200ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
              }}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div style={{
            marginRight: 12,
            display: 'flex',
            gap: 4,
          }}>
            <kbd style={{
              padding: '4px 8px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 6,
              fontSize: 11,
              color: 'rgba(255, 255, 255, 0.4)',
              fontFamily: 'inherit',
              fontWeight: 500,
            }}>⌘</kbd>
            <kbd style={{
              padding: '4px 8px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 6,
              fontSize: 11,
              color: 'rgba(255, 255, 255, 0.4)',
              fontFamily: 'inherit',
              fontWeight: 500,
            }}>K</kbd>
          </div>
        )}
      </div>
    </div>
  );
};
