import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Flag,
  Copy,
  Calculator,
  Receipt,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { db } from '@/lib/firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  Timestamp,
  getDocs,
} from 'firebase/firestore';
import type {
  ServiceTemplate,
  ServiceComponent,
  CostRef,
  StaffCostRef,
  EquipmentCostRef,
  OverheadCostRef,
  ManualCostRef,
  QuantityTier,
  ComponentType,
  CostSource,
  OverheadAllocationType,
  ServiceCategory,
  StaffMember,
  Equipment,
} from '@/shared/types/pricing';
import {
  SERVICE_CATEGORY_LABELS,
  STAFF_ROLE_LABELS,
  EQUIPMENT_CATEGORY_LABELS,
  COMPONENT_TYPE_LABELS,
  COST_SOURCE_LABELS,
  DEFAULT_QUANTITY_TIERS,
  formatCurrency,
} from '@/shared/types/pricing';
import type { StaffRole, EquipmentCategory, LiveRates, BillingType, BillingPeriod } from '@/shared/types/pricing';
import { ServiceCatalogEngine, getOrCalculateFixedCostsSummary, getPricingConfig } from '@/shared/services/pricing';

// Available icons for selection
const ICON_OPTIONS = [
  'Video', 'Camera', 'Image', 'Film', 'Tv', 'Monitor',
  'Mic', 'Music', 'Headphones', 'Speaker',
  'Palette', 'Brush', 'PenTool', 'Layers',
  'Share2', 'Instagram', 'Youtube', 'MessageCircle',
  'FileText', 'File', 'Folder', 'Package',
  'Zap', 'Star', 'Award', 'Target',
];

// Color options
const COLOR_OPTIONS = [
  '#8B5CF6', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#6366F1', '#EF4444', '#14B8A6',
];

const ServiceEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id && id !== 'new';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAsQuote, setSavingAsQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quote billing options
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteBillingType, setQuoteBillingType] = useState<BillingType>('one_time');
  const [quoteBillingPeriod, setQuoteBillingPeriod] = useState<BillingPeriod>(12);

  // Reference data
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [liveRates, setLiveRates] = useState<LiveRates | null>(null);
  const [engine] = useState(() => new ServiceCatalogEngine());

  // Genel gider oranı: direkt maliyet × bu oran = overhead (Firestore'dan yüklenir)
  const [overheadRate, setOverheadRate] = useState(0.30);

  // Form state
  const [formData, setFormData] = useState<Partial<ServiceTemplate>>({
    name: '',
    description: '',
    shortDescription: '',
    category: 'video_production',
    tags: [],
    components: [],
    minimumPrice: 0,
    defaultMargin: 0.30,
    complexityMultiplier: 1.0,
    allowQuickQuote: true,
    icon: 'Video',
    color: '#8B5CF6',
    isPopular: false,
    isActive: true,
    sortOrder: 1,
    version: 1,
  });

  // UI state
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState('');

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!db) {
        setError('Firebase baglantisi bulunamadi');
        setLoading(false);
        return;
      }

      try {
        // Fetch reference data
        const [staffSnapshot, equipmentSnapshot] = await Promise.all([
          getDocs(collection(db, 'pricing', 'data', 'staff')),
          getDocs(collection(db, 'pricing', 'data', 'equipment')),
        ]);

        const fetchedStaff = staffSnapshot.docs.map((d) => ({ ...d.data(), id: d.id } as StaffMember));
        const fetchedEquipment = equipmentSnapshot.docs
          .map((d) => ({ ...d.data(), id: d.id } as Equipment))
          .filter((e) => e.isActive);

        setStaffMembers(fetchedStaff);
        setEquipment(fetchedEquipment);

        // Genel gider oranını config'den yükle
        const pricingConfig = await getPricingConfig(db);
        setOverheadRate(pricingConfig.overheadRate ?? 0.30);

        // Build live rates for cost display (staff & equipment rates)
        const fixedCostsSummary = await getOrCalculateFixedCostsSummary(db, true);
        const rates = engine.buildLiveRates(fetchedStaff, fetchedEquipment, fixedCostsSummary.dailyShopCost, fixedCostsSummary.hourlyShopCost);
        setLiveRates(rates);

        // Fetch template if editing
        if (isEditing) {
          const templateDoc = await getDoc(doc(db, 'pricing', 'data', 'serviceCatalog', id));
          if (templateDoc.exists()) {
            const data = templateDoc.data() as ServiceTemplate;
            setFormData({ ...data, id: templateDoc.id });
            // Expand all components by default when editing
            setExpandedComponents(new Set(data.components.map((c) => c.id)));
          } else {
            setError('Servis bulunamadi');
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Veri yuklenirken hata olustu');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isEditing, engine]);


  // Handle basic field changes
  const handleFieldChange = useCallback(
    (field: keyof ServiceTemplate, value: unknown) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Handle tag management
  const handleAddTag = useCallback(() => {
    if (tagInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim().toLowerCase()],
      }));
      setTagInput('');
    }
  }, [tagInput]);

  const handleRemoveTag = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      tags: (prev.tags || []).filter((_, i) => i !== index),
    }));
  }, []);

  // Component management
  const handleAddComponent = useCallback(() => {
    const newId = `comp_${Date.now()}`;
    const newComponent: ServiceComponent = {
      id: newId,
      name: 'Yeni Bilesen',
      description: '',
      type: 'fixed',
      costRefs: [],
      isOptional: false,
      isEditable: true,
      sortOrder: (formData.components?.length || 0) + 1,
    };
    setFormData((prev) => ({
      ...prev,
      components: [...(prev.components || []), newComponent],
    }));
    setExpandedComponents((prev) => new Set([...prev, newId]));
  }, [formData.components]);

  const handleUpdateComponent = useCallback(
    (componentId: string, updates: Partial<ServiceComponent>) => {
      setFormData((prev) => ({
        ...prev,
        components: (prev.components || []).map((c) =>
          c.id === componentId ? { ...c, ...updates } : c
        ),
      }));
    },
    []
  );

  const handleRemoveComponent = useCallback((componentId: string) => {
    setFormData((prev) => ({
      ...prev,
      components: (prev.components || []).filter((c) => c.id !== componentId),
    }));
    setExpandedComponents((prev) => {
      const next = new Set(prev);
      next.delete(componentId);
      return next;
    });
  }, []);

  const handleCopyComponent = useCallback((componentId: string) => {
    const componentToCopy = formData.components?.find((c) => c.id === componentId);
    if (!componentToCopy) return;

    const newId = `comp_${Date.now()}`;
    const copiedComponent: ServiceComponent = {
      ...componentToCopy,
      id: newId,
      name: `${componentToCopy.name} (Kopya)`,
      sortOrder: (formData.components?.length || 0) + 1,
      costRefs: componentToCopy.costRefs.map((ref) => ({ ...ref })), // Deep copy cost refs
    };

    setFormData((prev) => ({
      ...prev,
      components: [...(prev.components || []), copiedComponent],
    }));
    setExpandedComponents((prev) => new Set([...prev, newId]));
  }, [formData.components]);

  const toggleComponentExpanded = useCallback((componentId: string) => {
    setExpandedComponents((prev) => {
      const next = new Set(prev);
      if (next.has(componentId)) {
        next.delete(componentId);
      } else {
        next.add(componentId);
      }
      return next;
    });
  }, []);

  // Cost ref management
  const handleAddCostRef = useCallback(
    (componentId: string, source: CostSource) => {
      let newRef: CostRef;
      switch (source) {
        case 'staff':
          newRef = { source: 'staff', roleType: 'junior', timeUnit: 'hours', timeAmount: 1 };
          break;
        case 'equipment':
          newRef = { source: 'equipment', category: 'camera', days: 1 };
          break;
        case 'overhead':
          newRef = { source: 'overhead', allocationType: 'per_day' };
          break;
        case 'manual':
          newRef = { source: 'manual', amount: 0, description: '', isDeductible: true };
          break;
      }
      handleUpdateComponent(componentId, {
        costRefs: [
          ...(formData.components?.find((c) => c.id === componentId)?.costRefs || []),
          newRef,
        ],
      });
    },
    [formData.components, handleUpdateComponent]
  );

  const handleUpdateCostRef = useCallback(
    (componentId: string, refIndex: number, updates: Partial<CostRef>) => {
      const component = formData.components?.find((c) => c.id === componentId);
      if (!component) return;

      const newRefs = [...component.costRefs];
      newRefs[refIndex] = { ...newRefs[refIndex], ...updates } as CostRef;

      handleUpdateComponent(componentId, { costRefs: newRefs });
    },
    [formData.components, handleUpdateComponent]
  );

  const handleRemoveCostRef = useCallback(
    (componentId: string, refIndex: number) => {
      const component = formData.components?.find((c) => c.id === componentId);
      if (!component) return;

      handleUpdateComponent(componentId, {
        costRefs: component.costRefs.filter((_, i) => i !== refIndex),
      });
    },
    [formData.components, handleUpdateComponent]
  );

  const handleCopyCostRef = useCallback(
    (componentId: string, refIndex: number) => {
      const component = formData.components?.find((c) => c.id === componentId);
      if (!component) return;

      const refToCopy = component.costRefs[refIndex];
      const copiedRef = { ...refToCopy };

      handleUpdateComponent(componentId, {
        costRefs: [...component.costRefs, copiedRef],
      });
    },
    [formData.components, handleUpdateComponent]
  );

  // Helper to remove undefined values recursively
  const removeUndefined = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      const value = obj[key];
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? removeUndefined(item as Record<string, unknown>)
            : item
        );
      } else if (typeof value === 'object' && value !== null && !(value instanceof Timestamp)) {
        result[key] = removeUndefined(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  // Save
  const handleSave = async () => {
    if (!db) return;
    if (!formData.name?.trim()) {
      setError('Servis adi gerekli');
      return;
    }
    if (!formData.components?.length) {
      setError('En az bir bilesen ekleyin');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Remove undefined values before saving (Firestore doesn't accept undefined)
      const dataToSave = removeUndefined({
        ...formData,
        updatedAt: Timestamp.now(),
      }) as Record<string, unknown>;

      if (isEditing) {
        await setDoc(doc(db, 'pricing', 'data', 'serviceCatalog', id), dataToSave, {
          merge: true,
        });
      } else {
        await addDoc(collection(db, 'pricing', 'data', 'serviceCatalog'), {
          ...dataToSave,
          createdAt: Timestamp.now(),
        });
      }

      navigate('/admin/pricing/catalog');
    } catch (err) {
      console.error('Error saving service:', err);
      setError('Kaydetme sirasinda hata olustu');
    } finally {
      setSaving(false);
    }
  };

  // Save as Quote
  const handleSaveAsQuote = async () => {
    if (!db || !liveRates) return;
    if (!formData.name?.trim()) {
      setError('Servis adi gerekli');
      return;
    }

    setSavingAsQuote(true);
    setError(null);

    try {
      // Calculate costs - separating owner from employee labor
      let employeeLaborCost = 0;
      let ownerLaborCost = 0;
      let equipmentCost = 0;
      let nonFreelancerHours = 0;

      (formData.components || []).forEach((comp) => {
        comp.costRefs.forEach((ref) => {
          const refCost = calculateCostRefAmount(ref, liveRates);

          if (ref.source === 'staff') {
            const staffRef = ref as StaffCostRef;
            let hours = 0;
            let isOwner = false;

            if (staffRef.timeUnit === 'hours') {
              hours = staffRef.timeAmount;
            } else if (staffRef.timeUnit === 'days') {
              hours = staffRef.timeAmount * 8;
            }

            // Check if owner
            if (staffRef.staffId && liveRates.staffRates[staffRef.staffId]) {
              const role = liveRates.staffRates[staffRef.staffId].role;
              isOwner = role === 'owner';
              if (role !== 'freelancer') {
                nonFreelancerHours += hours;
              }
            } else {
              isOwner = staffRef.roleType === 'owner';
              if (staffRef.roleType !== 'freelancer') {
                nonFreelancerHours += hours;
              }
            }

            if (isOwner) {
              ownerLaborCost += refCost;
            } else {
              employeeLaborCost += refCost;
            }
          } else if (ref.source === 'equipment') {
            equipmentCost += refCost;
          }
        });
      });

      const directCostTotal = employeeLaborCost + equipmentCost + ownerLaborCost;
      const autoOverhead = Math.round(directCostTotal * overheadRate);

      // Dış Maliyet = Çalışan İşçilik + Ekipman + Overhead (Başkan Payı HARİÇ)
      const externalCost = employeeLaborCost + equipmentCost + autoOverhead;

      // Total cost includes owner labor (for pricing calculation)
      const totalCost = externalCost + ownerLaborCost;
      const margin = formData.defaultMargin || 0.3;
      const suggestedPrice = Math.round(totalCost / (1 - margin));
      const marginProfit = suggestedPrice - totalCost;

      // Toplam Kar = Başkan Payı + Marj Karı
      const totalProfit = ownerLaborCost + marginProfit;

      const now = Timestamp.now();
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + 30);

      const quoteData = {
        clientName: formData.name || 'Isimsiz Teklif',
        projectTitle: formData.shortDescription || formData.name || '',
        items: [],
        totalLaborCost: employeeLaborCost,
        totalEquipmentCost: equipmentCost,
        totalFixedCostAllocation: autoOverhead,
        additionalExpenses: 0,
        subtotal: externalCost,
        discountAmount: 0,
        targetMarginPercent: margin,
        safetyBufferPercent: 0,
        rawCost: externalCost,
        sellPrice: suggestedPrice,
        profit: totalProfit,
        actualMarginPercent: suggestedPrice > 0 ? totalProfit / suggestedPrice : 0,
        totalEstimatedHours: nonFreelancerHours,
        totalEstimatedDays: Math.ceil(nonFreelancerHours / 8),
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
      setShowQuoteModal(false);
      navigate('/admin/pricing/projections');
    } catch (err) {
      console.error('Error saving quote:', err);
      setError('Teklif kaydedilirken hata olustu');
    } finally {
      setSavingAsQuote(false);
    }
  };

  // Render loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const IconComponent = formData.icon
    ? (LucideIcons as Record<string, React.FC<{ className?: string }>>)[formData.icon] ||
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

        <div className="flex items-center gap-3">
          <motion.button
            onClick={() => setShowQuoteModal(true)}
            disabled={!formData.components?.length || !liveRates}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-commons text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FileCheck className="w-4 h-4" />
            Teklif Olarak Kaydet
          </motion.button>

          <motion.button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg font-commons text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Kaydet
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Quote Modal */}
      <AnimatePresence>
        {showQuoteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={() => setShowQuoteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
            >
              <h3 className="font-commons text-lg font-semibold text-[#171717] mb-4">
                Teklif Olarak Kaydet
              </h3>

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
                {liveRates && (
                  <div className="p-4 bg-neutral-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-commons text-sm text-neutral-600">Teklif Fiyati:</span>
                      <span className="font-commons text-xl font-bold text-[#171717]">
                        {(() => {
                          let directCost = 0;
                          let nonFreelancerHours = 0;
                          (formData.components || []).forEach((comp) => {
                            comp.costRefs.forEach((ref) => {
                              directCost += calculateCostRefAmount(ref, liveRates);
                              if (ref.source === 'staff') {
                                const staffRef = ref as StaffCostRef;
                                const hours = staffRef.timeUnit === 'hours' ? staffRef.timeAmount : staffRef.timeAmount * 8;
                                if (staffRef.roleType !== 'freelancer') nonFreelancerHours += hours;
                              }
                            });
                          });
                          const autoOverhead = Math.round(directCost * overheadRate);
                          const totalCost = directCost + autoOverhead;
                          const margin = formData.defaultMargin || 0.3;
                          return formatCurrency(Math.round(totalCost / (1 - margin)));
                        })()} TL
                        {quoteBillingType === 'recurring' && <span className="text-sm font-normal text-neutral-500">/ay</span>}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowQuoteModal(false)}
                  className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg font-commons text-sm font-medium hover:bg-neutral-200"
                >
                  Iptal
                </button>
                <motion.button
                  onClick={handleSaveAsQuote}
                  disabled={savingAsQuote}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-commons text-sm font-medium hover:bg-green-600 disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {savingAsQuote ? (
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

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg font-commons text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title */}
      <h1 className="font-commons text-2xl font-bold text-[#171717] mb-6">
        {isEditing ? 'Servisi Duzenle' : 'Yeni Servis Olustur'}
      </h1>

      {/* Basic Info Section */}
      <div className="bg-white/80 rounded-xl p-6 mb-6 border border-neutral-200">
        <h2 className="font-commons text-lg font-semibold text-[#171717] mb-4">
          Temel Bilgiler
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div className="md:col-span-2">
            <label className="block font-commons text-sm font-medium text-neutral-600 mb-1">
              Servis Adi *
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400"
              placeholder="Reels Paketi"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block font-commons text-sm font-medium text-neutral-600 mb-1">
              Kategori
            </label>
            <select
              value={formData.category || 'video_production'}
              onChange={(e) => handleFieldChange('category', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400"
            >
              {Object.entries(SERVICE_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Icon */}
          <div>
            <label className="block font-commons text-sm font-medium text-neutral-600 mb-1">
              Ikon
            </label>
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: formData.color || '#8B5CF6' }}
              >
                <IconComponent className="w-5 h-5 text-white" />
              </div>
              <select
                value={formData.icon || 'Video'}
                onChange={(e) => handleFieldChange('icon', e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400"
              >
                {ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block font-commons text-sm font-medium text-neutral-600 mb-1">
              Renk
            </label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleFieldChange('color', color)}
                  className={`w-8 h-8 rounded-lg transition-transform ${
                    formData.color === color ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Short Description */}
          <div className="md:col-span-2">
            <label className="block font-commons text-sm font-medium text-neutral-600 mb-1">
              Kisa Aciklama
            </label>
            <input
              type="text"
              value={formData.shortDescription || ''}
              onChange={(e) => handleFieldChange('shortDescription', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400"
              placeholder="Katalog karti icin kisa aciklama"
            />
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block font-commons text-sm font-medium text-neutral-600 mb-1">
              Detayli Aciklama
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400 resize-none"
              placeholder="Servisi detayli olarak aciklayin"
            />
          </div>

          {/* Tags */}
          <div className="md:col-span-2">
            <label className="block font-commons text-sm font-medium text-neutral-600 mb-1">
              Etiketler
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(formData.tags || []).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full font-commons text-xs"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(index)}
                    className="hover:text-indigo-900"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400"
                placeholder="Etiket ekle..."
              />
              <button
                onClick={handleAddTag}
                className="px-3 py-2 bg-neutral-100 text-neutral-600 rounded-lg font-commons text-sm hover:bg-neutral-200"
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Components Section */}
      <div className="bg-white/80 rounded-xl p-6 mb-6 border border-neutral-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-commons text-lg font-semibold text-[#171717]">
            Maliyet Bilesenleri
          </h2>
          <motion.button
            onClick={handleAddComponent}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg font-commons text-sm hover:bg-indigo-200 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            Bilesen Ekle
          </motion.button>
        </div>

        {(formData.components || []).length === 0 ? (
          <div className="text-center py-8 text-neutral-400 font-commons text-sm">
            Henuz bilesen yok. Bilesen ekleyerek baslayin.
          </div>
        ) : (
          <div className="space-y-3">
            {(formData.components || []).map((component) => (
              <ComponentEditor
                key={component.id}
                component={component}
                expanded={expandedComponents.has(component.id)}
                onToggle={() => toggleComponentExpanded(component.id)}
                onUpdate={(updates) => handleUpdateComponent(component.id, updates)}
                onRemove={() => handleRemoveComponent(component.id)}
                onCopy={() => handleCopyComponent(component.id)}
                onAddCostRef={(source) => handleAddCostRef(component.id, source)}
                onUpdateCostRef={(index, updates) =>
                  handleUpdateCostRef(component.id, index, updates)
                }
                onRemoveCostRef={(index) => handleRemoveCostRef(component.id, index)}
                onCopyCostRef={(index) => handleCopyCostRef(component.id, index)}
                staffMembers={staffMembers}
                equipment={equipment}
                liveRates={liveRates}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pricing Settings */}
      <div className="bg-white/80 rounded-xl p-6 mb-6 border border-neutral-200">
        <h2 className="font-commons text-lg font-semibold text-[#171717] mb-4">
          Fiyatlandirma Ayarlari
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block font-commons text-sm font-medium text-neutral-600 mb-1">
              Varsayilan Marj (%)
            </label>
            <input
              type="number"
              value={Math.round((formData.defaultMargin || 0.3) * 100)}
              onChange={(e) =>
                handleFieldChange('defaultMargin', parseInt(e.target.value) / 100)
              }
              min={0}
              max={100}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="block font-commons text-sm font-medium text-neutral-600 mb-1">
              Minimum Fiyat (TL)
            </label>
            <input
              type="number"
              value={formData.minimumPrice || 0}
              onChange={(e) => handleFieldChange('minimumPrice', parseInt(e.target.value))}
              min={0}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="block font-commons text-sm font-medium text-neutral-600 mb-1">
              Karmasiklik Carpani
            </label>
            <input
              type="number"
              value={formData.complexityMultiplier || 1}
              onChange={(e) =>
                handleFieldChange('complexityMultiplier', parseFloat(e.target.value))
              }
              min={0.5}
              max={3}
              step={0.1}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-4">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.allowQuickQuote || false}
              onChange={(e) => handleFieldChange('allowQuickQuote', e.target.checked)}
              className="w-4 h-4 rounded border-neutral-300 text-indigo-500 focus:ring-indigo-500"
            />
            <span className="font-commons text-sm text-neutral-700">Hizli Teklif Aktif</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isPopular || false}
              onChange={(e) => handleFieldChange('isPopular', e.target.checked)}
              className="w-4 h-4 rounded border-neutral-300 text-indigo-500 focus:ring-indigo-500"
            />
            <span className="font-commons text-sm text-neutral-700">Populer Servis</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive !== false}
              onChange={(e) => handleFieldChange('isActive', e.target.checked)}
              className="w-4 h-4 rounded border-neutral-300 text-indigo-500 focus:ring-indigo-500"
            />
            <span className="font-commons text-sm text-neutral-700">Aktif</span>
          </label>
        </div>
      </div>

      {/* Cost Summary */}
      {liveRates && (formData.components?.length || 0) > 0 && (
        <>
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
            <h2 className="font-commons text-lg font-semibold mb-4">Maliyet Ozeti</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                // Calculate direct costs
                let directCost = 0;
                let nonFreelancerHours = 0;

                (formData.components || []).forEach((comp) => {
                  comp.costRefs.forEach((ref) => {
                    directCost += calculateCostRefAmount(ref, liveRates);

                    // Calculate non-freelancer hours for auto overhead
                    if (ref.source === 'staff') {
                      const staffRef = ref as StaffCostRef;
                      let hours = 0;

                      if (staffRef.timeUnit === 'hours') {
                        hours = staffRef.timeAmount;
                      } else if (staffRef.timeUnit === 'days') {
                        hours = staffRef.timeAmount * 8; // 8 hours per day
                      }

                      // Check if freelancer
                      if (staffRef.staffId && liveRates.staffRates[staffRef.staffId]) {
                        const role = liveRates.staffRates[staffRef.staffId].role;
                        if (role !== 'freelancer') {
                          nonFreelancerHours += hours;
                        }
                      } else if (staffRef.roleType !== 'freelancer') {
                        nonFreelancerHours += hours;
                      }
                    }
                  });
                });

                // Calculate auto overhead: non-freelancer hours × hourly shop cost
                const autoOverhead = Math.round(directCost * overheadRate);
                const totalCost = directCost + autoOverhead;
                const margin = formData.defaultMargin || 0.3;
                const suggestedPrice = totalCost / (1 - margin);
                const profit = suggestedPrice - totalCost;

                return (
                  <>
                    <div>
                      <p className="text-white/70 text-xs font-commons mb-1">Direkt Maliyet</p>
                      <p className="text-2xl font-bold font-commons">{formatCurrency(directCost)} TL</p>
                    </div>
                    <div>
                      <p className="text-white/70 text-xs font-commons mb-1">
                        Genel Gider
                        <span className="text-white/50 text-[10px] block">
                          (%{Math.round(overheadRate * 100)} × direkt maliyet)
                        </span>
                      </p>
                      <p className="text-2xl font-bold font-commons">{formatCurrency(autoOverhead)} TL</p>
                    </div>
                    <div>
                      <p className="text-white/70 text-xs font-commons mb-1">Toplam Maliyet</p>
                      <p className="text-2xl font-bold font-commons">{formatCurrency(totalCost)} TL</p>
                    </div>
                    <div>
                      <p className="text-white/70 text-xs font-commons mb-1">Onerilen Fiyat (%{Math.round(margin * 100)} marj)</p>
                      <p className="text-2xl font-bold font-commons">{formatCurrency(suggestedPrice)} TL</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Vergi Etkisi Bildirimi */}
          {(() => {
            // isDeductible: false olan manual cost ref'leri hesapla
            let nonDeductibleCost = 0;
            (formData.components || []).forEach((comp) => {
              comp.costRefs.forEach((ref) => {
                if (ref.source === 'manual') {
                  const manualRef = ref as ManualCostRef;
                  if (manualRef.isDeductible === false) {
                    nonDeductibleCost += manualRef.amount || 0;
                  }
                }
              });
            });

            if (nonDeductibleCost <= 0) return null;

            // Vergi hesaplama - varsayılan %27 marjinal vergi oranı
            const TAX_RATE = 0.27;
            const taxOnNonDeductible = nonDeductibleCost * TAX_RATE;

            // Toplam maliyet ve kar hesabı
            let directCost = 0;
            let nonFreelancerHours = 0;
            (formData.components || []).forEach((comp) => {
              comp.costRefs.forEach((ref) => {
                directCost += calculateCostRefAmount(ref, liveRates);
                if (ref.source === 'staff') {
                  const staffRef = ref as StaffCostRef;
                  const hours = staffRef.timeUnit === 'hours' ? staffRef.timeAmount : staffRef.timeAmount * 8;
                  if (staffRef.roleType !== 'freelancer') nonFreelancerHours += hours;
                }
              });
            });
            const autoOverhead = Math.round(directCost * overheadRate);
            const totalCost = directCost + autoOverhead;
            const margin = formData.defaultMargin || 0.3;
            const suggestedPrice = totalCost / (1 - margin);
            const profit = suggestedPrice - totalCost;
            const realProfit = profit - taxOnNonDeductible;

            return (
              <motion.div
                className="mt-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Flag className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-commons text-sm font-semibold text-orange-800 mb-3">
                      Vergi Etkisi Bildirimi
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-white/60 rounded-lg p-2.5">
                        <div className="flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-orange-500" />
                          <span className="font-commons text-xs text-neutral-700">
                            Gider olarak gösterilemeyen maliyet
                          </span>
                        </div>
                        <span className="font-commons text-sm font-semibold text-orange-700">
                          {formatCurrency(nonDeductibleCost)} TL
                        </span>
                      </div>

                      <p className="font-commons text-xs text-orange-700 leading-relaxed">
                        Bu maliyetler faturasız olduğu için gider olarak gösteremiyorsunuz.
                        Dolayısıyla bu işten <strong>{formatCurrency(profit)} TL</strong> geliriniz var gibi görünüyor.
                      </p>

                      <div className="flex items-center justify-between bg-white/60 rounded-lg p-2.5">
                        <div className="flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-orange-500" />
                          <span className="font-commons text-xs text-neutral-700">
                            Bu giderler üzerinden ödeyeceğiniz vergi (~%{Math.round(TAX_RATE * 100)})
                          </span>
                        </div>
                        <span className="font-commons text-sm font-semibold text-red-600">
                          -{formatCurrency(taxOnNonDeductible)} TL
                        </span>
                      </div>

                      <div className="border-t border-orange-200 pt-2 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-commons text-xs font-medium text-orange-800">
                            Gerçek Net Kar
                          </span>
                          <span className={`font-commons text-lg font-bold ${
                            realProfit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(realProfit)} TL
                          </span>
                        </div>
                        <p className="font-commons text-[10px] text-orange-600 mt-1">
                          Bu giderleri faturalandırabilseydiniz, karınız <strong>{formatCurrency(profit)} TL</strong> olacaktı.
                          Şu an <strong>{formatCurrency(taxOnNonDeductible)} TL</strong> vergi kaybınız var.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </>
      )}
    </div>
  );
};

// Calculate cost for a single CostRef
function calculateCostRefAmount(ref: CostRef, liveRates: LiveRates | null): number {
  if (!liveRates) return 0;

  switch (ref.source) {
    case 'staff': {
      const staffRef = ref as StaffCostRef;
      // Use specific staff rate if staffId is provided, otherwise use role average
      let hourlyRate: number;
      let dailyRate: number;

      if (staffRef.staffId && liveRates.staffRates[staffRef.staffId]) {
        const specificRate = liveRates.staffRates[staffRef.staffId];
        hourlyRate = specificRate.hourlyRate;
        dailyRate = specificRate.dailyRate;
      } else {
        const roleRate = liveRates.roleRates[staffRef.roleType];
        if (!roleRate) return 0;
        hourlyRate = roleRate.hourlyRate;
        dailyRate = roleRate.dailyRate;
      }

      if (staffRef.timeUnit === 'hours') {
        return hourlyRate * staffRef.timeAmount;
      } else {
        return dailyRate * staffRef.timeAmount;
      }
    }
    case 'equipment': {
      const equipRef = ref as EquipmentCostRef;
      // Use specific equipment rate if equipmentId is provided, otherwise use category average
      let dailyRate: number;

      if (equipRef.equipmentId && liveRates.equipmentRates[equipRef.equipmentId]) {
        dailyRate = liveRates.equipmentRates[equipRef.equipmentId].dailyRate;
      } else {
        const categoryRate = liveRates.categoryRates[equipRef.category];
        if (!categoryRate) return 0;
        dailyRate = categoryRate.dailyRate;
      }

      return dailyRate * equipRef.days;
    }
    case 'overhead': {
      const overheadRef = ref as OverheadCostRef;
      if (overheadRef.allocationType === 'per_month') {
        return liveRates.overhead.monthlyShopCost;
      } else if (overheadRef.allocationType === 'per_day') {
        return liveRates.overhead.dailyShopCost;
      } else if (overheadRef.allocationType === 'per_hour') {
        return liveRates.overhead.hourlyShopCost;
      } else if (overheadRef.allocationType === 'fixed') {
        return overheadRef.amount || 0;
      }
      return 0;
    }
    case 'manual': {
      const manualRef = ref as ManualCostRef;
      return manualRef.amount || 0;
    }
    default:
      return 0;
  }
}

// Component Editor
interface ComponentEditorProps {
  component: ServiceComponent;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<ServiceComponent>) => void;
  onRemove: () => void;
  onCopy: () => void;
  onAddCostRef: (source: CostSource) => void;
  onUpdateCostRef: (index: number, updates: Partial<CostRef>) => void;
  onRemoveCostRef: (index: number) => void;
  onCopyCostRef: (index: number) => void;
  staffMembers: StaffMember[];
  equipment: Equipment[];
  liveRates: LiveRates | null;
}

const ComponentEditor: React.FC<ComponentEditorProps> = ({
  component,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
  onCopy,
  onAddCostRef,
  onUpdateCostRef,
  onRemoveCostRef,
  onCopyCostRef,
  staffMembers,
  equipment,
  liveRates,
}) => {
  // Calculate total component cost
  const componentTotal = component.costRefs.reduce(
    (sum, ref) => sum + calculateCostRefAmount(ref, liveRates),
    0
  );
  return (
    <div className="border border-neutral-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 bg-neutral-50 cursor-pointer hover:bg-neutral-100 transition-colors"
        onClick={onToggle}
      >
        <GripVertical className="w-4 h-4 text-neutral-400" />
        <div className="flex-1">
          <span className="font-commons text-sm font-medium text-[#171717]">
            {component.name}
          </span>
          <span className="ml-2 text-xs text-neutral-500">
            ({COMPONENT_TYPE_LABELS[component.type]})
          </span>
        </div>
        <span className="text-xs text-neutral-400">
          {component.costRefs.length} maliyet kaynagi
        </span>
        {componentTotal > 0 && (
          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-commons font-semibold">
            {formatCurrency(componentTotal)} TL
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          className="p-1 text-indigo-400 hover:text-indigo-600"
          title="Bileşeni Kopyala"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 text-red-400 hover:text-red-600"
          title="Bileşeni Sil"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-neutral-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-neutral-400" />
        )}
      </div>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-commons text-xs font-medium text-neutral-500 mb-1">
                    Bilesen Adi
                  </label>
                  <input
                    type="text"
                    value={component.name}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    className="w-full px-2 py-1.5 rounded border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block font-commons text-xs font-medium text-neutral-500 mb-1">
                    Tip
                  </label>
                  <select
                    value={component.type}
                    onChange={(e) => onUpdate({ type: e.target.value as ComponentType })}
                    className="w-full px-2 py-1.5 rounded border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400"
                  >
                    {Object.entries(COMPONENT_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-commons text-xs font-medium text-neutral-500 mb-1">
                    Birim Etiketi
                  </label>
                  <input
                    type="text"
                    value={component.unitLabel || ''}
                    onChange={(e) => onUpdate({ unitLabel: e.target.value })}
                    placeholder="Reels, Gun, Dakika"
                    className="w-full px-2 py-1.5 rounded border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              {/* Options */}
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={component.isOptional}
                    onChange={(e) => onUpdate({ isOptional: e.target.checked })}
                    className="w-4 h-4 rounded border-neutral-300 text-indigo-500"
                  />
                  <span className="font-commons text-xs text-neutral-600">Opsiyonel</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={component.isEditable}
                    onChange={(e) => onUpdate({ isEditable: e.target.checked })}
                    className="w-4 h-4 rounded border-neutral-300 text-indigo-500"
                  />
                  <span className="font-commons text-xs text-neutral-600">
                    Miktar Degistirilebilir
                  </span>
                </label>
                {component.type !== 'fixed' && (
                  <div className="flex items-center gap-2">
                    <label className="font-commons text-xs text-neutral-600">
                      Varsayilan Miktar:
                    </label>
                    <input
                      type="number"
                      value={component.baseQuantity || 1}
                      onChange={(e) => onUpdate({ baseQuantity: parseInt(e.target.value) })}
                      min={1}
                      className="w-16 px-2 py-1 rounded border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                )}
              </div>

              {/* Cost Refs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-commons text-xs font-medium text-neutral-500">
                    Maliyet Kaynaklari
                  </label>
                  <div className="flex gap-1">
                    {(['staff', 'equipment', 'overhead', 'manual'] as CostSource[]).map(
                      (source) => (
                        <button
                          key={source}
                          onClick={() => onAddCostRef(source)}
                          className="px-2 py-1 text-xs bg-neutral-100 text-neutral-600 rounded hover:bg-neutral-200 font-commons"
                        >
                          + {COST_SOURCE_LABELS[source]}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {component.costRefs.length === 0 ? (
                  <div className="text-center py-4 text-neutral-400 font-commons text-xs">
                    Maliyet kaynagi ekleyin
                  </div>
                ) : (
                  <div className="space-y-2">
                    {component.costRefs.map((ref, index) => (
                      <CostRefEditor
                        key={index}
                        costRef={ref}
                        onUpdate={(updates) => onUpdateCostRef(index, updates)}
                        onRemove={() => onRemoveCostRef(index)}
                        onCopy={() => onCopyCostRef(index)}
                        staffMembers={staffMembers}
                        equipment={equipment}
                        liveRates={liveRates}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity Tiers (for tiered type) */}
              {component.type === 'tiered' && (
                <div>
                  <label className="block font-commons text-xs font-medium text-neutral-500 mb-2">
                    Miktar Kademeleri
                  </label>
                  <button
                    onClick={() =>
                      onUpdate({
                        quantityTiers: component.quantityTiers
                          ? undefined
                          : DEFAULT_QUANTITY_TIERS,
                      })
                    }
                    className="text-xs text-indigo-500 hover:text-indigo-600 font-commons"
                  >
                    {component.quantityTiers
                      ? 'Varsayilan Tier Kaldir'
                      : 'Varsayilan Tier Ekle'}
                  </button>
                  {component.quantityTiers && (
                    <div className="mt-2 text-xs text-neutral-500 font-commons">
                      {component.quantityTiers.map((t, i) => (
                        <div key={i}>
                          {t.label}: %{Math.round((1 - t.unitPriceModifier) * 100)} indirim
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Cost Ref Editor
interface CostRefEditorProps {
  costRef: CostRef;
  onUpdate: (updates: Partial<CostRef>) => void;
  onRemove: () => void;
  onCopy: () => void;
  staffMembers: StaffMember[];
  equipment: Equipment[];
  liveRates: LiveRates | null;
}

const CostRefEditor: React.FC<CostRefEditorProps> = ({
  costRef,
  onUpdate,
  onRemove,
  onCopy,
  staffMembers,
  equipment,
  liveRates,
}) => {
  // Calculate cost for this ref
  const refCost = calculateCostRefAmount(costRef, liveRates);
  const renderFields = () => {
    switch (costRef.source) {
      case 'staff': {
        const ref = costRef as StaffCostRef;
        // Filter staff by selected role
        const staffByRole = staffMembers.filter(s => s.role === ref.roleType && s.isActive);
        return (
          <>
            <select
              value={ref.roleType}
              onChange={(e) => onUpdate({ roleType: e.target.value as StaffRole, staffId: undefined })}
              className="px-2 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none focus:border-indigo-400"
            >
              {Object.entries(STAFF_ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            {/* Specific staff selection - especially useful for freelancers */}
            {staffByRole.length > 0 && (
              <select
                value={ref.staffId || ''}
                onChange={(e) => onUpdate({ staffId: e.target.value || undefined })}
                className="px-2 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none focus:border-indigo-400"
              >
                <option value="">Ortalama ({STAFF_ROLE_LABELS[ref.roleType]})</option>
                {staffByRole.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {liveRates?.staffRates[s.id] && ` (${formatCurrency(liveRates.staffRates[s.id].hourlyRate)} TL/saat)`}
                  </option>
                ))}
              </select>
            )}
            <input
              type="number"
              value={ref.timeAmount}
              onChange={(e) => onUpdate({ timeAmount: parseFloat(e.target.value) })}
              min={0.5}
              step={0.5}
              className="w-16 px-2 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none focus:border-indigo-400"
            />
            <select
              value={ref.timeUnit}
              onChange={(e) => onUpdate({ timeUnit: e.target.value as 'hours' | 'days' })}
              className="px-2 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none focus:border-indigo-400"
            >
              <option value="hours">Saat</option>
              <option value="days">Gun</option>
            </select>
          </>
        );
      }
      case 'equipment': {
        const ref = costRef as EquipmentCostRef;
        // Filter equipment by selected category
        const equipmentByCategory = equipment.filter(e => e.category === ref.category && e.isActive);
        return (
          <>
            <select
              value={ref.category}
              onChange={(e) => onUpdate({ category: e.target.value as EquipmentCategory, equipmentId: undefined })}
              className="px-2 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none focus:border-indigo-400"
            >
              {Object.entries(EQUIPMENT_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            {/* Specific equipment selection */}
            {equipmentByCategory.length > 0 && (
              <select
                value={ref.equipmentId || ''}
                onChange={(e) => onUpdate({ equipmentId: e.target.value || undefined })}
                className="px-2 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none focus:border-indigo-400 max-w-[200px]"
              >
                <option value="">Ortalama ({EQUIPMENT_CATEGORY_LABELS[ref.category]})</option>
                {equipmentByCategory.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {liveRates?.equipmentRates[e.id] && ` (${formatCurrency(liveRates.equipmentRates[e.id].dailyRate)} TL/gun)`}
                  </option>
                ))}
              </select>
            )}
            <input
              type="number"
              value={ref.days}
              onChange={(e) => onUpdate({ days: parseInt(e.target.value) })}
              min={1}
              className="w-16 px-2 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none focus:border-indigo-400"
            />
            <span className="font-commons text-xs text-neutral-500">gun</span>
          </>
        );
      }
      case 'overhead': {
        const ref = costRef as OverheadCostRef;
        return (
          <>
            <select
              value={ref.allocationType}
              onChange={(e) =>
                onUpdate({ allocationType: e.target.value as OverheadAllocationType })
              }
              className="px-2 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none focus:border-indigo-400"
            >
              <option value="per_month">Aylik</option>
              <option value="per_day">Gunluk</option>
              <option value="per_hour">Saatlik</option>
              <option value="fixed">Sabit</option>
            </select>
            {ref.allocationType === 'fixed' && (
              <input
                type="number"
                value={ref.amount || 0}
                onChange={(e) => onUpdate({ amount: parseInt(e.target.value) })}
                className="w-20 px-2 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none focus:border-indigo-400"
                placeholder="TL"
              />
            )}
          </>
        );
      }
      case 'manual': {
        const ref = costRef as ManualCostRef;
        const isDeductible = ref.isDeductible !== false; // varsayılan true
        return (
          <>
            <input
              type="number"
              value={ref.amount}
              onChange={(e) => onUpdate({ amount: parseInt(e.target.value) })}
              className="w-20 px-2 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none focus:border-indigo-400"
              placeholder="TL"
            />
            <input
              type="text"
              value={ref.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              className="flex-1 px-2 py-1 rounded border border-neutral-200 font-commons text-xs focus:outline-none focus:border-indigo-400"
              placeholder="Aciklama (Ulasim, Konaklama...)"
            />
            <button
              onClick={() => onUpdate({ isDeductible: !isDeductible })}
              className={`p-1.5 rounded transition-colors ${
                isDeductible
                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                  : 'bg-red-100 text-red-500 hover:bg-red-200'
              }`}
              title={isDeductible ? 'Gider gösterilebilir' : 'Gider gösterilemiyor'}
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          </>
        );
      }
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded">
      <span
        className={`px-2 py-0.5 rounded text-xs font-commons font-medium ${
          costRef.source === 'staff'
            ? 'bg-blue-100 text-blue-700'
            : costRef.source === 'equipment'
            ? 'bg-green-100 text-green-700'
            : costRef.source === 'overhead'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-neutral-200 text-neutral-700'
        }`}
      >
        {COST_SOURCE_LABELS[costRef.source]}
      </span>
      {renderFields()}
      {refCost > 0 && (
        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-commons font-semibold ml-auto">
          {formatCurrency(refCost)} TL
        </span>
      )}
      <button
        onClick={onCopy}
        className="p-1 text-indigo-400 hover:text-indigo-600"
        title="Kopyala"
      >
        <Copy className="w-3 h-3" />
      </button>
      <button onClick={onRemove} className="p-1 text-red-400 hover:text-red-600" title="Sil">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
};

export default ServiceEditorPage;
