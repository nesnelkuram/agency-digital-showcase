import React, { useEffect, useState, useRef } from 'react';
import './CustomCursor.css';

interface CustomCursorProps {
  isHoveringPhone?: boolean;
}

const CustomCursor: React.FC<CustomCursorProps> = ({ isHoveringPhone = false }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

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
      <div
        ref={cursorRef}
        className={`custom-cursor ${isHoveringPhone ? 'hovering' : ''} ${isVisible ? 'visible' : ''}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        <div className="cursor-dot"></div>
        {isHoveringPhone && (
          <div className="cursor-ring">
            <svg className="rotating-text" viewBox="0 0 200 200">
              <defs>
                <path
                  id="circle-path"
                  d="M 100, 100 m -60, 0 a 60,60 0 1,1 120,0 a 60,60 0 1,1 -120,0"
                />
              </defs>
              <text className="circular-text">
                <textPath href="#circle-path" startOffset="0%">
                  CLICK THE VIDEO • CLICK THE VIDEO • 
                </textPath>
              </text>
            </svg>
          </div>
        )}
      </div>
    </>
  );
};

export default CustomCursor;