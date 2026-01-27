import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Copy, FileText, Check } from 'lucide-react';
import type { ServiceTemplate, QuickQuoteResult, QuantityTier } from '@/shared/types/pricing';
import { formatCurrency, getApplicableTier, DEFAULT_QUANTITY_TIERS } from '@/shared/types/pricing';

interface QuickQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: ServiceTemplate;
  quoteResult: QuickQuoteResult | null;
  onQuantityChange: (quantity: number) => void;
}

const QuickQuoteModal: React.FC<QuickQuoteModalProps> = ({
  isOpen,
  onClose,
  template,
  quoteResult,
  onQuantityChange,
}) => {
  // Find the tiered component for quantity input
  const tieredComponent = template.components.find((c) => c.type !== 'fixed');
  const [quantity, setQuantity] = useState(tieredComponent?.baseQuantity || 1);
  const [copied, setCopied] = useState(false);

  const tiers = tieredComponent?.quantityTiers || DEFAULT_QUANTITY_TIERS;
  const currentTier = getApplicableTier(quantity, tiers);

  useEffect(() => {
    if (isOpen) {
      setQuantity(template.quickQuoteDefaults?.quantity || tieredComponent?.baseQuantity || 1);
    }
  }, [isOpen, template, tieredComponent]);

  useEffect(() => {
    onQuantityChange(quantity);
  }, [quantity, onQuantityChange]);

  const handleQuantityChange = (delta: number) => {
    const newQuantity = Math.max(1, quantity + delta);
    setQuantity(newQuantity);
  };

  const handleCopy = async () => {
    if (!quoteResult) return;

    const text = `${template.name}
Miktar: ${quantity} ${tieredComponent?.unitLabel || 'adet'}
Maliyet: ${quoteResult.formattedCost}
Teklif Fiyati: ${quoteResult.formattedPrice}
${quoteResult.pricePerUnit ? `Birim Fiyat: ${quoteResult.pricePerUnit}/${quoteResult.unitLabel}` : ''}`;

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ backgroundColor: template.color || '#DDD6FE' }}
            >
              <div>
                <h2 className="font-commons text-lg font-bold text-[#171717]">Hizli Teklif</h2>
                <p className="font-commons text-sm text-[#171717]/70">{template.name}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/30 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#171717]" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Quantity Input */}
              {tieredComponent && (
                <div className="mb-6">
                  <label className="block font-commons text-sm text-neutral-600 mb-2">
                    {tieredComponent.unitLabel || 'Adet'} Sayisi
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg bg-neutral-100 hover:bg-neutral-200 transition-colors"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 text-center text-2xl font-bold font-commons border-b-2 border-indigo-300 focus:border-indigo-500 outline-none"
                    />
                    <button
                      onClick={() => handleQuantityChange(1)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg bg-neutral-100 hover:bg-neutral-200 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Tier Indicator */}
                  {currentTier && (
                    <div className="mt-3 flex items-center gap-2">
                      <TierIndicator tiers={tiers} currentTier={currentTier} />
                    </div>
                  )}
                </div>
              )}

              {/* Cost Breakdown */}
              {quoteResult ? (
                <div className="space-y-3 mb-6">
                  <h3 className="font-commons text-sm font-semibold text-neutral-500 uppercase tracking-wider">
                    Maliyet Dokumu
                  </h3>
                  <div className="space-y-2 bg-neutral-50 rounded-lg p-4">
                    {quoteResult.breakdown.components.map((comp) => (
                      <div key={comp.componentId} className="flex justify-between text-sm">
                        <span className="text-neutral-600">
                          {comp.componentName}
                          {comp.type !== 'fixed' && ` (${comp.quantity}x)`}
                        </span>
                        <span className="font-medium">{formatCurrency(comp.totalCost)} TL</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-commons text-sm text-neutral-600">Toplam Maliyet</span>
                      <span className="font-commons text-lg font-bold">
                        {quoteResult.formattedCost}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-commons text-sm text-neutral-600">
                        Marj (%{Math.round(quoteResult.breakdown.margin * 100)})
                      </span>
                      <span className="font-commons text-sm text-green-600">
                        +{formatCurrency(quoteResult.breakdown.profit)} TL
                      </span>
                    </div>
                  </div>

                  {/* Final Price */}
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-commons text-sm font-semibold text-indigo-700">
                        Teklif Fiyati
                      </span>
                      <span className="font-commons text-2xl font-bold text-indigo-700">
                        {quoteResult.formattedPrice}
                      </span>
                    </div>
                    {quoteResult.pricePerUnit && (
                      <p className="text-right font-commons text-sm text-indigo-600/70">
                        Birim: {quoteResult.pricePerUnit}/{quoteResult.unitLabel}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-neutral-400">
                  Hesaplaniyor...
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-neutral-200 rounded-lg font-commons text-sm hover:bg-neutral-50 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      Kopyalandi!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Kopyala
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500 text-white rounded-lg font-commons text-sm font-medium hover:bg-indigo-600 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Teklif Olustur
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Tier Indicator Component
interface TierIndicatorProps {
  tiers: QuantityTier[];
  currentTier: QuantityTier;
}

const TierIndicator: React.FC<TierIndicatorProps> = ({ tiers, currentTier }) => {
  return (
    <div className="flex items-center gap-2 w-full">
      {tiers.map((tier, index) => {
        const isActive = tier.label === currentTier.label;
        const discount = Math.round((1 - tier.unitPriceModifier) * 100);

        return (
          <div
            key={index}
            className={`flex-1 py-1.5 px-2 rounded text-center text-xs font-commons transition-colors ${
              isActive
                ? 'bg-indigo-100 text-indigo-700 font-medium'
                : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {tier.label}
            {discount > 0 && (
              <span className={`ml-1 ${isActive ? 'text-indigo-600' : 'text-neutral-400'}`}>
                -%{discount}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default QuickQuoteModal;
