import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Loader2, Check } from 'lucide-react';
import { SERVICE_MODULE_CONFIG } from '@/admin/projects/constants';
import type { ServiceCategory } from '@/shared/types/pricing/services';
import type { ProjectService } from '@/shared/types/project';

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingServices: ProjectService[];
  onAdd: (category: ServiceCategory) => Promise<void>;
}

const AddServiceModal: React.FC<AddServiceModalProps> = ({
  isOpen,
  onClose,
  existingServices,
  onAdd,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [loading, setLoading] = useState(false);

  const existingCategories = new Set(existingServices.map((s) => s.category));

  const handleAdd = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    try {
      await onAdd(selectedCategory);
      onClose();
      setSelectedCategory(null);
    } catch (err) {
      console.error('Error adding service:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = Object.entries(SERVICE_MODULE_CONFIG) as [ServiceCategory, typeof SERVICE_MODULE_CONFIG[ServiceCategory]][];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                <h3 className="font-grotesk text-lg font-bold text-[#171717]">
                  Hizmet Ekle
                </h3>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-4 h-4 text-neutral-500" />
                </button>
              </div>

              <div className="px-6 py-4 max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {categories.map(([cat, config]) => {
                    const exists = existingCategories.has(cat);
                    const isSelected = selectedCategory === cat;
                    const Icon = config.icon;

                    return (
                      <label
                        key={cat}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          exists
                            ? 'border-neutral-100 bg-neutral-50 opacity-50 cursor-not-allowed'
                            : isSelected
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-neutral-100 hover:border-neutral-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="service-category"
                          value={cat}
                          disabled={exists}
                          checked={isSelected}
                          onChange={() => setSelectedCategory(cat)}
                          className="sr-only"
                        />
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${config.color}15` }}
                        >
                          <Icon className="w-4.5 h-4.5" style={{ color: config.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-grotesk text-sm font-medium text-[#171717]">
                            {config.label}
                          </span>
                          <p className="font-grotesk text-[10px] text-neutral-400 line-clamp-1">
                            {config.description}
                          </p>
                        </div>
                        {exists ? (
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : isSelected ? (
                          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-neutral-200 flex-shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-neutral-100">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl border border-neutral-200 bg-white text-neutral-700 font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors"
                >
                  Iptal
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAdd}
                  disabled={loading || !selectedCategory}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171717] text-white font-grotesk text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Ekle
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AddServiceModal;
