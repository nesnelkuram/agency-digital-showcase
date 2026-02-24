import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Calendar,
  DollarSign,
  Calculator,
  FileText,
  Repeat,
  ChevronRight,
  X,
  ChevronDown,
  Trash2,
  Loader2,
  RefreshCw,
  Flag,
  Receipt,
  Users,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import {
  Quote,
  QUOTE_STATUS_LABELS,
  BILLING_TYPE_LABELS,
  calculateProgressiveTaxDetailed,
  TAX_BRACKETS_2026,
  formatCurrency,
  ServiceTemplate,
  StaffMember,
  Equipment,
} from '@/shared/types/pricing';
import { ServiceCatalogEngine, getOrCalculateFixedCostsSummary, getPricingConfig } from '@/shared/services/pricing';

type ProjectionPeriod = 6 | 12 | 24;

const PERIOD_OPTIONS: { value: ProjectionPeriod; label: string }[] = [
  { value: 6, label: '6 Ay' },
  { value: 12, label: '12 Ay (1 Yil)' },
  { value: 24, label: '24 Ay (2 Yil)' },
];

// Non-deductible cost item
interface NonDeductibleItem {
  name: string;
  monthlyCost: number;
  source: 'software' | 'overhead' | 'marketing';
}

const ProjectionsPage: React.FC = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectionPeriod, setProjectionPeriod] = useState<ProjectionPeriod>(12);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showNonDeductibleBreakdown, setShowNonDeductibleBreakdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalculateMessage, setRecalculateMessage] = useState<string | null>(null);
  const [nonDeductibleItems, setNonDeductibleItems] = useState<NonDeductibleItem[]>([]);

  // Fetch quotes and non-deductible costs from Firestore
  useEffect(() => {
    const fetchData = async () => {
      if (!db) return;

      try {
        // Fetch quotes
        const quotesSnapshot = await getDocs(
          query(collection(db, 'quotes'), where('status', 'in', ['accepted', 'draft', 'sent']))
        );
        const quotesData: Quote[] = [];
        quotesSnapshot.forEach((doc) => {
          quotesData.push({ id: doc.id, ...doc.data() } as Quote);
        });
        setQuotes(quotesData);

        // Fetch non-deductible costs
        const nonDeductible: NonDeductibleItem[] = [];

        // Software subscriptions - doğru path: pricing/data/software
        const softwareSnapshot = await getDocs(collection(db, 'pricing', 'data', 'software'));
        softwareSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.isActive && data.isDeductible === false) {
            nonDeductible.push({
              name: data.name,
              monthlyCost: data.monthlyCost || 0,
              source: 'software',
            });
          }
        });

        // Overhead costs - doğru path: pricing/data/overhead
        const overheadSnapshot = await getDocs(collection(db, 'pricing', 'data', 'overhead'));
        overheadSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.isActive && data.isDeductible === false) {
            nonDeductible.push({
              name: data.name,
              monthlyCost: data.monthlyCost || 0,
              source: 'overhead',
            });
          }
        });

        // Marketing costs - doğru path: pricing/data/marketing
        const marketingSnapshot = await getDocs(collection(db, 'pricing', 'data', 'marketing'));
        marketingSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.isActive && data.isDeductible === false) {
            nonDeductible.push({
              name: data.name,
              monthlyCost: data.monthlyCost || 0,
              source: 'marketing',
            });
          }
        });

        setNonDeductibleItems(nonDeductible);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate projections
  const projections = useMemo(() => {
    // Separate one-time and recurring quotes
    const oneTimeQuotes = quotes.filter((q) => q.billingType === 'one_time' || !q.billingType);
    const recurringQuotes = quotes.filter((q) => q.billingType === 'recurring');

    // One-time quotes (only accepted quotes count)
    const oneTimeAccepted = oneTimeQuotes.filter((q) => q.status === 'accepted');
    const oneTimeRevenue = oneTimeAccepted.reduce((sum, q) => sum + (q.sellPrice || 0), 0);
    const oneTimeCost = oneTimeAccepted.reduce((sum, q) => sum + (q.rawCost || 0), 0);
    const oneTimeProfit = oneTimeAccepted.reduce((sum, q) => sum + (q.profit || 0), 0);

    // Recurring quotes calculation
    let recurringMonthlyRevenue = 0;
    let recurringMonthlyCost = 0;
    let recurringMonthlyProfit = 0;
    const recurringDetails: {
      quote: Quote;
      monthlyRevenue: number;
      monthlyCost: number;
      monthlyProfit: number;
      projectedRevenue: number;
      projectedCost: number;
      projectedProfit: number;
    }[] = [];

    recurringQuotes.forEach((q) => {
      if (q.status === 'accepted') {
        const monthlyRevenue = q.sellPrice || 0;
        const monthlyCost = q.rawCost || 0;
        const monthlyProfit = q.profit || 0;

        recurringMonthlyRevenue += monthlyRevenue;
        recurringMonthlyCost += monthlyCost;
        recurringMonthlyProfit += monthlyProfit;

        recurringDetails.push({
          quote: q,
          monthlyRevenue,
          monthlyCost,
          monthlyProfit,
          projectedRevenue: monthlyRevenue * projectionPeriod,
          projectedCost: monthlyCost * projectionPeriod,
          projectedProfit: monthlyProfit * projectionPeriod,
        });
      }
    });

    const recurringProjectedRevenue = recurringMonthlyRevenue * projectionPeriod;
    const recurringProjectedCost = recurringMonthlyCost * projectionPeriod;
    const recurringProjectedProfit = recurringMonthlyProfit * projectionPeriod;

    // Totals
    const totalRevenue = oneTimeRevenue + recurringProjectedRevenue;
    const totalCost = oneTimeCost + recurringProjectedCost;
    const grossProfit = oneTimeProfit + recurringProjectedProfit;

    // Calculate tax on gross profit (not revenue!)
    // Annualize if period is not 12 months
    const annualizedProfit = projectionPeriod === 12
      ? grossProfit
      : (grossProfit / projectionPeriod) * 12;

    const taxResult = calculateProgressiveTaxDetailed(annualizedProfit);

    // Adjust tax for projection period
    const projectedTax = projectionPeriod === 12
      ? taxResult.totalTax
      : (taxResult.totalTax / 12) * projectionPeriod;

    // Non-deductible costs from global settings (software, overhead, marketing)
    const nonDeductibleMonthly = nonDeductibleItems.reduce((sum, item) => sum + item.monthlyCost, 0);
    const nonDeductibleFromSettings = nonDeductibleMonthly * projectionPeriod;

    // Non-deductible costs from quotes
    const nonDeductibleFromOneTime = oneTimeAccepted.reduce(
      (sum, q) => sum + (q.nonDeductibleCost || 0),
      0
    );
    const nonDeductibleFromRecurring = recurringDetails.reduce(
      (sum, r) => sum + ((r.quote.nonDeductibleCost || 0) * projectionPeriod),
      0
    );
    const nonDeductibleFromQuotes = nonDeductibleFromOneTime + nonDeductibleFromRecurring;

    // Freelancer costs from accepted quotes
    const freelancerFromOneTime = oneTimeAccepted.reduce(
      (sum, q) => sum + (q.freelancerCost || 0),
      0
    );
    const freelancerFromRecurring = recurringDetails.reduce(
      (sum, r) => sum + ((r.quote.freelancerCost || 0) * projectionPeriod),
      0
    );
    const totalFreelancerCost = freelancerFromOneTime + freelancerFromRecurring;
    const monthlyFreelancerCost = totalFreelancerCost / projectionPeriod;

    // Total non-deductible
    const nonDeductibleProjected = nonDeductibleFromSettings + nonDeductibleFromQuotes;

    // Tax on non-deductible costs (using marginal rate)
    const taxOnNonDeductible = nonDeductibleProjected * taxResult.marginalRate;

    const netProfit = grossProfit - projectedTax;
    const realNetProfit = netProfit - taxOnNonDeductible;

    return {
      // One-time
      oneTimeQuotes: oneTimeAccepted,
      oneTimeRevenue,
      oneTimeCost,
      oneTimeProfit,
      // Recurring
      recurringQuotes: recurringDetails,
      recurringMonthlyRevenue,
      recurringMonthlyCost,
      recurringMonthlyProfit,
      recurringProjectedRevenue,
      recurringProjectedCost,
      recurringProjectedProfit,
      // Totals
      totalRevenue,
      totalCost,
      grossProfit,
      annualizedProfit,
      taxResult,
      projectedTax,
      netProfit,
      // Non-deductible
      nonDeductibleMonthly,
      nonDeductibleFromSettings,
      nonDeductibleFromQuotes,
      nonDeductibleProjected,
      taxOnNonDeductible,
      realNetProfit,
      // Freelancer
      freelancerFromOneTime,
      freelancerFromRecurring,
      totalFreelancerCost,
      monthlyFreelancerCost,
    };
  }, [quotes, projectionPeriod, nonDeductibleItems]);

  // Delete all quotes
  const handleDeleteAllQuotes = async () => {
    if (!db) return;
    setDeleting(true);
    try {
      const quotesSnapshot = await getDocs(collection(db, 'quotes'));
      const deletePromises = quotesSnapshot.docs.map((docSnap) =>
        deleteDoc(doc(db, 'quotes', docSnap.id))
      );
      await Promise.all(deletePromises);
      setQuotes([]);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting quotes:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Delete single quote
  const handleDeleteQuote = async (quoteId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'quotes', quoteId));
      setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
    } catch (err) {
      console.error('Error deleting quote:', err);
    }
  };

  // Recalculate all quotes from templates
  const handleRecalculateQuotes = useCallback(async () => {
    if (!db) return;
    setRecalculating(true);
    setRecalculateMessage(null);

    try {
      // Fetch templates
      const templatesSnapshot = await getDocs(
        collection(db, 'pricing', 'data', 'serviceCatalog')
      );
      const templates: ServiceTemplate[] = templatesSnapshot.docs.map((d) => ({
        ...(d.data() as ServiceTemplate),
        id: d.id,
      }));

      // Fetch staff and equipment
      const [staffSnapshot, equipmentSnapshot] = await Promise.all([
        getDocs(collection(db, 'pricing', 'data', 'staff')),
        getDocs(collection(db, 'pricing', 'data', 'equipment')),
      ]);

      const staff: StaffMember[] = staffSnapshot.docs.map((d) => ({
        ...(d.data() as StaffMember),
        id: d.id,
      }));

      const equipment: Equipment[] = equipmentSnapshot.docs.map((d) => ({
        ...(d.data() as Equipment),
        id: d.id,
      }));

      // Build rates
      const [fixedCostsSummary, pricingConfig] = await Promise.all([
        getOrCalculateFixedCostsSummary(db, true),
        getPricingConfig(db),
      ]);
      const engine = new ServiceCatalogEngine();
      engine.buildLiveRates(staff, equipment, fixedCostsSummary.dailyShopCost, fixedCostsSummary.hourlyShopCost, undefined, pricingConfig.overheadRate ?? 0.30);

      let updatedCount = 0;
      const updatedQuotes: Quote[] = [];

      for (const quote of quotes) {
        // Find matching template
        let template: ServiceTemplate | undefined;

        // First try by templateId
        if (quote.templateId) {
          template = templates.find((t) => t.id === quote.templateId);
        }

        // Fallback: try by serviceName or clientName
        if (!template) {
          const searchName = quote.serviceName || quote.clientName;
          template = templates.find((t) =>
            t.name === searchName ||
            t.name.includes(searchName) ||
            searchName.includes(t.name)
          );
        }

        if (template) {
          // Recalculate
          const costResult = engine.calculateServiceCost(template);

          // Calculate correct values
          const externalCost = costResult.employeeLaborCost + costResult.equipmentCost +
            costResult.overheadCost + costResult.autoOverheadCost + costResult.manualCost;
          const totalProfit = costResult.ownerLaborCost + costResult.profit;

          // Update in Firestore
          await updateDoc(doc(db, 'quotes', quote.id), {
            templateId: template.id,
            serviceName: template.name,
            rawCost: externalCost,
            sellPrice: costResult.suggestedPrice,
            profit: totalProfit,
            ownerLaborCost: costResult.ownerLaborCost,
            employeeLaborCost: costResult.employeeLaborCost,
            freelancerCost: costResult.freelancerCost,
            equipmentCost: costResult.equipmentCost,
            overheadCost: costResult.overheadCost + costResult.autoOverheadCost,
            manualCost: costResult.manualCost,
            nonDeductibleCost: costResult.nonDeductibleCost,
            totalLaborCost: costResult.employeeLaborCost,
            totalEquipmentCost: costResult.equipmentCost,
            totalFixedCostAllocation: costResult.autoOverheadCost,
            actualMarginPercent: costResult.suggestedPrice > 0 ? totalProfit / costResult.suggestedPrice : 0,
            updatedAt: Timestamp.now(),
          });

          updatedQuotes.push({
            ...quote,
            templateId: template.id,
            serviceName: template.name,
            rawCost: externalCost,
            sellPrice: costResult.suggestedPrice,
            profit: totalProfit,
            nonDeductibleCost: costResult.nonDeductibleCost,
            freelancerCost: costResult.freelancerCost,
          });
          updatedCount++;
        } else {
          // Keep unchanged
          updatedQuotes.push(quote);
        }
      }

      setQuotes(updatedQuotes);
      setRecalculateMessage(`${updatedCount} teklif guncellendi`);
    } catch (err) {
      console.error('Error recalculating quotes:', err);
      setRecalculateMessage('Hata olustu');
    } finally {
      setRecalculating(false);
    }
  }, [quotes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-commons text-2xl font-bold text-[#171717]">
            Yillik Projeksiyonlar
          </h1>
          <p className="font-commons text-sm text-neutral-500 mt-1">
            Kabul edilen tekliflere gore gelir ve vergi tahmini
          </p>
        </div>

        {/* Period Selector and Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-commons text-sm text-neutral-600">Projeksiyon Donemi:</span>
            <div className="flex bg-neutral-100 rounded-lg p-1">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setProjectionPeriod(option.value)}
                  className={`
                    px-4 py-2 rounded-md font-commons text-sm font-medium transition-all
                    ${
                      projectionPeriod === option.value
                        ? 'bg-white text-[#171717] shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {quotes.length > 0 && (
            <>
              <button
                onClick={handleRecalculateQuotes}
                disabled={recalculating}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg font-commons text-sm transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
                {recalculating ? 'Hesaplaniyor...' : 'Yeniden Hesapla'}
              </button>
              {recalculateMessage && (
                <span className="font-commons text-sm text-green-600">{recalculateMessage}</span>
              )}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg font-commons text-sm transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Temizle
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-5 border border-neutral-200"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <span className="font-commons text-sm text-neutral-600">Ciro</span>
          </div>
          <p className="font-commons text-2xl font-bold text-[#171717]">
            {formatCurrency(projections.totalRevenue)} TL
          </p>
          <p className="font-commons text-xs text-neutral-500 mt-1">
            Toplam gelir
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-5 border border-neutral-200 cursor-pointer hover:border-red-300 hover:shadow-md transition-all"
          onClick={() => setShowCostBreakdown(true)}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-red-600" />
            </div>
            <span className="font-commons text-sm text-neutral-600">Maliyet</span>
            <ChevronDown className="w-4 h-4 text-neutral-400 ml-auto" />
          </div>
          <p className="font-commons text-2xl font-bold text-red-600">
            -{formatCurrency(projections.totalCost)} TL
          </p>
          <p className="font-commons text-xs text-neutral-500 mt-1">
            Detay icin tikla
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-5 border border-neutral-200"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <span className="font-commons text-sm text-neutral-600">Brut Kar</span>
          </div>
          <p className="font-commons text-2xl font-bold text-[#171717]">
            {formatCurrency(projections.grossProfit)} TL
          </p>
          <p className="font-commons text-xs text-neutral-500 mt-1">
            Ciro - Maliyet
          </p>
        </motion.div>
      </div>

      {/* Second Row - Tax & Net Profit */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-5 border border-neutral-200"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-purple-600" />
            </div>
            <span className="font-commons text-sm text-neutral-600">Gelir Vergisi</span>
          </div>
          <p className="font-commons text-2xl font-bold text-purple-600">
            -{formatCurrency(projections.projectedTax)} TL
          </p>
          <p className="font-commons text-xs text-neutral-500 mt-1">
            %{(projections.taxResult.effectiveRate * 100).toFixed(1)} efektif oran
          </p>
        </motion.div>

        {/* Non-deductible costs card */}
        {projections.nonDeductibleProjected > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-xl p-5 border border-orange-200 bg-orange-50 cursor-pointer hover:border-orange-400 hover:shadow-md transition-all"
            onClick={() => setShowNonDeductibleBreakdown(true)}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Flag className="w-5 h-5 text-orange-600" />
              </div>
              <span className="font-commons text-sm text-orange-700">Faturasız Giderler</span>
              <ChevronDown className="w-4 h-4 text-orange-400 ml-auto" />
            </div>
            <p className="font-commons text-2xl font-bold text-orange-600">
              {formatCurrency(projections.nonDeductibleProjected)} TL
            </p>
            <p className="font-commons text-xs text-orange-600 mt-1">
              Detay icin tikla
            </p>
          </motion.div>
        )}

        {/* Freelancer costs card */}
        {projections.totalFreelancerCost > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            className="bg-white rounded-xl p-5 border border-cyan-200 bg-cyan-50"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-cyan-600" />
              </div>
              <span className="font-commons text-sm text-cyan-700">Freelancer Ödemeleri</span>
            </div>
            <p className="font-commons text-2xl font-bold text-cyan-700">
              {formatCurrency(projections.totalFreelancerCost)} TL
            </p>
            <p className="font-commons text-xs text-cyan-600 mt-1">
              Aylik {formatCurrency(projections.monthlyFreelancerCost)} TL
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl p-5 border border-green-200 bg-green-50"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <span className="font-commons text-sm text-green-700">Gercek Net Kar</span>
          </div>
          <p className="font-commons text-2xl font-bold text-green-700">
            {formatCurrency(projections.realNetProfit)} TL
          </p>
          <p className="font-commons text-xs text-green-600 mt-1">
            {projections.taxOnNonDeductible > 0 ? (
              <>Faturasız gider vergisi dahil</>
            ) : (
              <>Vergi sonrasi</>
            )}
          </p>
        </motion.div>
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-2 gap-6">
        {/* One-Time Quotes */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50">
            <h2 className="font-commons text-base font-semibold text-[#171717] flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Tek Seferlik Teklifler
            </h2>
          </div>
          <div className="p-5">
            {projections.oneTimeQuotes.length === 0 ? (
              <p className="font-commons text-sm text-neutral-500 text-center py-4">
                Kabul edilmis tek seferlik teklif yok
              </p>
            ) : (
              <div className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-6 gap-2 pb-2 border-b border-neutral-200">
                  <span className="font-commons text-xs font-medium text-neutral-500">Teklif</span>
                  <span className="font-commons text-xs font-medium text-neutral-500 text-right">Ciro</span>
                  <span className="font-commons text-xs font-medium text-neutral-500 text-right">Maliyet</span>
                  <span className="font-commons text-xs font-medium text-neutral-500 text-right">Kar</span>
                  <span className="font-commons text-xs font-medium text-orange-500 text-right">Faturasız</span>
                  <span></span>
                </div>
                {projections.oneTimeQuotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="grid grid-cols-6 gap-2 py-2 border-b border-neutral-100 last:border-0 group"
                  >
                    <div>
                      <p className="font-commons text-sm font-medium text-[#171717] truncate">
                        {quote.clientName}
                      </p>
                    </div>
                    <p className="font-commons text-sm text-neutral-700 text-right">
                      {formatCurrency(quote.sellPrice || 0)}
                    </p>
                    <p className="font-commons text-sm text-red-600 text-right">
                      -{formatCurrency(quote.rawCost || 0)}
                    </p>
                    <p className="font-commons text-sm font-semibold text-green-600 text-right">
                      {formatCurrency(quote.profit || 0)}
                    </p>
                    <p className="font-commons text-sm text-orange-600 text-right">
                      {quote.nonDeductibleCost ? formatCurrency(quote.nonDeductibleCost) : '-'}
                    </p>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleDeleteQuote(quote.id)}
                        className="p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                        title="Teklifi sil"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {/* Totals */}
                <div className="grid grid-cols-6 gap-2 pt-3 border-t border-neutral-200">
                  <span className="font-commons text-sm font-medium text-neutral-600">Toplam</span>
                  <span className="font-commons text-sm font-bold text-[#171717] text-right">
                    {formatCurrency(projections.oneTimeRevenue)}
                  </span>
                  <span className="font-commons text-sm font-bold text-red-600 text-right">
                    -{formatCurrency(projections.oneTimeCost)}
                  </span>
                  <span className="font-commons text-sm font-bold text-green-600 text-right">
                    {formatCurrency(projections.oneTimeProfit)}
                  </span>
                  <span className="font-commons text-sm font-bold text-orange-600 text-right">
                    {projections.nonDeductibleFromQuotes > 0 ? formatCurrency(projections.nonDeductibleFromQuotes) : '-'}
                  </span>
                  <span></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recurring Quotes */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50">
            <h2 className="font-commons text-base font-semibold text-[#171717] flex items-center gap-2">
              <Repeat className="w-4 h-4" />
              Aylik Duzenli Sozlesmeler ({projectionPeriod} ay)
            </h2>
          </div>
          <div className="p-5">
            {projections.recurringQuotes.length === 0 ? (
              <p className="font-commons text-sm text-neutral-500 text-center py-4">
                Kabul edilmis aylik sozlesme yok
              </p>
            ) : (
              <div className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-6 gap-2 pb-2 border-b border-neutral-200">
                  <span className="font-commons text-xs font-medium text-neutral-500">Sozlesme</span>
                  <span className="font-commons text-xs font-medium text-neutral-500 text-right">Ciro</span>
                  <span className="font-commons text-xs font-medium text-neutral-500 text-right">Maliyet</span>
                  <span className="font-commons text-xs font-medium text-neutral-500 text-right">Kar</span>
                  <span className="font-commons text-xs font-medium text-orange-500 text-right">Faturasız</span>
                  <span></span>
                </div>
                {projections.recurringQuotes.map(({ quote, projectedRevenue, projectedCost, projectedProfit, monthlyRevenue }) => {
                  const projectedNonDeductible = (quote.nonDeductibleCost || 0) * projectionPeriod;
                  return (
                    <div
                      key={quote.id}
                      className="grid grid-cols-6 gap-2 py-2 border-b border-neutral-100 last:border-0 group"
                    >
                      <div>
                        <p className="font-commons text-sm font-medium text-[#171717] truncate">
                          {quote.clientName}
                        </p>
                        <p className="font-commons text-xs text-neutral-500">
                          {formatCurrency(monthlyRevenue)}/ay × {projectionPeriod}
                        </p>
                      </div>
                      <p className="font-commons text-sm text-neutral-700 text-right">
                        {formatCurrency(projectedRevenue)}
                      </p>
                      <p className="font-commons text-sm text-red-600 text-right">
                        -{formatCurrency(projectedCost)}
                      </p>
                      <p className="font-commons text-sm font-semibold text-green-600 text-right">
                        {formatCurrency(projectedProfit)}
                      </p>
                      <p className="font-commons text-sm text-orange-600 text-right">
                        {projectedNonDeductible > 0 ? formatCurrency(projectedNonDeductible) : '-'}
                      </p>
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleDeleteQuote(quote.id)}
                          className="p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                          title="Teklifi sil"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {/* Totals */}
                <div className="grid grid-cols-6 gap-2 pt-3 border-t border-neutral-200">
                  <span className="font-commons text-sm font-medium text-neutral-600">Toplam</span>
                  <span className="font-commons text-sm font-bold text-[#171717] text-right">
                    {formatCurrency(projections.recurringProjectedRevenue)}
                  </span>
                  <span className="font-commons text-sm font-bold text-red-600 text-right">
                    -{formatCurrency(projections.recurringProjectedCost)}
                  </span>
                  <span className="font-commons text-sm font-bold text-green-600 text-right">
                    {formatCurrency(projections.recurringProjectedProfit)}
                  </span>
                  <span className="font-commons text-sm font-bold text-orange-600 text-right">
                    {projections.nonDeductibleFromQuotes > 0 ? formatCurrency(projections.nonDeductibleFromQuotes) : '-'}
                  </span>
                  <span></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tax Calculation Section */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50">
          <h2 className="font-commons text-base font-semibold text-[#171717] flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Gelir Vergisi Hesabi (2025 Dilimleri)
          </h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-8">
            {/* Tax Breakdown */}
            <div>
              <h3 className="font-commons text-sm font-semibold text-neutral-700 mb-4">
                Dilim Bazli Hesaplama
                {projectionPeriod !== 12 && (
                  <span className="font-normal text-neutral-500 ml-2">
                    (Yillik kar: {formatCurrency(projections.annualizedProfit)} TL)
                  </span>
                )}
              </h3>
              <div className="space-y-2">
                {projections.taxResult.breakdown.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-commons text-xs text-neutral-500">
                        {formatCurrency(item.bracket.minIncome)} - {item.bracket.maxIncome ? formatCurrency(item.bracket.maxIncome) : '...'} TL
                      </span>
                      <span className="font-commons text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                        %{Math.round(item.bracket.rate * 100)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-commons text-xs text-neutral-500">
                        {formatCurrency(item.incomeInBracket)} TL
                      </p>
                      <p className="font-commons text-sm font-medium text-[#171717]">
                        {formatCurrency(item.taxInBracket)} TL
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div>
              <h3 className="font-commons text-sm font-semibold text-neutral-700 mb-4">
                {projectionPeriod} Aylik Projeksiyon Ozeti
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <span className="font-commons text-sm text-neutral-600">Toplam Ciro</span>
                  <span className="font-commons text-sm font-medium text-[#171717]">
                    {formatCurrency(projections.totalRevenue)} TL
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="font-commons text-sm text-neutral-600">Toplam Maliyet</span>
                  <span className="font-commons text-sm font-medium text-red-600">
                    -{formatCurrency(projections.totalCost)} TL
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-neutral-100">
                  <span className="font-commons text-sm text-neutral-600">Brut Kar</span>
                  <span className="font-commons text-sm font-medium text-[#171717]">
                    {formatCurrency(projections.grossProfit)} TL
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="font-commons text-sm text-neutral-600">
                    Gelir Vergisi
                    <span className="text-xs text-neutral-400 ml-1">
                      (%{(projections.taxResult.effectiveRate * 100).toFixed(1)} efektif)
                    </span>
                  </span>
                  <span className="font-commons text-sm font-medium text-purple-600">
                    -{formatCurrency(projections.projectedTax)} TL
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-neutral-100">
                  <span className="font-commons text-sm text-neutral-600">Net Kar</span>
                  <span className="font-commons text-sm font-medium text-[#171717]">
                    {formatCurrency(projections.netProfit)} TL
                  </span>
                </div>

                {/* Non-deductible costs section */}
                {projections.nonDeductibleProjected > 0 && (
                  <>
                    <div className="flex items-center justify-between py-2 border-t border-orange-200 bg-orange-50 -mx-2 px-2 rounded">
                      <span className="font-commons text-sm text-orange-700 flex items-center gap-1">
                        <Flag className="w-3 h-3" />
                        Faturasız Giderler
                      </span>
                      <span className="font-commons text-sm font-medium text-orange-600">
                        {formatCurrency(projections.nonDeductibleProjected)} TL
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 -mx-2 px-2 bg-orange-50 rounded">
                      <span className="font-commons text-sm text-orange-700">
                        Ek Vergi
                        <span className="text-xs text-orange-500 ml-1">
                          (%{Math.round(projections.taxResult.marginalRate * 100)} marjinal)
                        </span>
                      </span>
                      <span className="font-commons text-sm font-medium text-orange-600">
                        -{formatCurrency(projections.taxOnNonDeductible)} TL
                      </span>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between py-3 border-t border-neutral-200">
                  <span className="font-commons text-base font-semibold text-[#171717]">
                    Gercek Net Kar
                  </span>
                  <span className="font-commons text-xl font-bold text-green-600">
                    {formatCurrency(projections.realNetProfit)} TL
                  </span>
                </div>
              </div>

              {/* Tax Bracket Info */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="font-commons text-sm text-blue-700">
                  <strong>Marjinal Vergi Orani:</strong> %{Math.round(projections.taxResult.marginalRate * 100)}
                </p>
                <p className="font-commons text-xs text-blue-600 mt-1">
                  Son kazandiginiz lira icin odeyeceginiz vergi orani
                </p>
              </div>

              {/* Non-deductible warning */}
              {projections.nonDeductibleProjected > 0 && (
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Flag className="w-4 h-4 text-orange-600 mt-0.5" />
                    <div>
                      <p className="font-commons text-sm font-medium text-orange-800">
                        Faturasız Gider Uyarısı
                      </p>
                      <p className="font-commons text-xs text-orange-700 mt-1">
                        Aylik <strong>{formatCurrency(projections.nonDeductibleMonthly)} TL</strong> gideriniz faturasız.
                        Bu giderleri gösteremediğiniz için <strong>{formatCurrency(projections.taxOnNonDeductible)} TL</strong> ekstra vergi ödüyorsunuz.
                      </p>
                      <p className="font-commons text-xs text-orange-600 mt-2">
                        Bu giderleri faturalandırabilseydiniz, gerçek net karınız{' '}
                        <strong>{formatCurrency(projections.netProfit)} TL</strong> olacaktı.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Non-Deductible Costs Detail */}
      {nonDeductibleItems.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-orange-200 bg-orange-50">
            <h2 className="font-commons text-base font-semibold text-orange-800 flex items-center gap-2">
              <Flag className="w-4 h-4" />
              Faturasiz Giderler - Vergi Etkisi
            </h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-8">
              {/* Item list */}
              <div>
                <h3 className="font-commons text-sm font-semibold text-neutral-700 mb-4">
                  Gider Kalemleri
                </h3>
                <div className="space-y-2">
                  {nonDeductibleItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-orange-500" />
                        <span className="font-commons text-sm text-neutral-700">
                          {item.name}
                        </span>
                        <span className="text-xs text-neutral-400 bg-neutral-200 px-1.5 py-0.5 rounded">
                          {item.source === 'software' ? 'Yazılım' : item.source === 'overhead' ? 'Genel Gider' : 'Pazarlama'}
                        </span>
                      </div>
                      <span className="font-commons text-sm font-medium text-neutral-700">
                        {formatCurrency(item.monthlyCost)} TL/ay
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2 px-3 border-t border-neutral-200 mt-2">
                    <span className="font-commons text-sm font-medium text-neutral-600">
                      Toplam Aylik
                    </span>
                    <span className="font-commons text-sm font-bold text-orange-600">
                      {formatCurrency(projections.nonDeductibleMonthly)} TL
                    </span>
                  </div>
                </div>
              </div>

              {/* Impact summary */}
              <div>
                <h3 className="font-commons text-sm font-semibold text-neutral-700 mb-4">
                  {projectionPeriod} Aylik Vergi Etkisi
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="font-commons text-sm text-neutral-600">
                      Faturasiz Gider Toplami
                    </span>
                    <span className="font-commons text-sm font-medium text-[#171717]">
                      {formatCurrency(projections.nonDeductibleProjected)} TL
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="font-commons text-sm text-neutral-600">
                      Marjinal Vergi Orani
                    </span>
                    <span className="font-commons text-sm font-medium text-purple-600">
                      %{Math.round(projections.taxResult.marginalRate * 100)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-neutral-200">
                    <span className="font-commons text-sm font-semibold text-red-700">
                      Ekstra Odenen Vergi
                    </span>
                    <span className="font-commons text-lg font-bold text-red-600">
                      {formatCurrency(projections.taxOnNonDeductible)} TL
                    </span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-commons text-sm text-green-700">
                    <strong>Potansiyel Tasarruf:</strong> Bu giderleri faturali hale getirirseniz,
                    yillik <strong>{formatCurrency(projections.taxOnNonDeductible * (12 / projectionPeriod))} TL</strong> vergi tasarrufu saglayabilirsiniz.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cost Breakdown Modal */}
      <AnimatePresence>
        {showCostBreakdown && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={() => setShowCostBreakdown(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-xl"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-red-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-commons text-lg font-semibold text-[#171717]">
                      Maliyet Detayi
                    </h3>
                    <p className="font-commons text-sm text-neutral-500">
                      {projectionPeriod} aylik projeksiyon
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCostBreakdown(false)}
                  className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {/* One-time costs */}
                {projections.oneTimeQuotes.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-commons text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Tek Seferlik Teklifler
                    </h4>
                    <div className="space-y-2">
                      {projections.oneTimeQuotes.map((quote) => (
                        <div
                          key={quote.id}
                          className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg"
                        >
                          <span className="font-commons text-sm text-neutral-700">
                            {quote.clientName}
                          </span>
                          <span className="font-commons text-sm font-medium text-red-600">
                            -{formatCurrency(quote.rawCost || 0)} TL
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-2 px-3 border-t border-neutral-200">
                        <span className="font-commons text-sm font-medium text-neutral-600">
                          Tek Seferlik Toplam
                        </span>
                        <span className="font-commons text-sm font-bold text-red-600">
                          -{formatCurrency(projections.oneTimeCost)} TL
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recurring costs */}
                {projections.recurringQuotes.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-commons text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                      <Repeat className="w-4 h-4" />
                      Aylik Duzenli Sozlesmeler ({projectionPeriod} ay)
                    </h4>
                    <div className="space-y-2">
                      {projections.recurringQuotes.map(({ quote, monthlyCost, projectedCost }) => (
                        <div
                          key={quote.id}
                          className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg"
                        >
                          <div>
                            <span className="font-commons text-sm text-neutral-700">
                              {quote.clientName}
                            </span>
                            <span className="font-commons text-xs text-neutral-500 ml-2">
                              ({formatCurrency(monthlyCost)}/ay × {projectionPeriod})
                            </span>
                          </div>
                          <span className="font-commons text-sm font-medium text-red-600">
                            -{formatCurrency(projectedCost)} TL
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-2 px-3 border-t border-neutral-200">
                        <span className="font-commons text-sm font-medium text-neutral-600">
                          Aylik Duzenli Toplam
                        </span>
                        <span className="font-commons text-sm font-bold text-red-600">
                          -{formatCurrency(projections.recurringProjectedCost)} TL
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Grand Total */}
                <div className="pt-4 border-t border-neutral-200">
                  <div className="flex items-center justify-between py-3 px-4 bg-red-50 rounded-lg">
                    <span className="font-commons text-base font-semibold text-[#171717]">
                      Toplam Maliyet
                    </span>
                    <span className="font-commons text-xl font-bold text-red-600">
                      -{formatCurrency(projections.totalCost)} TL
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Non-Deductible Breakdown Modal */}
      <AnimatePresence>
        {showNonDeductibleBreakdown && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={() => setShowNonDeductibleBreakdown(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-xl"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-orange-200 flex items-center justify-between bg-orange-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Flag className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-commons text-lg font-semibold text-[#171717]">
                      Faturasız Giderler Detayı
                    </h3>
                    <p className="font-commons text-sm text-neutral-500">
                      {projectionPeriod} aylık projeksiyon
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNonDeductibleBreakdown(false)}
                  className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {/* Global Non-Deductible Items (Software, Overhead, Marketing) */}
                {nonDeductibleItems.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-commons text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Sabit Giderler (Yazılım, Genel Gider, Pazarlama)
                    </h4>
                    <div className="space-y-2">
                      {nonDeductibleItems.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-commons text-sm text-neutral-700">
                              {item.name}
                            </span>
                            <span className="text-xs text-neutral-400 bg-neutral-200 px-1.5 py-0.5 rounded">
                              {item.source === 'software' ? 'Yazılım' : item.source === 'overhead' ? 'Genel Gider' : 'Pazarlama'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-commons text-sm font-medium text-orange-600">
                              {formatCurrency(item.monthlyCost * projectionPeriod)} TL
                            </span>
                            <span className="font-commons text-xs text-neutral-400 ml-2">
                              ({formatCurrency(item.monthlyCost)}/ay)
                            </span>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-2 px-3 border-t border-neutral-200">
                        <span className="font-commons text-sm font-medium text-neutral-600">
                          Sabit Giderler Toplamı
                        </span>
                        <span className="font-commons text-sm font-bold text-orange-600">
                          {formatCurrency(projections.nonDeductibleFromSettings)} TL
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Non-Deductible from Quotes */}
                {projections.nonDeductibleFromQuotes > 0 && (
                  <div className="mb-6">
                    <h4 className="font-commons text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Tekliflerden Gelen Faturasız Giderler
                    </h4>
                    <div className="space-y-2">
                      {/* One-time quotes with non-deductible */}
                      {projections.oneTimeQuotes
                        .filter(q => q.nonDeductibleCost && q.nonDeductibleCost > 0)
                        .map((quote) => (
                          <div
                            key={quote.id}
                            className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-commons text-sm text-neutral-700">
                                {quote.clientName}
                              </span>
                              <span className="text-xs text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded">
                                Tek Seferlik
                              </span>
                            </div>
                            <span className="font-commons text-sm font-medium text-orange-600">
                              {formatCurrency(quote.nonDeductibleCost || 0)} TL
                            </span>
                          </div>
                        ))}

                      {/* Recurring quotes with non-deductible */}
                      {projections.recurringQuotes
                        .filter(r => r.quote.nonDeductibleCost && r.quote.nonDeductibleCost > 0)
                        .map(({ quote }) => (
                          <div
                            key={quote.id}
                            className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-commons text-sm text-neutral-700">
                                {quote.clientName}
                              </span>
                              <span className="text-xs text-purple-500 bg-purple-100 px-1.5 py-0.5 rounded">
                                Aylık × {projectionPeriod}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-commons text-sm font-medium text-orange-600">
                                {formatCurrency((quote.nonDeductibleCost || 0) * projectionPeriod)} TL
                              </span>
                              <span className="font-commons text-xs text-neutral-400 ml-2">
                                ({formatCurrency(quote.nonDeductibleCost || 0)}/ay)
                              </span>
                            </div>
                          </div>
                        ))}

                      <div className="flex items-center justify-between py-2 px-3 border-t border-neutral-200">
                        <span className="font-commons text-sm font-medium text-neutral-600">
                          Tekliflerden Toplam
                        </span>
                        <span className="font-commons text-sm font-bold text-orange-600">
                          {formatCurrency(projections.nonDeductibleFromQuotes)} TL
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tax Impact Summary */}
                <div className="pt-4 border-t border-neutral-200">
                  <h4 className="font-commons text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    Vergi Etkisi Özeti
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 px-4 bg-orange-50 rounded-lg">
                      <span className="font-commons text-sm text-orange-700">
                        Toplam Faturasız Gider
                      </span>
                      <span className="font-commons text-lg font-bold text-orange-600">
                        {formatCurrency(projections.nonDeductibleProjected)} TL
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2 px-4">
                      <span className="font-commons text-sm text-neutral-600">
                        Marjinal Vergi Oranı
                      </span>
                      <span className="font-commons text-sm font-medium text-purple-600">
                        %{Math.round(projections.taxResult.marginalRate * 100)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-3 px-4 bg-red-50 rounded-lg">
                      <span className="font-commons text-sm font-semibold text-red-700">
                        Ekstra Ödenen Vergi
                      </span>
                      <span className="font-commons text-xl font-bold text-red-600">
                        {formatCurrency(projections.taxOnNonDeductible)} TL
                      </span>
                    </div>

                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="font-commons text-sm text-green-700">
                        <strong>Potansiyel Tasarruf:</strong> Bu giderleri faturalı hale getirirseniz,
                        yıllık <strong>{formatCurrency(projections.taxOnNonDeductible * (12 / projectionPeriod))} TL</strong> vergi tasarrufu sağlayabilirsiniz.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-commons text-lg font-semibold text-[#171717]">
                    Tum Teklifleri Sil
                  </h3>
                  <p className="font-commons text-sm text-neutral-500">
                    {quotes.length} teklif silinecek
                  </p>
                </div>
              </div>

              <p className="font-commons text-sm text-neutral-600 mb-6">
                Tum teklifler kalici olarak silinecek. Bu islem geri alinamaz.
                Silme isleminden sonra Hizmet Katalogundan tekrar teklif ekleyebilirsin.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg font-commons text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
                >
                  Iptal
                </button>
                <button
                  onClick={handleDeleteAllQuotes}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg font-commons text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Siliniyor...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Tum Teklifleri Sil
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectionsPage;
