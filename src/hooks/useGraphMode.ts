import { useState, useEffect } from 'react';

// Breakpoint for switching to 2D mode (in pixels)
const MOBILE_BREAKPOINT = 768;

// Check if device supports WebGL (required for 3D)
const checkWebGLSupport = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
};

// Check if device is mobile/touch
const isMobileDevice = (): boolean => {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || ('ontouchstart' in window)
  );
};

interface GraphModeState {
  is3DMode: boolean;
  isMobile: boolean;
  hasWebGL: boolean;
  width: number;
  height: number;
}

export const useGraphMode = (): GraphModeState => {
  const [state, setState] = useState<GraphModeState>(() => ({
    is3DMode: false,
    isMobile: false,
    hasWebGL: checkWebGLSupport(),
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const updateMode = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobile = width < MOBILE_BREAKPOINT || isMobileDevice();
      const hasWebGL = checkWebGLSupport();

      // Use 3D mode only if:
      // 1. Device has WebGL support
      // 2. Screen is wide enough (not mobile)
      // 3. Not explicitly a touch device (for performance)
      const is3DMode = hasWebGL && !isMobile;

      setState({
        is3DMode,
        isMobile,
        hasWebGL,
        width,
        height,
      });
    };

    // Initial check
    updateMode();

    // Listen for resize
    window.addEventListener('resize', updateMode);

    return () => {
      window.removeEventListener('resize', updateMode);
    };
  }, []);

  return state;
};
