import React from 'react';
import { motion } from 'framer-motion';
import { HardDrive, ExternalLink } from 'lucide-react';

interface DriveConnectPromptProps {
  onConnect: () => void;
}

const DriveConnectPrompt: React.FC<DriveConnectPromptProps> = ({ onConnect }) => (
  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-neutral-200">
    <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
      <HardDrive className="w-8 h-8 text-blue-500" />
    </div>
    <h3 className="font-grotesk font-semibold text-[#171717] text-lg">
      Google Drive Bağlantısı
    </h3>
    <p className="font-grotesk text-sm text-neutral-500 mt-1 max-w-sm text-center">
      Google Drive hesabınızı bağlayarak dosyalarınıza doğrudan erişin, import edin ve senkronize edin.
    </p>
    <motion.button
      onClick={onConnect}
      className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full font-grotesk text-sm font-medium hover:bg-blue-700 transition-colors"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <ExternalLink className="w-4 h-4" />
      Google Drive Bağla
    </motion.button>
  </div>
);

export default DriveConnectPrompt;
