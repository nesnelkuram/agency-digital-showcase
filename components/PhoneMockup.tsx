import React from 'react';

interface PhoneMockupProps {
  videoSrc: string;
  className?: string;
  altText: string;
}

const PhoneMockup: React.FC<PhoneMockupProps> = ({ videoSrc, className, altText }) => {
  return (
    <div 
      className={`relative ${className}`}
      style={{
        transformStyle: 'preserve-3d',
        transform: 'rotateY(-5deg) rotateX(2deg)',
      }}
      role="figure"
      aria-label={`Phone mockup playing ${altText}`}
    >
      {/* Phone body with metallic frame - iPhone 15/16 style */}
      <div 
        className="relative bg-gradient-to-b from-neutral-900 to-neutral-800 rounded-[3rem] overflow-hidden aspect-[9/19] shadow-2xl"
        style={{
          boxShadow: `
            0 25px 50px rgba(0, 0, 0, 0.4),
            0 0 0 2px rgba(180, 180, 180, 0.3),
            inset 0 0 0 2px rgba(255, 255, 255, 0.1)
          `,
          background: 'linear-gradient(135deg, #1a1a1a 0%, #3a3a3a 50%, #1a1a1a 100%)',
        }}
      >
        {/* Side buttons - iPhone style */}
        <div className="absolute -left-[2px] top-24 w-[3px] h-10 bg-neutral-600 rounded-r-lg" style={{ boxShadow: 'inset -1px 0 2px rgba(0,0,0,0.5)' }}></div>
        <div className="absolute -left-[2px] top-36 w-[3px] h-14 bg-neutral-600 rounded-r-lg" style={{ boxShadow: 'inset -1px 0 2px rgba(0,0,0,0.5)' }}></div>
        <div className="absolute -right-[2px] top-32 w-[3px] h-20 bg-neutral-600 rounded-l-lg" style={{ boxShadow: 'inset 1px 0 2px rgba(0,0,0,0.5)' }}></div>
        
        {/* Dynamic Island - iPhone 15/16 style */}
        <div 
          className="absolute top-[14px] left-1/2 transform -translate-x-1/2 w-[30%] max-w-[80px] h-[32px] bg-black rounded-[16px] z-30"
          style={{
            boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.9), 0 1px 2px rgba(255,255,255,0.05)',
          }}
        ></div>
        
        {/* Screen bezel - thicker for iPhone 15/16 */}
        <div 
          className="absolute inset-[6px] bg-black rounded-[2.6rem] overflow-hidden"
          style={{
            boxShadow: 'inset 0 0 15px rgba(0,0,0,0.9)',
          }}
        >
          {/* Screen area with subtle reflection */}
          <div className="absolute inset-[3px] rounded-[2.4rem] overflow-hidden">
            {/* Glass reflection overlay */}
            <div 
              className="absolute inset-0 z-20 pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%)',
              }}
            ></div>
            
            {/* Video content */}
            <video
              key={videoSrc}
              className="w-full h-full object-cover"
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              aria-label={altText}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneMockup;