import React from 'react';
import { ImageIcon, Upload } from 'lucide-react';
import { motion } from 'framer-motion';

const AssetLibraryPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
            Asset Kutuphanesi
          </h1>
          <p className="font-grotesk text-neutral-500 mt-1">
            Marka assetlerini yonetin ve organize edin.
          </p>
        </div>
        <motion.button
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Upload className="w-4 h-4" />
          Dosya Yukle
        </motion.button>
      </div>

      <div className="bg-white rounded-xl p-12 text-center border border-neutral-100">
        <ImageIcon className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
        <h3 className="font-grotesk text-xl font-bold text-neutral-400 mb-2">
          Asset Yonetimi
        </h3>
        <p className="font-grotesk text-neutral-400">
          Bu modul yakin zamanda aktif olacak.
        </p>
      </div>
    </div>
  );
};

export default AssetLibraryPage;
