import React, { useEffect, useState } from 'react';

interface SimpleLoadingScreenProps {
  onLoadComplete: () => void;
  progress: number;
  isActive: boolean;
}

const SimpleLoadingScreen: React.FC<SimpleLoadingScreenProps> = ({ onLoadComplete, progress, isActive }) => {
  const [phase, setPhase] = useState<'loading' | 'fadeOutLogo' | 'shrinking' | 'done'>('loading');
  const [minimumTimePassed, setMinimumTimePassed] = useState(false);

  // Ensure minimum display time
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinimumTimePassed(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Safety: Force complete after 6 seconds no matter what
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (phase === 'loading') {
        console.log('[LoadingScreen] ⚠️ Safety timeout - forcing completion');
        setPhase('fadeOutLogo');
        setTimeout(() => setPhase('shrinking'), 600);
        setTimeout(() => {
          setPhase('done');
          onLoadComplete();
        }, 1800);
      }
    }, 6000);
    return () => clearTimeout(safetyTimer);
  }, [phase, onLoadComplete]);

  useEffect(() => {
    // Start animation sequence when loading is complete
    if (progress >= 100 && minimumTimePassed && phase === 'loading' && isActive) {
      console.log('[LoadingScreen] Phase 1: Fading out logo');

      // Phase 1: Fade out logo first
      setPhase('fadeOutLogo');

      // Phase 2: Start shrinking after logo fades
      setTimeout(() => {
        console.log('[LoadingScreen] Phase 2: Shrinking to circle');
        setPhase('shrinking');
      }, 600);

      // Phase 3: Complete - notify parent AFTER animation finishes
      setTimeout(() => {
        console.log('[LoadingScreen] Phase 3: Done');
        setPhase('done');
        onLoadComplete();
      }, 1800); // 600ms logo fade + 1200ms shrink
    }
  }, [progress, minimumTimePassed, phase, isActive, onLoadComplete]);

  // Don't render if done
  if (phase === 'done') return null;

  return (
    <>
      {/* Yellow circle background - shrinks to right side */}
      <div
        className="fixed z-[9998] bg-[#fffceb] overflow-hidden"
        style={{
          left: '84%',
          top: '26%',
          transform: 'translate(-50%, -50%)',
          width: phase === 'shrinking' ? '100vh' : '300vmax',
          height: phase === 'shrinking' ? '100vh' : '300vmax',
          borderRadius: '50%',
          transition: phase === 'shrinking'
            ? 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1), height 1.2s cubic-bezier(0.4, 0, 0.2, 1)'
            : 'none',
        }}
      />

      {/* Logo and loading content - centered on screen, fades out first */}
      <div
        className="fixed z-[9999] flex flex-col items-center justify-center"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: phase === 'loading' ? 1 : 0,
          transition: 'opacity 0.5s ease-out',
          pointerEvents: 'none',
        }}
      >
        {/* Intiba Logo */}
        <img
          src="/images/intibalogo.svg"
          alt="intiba"
          className="w-32 mb-8"
        />

        {/* Loading Bar */}
        <div className="w-48 h-3 border-2 border-black relative overflow-hidden">
          <div
            className="absolute top-0 left-0 bottom-0 bg-black transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Loading text */}
        <p className="mt-4 text-sm text-gray-700 font-medium">
          Loading videos...
        </p>
      </div>
    </>
  );
};

export default SimpleLoadingScreen;
