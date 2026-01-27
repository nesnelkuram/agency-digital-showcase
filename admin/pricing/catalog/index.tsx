import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Loader2, Filter, Search, FileCheck, Copy } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import {
  collection,
  getDocs,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import type {
  ServiceTemplate,
  ServiceCostResult,
  QuickQuoteResult,
  ServiceCategory,
  StaffMember,
  Equipment,
  BillingType,
  BillingPeriod,
} from '@/shared/types/pricing';
import {
  SERVICE_CATEGORY_LABELS,
  SAMPLE_REELS_TEMPLATE,
  SAMPLE_CEKIM_GUNU_TEMPLATE,
  formatCurrency,
} from '@/shared/types/pricing';
import { ServiceCatalogEngine, getOrCalculateFixedCostsSummary } from '@/shared/services/pricing';
import ServiceCard from './components/ServiceCard';
import QuickQuoteModal from './components/QuickQuoteModal';

const CatalogPage: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick quote state
  const [quickQuoteTemplate, setQuickQuoteTemplate] = useState<ServiceTemplate | null>(null);
  const [quickQuoteResult, setQuickQuoteResult] = useState<QuickQuoteResult | null>(null);

  // Save as quote state
  const [saveQuoteTemplate, setSaveQuoteTemplate] = useState<ServiceTemplate | null>(null);
  const [quoteBillingType, setQuoteBillingType] = useState<BillingType>('one_time');
  const [quoteBillingPeriod, setQuoteBillingPeriod] = useState<BillingPeriod>(12);
  const [savingQuote, setSavingQuote] = useState(false);

  // Cost results for cards
  const [costResults, setCostResults] = useState<Record<string, ServiceCostResult>>({});

  // Calculation engine
  const [engine] = useState(() => new ServiceCatalogEngine());
  const [ratesLoaded, setRatesLoaded] = useState(false);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!db) {
        setError('Firebase baglantisi bulunamadi');
        setLoading(false);
        return;
      }

      try {
        // Fetch templates
        const templatesSnapshot = await getDocs(
          collection(db, 'pricing', 'data', 'serviceCatalog')
        );
        let fetchedTemplates: ServiceTemplate[] = templatesSnapshot.docs.map((doc) => ({
          ...(doc.data() as ServiceTemplate),
          id: doc.id,
        }));

        // If no templates exist, add sample templates
        if (fetchedTemplates.length === 0) {
          const reelsDoc = await addDoc(
            collection(db, 'pricing', 'data', 'serviceCatalog'),
            {
              ...SAMPLE_REELS_TEMPLATE,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            }
          );
          const cekimDoc = await addDoc(
            collection(db, 'pricing', 'data', 'serviceCatalog'),
            {
              ...SAMPLE_CEKIM_GUNU_TEMPLATE,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            }
          );

          fetchedTemplates = [
            { ...SAMPLE_REELS_TEMPLATE, id: reelsDoc.id } as ServiceTemplate,
            { ...SAMPLE_CEKIM_GUNU_TEMPLATE, id: cekimDoc.id } as ServiceTemplate,
          ];
        }

        setTemplates(fetchedTemplates.filter((t) => t.isActive));

        // Fetch staff and equipment for rate calculation
        const [staffSnapshot, equipmentSnapshot] = await Promise.all([
          getDocs(collection(db, 'pricing', 'data', 'staff')),
          getDocs(collection(db, 'pricing', 'data', 'equipment')),
        ]);

        const staff: StaffMember[] = staffSnapshot.docs.map((doc) => ({
          ...(doc.data() as StaffMember),
          id: doc.id,
        }));

        const equipment: Equipment[] = equipmentSnapshot.docs.map((doc) => ({
          ...(doc.data() as Equipment),
          id: doc.id,
        }));

        // Build live rates - get actual costs from Firestore
        const fixedCostsSummary = await getOrCalculateFixedCostsSummary(db, true);
        const dailyShopCost = fixedCostsSummary.dailyShopCost;
        const hourlyShopCost = fixedCostsSummary.hourlyShopCost;

        engine.buildLiveRates(staff, equipment, dailyShopCost, hourlyShopCost);
        setRatesLoaded(true);
      } catch (err) {
        console.error('Error fetching catalog data:', err);
        setError('Veriler yuklenirken hata olustu');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [engine]);

  // Calculate costs for all templates when rates are loaded
  useEffect(() => {
    if (!ratesLoaded || templates.length === 0) return;

    const results: Record<string, ServiceCostResult> = {};
    templates.forEach((template) => {
      try {
        const result = engine.calculateServiceCost(template);
        results[template.id] = result;
      } catch (err) {
        console.error(`Error calculating cost for ${template.name}:`, err);
      }
    });

    setCostResults(results);
  }, [ratesLoaded, templates, engine]);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      // Category filter
      if (selectedCategory !== 'all' && t.category !== selectedCategory) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(query)))
        );
      }
      return true;
    });
  }, [templates, selectedCategory, searchQuery]);

  // Quick quote handlers
  const handleQuickQuote = useCallback((template: ServiceTemplate) => {
    setQuickQuoteTemplate(template);
    // Calculate initial quote
    if (ratesLoaded) {
      try {
        const result = engine.calculateQuickQuote(template, {
          templateId: template.id,
          quantity: template.quickQuoteDefaults?.quantity || 1,
        });
        setQuickQuoteResult(result);
      } catch (err) {
        console.error('Error calculating quick quote:', err);
      }
    }
  }, [engine, ratesLoaded]);

  const handleQuickQuoteQuantityChange = useCallback(
    (quantity: number) => {
      if (!quickQuoteTemplate || !ratesLoaded) return;

      try {
        const result = engine.calculateQuickQuote(quickQuoteTemplate, {
          templateId: quickQuoteTemplate.id,
          quantity,
        });
        setQuickQuoteResult(result);
      } catch (err) {
        console.error('Error calculating quick quote:', err);
      }
    },
    [quickQuoteTemplate, engine, ratesLoaded]
  );

  const closeQuickQuote = useCallback(() => {
    setQuickQuoteTemplate(null);
    setQuickQuoteResult(null);
  }, []);

  // Save as quote handler
  const handleSaveAsQuote = useCallback(async () => {
    if (!db || !saveQuoteTemplate) return;

    const costResult = costResults[saveQuoteTemplate.id];
    if (!costResult) return;

    setSavingQuote(true);

    try {
      const now = Timestamp.now();
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + 30);

      // Dış Maliyet = Çalışan İşçilik + Ekipman + Overhead (Başkan Payı HARİÇ)
      const externalCost = costResult.employeeLaborCost + costResult.equipmentCost + costResult.overheadCost + costResult.autoOverheadCost + costResult.manualCost;
      // Toplam Kar = Başkan Payı + Marj Karı
      const totalProfit = costResult.ownerLaborCost + costResult.profit;

      const quoteData = {
        templateId: saveQuoteTemplate.id, // Yeniden hesaplama için şablon ID
        serviceName: saveQuoteTemplate.name, // Görüntüleme için
        clientName: saveQuoteTemplate.name,
        projectTitle: saveQuoteTemplate.shortDescription || saveQuoteTemplate.name,
        items: [],
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
        ownerLaborCost: costResult.ownerLaborCost, // Maliyet detayları
        employeeLaborCost: costResult.employeeLaborCost,
        equipmentCost: costResult.equipmentCost,
        overheadCost: costResult.overheadCost + costResult.autoOverheadCost,
        manualCost: costResult.manualCost,
        actualMarginPercent: costResult.suggestedPrice > 0 ? totalProfit / costResult.suggestedPrice : 0,
        totalEstimatedHours: costResult.estimatedHours,
        totalEstimatedDays: costResult.estimatedDays,
        status: 'accepted' as const,
        validUntil: Timestamp.fromDate(validUntilDate),
        billingType: quoteBillingType,
        billingPeriodMonths: quoteBillingType === 'recurring' ? quoteBillingPeriod : undefined,
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
        createdByName: 'Sistem',
      };

      await addDoc(collection(db, 'quotes'), quoteData);
      setSaveQuoteTemplate(null);
      navigate('/admin/pricing/projections');
    } catch (err) {
      console.error('Error saving quote:', err);
    } finally {
      setSavingQuote(false);
    }
  }, [saveQuoteTemplate, costResults, quoteBillingType, quoteBillingPeriod, navigate]);

  // Copy template
  const handleCopyTemplate = useCallback(async (template: ServiceTemplate) => {
    if (!db) return;

    try {
      const now = Timestamp.now();
      // Create a copy with modified name
      const { id, ...templateData } = template;
      const copyData = {
        ...templateData,
        name: `${template.name} (Kopya)`,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(
        collection(db, 'pricing', 'data', 'serviceCatalog'),
        copyData
      );

      // Navigate to edit the new copy
      navigate(`/admin/pricing/catalog/${docRef.id}`);
    } catch (err) {
      console.error('Error copying template:', err);
    }
  }, [navigate]);

  // Add new template
  const handleAddTemplate = () => {
    navigate('/admin/pricing/catalog/new');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500 font-commons">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-commons text-2xl md:text-3xl font-bold text-[#171717] pb-2 border-b-2 border-indigo-500 inline-block">
            Hizmet Katalogu
          </h1>
          <p className="font-commons text-sm text-neutral-500 mt-2">
            Servis sablonlari ve fiyatlandirma
          </p>
        </div>
        <motion.button
          onClick={handleAddTemplate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg font-commons text-sm font-medium hover:bg-indigo-600 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="w-4 h-4" />
          Yeni Servis
        </motion.button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Servis ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          <Filter className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full font-commons text-sm whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-indigo-500 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            Tumu
          </button>
          {(Object.entries(SERVICE_CATEGORY_LABELS) as [ServiceCategory, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-3 py-1.5 rounded-full font-commons text-sm whitespace-nowrap transition-colors ${
                  selectedCategory === key
                    ? 'bg-indigo-500 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-commons text-neutral-500">Henuz servis sablonu yok.</p>
          <button
            onClick={handleAddTemplate}
            className="mt-4 inline-flex items-center gap-2 text-indigo-500 hover:text-indigo-600 font-commons text-sm"
          >
            <Plus className="w-4 h-4" />
            Ilk servisi ekle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <ServiceCard
              key={template.id}
              template={template}
              costResult={costResults[template.id]}
              onViewDetail={() => navigate(`/admin/pricing/catalog/${template.id}`)}
              onQuickQuote={() => handleQuickQuote(template)}
              onSaveAsQuote={() => setSaveQuoteTemplate(template)}
              onCopy={() => handleCopyTemplate(template)}
            />
          ))}
        </div>
      )}

      {/* Quick Quote Modal */}
      {quickQuoteTemplate && (
        <QuickQuoteModal
          isOpen={!!quickQuoteTemplate}
          onClose={closeQuickQuote}
          template={quickQuoteTemplate}
          quoteResult={quickQuoteResult}
          onQuantityChange={handleQuickQuoteQuantityChange}
        />
      )}

      {/* Save as Quote Modal */}
      <AnimatePresence>
        {saveQuoteTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={() => setSaveQuoteTemplate(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
            >
              <h3 className="font-commons text-lg font-semibold text-[#171717] mb-2">
                Teklif Olarak Kaydet
              </h3>
              <p className="font-commons text-sm text-neutral-500 mb-4">
                {saveQuoteTemplate.name}
              </p>

              <div className="space-y-4">
                {/* Billing Type */}
                <div>
                  <label className="block font-commons text-sm font-medium text-neutral-600 mb-2">
                    Fatura Turu
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setQuoteBillingType('one_time')}
                      className={`px-4 py-3 rounded-lg text-left transition-all ${
                        quoteBillingType === 'one_time'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      <span className="font-commons text-sm font-medium block">Tek Seferlik</span>
                      <span className={`font-commons text-xs ${quoteBillingType === 'one_time' ? 'text-indigo-200' : 'text-neutral-500'}`}>
                        Tek seferlik proje
                      </span>
                    </button>
                    <button
                      onClick={() => setQuoteBillingType('recurring')}
                      className={`px-4 py-3 rounded-lg text-left transition-all ${
                        quoteBillingType === 'recurring'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      <span className="font-commons text-sm font-medium block">Aylik Duzenli</span>
                      <span className={`font-commons text-xs ${quoteBillingType === 'recurring' ? 'text-indigo-200' : 'text-neutral-500'}`}>
                        Aylik tekrarlayan
                      </span>
                    </button>
                  </div>
                </div>

                {/* Billing Period (only for recurring) */}
                {quoteBillingType === 'recurring' && (
                  <div>
                    <label className="block font-commons text-sm font-medium text-neutral-600 mb-2">
                      Sozlesme Suresi
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {([1, 3, 6, 12] as BillingPeriod[]).map((period) => (
                        <button
                          key={period}
                          onClick={() => setQuoteBillingPeriod(period)}
                          className={`px-3 py-2 rounded-lg font-commons text-sm font-medium transition-all ${
                            quoteBillingPeriod === period
                              ? 'bg-indigo-500 text-white'
                              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                          }`}
                        >
                          {period} Ay
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price Preview */}
                {costResults[saveQuoteTemplate.id] && (
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-commons text-sm text-neutral-600">Teklif Fiyati:</span>
                      <span className="font-commons text-xl font-bold text-[#171717]">
                        {formatCurrency(costResults[saveQuoteTemplate.id].suggestedPrice)} TL
                        {quoteBillingType === 'recurring' && <span className="text-sm font-normal text-neutral-500">/ay</span>}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setSaveQuoteTemplate(null)}
                  className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg font-commons text-sm font-medium hover:bg-neutral-200"
                >
                  Iptal
                </button>
                <motion.button
                  onClick={handleSaveAsQuote}
                  disabled={savingQuote}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-commons text-sm font-medium hover:bg-green-600 disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {savingQuote ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      Kaydet
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CatalogPage;
