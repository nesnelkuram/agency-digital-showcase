import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Zap, FileCheck, Copy, ShoppingCart } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { ServiceTemplate, ServiceCostResult } from '@/shared/types/pricing';
import { SERVICE_CATEGORY_LABELS, formatCurrency } from '@/shared/types/pricing';
import { usePermission } from '@/shared/hooks/usePermission';
import { PERMISSIONS } from '@/lib/rbac/permissions';

interface ServiceCardProps {
  template: ServiceTemplate;
  costResult?: ServiceCostResult;
  onViewDetail: () => void;
  onQuickQuote: () => void;
  onSaveAsQuote?: () => void;
  onCopy?: () => void;
  onAddToCart?: () => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  template,
  costResult,
  onViewDetail,
  onQuickQuote,
  onSaveAsQuote,
  onCopy,
  onAddToCart,
}) => {
  const { can } = usePermission();
  const canViewCost = can(PERMISSIONS.PRICING_VIEW_COST);
  const canViewMargin = can(PERMISSIONS.PRICING_VIEW_MARGIN);

  // Get the icon component dynamically
  const IconComponent = template.icon
    ? (LucideIcons as Record<string, React.FC<{ className?: string }>>)[template.icon] || LucideIcons.FileText
    : LucideIcons.FileText;

  const categoryLabel = SERVICE_CATEGORY_LABELS[template.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: template.color || '#DDD6FE' }}
      >
        <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center">
          <IconComponent className="w-5 h-5 text-[#171717]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-commons text-sm font-bold text-[#171717] truncate">
            {template.name}
          </h3>
          <p className="font-commons text-xs text-[#171717]/70">{categoryLabel}</p>
        </div>
        {template.isPopular && (
          <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-xs font-medium rounded-full">
            Populer
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="font-commons text-sm text-neutral-600 mb-4 line-clamp-2">
          {template.shortDescription || template.description}
        </p>

        {/* Cost Display */}
        {costResult ? (
          <div className="space-y-2 mb-4">
            {canViewCost && (
              <div className="flex justify-between items-center">
                <span className="font-commons text-xs text-neutral-500">Maliyet</span>
                <span className="font-commons text-sm font-medium text-neutral-700">
                  {formatCurrency(costResult.totalCost)} TL
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="font-commons text-xs text-neutral-500">Teklif Fiyati</span>
              <span className="font-commons text-lg font-bold text-[#171717]">
                {formatCurrency(costResult.suggestedPrice)} TL
              </span>
            </div>
            {canViewMargin && (
              <div className="flex justify-between items-center">
                <span className="font-commons text-xs text-neutral-500">Kar</span>
                <span className="font-commons text-sm font-medium text-green-600">
                  {formatCurrency(costResult.profit)} TL (%{costResult.profitPercentage.toFixed(0)})
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="h-20 flex items-center justify-center text-neutral-400 text-sm mb-4">
            Hesaplaniyor...
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <div className="flex gap-2">
            {onAddToCart && costResult && (
              <button
                onClick={onAddToCart}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-500 text-white rounded-lg font-commons text-sm font-medium hover:bg-indigo-600 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                Sepete Ekle
              </button>
            )}
            <button
              onClick={onQuickQuote}
              className="flex items-center justify-center px-3 py-2 border border-neutral-200 text-neutral-700 rounded-lg font-commons text-sm hover:bg-neutral-50 transition-colors"
              title="Hizli Teklif"
            >
              <Zap className="w-4 h-4" />
            </button>
            {onCopy && (
              <button
                onClick={onCopy}
                className="flex items-center justify-center px-3 py-2 border border-neutral-200 text-neutral-700 rounded-lg font-commons text-sm hover:bg-neutral-50 transition-colors"
                title="Kopyala"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onViewDetail}
              className="flex items-center justify-center gap-1 px-3 py-2 border border-neutral-200 text-neutral-700 rounded-lg font-commons text-sm hover:bg-neutral-50 transition-colors"
            >
              Detay
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {onSaveAsQuote && costResult && (
            <button
              onClick={onSaveAsQuote}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500 text-white rounded-lg font-commons text-sm font-medium hover:bg-green-600 transition-colors"
            >
              <FileCheck className="w-4 h-4" />
              Teklif Olarak Kaydet
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ServiceCard;
