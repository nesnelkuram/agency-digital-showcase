import React, { useEffect, useState, useRef } from 'react';
import './CustomCursor.css';

interface CustomCursorProps {
  isHoveringPhone?: boolean;
}

const CustomCursor: React.FC<CustomCursorProps> = ({ isHoveringPhone = false }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);

  // Hide default cursor when hovering over phones
  useEffect(() => {
    if (isHoveringPhone) {
      document.body.style.cursor = 'none';
    } else {
      document.body.style.cursor = '';
    }
    
    return () => {
      document.body.style.cursor = '';
    };
  }, [isHoveringPhone]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, []);

  return (
    <>
      {isHoveringPhone && isVisible && (
        <div
          ref={cursorRef}
          className="custom-cursor"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            mixBlendMode: 'difference' as any
          }}
        >
          <div className="cursor-ring">
            <svg className="rotating-text" viewBox="0 0 200 200">
              <defs>
                <path
                  id="circle-path"
                  d="M 100, 100 m -50, 0 a 50,50 0 1,1 100,0 a 50,50 0 1,1 -100,0"
                />
              </defs>
              <text className="circular-text" fill="white">
                <textPath href="#circle-path" startOffset="0%">
                  CLICK THE PHONE 
                </textPath>
              </text>
            </svg>
            {/* Custom cursor icon from SVG file */}
            <div className="cursor-center-icon">
              <img 
                src="/images/cursor.svg" 
                alt="Click cursor" 
                style={{ 
                  width: '32px', 
                  height: '32px',
                  filter: 'invert(1)' // Make it white for difference mode
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomCursor;