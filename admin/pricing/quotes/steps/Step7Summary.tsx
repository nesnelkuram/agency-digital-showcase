import React from 'react';
import { motion } from 'framer-motion';
import {
  User,
  FileText,
  Users,
  Package,
  Building2,
  Receipt,
  TrendingUp,
  AlertCircle,
  Flag,
  Calculator,
} from 'lucide-react';
import { QuoteWizardState, SERVICE_CATEGORY_LABELS, ServiceCategory } from '@/shared/types/pricing';

interface Step7SummaryProps {
  wizardState: QuoteWizardState;
  onMarginChange: (margin: number) => void;
  formatCurrency: (amount: number) => string;
  nonDeductibleCost?: number;
}

const MARGIN_PRESETS = [
  { value: 0.20, label: '%20' },
  { value: 0.25, label: '%25' },
  { value: 0.30, label: '%30' },
  { value: 0.35, label: '%35' },
  { value: 0.40, label: '%40' },
];

const Step7Summary: React.FC<Step7SummaryProps> = ({
  wizardState,
  onMarginChange,
  formatCurrency,
  nonDeductibleCost = 0,
}) => {
  const { client, category, costs, sellPrice, profit, margin, team, equipment, extras } = wizardState;

  // Vergi hesaplaması - varsayılan %27 marjinal vergi oranı
  const TAX_RATE = 0.27;
  const taxOnNonDeductible = nonDeductibleCost * TAX_RATE;
  const realProfit = profit - taxOnNonDeductible;

  // Calculate break-even (no margin)
  const breakEven = costs.total;

  // Margin percentage display
  const marginPercent = Math.round(margin * 100);

  // Profit margin color
  const getMarginColor = () => {
    if (margin < 0.20) return 'text-red-600';
    if (margin < 0.30) return 'text-amber-600';
    return 'text-green-600';
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="font-ramillas text-2xl font-bold text-[#171717] mb-2">
          Ozet & Fiyat
        </h2>
        <p className="font-grotesk text-neutral-500">
          Teklif detaylarini inceleyin ve kar marjini belirleyin
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Details */}
        <div className="space-y-4">
          {/* Client & Project Info */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <h3 className="font-grotesk text-sm font-medium text-neutral-500 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Proje Bilgileri
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-grotesk text-sm text-neutral-600">Musteri:</span>
                <span className="font-grotesk text-sm font-medium text-[#171717]">
                  {client.clientName || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-grotesk text-sm text-neutral-600">Proje:</span>
                <span className="font-grotesk text-sm font-medium text-[#171717]">
                  {client.projectName || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-grotesk text-sm text-neutral-600">Kategori:</span>
                <span className="font-grotesk text-sm font-medium text-[#171717]">
                  {category ? SERVICE_CATEGORY_LABELS[category as ServiceCategory] : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-grotesk text-sm text-neutral-600">Gecerlilik:</span>
                <span className="font-grotesk text-sm font-medium text-[#171717]">
                  {client.validityDays} gun
                </span>
              </div>
            </div>
          </div>

          {/* Team Summary */}
          {team.length > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              <h3 className="font-grotesk text-sm font-medium text-neutral-500 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Ekip ({team.length} kisi)
              </h3>
              <div className="space-y-2">
                {team.map((member) => (
                  <div key={member.staffId} className="flex justify-between text-sm">
                    <span className="font-grotesk text-neutral-600">
                      {member.name} ({member.days} gun)
                    </span>
                    <span className="font-grotesk font-medium text-[#171717]">
                      {formatCurrency(member.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equipment Summary */}
          {equipment.length > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              <h3 className="font-grotesk text-sm font-medium text-neutral-500 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Ekipman ({equipment.length} adet)
              </h3>
              <div className="space-y-2">
                {equipment.map((eq) => (
                  <div key={eq.equipmentId} className="flex justify-between text-sm">
                    <span className="font-grotesk text-neutral-600">
                      {eq.name} ({eq.days} gun)
                    </span>
                    <span className="font-grotesk font-medium text-[#171717]">
                      {formatCurrency(eq.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Costs & Pricing */}
        <div className="space-y-4">
          {/* Cost Breakdown */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <h3 className="font-grotesk text-sm font-medium text-neutral-500 mb-4 flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Maliyet Dagilimi
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-grotesk text-sm text-neutral-600 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" />
                  Personel (FBLR)
                </span>
                <span className="font-grotesk font-medium text-[#171717]">
                  {formatCurrency(costs.labor)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-grotesk text-sm text-neutral-600 flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-500" />
                  Ekipman
                </span>
                <span className="font-grotesk font-medium text-[#171717]">
                  {formatCurrency(costs.equipment)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-grotesk text-sm text-neutral-600 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-orange-500" />
                  Sabit Gider Payi
                </span>
                <span className="font-grotesk font-medium text-[#171717]">
                  {formatCurrency(costs.fixedCostShare)}
                </span>
              </div>
              {costs.extras > 0 && (
                <div className="flex justify-between items-center">
                  <span className="font-grotesk text-sm text-neutral-600 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-gray-500" />
                    Ek Masraflar
                  </span>
                  <span className="font-grotesk font-medium text-[#171717]">
                    {formatCurrency(costs.extras)}
                  </span>
                </div>
              )}
              <div className="border-t border-neutral-200 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-grotesk font-medium text-[#171717]">TOPLAM MALIYET</span>
                  <span className="font-ramillas text-lg font-bold text-[#171717]">
                    {formatCurrency(costs.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Break-even warning */}
            <div className="mt-4 p-3 bg-amber-50 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-grotesk text-xs text-amber-700">
                  <strong>Basabas Noktasi:</strong> {formatCurrency(breakEven)}
                </p>
                <p className="font-grotesk text-xs text-amber-600 mt-1">
                  Bu fiyatin altinda zarar edersiniz.
                </p>
              </div>
            </div>
          </div>

          {/* Margin Slider */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <h3 className="font-grotesk text-sm font-medium text-neutral-500 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Kar Marji
            </h3>

            {/* Preset buttons */}
            <div className="flex gap-2 mb-4">
              {MARGIN_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => onMarginChange(preset.value)}
                  className={`
                    flex-1 py-2 rounded-lg font-grotesk text-sm font-medium transition-all
                    ${
                      margin === preset.value
                        ? 'bg-[#171717] text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }
                  `}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Slider */}
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                value={marginPercent}
                onChange={(e) => onMarginChange(parseInt(e.target.value) / 100)}
                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#171717]"
              />
              <div className="flex justify-between text-xs font-grotesk text-neutral-400">
                <span>%0</span>
                <span className={`font-medium ${getMarginColor()}`}>%{marginPercent}</span>
                <span>%60</span>
              </div>
            </div>
          </div>

          {/* Final Price Card */}
          <motion.div
            className="bg-gradient-to-br from-[#171717] to-neutral-800 rounded-2xl p-6 text-white"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-grotesk text-neutral-400">Satis Fiyati</span>
              <span className="font-grotesk text-xs bg-white/10 px-2 py-1 rounded">
                KDV Haric
              </span>
            </div>
            <div className="mb-4">
              <motion.span
                key={sellPrice}
                className="font-ramillas text-4xl font-bold"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {formatCurrency(sellPrice)}
              </motion.span>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div>
                <p className="font-grotesk text-xs text-neutral-400">Kar</p>
                <p className="font-grotesk font-medium text-green-400">
                  {formatCurrency(profit)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-grotesk text-xs text-neutral-400">Marj</p>
                <p className={`font-grotesk font-medium ${
                  margin >= 0.30 ? 'text-green-400' : margin >= 0.20 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  %{marginPercent}
                </p>
              </div>
            </div>
          </motion.div>

          {/* KDV Note */}
          <div className="p-3 bg-neutral-100 rounded-xl">
            <p className="font-grotesk text-xs text-neutral-500 text-center">
              KDV dahil fiyat: <strong>{formatCurrency(sellPrice * 1.20)}</strong> (%20 KDV ile)
            </p>
          </div>
        </div>
      </div>

      {/* Faturalandırılamayan Giderler Uyarısı */}
      {nonDeductibleCost > 0 && (
        <motion.div
          className="mt-8 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="flex items-start gap-4">
            <div className="p-2 bg-orange-100 rounded-xl">
              <Flag className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-grotesk text-sm font-semibold text-orange-800 mb-2">
                Vergi Etkisi Bildirimi
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-white/60 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-orange-500" />
                    <span className="font-grotesk text-sm text-neutral-700">
                      Gider olarak gösterilemeyen maliyet
                    </span>
                  </div>
                  <span className="font-grotesk font-semibold text-orange-700">
                    {formatCurrency(nonDeductibleCost)}
                  </span>
                </div>

                <p className="font-grotesk text-xs text-orange-700 leading-relaxed">
                  Bu maliyetler faturasız olduğu için gider olarak gösteremiyorsunuz.
                  Dolayısıyla bu işten <strong>{formatCurrency(profit)}</strong> geliriniz var gibi görünüyor.
                </p>

                <div className="flex items-center justify-between bg-white/60 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-orange-500" />
                    <span className="font-grotesk text-sm text-neutral-700">
                      Bu giderler üzerinden ödeyeceğiniz vergi (~%{Math.round(TAX_RATE * 100)})
                    </span>
                  </div>
                  <span className="font-grotesk font-semibold text-red-600">
                    -{formatCurrency(taxOnNonDeductible)}
                  </span>
                </div>

                <div className="border-t border-orange-200 pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-grotesk text-sm font-medium text-orange-800">
                      Gerçek Net Kar
                    </span>
                    <span className={`font-ramillas text-lg font-bold ${
                      realProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(realProfit)}
                    </span>
                  </div>
                  <p className="font-grotesk text-xs text-orange-600 mt-2">
                    Bu giderleri faturalandırabilseydiniz, karınız <strong>{formatCurrency(profit)}</strong> olacaktı.
                    Şu an <strong>{formatCurrency(taxOnNonDeductible)}</strong> vergi kaybınız var.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Step7Summary;
