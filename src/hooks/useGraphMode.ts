import { useState, useEffect } from 'react';

// Breakpoint for switching to 2D mode (in pixels)
const MOBILE_BREAKPOINT = 1024; // 提高到1024，平板也使用2D模式

// Check if device supports WebGL (required for 3D)
const checkWebGLSupport = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return false;
    
    // 进一步检测 WebGL 性能
    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      // 如果是软件渲染器，不使用3D模式
      if (renderer?.toLowerCase().includes('software') || 
          renderer?.toLowerCase().includes('llvmpipe')) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
};

// Check if device is mobile/touch or has low performance
const isMobileDevice = (): boolean => {
  const userAgent = navigator.userAgent;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  // 检测设备内存（如果可用）
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const isLowMemory = deviceMemory !== undefined && deviceMemory < 4;
  
  return isMobileUA || (isTouchDevice && isLowMemory);
};

// 检测是否是低性能设备
const isLowPerformanceDevice = (): boolean => {
  // 检测 CPU 核心数
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  if (hardwareConcurrency < 4) return true;
  
  // 检测是否为低功耗模式
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (deviceMemory !== undefined && deviceMemory < 4) return true;
  
  return false;
};

interface GraphModeState {
  is3DMode: boolean;
  isMobile: boolean;
  hasWebGL: boolean;
  isLowPerformance: boolean;
  width: number;
  height: number;
}

export const useGraphMode = (): GraphModeState => {
  const [state, setState] = useState<GraphModeState>(() => {
    // 立即进行检测
    const width = window.innerWidth;
    const height = window.innerHeight;
    const hasWebGL = checkWebGLSupport();
    const isMobile = width < MOBILE_BREAKPOINT || isMobileDevice();
    const isLowPerformance = isLowPerformanceDevice();
    const is3DMode = hasWebGL && !isMobile && !isLowPerformance;
    
    console.log('useGraphMode: Initial detection -', { is3DMode, isMobile, hasWebGL, isLowPerformance, width });
    
    return {
      is3DMode,
      isMobile,
      hasWebGL,
      isLowPerformance,
      width,
      height,
    };
  });

  useEffect(() => {
    const updateMode = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobile = width < MOBILE_BREAKPOINT || isMobileDevice();
      const hasWebGL = checkWebGLSupport();
      const isLowPerformance = isLowPerformanceDevice();
      const is3DMode = hasWebGL && !isMobile && !isLowPerformance;

      console.log('useGraphMode: Updated -', { is3DMode, isMobile, hasWebGL, isLowPerformance, width });

      setState(prev => {
        // 只在值变化时更新
        if (prev.is3DMode === is3DMode && prev.isMobile === isMobile && 
            prev.width === width && prev.height === height) {
          return prev;
        }
        return { is3DMode, isMobile, hasWebGL, isLowPerformance, width, height };
      });
    };

    // Listen for resize with debounce
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateMode, 150);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return state;
};
