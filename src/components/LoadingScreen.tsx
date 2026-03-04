interface LoadingScreenProps {
  message?: string;
  progress?: { loaded: number; total: number };
}

export const LoadingScreen = ({ message = 'Loading...', progress }: LoadingScreenProps) => {
  const progressPercent = progress
    ? Math.round((progress.loaded / progress.total) * 100)
    : null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0f] z-50">
      {/* Animated loader */}
      <div className="relative w-20 h-20 mb-8">
        {/* Outer ring */}
        <div className="absolute inset-0 border-2 border-[#00d4ff]/20 rounded-full" />

        {/* Spinning ring */}
        <div className="absolute inset-0 border-2 border-transparent border-t-[#00d4ff] rounded-full animate-spin" />

        {/* Inner pulse */}
        <div className="absolute inset-3 bg-[#00d4ff]/10 rounded-full animate-pulse" />

        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 bg-[#00d4ff] rounded-full" />
        </div>
      </div>

      {/* Message */}
      <p className="text-white/80 text-lg font-medium mb-2">{message}</p>

      {/* Progress bar */}
      {progressPercent !== null && progress && (
        <div className="w-64 mt-4">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00d4ff] transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-center text-white/40 text-sm mt-2">
            {progress.loaded} / {progress.total} movies
          </p>
        </div>
      )}

      {/* Hint */}
      <p className="text-white/30 text-sm mt-8">
        First load may take a minute to fetch movie data
      </p>
    </div>
  );
};

export const ErrorScreen = ({ message, onRetry }: { message: string; onRetry?: () => void }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0f] z-50 p-4">
      <div className="w-16 h-16 mb-6 text-red-500/50">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h2 className="text-white/90 text-xl font-semibold mb-2 text-center">
        Something went wrong
      </h2>

      <p className="text-white/50 text-sm text-center max-w-md mb-6">
        {message}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2.5 bg-[#00d4ff]/20 hover:bg-[#00d4ff]/30 text-[#00d4ff] rounded-lg font-medium transition-colors"
        >
          Try Again
        </button>
      )}

      <p className="text-white/30 text-xs mt-8 text-center">
        Make sure you have set <code className="bg-white/5 px-1 rounded">VITE_TMDB_API_KEY</code> in your .env file
      </p>
    </div>
  );
};
