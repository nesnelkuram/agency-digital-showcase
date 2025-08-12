// Device detection utilities

export const isMobile = (): boolean => {
  // Check if running on server (SSR)
  if (typeof window === 'undefined') return false;
  
  // Check viewport width
  if (window.innerWidth <= 768) return true;
  
  // Check user agent
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  // iOS detection
  if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) return true;
  
  // Android detection
  if (/android/i.test(userAgent)) return true;
  
  // Windows Phone detection
  if (/windows phone/i.test(userAgent)) return true;
  
  // Check for touch support (not perfect but helps)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Combine checks
  return hasTouch && window.innerWidth <= 1024;
};

export const isLowPowerMode = (): boolean => {
  // Check if running on server (SSR)
  if (typeof window === 'undefined') return false;
  
  // Check for reduced motion preference (often correlates with power saving)
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // Check battery status if available
  if ('getBattery' in navigator) {
    (navigator as any).getBattery().then((battery: any) => {
      // If battery is low (< 20%) or charging
      if (battery.level < 0.2 || battery.charging) {
        return true;
      }
    });
  }
  
  return prefersReducedMotion;
};

export const shouldAutoplayVideos = (): boolean => {
  // Don't autoplay on mobile devices
  if (isMobile()) return false;
  
  // Don't autoplay in low power mode
  if (isLowPowerMode()) return false;
  
  // Check for data saver preference
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    if (connection?.saveData) return false;
    
    // Don't autoplay on slow connections
    if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') {
      return false;
    }
  }
  
  return true;
};