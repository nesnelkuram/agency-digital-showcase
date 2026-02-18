import React from 'react';
import { Package, Tag, DollarSign, Layers, Settings2 } from 'lucide-react';
import type { ServiceTemplate } from '@/shared/types/pricing';
import {
  SERVICE_CATEGORY_LABELS,
  COMPONENT_TYPE_LABELS,
  COST_SOURCE_LABELS,
} from '@/shared/types/pricing';

interface Props {
  draft: Partial<ServiceTemplate> | null;
}

const ServiceDesignPreview: React.FC<Props> = ({ draft }) => {
  if (!draft) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-neutral-50/50 rounded-2xl border border-dashed border-neutral-200">
        <Package className="w-12 h-12 text-neutral-300 mb-4" />
        <p className="font-grotesk text-sm text-neutral-400 text-center max-w-xs">
          AI ile sohbet ederek hizmet sablonunuz burada gorunecek
        </p>
      </div>
    );
  }

  const components = draft.components || [];
  const tags = draft.tags || [];

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
      {/* Header info */}
      <div className="px-5 py-3 border-b border-neutral-100 bg-gradient-to-r from-indigo-50 to-white">
        <h3 className="font-grotesk text-base font-bold text-neutral-800 truncate">
          {draft.name || 'Isimsiz Sablon'}
        </h3>
        {draft.shortDescription && (
          <p className="font-grotesk text-xs text-neutral-500 mt-0.5 truncate">
            {draft.shortDescription}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-xs font-grotesk text-neutral-500">
          {draft.category && (
            <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
              {SERVICE_CATEGORY_LABELS[draft.category] || draft.category}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            {components.length} bilesen
          </span>
          {draft.defaultMargin !== undefined && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              %{(draft.defaultMargin * 100).toFixed(0)} marj
            </span>
          )}
          {draft.complexityMultiplier !== undefined && draft.complexityMultiplier !== 1 && (
            <span className="flex items-center gap-1">
              <Settings2 className="w-3 h-3" />
              x{draft.complexityMultiplier}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Description */}
        {draft.description && (
          <div>
            <h4 className="font-grotesk text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
              Aciklama
            </h4>
            <p className="font-grotesk text-sm text-neutral-700 leading-relaxed">
              {draft.description}
            </p>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <h4 className="font-grotesk text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Etiketler
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-grotesk text-xs"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Components */}
        {components.length > 0 && (
          <div>
            <h4 className="font-grotesk text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Bilesenler ({components.length})
            </h4>
            <div className="space-y-2">
              {components.map((comp, i) => (
                <div
                  key={comp.id || i}
                  className="p-3 rounded-lg bg-neutral-50 border border-neutral-100"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-grotesk text-sm font-medium text-neutral-800">
                      {comp.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600 font-grotesk">
                        {COMPONENT_TYPE_LABELS[comp.type as keyof typeof COMPONENT_TYPE_LABELS] || comp.type}
                      </span>
                      {comp.isOptional && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-600 font-grotesk">
                          Opsiyonel
                        </span>
                      )}
                    </div>
                  </div>

                  {comp.description && (
                    <p className="font-grotesk text-xs text-neutral-500 mb-1.5">
                      {comp.description}
                    </p>
                  )}

                  {comp.unitLabel && (
                    <p className="font-grotesk text-xs text-neutral-400">
                      Birim: {comp.unitLabel}
                      {comp.baseQuantity ? ` (varsayilan: ${comp.baseQuantity})` : ''}
                    </p>
                  )}

                  {/* Cost Refs */}
                  {comp.costRefs && comp.costRefs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {comp.costRefs.map((ref: any, j: number) => (
                        <span
                          key={j}
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-grotesk ${
                            ref.source === 'staff'
                              ? 'bg-purple-50 text-purple-600'
                              : ref.source === 'equipment'
                              ? 'bg-cyan-50 text-cyan-600'
                              : ref.source === 'overhead'
                              ? 'bg-orange-50 text-orange-600'
                              : 'bg-neutral-100 text-neutral-600'
                          }`}
                        >
                          {COST_SOURCE_LABELS[ref.source as keyof typeof COST_SOURCE_LABELS] || ref.source}
                          {ref.source === 'staff' && `: ${ref.roleType} ${ref.timeAmount}${ref.timeUnit === 'hours' ? 's' : ref.timeUnit === 'days' ? 'g' : ''}`}
                          {ref.source === 'equipment' && `: ${ref.category} ${ref.days}g`}
                          {ref.source === 'manual' && `: ${ref.amount} TL`}
                          {ref.source === 'overhead' && `: ${ref.allocationType}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pricing Info */}
        <div>
          <h4 className="font-grotesk text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            Fiyatlandirma
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {draft.minimumPrice !== undefined && (
              <div className="p-2.5 rounded-lg bg-green-50 border border-green-100">
                <span className="font-grotesk text-xs text-green-600 block">Min. Fiyat</span>
                <span className="font-grotesk text-sm font-bold text-green-800">
                  {draft.minimumPrice.toLocaleString('tr-TR')} TL
                </span>
              </div>
            )}
            {draft.defaultMargin !== undefined && (
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                <span className="font-grotesk text-xs text-blue-600 block">Kar Marji</span>
                <span className="font-grotesk text-sm font-bold text-blue-800">
                  %{(draft.defaultMargin * 100).toFixed(0)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDesignPreview;
