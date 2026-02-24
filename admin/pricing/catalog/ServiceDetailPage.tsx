import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit, Trash2, Loader2, Zap, FileCheck } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { db } from '@/lib/firebase/config';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import type {
  ServiceTemplate,
  ServiceCostResult,
  QuickQuoteResult,
  StaffMember,
  Equipment,
} from '@/shared/types/pricing';
import {
  SERVICE_CATEGORY_LABELS,
  formatCurrency,
} from '@/shared/types/pricing';
import { ServiceCatalogEngine, getOrCalculateFixedCostsSummary, getPricingConfig } from '@/shared/services/pricing';
import CostBreakdownTable from './components/CostBreakdownTable';
import QuickQuoteModal from './components/QuickQuoteModal';

const ServiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [template, setTemplate] = useState<ServiceTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Calculation
  const [engine] = useState(() => new ServiceCatalogEngine());
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [costResult, setCostResult] = useState<ServiceCostResult | null>(null);

  // Quantity state for editable components
  const [componentQuantities, setComponentQuantities] = useState<Record<string, number>>({});

  // Quick quote
  const [quickQuoteOpen, setQuickQuoteOpen] = useState(false);
  const [quickQuoteResult, setQuickQuoteResult] = useState<any>(null);

  // Save state
  const [savingQuote, setSavingQuote] = useState(false);

  // Fetch template and rates
  useEffect(() => {
    const fetchData = async () => {
      if (!db || !id) {
        setError('Gecersiz ID');
        setLoading(false);
        return;
      }

      try {
        // Fetch template
        const templateDoc = await getDoc(doc(db, 'pricing', 'data', 'serviceCatalog', id));
        if (!templateDoc.exists()) {
          setError('Servis bulunamadi');
          setLoading(false);
          return;
        }

        const templateData = { ...templateDoc.data(), id: templateDoc.id } as ServiceTemplate;
        setTemplate(templateData);

        // Initialize quantities from template defaults
        const initialQuantities: Record<string, number> = {};
        templateData.components.forEach((comp) => {
          initialQuantities[comp.id] = comp.baseQuantity ?? 1;
        });
        setComponentQuantities(initialQuantities);

        // Fetch staff and equipment for rate calculation
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

        // Build live rates - get actual costs from Firestore
        const [fixedCostsSummary, pricingConfig] = await Promise.all([
          getOrCalculateFixedCostsSummary(db, true),
          getPricingConfig(db),
        ]);
        const dailyShopCost = fixedCostsSummary.dailyShopCost;
        const hourlyShopCost = fixedCostsSummary.hourlyShopCost;

        engine.buildLiveRates(staff, equipment, dailyShopCost, hourlyShopCost, undefined, pricingConfig.overheadRate ?? 0.30);
        setRatesLoaded(true);
      } catch (err) {
        console.error('Error fetching service:', err);
        setError('Veri yuklenirken hata olustu');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, engine]);

  // Recalculate when quantities change
  useEffect(() => {
    if (!template || !ratesLoaded) return;

    try {
      const result = engine.calculateServiceCost(template, componentQuantities);
      setCostResult(result);
    } catch (err) {
      console.error('Error calculating cost:', err);
    }
  }, [template, ratesLoaded, componentQuantities, engine]);

  // Handle delete
  const handleDelete = async () => {
    if (!db || !id) return;

    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'pricing', 'data', 'serviceCatalog', id));
      navigate('/admin/pricing/catalog');
    } catch (err) {
      console.error('Error deleting service:', err);
      setError('Silme sirasinda hata olustu');
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  // Quick quote handlers
  const handleOpenQuickQuote = useCallback(() => {
    if (!template || !ratesLoaded) return;

    const result = engine.calculateQuickQuote(template, {
      templateId: template.id,
      quantity: template.quickQuoteDefaults?.quantity || 1,
    });
    setQuickQuoteResult(result);
    setQuickQuoteOpen(true);
  }, [template, ratesLoaded, engine]);

  const handleQuickQuoteQuantityChange = useCallback(
    (quantity: number) => {
      if (!template || !ratesLoaded) return;

      const result = engine.calculateQuickQuote(template, {
        templateId: template.id,
        quantity,
      });
      setQuickQuoteResult(result);
    },
    [template, ratesLoaded, engine]
  );

  // Teklif olarak kaydet (detay sayfasindan)
  const handleSaveAsQuote = useCallback(async () => {
    if (!db || !template || !costResult) return;

    setSavingQuote(true);
    try {
      const now = Timestamp.now();
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + 30);

      const serviceLines = costResult.components.map((comp) => ({
        name: comp.componentName,
        componentId: comp.componentId,
        quantity: comp.quantity,
        unitCost: comp.unitCost,
        totalCost: comp.totalCost,
        laborCost: comp.laborCost,
        equipmentCost: comp.equipmentCost,
        overheadCost: comp.overheadCost,
        manualCost: comp.manualCost,
      }));

      const externalCost = costResult.employeeLaborCost + costResult.equipmentCost +
        costResult.overheadCost + costResult.autoOverheadCost + costResult.manualCost;
      const totalProfit = costResult.ownerLaborCost + costResult.profit;

      await addDoc(collection(db, 'quotes'), {
        templateId: template.id,
        serviceName: template.name,
        serviceDescription: template.description,
        serviceCategory: template.category,
        clientName: template.name,
        projectTitle: template.shortDescription || template.name,
        items: [],
        serviceLines,
        totalLaborCost: costResult.employeeLaborCost,
        totalEquipmentCost: costResult.equipmentCost,
        totalFixedCostAllocation: costResult.autoOverheadCost,
        additionalExpenses: 0,
        subtotal: externalCost,
        discountAmount: 0,
        targetMarginPercent: costResult.margin,
        safetyBufferPercent: 0,
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
        actualMarginPercent: costResult.suggestedPrice > 0 ? totalProfit / costResult.suggestedPrice : 0,
        totalEstimatedHours: costResult.estimatedHours,
        totalEstimatedDays: costResult.estimatedDays,
        status: 'draft',
        validUntil: Timestamp.fromDate(validUntilDate),
        billingType: 'one_time',
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
        createdByName: 'Sistem',
      });

      navigate('/admin/pricing/proposals');
    } catch (err) {
      console.error('Error saving quote:', err);
    } finally {
      setSavingQuote(false);
    }
  }, [template, costResult, navigate]);

  // QuickQuote'dan teklif olarak kaydet
  const handleQuickQuoteSave = useCallback(async (
    tmpl: ServiceTemplate,
    result: QuickQuoteResult,
    quantity: number,
  ) => {
    if (!db) return;

    const now = Timestamp.now();
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + 30);

    const breakdown = result.breakdown;

    const serviceLines = breakdown.components.map((comp) => ({
      name: comp.componentName,
      componentId: comp.componentId,
      quantity: comp.quantity,
      unitCost: comp.unitCost,
      totalCost: comp.totalCost,
      laborCost: comp.laborCost,
      equipmentCost: comp.equipmentCost,
      overheadCost: comp.overheadCost,
      manualCost: comp.manualCost,
    }));

    const externalCost = breakdown.employeeLaborCost + breakdown.equipmentCost +
      breakdown.overheadCost + breakdown.autoOverheadCost + breakdown.manualCost;

    await addDoc(collection(db, 'quotes'), {
      templateId: tmpl.id,
      serviceName: tmpl.name,
      serviceDescription: tmpl.description,
      serviceCategory: tmpl.category,
      clientName: tmpl.name,
      projectTitle: `${tmpl.name} (${quantity} ${tmpl.components.find(c => c.unitLabel)?.unitLabel || 'adet'})`,
      items: [],
      serviceLines,
      totalLaborCost: breakdown.employeeLaborCost,
      totalEquipmentCost: breakdown.equipmentCost,
      totalFixedCostAllocation: breakdown.autoOverheadCost,
      additionalExpenses: 0,
      subtotal: externalCost,
      discountAmount: 0,
      targetMarginPercent: breakdown.margin,
      safetyBufferPercent: 0,
      rawCost: externalCost,
      sellPrice: breakdown.suggestedPrice,
      profit: breakdown.ownerLaborCost + breakdown.profit,
      ownerLaborCost: breakdown.ownerLaborCost,
      employeeLaborCost: breakdown.employeeLaborCost,
      freelancerCost: breakdown.freelancerCost,
      equipmentCost: breakdown.equipmentCost,
      overheadCost: breakdown.overheadCost + breakdown.autoOverheadCost,
      manualCost: breakdown.manualCost,
      nonDeductibleCost: breakdown.nonDeductibleCost,
      actualMarginPercent: breakdown.suggestedPrice > 0
        ? (breakdown.ownerLaborCost + breakdown.profit) / breakdown.suggestedPrice
        : 0,
      totalEstimatedHours: breakdown.estimatedHours,
      totalEstimatedDays: breakdown.estimatedDays,
      status: 'draft',
      validUntil: Timestamp.fromDate(validUntilDate),
      billingType: 'one_time',
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      createdByName: 'Sistem',
    });

    setQuickQuoteOpen(false);
    navigate('/admin/pricing/proposals');
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-commons mb-4">{error || 'Servis bulunamadi'}</p>
        <button
          onClick={() => navigate('/admin/pricing/catalog')}
          className="text-indigo-500 hover:text-indigo-600 font-commons text-sm"
        >
          Kataloga don
        </button>
      </div>
    );
  }

  const IconComponent = template.icon
    ? (LucideIcons as Record<string, React.FC<{ className?: string }>>)[template.icon] ||
      LucideIcons.FileText
    : LucideIcons.FileText;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/admin/pricing/catalog')}
          className="inline-flex items-center gap-2 text-neutral-600 hover:text-neutral-800 font-commons text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Kataloga Don
        </button>

        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => navigate(`/admin/pricing/catalog/${id}/edit`)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-neutral-200 text-neutral-700 rounded-lg font-commons text-sm hover:bg-neutral-50 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Edit className="w-4 h-4" />
            Duzenle
          </motion.button>

          {deleteConfirm ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-2 bg-red-500 text-white rounded-lg font-commons text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Siliniyor...' : 'Onayla'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-3 py-2 bg-neutral-200 text-neutral-700 rounded-lg font-commons text-sm hover:bg-neutral-300 transition-colors"
              >
                Iptal
              </button>
            </div>
          ) : (
            <motion.button
              onClick={() => setDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg font-commons text-sm hover:bg-red-50 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Trash2 className="w-4 h-4" />
              Sil
            </motion.button>
          )}
        </div>
      </div>

      {/* Service Info */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{ backgroundColor: template.color || '#DDD6FE' }}
      >
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/80 flex items-center justify-center">
            <IconComponent className="w-7 h-7 text-[#171717]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-commons text-2xl font-bold text-[#171717]">
                {template.name}
              </h1>
              {template.isPopular && (
                <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-xs font-medium rounded-full">
                  Populer
                </span>
              )}
            </div>
            <p className="font-commons text-sm text-[#171717]/70 mb-2">
              {SERVICE_CATEGORY_LABELS[template.category]}
            </p>
            <p className="font-commons text-sm text-[#171717]/80">{template.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={handleOpenQuickQuote}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#171717] rounded-lg font-commons text-sm font-medium hover:bg-white/80 transition-colors shadow-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Zap className="w-4 h-4" />
              Hizli Teklif
            </motion.button>
            <motion.button
              onClick={handleSaveAsQuote}
              disabled={savingQuote || !costResult}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-commons text-sm font-medium hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {savingQuote ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileCheck className="w-4 h-4" />
              )}
              Teklif Olustur
            </motion.button>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="mb-6">
        <h2 className="font-commons text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Maliyet Dokumu
        </h2>
        {costResult ? (
          <CostBreakdownTable result={costResult} showDetails />
        ) : (
          <div className="bg-white/50 rounded-xl p-8 text-center text-neutral-400">
            Hesaplaniyor...
          </div>
        )}
      </div>

      {/* Quick Quote Modal */}
      {template && (
        <QuickQuoteModal
          isOpen={quickQuoteOpen}
          onClose={() => setQuickQuoteOpen(false)}
          template={template}
          quoteResult={quickQuoteResult}
          onQuantityChange={handleQuickQuoteQuantityChange}
          onSaveAsQuote={handleQuickQuoteSave}
        />
      )}
    </div>
  );
};

export default ServiceDetailPage;
