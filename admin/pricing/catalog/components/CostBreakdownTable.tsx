import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ServiceCostResult, ComponentCostResult } from '@/shared/types/pricing';
import { formatCurrency, COMPONENT_TYPE_LABELS } from '@/shared/types/pricing';

interface CostBreakdownTableProps {
  result: ServiceCostResult;
  showDetails?: boolean;
}

const CostBreakdownTable: React.FC<CostBreakdownTableProps> = ({
  result,
  showDetails = false,
}) => {
  const [expandedComponents, setExpandedComponents] = React.useState<Set<string>>(new Set());

  const toggleComponent = (componentId: string) => {
    setExpandedComponents((prev) => {
      const next = new Set(prev);
      if (next.has(componentId)) {
        next.delete(componentId);
      } else {
        next.add(componentId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Components Table */}
      <div className="bg-white/50 rounded-xl overflow-hidden border border-indigo-100">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: '#DDD6FE' }}>
              <th className="px-4 py-3 text-left font-commons text-sm font-semibold text-[#171717]">
                Bilesen
              </th>
              <th className="px-4 py-3 text-center font-commons text-sm font-semibold text-[#171717] w-24">
                Miktar
              </th>
              <th className="px-4 py-3 text-right font-commons text-sm font-semibold text-[#171717] w-32">
                Birim Maliyet
              </th>
              <th className="px-4 py-3 text-right font-commons text-sm font-semibold text-[#171717] w-32">
                Toplam
              </th>
            </tr>
          </thead>
          <tbody>
            {result.components.map((component, index) => (
              <React.Fragment key={component.componentId}>
                <ComponentRow
                  component={component}
                  isExpanded={expandedComponents.has(component.componentId)}
                  onToggle={() => toggleComponent(component.componentId)}
                  showDetails={showDetails}
                  rowIndex={index}
                />
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="bg-white/80 rounded-xl p-4 border border-indigo-100">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="font-commons text-xs text-neutral-500 mb-1">Iscilik (Calisanlar)</p>
            <p className="font-commons text-sm font-medium">{formatCurrency(result.employeeLaborCost)} TL</p>
          </div>
          <div>
            <p className="font-commons text-xs text-neutral-500 mb-1">Ekipman</p>
            <p className="font-commons text-sm font-medium">{formatCurrency(result.equipmentCost)} TL</p>
          </div>
          <div>
            <p className="font-commons text-xs text-neutral-500 mb-1">
              Sabit Giderler
              <span className="text-neutral-400 ml-1">
                ({result.nonFreelancerHours} saat × {formatCurrency(result.hourlyShopCostUsed)} TL)
              </span>
            </p>
            <p className="font-commons text-sm font-medium">{formatCurrency(result.autoOverheadCost)} TL</p>
          </div>
          <div>
            <p className="font-commons text-xs text-neutral-500 mb-1">Diger</p>
            <p className="font-commons text-sm font-medium">{formatCurrency(result.manualCost + result.overheadCost)} TL</p>
          </div>
        </div>

        {/* Kar Kalemleri - Yesil arkaplan */}
        {result.ownerLaborCost > 0 && (
          <div className="bg-green-50 rounded-lg p-3 mb-4 border border-green-200">
            <p className="font-commons text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">
              Kar Kalemleri
            </p>
            <div className="flex justify-between items-center">
              <span className="font-commons text-sm text-green-700">Ajans Baskani Payi</span>
              <span className="font-commons text-sm font-bold text-green-700">+{formatCurrency(result.ownerLaborCost)} TL</span>
            </div>
          </div>
        )}

        <div className="border-t border-indigo-100 pt-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-commons text-sm text-neutral-600">Dis Maliyet (Calisanlar + Ekipman + Giderler)</span>
            <span className="font-commons text-sm font-medium text-[#171717]">
              {formatCurrency(result.totalCost - result.ownerLaborCost)} TL
            </span>
          </div>
          {result.ownerLaborCost > 0 && (
            <div className="flex justify-between items-center">
              <span className="font-commons text-sm text-green-600">Ajans Baskani Payi (Kar)</span>
              <span className="font-commons text-sm font-medium text-green-600">
                +{formatCurrency(result.ownerLaborCost)} TL
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="font-commons text-sm text-neutral-600">
              Marj Kari (%{Math.round(result.margin * 100)})
            </span>
            <span className="font-commons text-sm text-green-600">
              +{formatCurrency(result.profit)} TL
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-indigo-100">
            <span className="font-commons text-base font-semibold text-[#171717]">
              Teklif Fiyati
            </span>
            <span className="font-commons text-2xl font-bold text-indigo-600">
              {formatCurrency(result.suggestedPrice)} TL
            </span>
          </div>
          <div className="flex justify-between items-center bg-green-50 -mx-4 px-4 py-2 rounded-lg">
            <span className="font-commons text-sm font-semibold text-green-700">
              Toplam Kar (Baskan + Marj)
            </span>
            <span className="font-commons text-lg font-bold text-green-700">
              {formatCurrency(result.ownerLaborCost + result.profit)} TL
            </span>
          </div>
        </div>

        {/* Tax Calculation Section */}
        <div className="border-t border-indigo-100 pt-4 mt-4 space-y-2">
          <p className="font-commons text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Vergi Hesabi
          </p>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="font-commons text-xs text-neutral-500 mb-1">
                Dusebilir Giderler
                <span className="text-green-600 ml-1">✓</span>
              </p>
              <p className="font-commons text-sm font-medium text-green-700">
                {formatCurrency(result.deductibleCost)} TL
              </p>
            </div>
            <div>
              <p className="font-commons text-xs text-neutral-500 mb-1">
                Dusulemez Giderler
                <span className="text-red-500 ml-1">✗</span>
              </p>
              <p className="font-commons text-sm font-medium text-red-600">
                {formatCurrency(result.nonDeductibleCost)} TL
              </p>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-commons text-sm text-neutral-600">
              Vergi Matrahi
              <span className="text-neutral-400 text-xs ml-1">
                (Teklif - Dusebilir Giderler)
              </span>
            </span>
            <span className="font-commons text-sm font-medium text-[#171717]">
              {formatCurrency(result.taxableIncome)} TL
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-commons text-sm text-neutral-600">
              Tahmini Gelir Vergisi
              <span className="text-neutral-400 text-xs ml-1">
                (%{Math.round(result.marginalTaxRate * 100)} dilim)
              </span>
            </span>
            <span className="font-commons text-sm font-medium text-red-600">
              -{formatCurrency(result.estimatedTax)} TL
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-indigo-100">
            <span className="font-commons text-base font-semibold text-[#171717]">
              Net Kar (Vergi Sonrasi)
              <span className="text-neutral-400 text-xs ml-1 font-normal">
                (Baskan + Marj - Vergi)
              </span>
            </span>
            <span className={`font-commons text-xl font-bold ${result.netProfitAfterTax >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(result.netProfitAfterTax)} TL
            </span>
          </div>
        </div>
      </div>

      {/* Time Estimate */}
      <div className="flex items-center gap-4 text-sm text-neutral-600">
        <span className="font-commons">
          Tahmini Sure: <strong>{result.estimatedDays} gun</strong>
          {result.estimatedHours > 0 && ` (${result.estimatedHours} saat)`}
        </span>
      </div>
    </div>
  );
};

// Component Row with expandable details
interface ComponentRowProps {
  component: ComponentCostResult;
  isExpanded: boolean;
  onToggle: () => void;
  showDetails: boolean;
  rowIndex: number;
}

const ComponentRow: React.FC<ComponentRowProps> = ({
  component,
  isExpanded,
  onToggle,
  showDetails,
  rowIndex,
}) => {
  const bgColor = rowIndex % 2 === 0 ? '#EDE9FE' : '#F5F3FF';

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-indigo-50/50 transition-colors"
        style={{ backgroundColor: bgColor }}
        onClick={showDetails ? onToggle : undefined}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {showDetails && (
              <button className="text-neutral-400 hover:text-neutral-600">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            )}
            <div>
              <p className="font-commons text-sm font-medium text-[#171717]">
                {component.componentName}
              </p>
              <p className="font-commons text-xs text-neutral-500">
                {COMPONENT_TYPE_LABELS[component.type]}
                {component.tierApplied && ` - ${component.tierApplied}`}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-center font-commons text-sm text-[#171717]">
          {component.quantity}
        </td>
        <td className="px-4 py-3 text-right font-commons text-sm text-[#171717]">
          {formatCurrency(component.unitCost)} TL
        </td>
        <td className="px-4 py-3 text-right font-commons text-sm font-medium text-[#171717]">
          {formatCurrency(component.totalCost)} TL
        </td>
      </tr>

      {/* Expanded Details */}
      <AnimatePresence>
        {showDetails && isExpanded && (
          <tr>
            <td colSpan={4} className="bg-indigo-50/30 p-0">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-8 py-3 space-y-1"
              >
                {component.details.map((detail, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-neutral-500 flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          detail.source === 'staff'
                            ? 'bg-blue-400'
                            : detail.source === 'equipment'
                            ? 'bg-amber-400'
                            : detail.source === 'overhead'
                            ? 'bg-purple-400'
                            : 'bg-gray-400'
                        }`}
                      />
                      {detail.description}
                      {detail.isDeductible ? (
                        <span className="text-green-600 text-[10px]" title="Dusebilir">✓</span>
                      ) : (
                        <span className="text-red-500 text-[10px]" title="Dusulemez">✗</span>
                      )}
                    </span>
                    <span className="text-neutral-700 font-medium">
                      {formatCurrency(detail.amount)} TL
                    </span>
                  </div>
                ))}
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
};

export default CostBreakdownTable;
