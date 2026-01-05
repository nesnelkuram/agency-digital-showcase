import React from 'react';
import { motion } from 'framer-motion';

interface AIAvatarProps {
  isActive?: boolean;
}

const AIAvatar: React.FC<AIAvatarProps> = ({ isActive = true }) => {
  const bars = [1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar Circle */}
      <motion.div
        className="w-20 h-20 rounded-full flex items-center justify-center border-2"
        style={{
          backgroundColor: '#fffceb',
          borderColor: '#d4d4d4',
        }}
        animate={isActive ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
          }}
        >
          <svg
            className="w-6 h-6"
            style={{ color: '#2563eb' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </motion.div>

      {/* Waveform */}
      <div className="flex items-center gap-1 h-8">
        {bars.map((bar, index) => (
          <motion.div
            key={bar}
            className="w-1 rounded-full"
            style={{ backgroundColor: '#2563eb' }}
            animate={isActive ? {
              height: [8, 24, 8],
            } : { height: 8 }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: index * 0.1,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default AIAvatar;
