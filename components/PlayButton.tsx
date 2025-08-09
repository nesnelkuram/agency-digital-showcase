import React from 'react';
import { Html } from '@react-three/drei';

interface PlayButtonProps {
  onClick: () => void;
  isVisible: boolean;
  isPlaying?: boolean;
}

const PlayButton: React.FC<PlayButtonProps> = ({ onClick, isVisible, isPlaying = false }) => {
  if (!isVisible) return null;

  return (
    <Html
      center
      style={{
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="play-button"
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          border: '2px solid rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          backdropFilter: 'blur(10px)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        }}
      >
        {!isPlaying ? (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            style={{ marginLeft: '3px' }}
          >
            <path
              d="M8 5V19L19 12L8 5Z"
              fill="white"
              stroke="white"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
          >
            <rect x="6" y="5" width="4" height="14" fill="white" />
            <rect x="14" y="5" width="4" height="14" fill="white" />
          </svg>
        )}
      </button>
    </Html>
  );
};

export default PlayButton;