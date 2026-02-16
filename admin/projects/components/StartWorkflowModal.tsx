import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GitBranch, Clock, Layers, Loader2 } from 'lucide-react';
import type { WorkflowTemplate } from '@/shared/types/workflow/template';
import type { ServiceCategory } from '@/shared/types/pricing/services';

interface StartWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: WorkflowTemplate[];
  category: ServiceCategory;
  categoryLabel: string;
  onStart: (templateId: string, category: ServiceCategory, customName?: string) => Promise<string | null>;
}

const StartWorkflowModal: React.FC<StartWorkflowModalProps> = ({
  isOpen,
  onClose,
  templates,
  category,
  categoryLabel,
  onStart,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!selectedTemplateId) return;
    setLoading(true);
    try {
      const result = await onStart(selectedTemplateId, category, customName || undefined);
      if (result) {
        onClose();
        setCustomName('');
        setSelectedTemplateId(templates[0]?.id || '');
      }
    } catch (err) {
      console.error('Error starting workflow:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/30 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
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
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                <div>
                  <h3 className="font-ramillas text-lg font-bold text-[#171717]">
                    Yeni Produksiyon Baslat
                  </h3>
                  <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                    {categoryLabel}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-4 h-4 text-neutral-500" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-4 space-y-4">
                {/* Template selection */}
                <div>
                  <label className="font-grotesk text-xs font-medium text-neutral-600 mb-2 block">
                    Is akisi sablonu secin
                  </label>
                  <div className="space-y-2">
                    {templates.map((template) => {
                      const nodeCount = template.nodes.filter(
                        n => n.type !== 'start' && n.type !== 'end'
                      ).length;
                      const totalHours = template.nodes.reduce(
                        (sum, n) => sum + (n.estimatedDurationHours || 0), 0
                      );
                      const isSelected = selectedTemplateId === template.id;

                      return (
                        <label
                          key={template.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-blue-300 bg-blue-50'
                              : 'border-neutral-100 bg-neutral-50 hover:border-neutral-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="template"
                            value={template.id}
                            checked={isSelected}
                            onChange={() => setSelectedTemplateId(template.id)}
                            className="mt-0.5 accent-blue-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <GitBranch className="w-3.5 h-3.5 text-neutral-400" />
                              <span className="font-grotesk text-sm font-medium text-[#171717]">
                                {template.name}
                              </span>
                            </div>
                            {template.description && (
                              <p className="font-grotesk text-xs text-neutral-500 mt-0.5 line-clamp-2">
                                {template.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="inline-flex items-center gap-1 font-grotesk text-[10px] text-neutral-400">
                                <Layers className="w-3 h-3" />
                                {nodeCount} adim
                              </span>
                              {totalHours > 0 && (
                                <span className="inline-flex items-center gap-1 font-grotesk text-[10px] text-neutral-400">
                                  <Clock className="w-3 h-3" />
                                  ~{totalHours}s
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Custom name */}
                <div>
                  <label className="font-grotesk text-xs font-medium text-neutral-600 mb-1.5 block">
                    Produksiyon adi (opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Ornek: Kurumsal Tanitim Filmi"
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors"
                  />
                </div>
              </div>

              {/* Footer */}
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
                  onClick={handleStart}
                  disabled={loading || !selectedTemplateId}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171717] text-white font-grotesk text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <GitBranch className="w-4 h-4" />
                  )}
                  Baslat
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default StartWorkflowModal;
