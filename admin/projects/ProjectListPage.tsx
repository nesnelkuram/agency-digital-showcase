import React from 'react';
import { motion } from 'framer-motion';
import { Plus, FolderKanban } from 'lucide-react';

const ProjectListPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-ramillas font-bold text-[#171717]">
            Projeler
          </h1>
          <p className="font-grotesk text-neutral-600 mt-1">
            Tum projeleri yonetin ve takip edin.
          </p>
        </div>
        <motion.button
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="w-4 h-4" />
          Yeni Proje
        </motion.button>
      </div>

      {/* Placeholder Content */}
      <div className="bg-white rounded-xl p-12 text-center border border-neutral-100">
        <FolderKanban className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
        <h3 className="font-ramillas text-xl font-bold text-neutral-400 mb-2">
          Proje Yonetimi
        </h3>
        <p className="font-grotesk text-neutral-400">
          Bu modul yakin zamanda aktif olacak.
        </p>
      </div>
    </div>
  );
};

export default ProjectListPage;
