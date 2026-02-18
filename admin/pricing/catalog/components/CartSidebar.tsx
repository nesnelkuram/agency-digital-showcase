import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Plus, Minus, ShoppingCart, FileCheck } from 'lucide-react';
import { formatCurrency, SERVICE_CATEGORY_LABELS } from '@/shared/types/pricing';
import type { ServiceCostResult } from '@/shared/types/pricing';

export interface CartItem {
  templateId: string;
  name: string;
  category: string;
  costResult: ServiceCostResult;
  quantity: number;
}

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onQuantityChange: (templateId: string, quantity: number) => void;
  onRemove: (templateId: string) => void;
  onCreateQuote: () => void;
}

const CartSidebar: React.FC<CartSidebarProps> = ({
  isOpen,
  onClose,
  items,
  onQuantityChange,
  onRemove,
  onCreateQuote,
}) => {
  const totalCost = items.reduce(
    (sum, item) => sum + item.costResult.totalCost * item.quantity,
    0
  );
  const totalSellPrice = items.reduce(
    (sum, item) => sum + item.costResult.suggestedPrice * item.quantity,
    0
  );
  const totalProfit = totalSellPrice - totalCost;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-500" />
                <h2 className="font-commons text-lg font-bold text-[#171717]">Sepet</h2>
                {items.length > 0 && (
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                    {items.length}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto py-4 px-5 space-y-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-neutral-400">
                  <ShoppingCart className="w-10 h-10 mb-2 opacity-40" />
                  <p className="font-commons text-sm">Sepetiniz bos</p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.templateId}
                    className="bg-neutral-50 rounded-xl p-4 space-y-3"
                  >
                    {/* Item header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-commons text-sm font-semibold text-[#171717] truncate">
                          {item.name}
                        </p>
                        <p className="font-commons text-xs text-neutral-500">
                          {SERVICE_CATEGORY_LABELS[item.category as keyof typeof SERVICE_CATEGORY_LABELS] || item.category}
                        </p>
                      </div>
                      <button
                        onClick={() => onRemove(item.templateId)}
                        className="p-1 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors flex-shrink-0"
                        title="Kaldir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quantity control */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onQuantityChange(item.templateId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-commons text-sm font-semibold w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onQuantityChange(item.templateId, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="font-commons text-xs text-neutral-500">
                          {formatCurrency(item.costResult.suggestedPrice)} TL × {item.quantity}
                        </p>
                        <p className="font-commons text-sm font-bold text-[#171717]">
                          {formatCurrency(item.costResult.suggestedPrice * item.quantity)} TL
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer summary + action */}
            {items.length > 0 && (
              <div className="border-t border-neutral-100 px-5 py-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-commons text-sm text-neutral-500">Toplam Maliyet</span>
                    <span className="font-commons text-sm font-medium text-neutral-700">
                      {formatCurrency(totalCost)} TL
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-commons text-sm text-neutral-500">Toplam Satis Fiyati</span>
                    <span className="font-commons text-base font-bold text-[#171717]">
                      {formatCurrency(totalSellPrice)} TL
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-commons text-sm text-neutral-500">Toplam Kar</span>
                    <span className="font-commons text-sm font-semibold text-green-600">
                      {formatCurrency(totalProfit)} TL
                    </span>
                  </div>
                </div>

                <motion.button
                  onClick={onCreateQuote}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-commons text-sm font-semibold hover:bg-indigo-700 transition-colors"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FileCheck className="w-4 h-4" />
                  Teklif Olustur
                </motion.button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartSidebar;
