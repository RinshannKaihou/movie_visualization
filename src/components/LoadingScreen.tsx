interface LoadingScreenProps {
  message?: string;
  progress?: { loaded: number; total: number };
  hint?: string;
}

export const LoadingScreen = ({ message = 'Loading...', progress, hint }: LoadingScreenProps) => {
  console.log('LoadingScreen: Rendering with message:', message);
  const progressPercent = progress
    ? Math.round((progress.loaded / progress.total) * 100)
    : null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a0a0f',
      zIndex: 50
    }}>
      {/* Animated loader */}
      <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 32 }}>
        {/* Outer ring */}
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '2px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '50%'
        }} />

        {/* Spinning ring */}
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '2px solid transparent',
          borderTopColor: '#00d4ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />

        {/* Inner pulse */}
        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          bottom: 12,
          backgroundColor: 'rgba(0, 212, 255, 0.1)',
          borderRadius: '50%',
          animation: 'pulse 2s ease-in-out infinite'
        }} />

        {/* Center dot */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: 12,
            height: 12,
            backgroundColor: '#00d4ff',
            borderRadius: '50%'
          }} />
        </div>
      </div>

      {/* Message */}
      <p style={{
        fontSize: 18,
        fontWeight: 500,
        marginBottom: 8,
        color: 'rgba(255, 255, 255, 0.8)'
      }}>
        {message}
      </p>

      {/* Progress bar */}
      {progressPercent !== null && progress && (
        <div style={{ width: 256, marginTop: 16 }}>
          <div style={{
            height: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 2,
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: '#00d4ff',
              transition: 'width 300ms ease-out'
            }} />
          </div>
          <p style={{
            textAlign: 'center',
            fontSize: 14,
            marginTop: 8,
            color: 'rgba(255, 255, 255, 0.4)'
          }}>
            {progress.loaded} / {progress.total} movies
          </p>
        </div>
      )}

      {/* Hint */}
      <p style={{
        fontSize: 14,
        marginTop: 32,
        color: 'rgba(255, 255, 255, 0.3)'
      }}>
        {hint || 'First load may take 15-20 minutes to fetch 2000 movies'}
      </p>
      {!hint && (
        <p style={{
          fontSize: 12,
          marginTop: 8,
          color: 'rgba(255, 255, 255, 0.2)'
        }}>
          Data will be cached locally for 7 days
        </p>
      )}
    </div>
  );
};

export const ErrorScreen = ({ message, onRetry }: { message: string; onRetry?: () => void }) => {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a0a0f',
      zIndex: 50,
      padding: 16
    }}>
      <div style={{ width: 64, height: 64, marginBottom: 24, color: 'rgba(239, 68, 68, 0.5)' }}>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h2 style={{
        fontSize: 20,
        fontWeight: 600,
        marginBottom: 8,
        textAlign: 'center',
        color: 'rgba(255, 255, 255, 0.9)'
      }}>
        Something went wrong
      </h2>

      <p style={{
        fontSize: 14,
        textAlign: 'center',
        maxWidth: 400,
        marginBottom: 24,
        color: 'rgba(255, 255, 255, 0.5)'
      }}>
        {message}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '10px 24px',
            backgroundColor: 'rgba(0, 212, 255, 0.2)',
            color: '#00d4ff',
            borderRadius: 8,
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 150ms'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 212, 255, 0.3)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 212, 255, 0.2)'}
        >
          Try Again
        </button>
      )}

      <p style={{
        fontSize: 12,
        marginTop: 32,
        textAlign: 'center',
        color: 'rgba(255, 255, 255, 0.3)'
      }}>
        Make sure you have set <code style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          padding: '2px 4px',
          borderRadius: 2
        }}>VITE_TMDB_API_KEY</code> in your .env file
      </p>
    </div>
  );
};
