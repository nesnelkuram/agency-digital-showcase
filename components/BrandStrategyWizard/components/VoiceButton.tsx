import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';

interface VoiceButtonProps {
  isRecording: boolean;
  onToggle: () => void;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({ isRecording, onToggle }) => {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      className="w-12 h-12 rounded-full flex items-center justify-center outline-none border-2 transition-all duration-300"
      style={{
        backgroundColor: isRecording ? '#ef4444' : '#fffceb',
        borderColor: isRecording ? '#ef4444' : '#d4d4d4',
        boxShadow: isRecording ? '0 0 20px rgba(239, 68, 68, 0.5)' : 'none',
      }}
      animate={isRecording ? { scale: [1, 1.1, 1] } : {}}
      transition={{ duration: 0.8, repeat: isRecording ? Infinity : 0 }}
      whileTap={{ scale: 0.95 }}
    >
      {isRecording ? (
        <MicOff className="w-5 h-5 text-white" />
      ) : (
        <Mic className="w-5 h-5" style={{ color: '#525252' }} />
      )}
    </motion.button>
  );
};

export default VoiceButton;
