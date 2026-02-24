import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CostSummaryCards from './components/CostSummaryCards';
import CostTable, { Column } from './components/CostTable';
import CategoryPickerCell from './components/CategoryPickerCell';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, setDoc, addDoc, Timestamp } from 'firebase/firestore';
import type { OverheadCost, CostStatus, RentTaxType, PriceEntryType, ServiceCategory } from '@/shared/types/pricing';
import {
  DEFAULT_PRICING_CONFIG,
  RENT_TAX_TYPE_LABELS,
  PRICE_ENTRY_TYPE_LABELS,
  DEFAULT_STOPAJ_RATE,
  DEFAULT_KDV_RATE,
} from '@/shared/types/pricing';

const WORKING_DAYS = DEFAULT_PRICING_CONFIG.workingDaysPerMonth;

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Aylik',
  quarterly: 'Ceyreklik',
  yearly: 'Yillik',
  'one-time': 'Tek Seferlik',
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// ========================================
// Vergi Hesaplama Fonksiyonlari
// ========================================

interface TaxCalculationResult {
  baseCost: number;       // Net tutar
  grossAmount: number;    // Brut tutar (stopaj dahil)
  stopajAmount: number;   // Stopaj tutari
  kdvAmount: number;      // KDV tutari
  totalCost: number;      // Toplam maliyet
}

/**
 * Girilen tutardan tum vergi degerlerini hesaplar
 *
 * Giris tipleri:
 * - net: Vergi haric net tutar girildi
 * - kdv_included: KDV dahil tutar girildi
 * - gross: Brut tutar (stopaj dahil) girildi
 * - total: Tum vergiler dahil toplam girildi
 */
const calculateAllTaxValues = (
  enteredAmount: number,
  priceEntryType: PriceEntryType,
  taxType: RentTaxType,
  stopajRate: number = DEFAULT_STOPAJ_RATE,
  kdvRate: number = DEFAULT_KDV_RATE
): TaxCalculationResult => {
  if (enteredAmount <= 0) {
    return { baseCost: 0, grossAmount: 0, stopajAmount: 0, kdvAmount: 0, totalCost: 0 };
  }

  let baseCost = 0;      // Net tutar
  let grossAmount = 0;   // Brut (stopaj sonrasi)
  let stopajAmount = 0;
  let kdvAmount = 0;
  let totalCost = 0;

  const hasStopaj = taxType === 'stopaj' || taxType === 'both';
  const hasKdv = taxType === 'kdv' || taxType === 'both';

  // 1. Oncelikle net tutari bul (giris tipine gore)
  switch (priceEntryType) {
    case 'net':
      // Net tutar girildi
      baseCost = enteredAmount;
      break;

    case 'kdv_included':
      // KDV dahil tutar girildi -> KDV'yi cikar
      if (hasKdv) {
        // KDV dahil tutar / (1 + KDV orani) = KDV haric tutar
        const amountWithoutKdv = enteredAmount / (1 + kdvRate);
        if (hasStopaj) {
          // Bu brut tutar, neti bulmak icin stopaj oranini uygula
          grossAmount = amountWithoutKdv;
          baseCost = grossAmount * (1 - stopajRate);
        } else {
          baseCost = amountWithoutKdv;
        }
      } else {
        baseCost = enteredAmount;
      }
      break;

    case 'gross':
      // Brut tutar (stopaj dahil) girildi
      if (hasStopaj) {
        grossAmount = enteredAmount;
        baseCost = grossAmount * (1 - stopajRate);
      } else {
        baseCost = enteredAmount;
      }
      break;

    case 'total':
      // Toplam tutar (tum vergiler dahil) girildi -> geriye dogru hesapla
      if (hasKdv && hasStopaj) {
        // Toplam = Brut * (1 + KDV)
        // Brut = Net / (1 - Stopaj)
        // Toplam = Net / (1 - Stopaj) * (1 + KDV)
        // Net = Toplam * (1 - Stopaj) / (1 + KDV)
        grossAmount = enteredAmount / (1 + kdvRate);
        baseCost = grossAmount * (1 - stopajRate);
      } else if (hasKdv) {
        baseCost = enteredAmount / (1 + kdvRate);
      } else if (hasStopaj) {
        grossAmount = enteredAmount;
        baseCost = grossAmount * (1 - stopajRate);
      } else {
        baseCost = enteredAmount;
      }
      break;
  }

  // 2. Net tutardan tum degerleri hesapla
  if (hasStopaj) {
    // Brut = Net / (1 - Stopaj orani)
    grossAmount = baseCost / (1 - stopajRate);
    stopajAmount = grossAmount - baseCost;
  } else {
    grossAmount = baseCost;
  }

  if (hasKdv) {
    kdvAmount = grossAmount * kdvRate;
    totalCost = grossAmount + kdvAmount;
  } else {
    totalCost = grossAmount;
  }

  return {
    baseCost: Number(baseCost.toFixed(2)),
    grossAmount: Number(grossAmount.toFixed(2)),
    stopajAmount: Number(stopajAmount.toFixed(2)),
    kdvAmount: Number(kdvAmount.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),
  };
};

const OfficeCostsPage: React.FC = () => {
  const [data, setData] = useState<OverheadCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch data from Firestore
  useEffect(() => {
    const fetchData = async () => {
      if (!db) {
        setError('Firebase baglantisi bulunamadi');
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDocs(collection(db, 'pricing', 'data', 'overhead'));
        const items: OverheadCost[] = snapshot.docs.map((docSnap) => {
          const docData = docSnap.data() as OverheadCost;
          // Set defaults for new fields if not present
          const taxType = (docData.taxType || 'none') as RentTaxType;
          const priceEntryType = (docData.priceEntryType || 'net') as PriceEntryType;
          const stopajRate = docData.stopajRate ?? DEFAULT_STOPAJ_RATE;
          const kdvRate = docData.kdvRate ?? DEFAULT_KDV_RATE;
          const enteredAmount = docData.enteredAmount ?? docData.baseCost ?? docData.monthlyCost ?? 0;

          // Recalculate all values
          const calculated = calculateAllTaxValues(enteredAmount, priceEntryType, taxType, stopajRate, kdvRate);

          return {
            ...docData,
            id: docSnap.id,
            taxType,
            priceEntryType,
            stopajRate,
            kdvRate,
            enteredAmount,
            baseCost: calculated.baseCost,
            calculatedStopaj: calculated.stopajAmount,
            calculatedKdv: calculated.kdvAmount,
            monthlyCost: calculated.totalCost,
          };
        });
        setData(items.filter(item => item.isActive));
      } catch (err) {
        console.error('Error fetching office costs:', err);
        setError('Veriler yuklenirken hata olustu');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate summary values
  const summary = useMemo(() => {
    const realCosts = data.filter((s) => s.status === 'real');
    const potentialCosts = data.filter((s) => s.status === 'potential');

    const realMonthly = realCosts.reduce((sum, s) => sum + (s.monthlyCost || 0), 0);
    const potentialMonthly = potentialCosts.reduce((sum, s) => sum + (s.monthlyCost || 0), 0);

    return {
      dailyReal: realMonthly / WORKING_DAYS,
      monthlyReal: realMonthly,
      dailyPotential: potentialMonthly / WORKING_DAYS,
      monthlyPotential: potentialMonthly,
    };
  }, [data]);

  // Giris tipi seceneklerini vergi tipine gore filtrele
  const getPriceEntryOptions = (taxType: RentTaxType) => {
    const options = [{ value: 'net', label: 'Net (Vergi Haric)' }];

    if (taxType === 'kdv') {
      options.push({ value: 'kdv_included', label: 'KDV Dahil' });
    } else if (taxType === 'stopaj') {
      options.push({ value: 'gross', label: 'Brut (Stopaj Dahil)' });
    } else if (taxType === 'both') {
      options.push(
        { value: 'kdv_included', label: 'KDV Dahil' },
        { value: 'gross', label: 'Brut (Stopaj Dahil)' },
        { value: 'total', label: 'Toplam (Tum Vergiler)' }
      );
    }

    return options;
  };

  // Column definitions
  const columns: Column<OverheadCost>[] = [
    { key: 'name', label: 'Gider Adi', type: 'text', width: '12%' },
    {
      key: 'taxType',
      label: 'Vergi Tipi',
      type: 'select',
      width: '10%',
      options: Object.entries(RENT_TAX_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      key: 'priceEntryType',
      label: 'Giris Tipi',
      type: 'select',
      width: '12%',
      options: Object.entries(PRICE_ENTRY_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      render: (value, row) => {
        const options = getPriceEntryOptions(row.taxType || 'none');
        const option = options.find(o => o.value === value);
        return option?.label || 'Net';
      },
    },
    { key: 'enteredAmount', label: 'Girilen Tutar', type: 'currency', width: '10%' },
    { key: 'baseCost', label: 'Net Tutar', type: 'currency', width: '10%', editable: false },
    {
      key: 'calculatedStopaj',
      label: 'Stopaj',
      type: 'currency',
      width: '8%',
      editable: false,
      render: (value, row) => {
        if (row.taxType === 'stopaj' || row.taxType === 'both') {
          return `${formatCurrency(value as number || 0)} TL`;
        }
        return '-';
      },
    },
    {
      key: 'calculatedKdv',
      label: 'KDV',
      type: 'currency',
      width: '8%',
      editable: false,
      render: (value, row) => {
        if (row.taxType === 'kdv' || row.taxType === 'both') {
          return `${formatCurrency(value as number || 0)} TL`;
        }
        return '-';
      },
    },
    { key: 'monthlyCost', label: 'Toplam Maliyet', type: 'currency', width: '10%', editable: false },
    {
      key: 'frequency',
      label: 'Frekans',
      type: 'select',
      width: '8%',
      options: Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      key: 'isDeductible',
      label: 'Gider',
      type: 'boolean',
      width: '6%',
    },
    { key: 'status', label: 'Durum', type: 'status', width: '6%' },
    {
      key: 'applyToCategories',
      label: 'Hizmet Kapsamı',
      type: 'text',
      editable: false,
      width: '12%',
      render: (value, row) => (
        <CategoryPickerCell
          value={value as ServiceCategory[] | null}
          onChange={(cats) => handleUpdate(row.id, 'applyToCategories' as keyof OverheadCost, cats)}
        />
      ),
    },
  ];

  // Handle add new row
  const handleAdd = async () => {
    if (!db) return;

    const newItem: Omit<OverheadCost, 'id'> = {
      name: 'Yeni Gider',
      category: 'office',
      description: '',
      enteredAmount: 0,
      baseCost: 0,
      monthlyCost: 0,
      frequency: 'monthly',
      taxType: 'none' as RentTaxType,
      priceEntryType: 'net' as PriceEntryType,
      stopajRate: DEFAULT_STOPAJ_RATE,
      kdvRate: DEFAULT_KDV_RATE,
      calculatedStopaj: 0,
      calculatedKdv: 0,
      isDeductible: true, // Varsayılan: gider gösterilebilir
      status: 'real' as CostStatus,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    try {
      const docRef = await addDoc(collection(db, 'pricing', 'data', 'overhead'), newItem);
      setData((prev) => [...prev, { ...newItem, id: docRef.id }]);
    } catch (err) {
      console.error('Error adding office cost:', err);
      setError('Ekleme sirasinda hata olustu');
    }
  };

  // Handle update
  const handleUpdate = async (id: string, field: keyof OverheadCost, value: unknown) => {
    if (!db) return;

    const currentItem = data.find((d) => d.id === id);
    if (!currentItem) return;

    let processedValue = value;

    // Process stopajRate and kdvRate from percentage input
    if (field === 'stopajRate' || field === 'kdvRate') {
      const numValue = Number(value);
      // If value > 1, assume it's a percentage (e.g., 20 means 20%)
      processedValue = numValue > 1 ? numValue / 100 : numValue;
    }

    // Get current/new values for calculation
    const enteredAmount = field === 'enteredAmount' ? Number(processedValue) : (currentItem.enteredAmount ?? currentItem.baseCost ?? 0);
    const priceEntryType = field === 'priceEntryType' ? (processedValue as PriceEntryType) : (currentItem.priceEntryType || 'net');
    const taxType = field === 'taxType' ? (processedValue as RentTaxType) : (currentItem.taxType || 'none');
    const stopajRate = field === 'stopajRate' ? Number(processedValue) : (currentItem.stopajRate ?? DEFAULT_STOPAJ_RATE);
    const kdvRate = field === 'kdvRate' ? Number(processedValue) : (currentItem.kdvRate ?? DEFAULT_KDV_RATE);

    // If taxType changes to 'none', reset priceEntryType to 'net'
    const finalPriceEntryType = (field === 'taxType' && processedValue === 'none') ? 'net' : priceEntryType;

    // Calculate all values
    const calculated = calculateAllTaxValues(enteredAmount, finalPriceEntryType, taxType, stopajRate, kdvRate);

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
      [field]: processedValue,
      enteredAmount,
      baseCost: calculated.baseCost,
      calculatedStopaj: calculated.stopajAmount,
      calculatedKdv: calculated.kdvAmount,
      monthlyCost: calculated.totalCost,
    };

    // Reset priceEntryType if taxType changed to none
    if (field === 'taxType' && processedValue === 'none') {
      updateData.priceEntryType = 'net';
    }

    try {
      await setDoc(doc(db, 'pricing', 'data', 'overhead', id), updateData, { merge: true });

      setData((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            [field]: processedValue,
            enteredAmount,
            priceEntryType: field === 'taxType' && processedValue === 'none' ? 'net' : (field === 'priceEntryType' ? processedValue as PriceEntryType : item.priceEntryType),
            baseCost: calculated.baseCost,
            calculatedStopaj: calculated.stopajAmount,
            calculatedKdv: calculated.kdvAmount,
            monthlyCost: calculated.totalCost,
          };
        })
      );

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('Error updating office cost:', err);
      setError('Guncelleme sirasinda hata olustu');
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!db) return;

    try {
      await setDoc(doc(db, 'pricing', 'data', 'overhead', id), { isActive: false }, { merge: true });
      setData((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Error deleting office cost:', err);
      setError('Silme sirasinda hata olustu');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-commons text-2xl md:text-3xl font-bold text-[#171717] pb-2 border-b-2 border-indigo-500 inline-block">
            Sabit Giderler
          </h1>
        </div>

        {/* Summary Cards */}
        <CostSummaryCards
          cards={[
            { label: 'Gunluk Reel Ofis Gideri', value: summary.dailyReal },
            { label: 'Aylik Reel Ofis Gideri', value: summary.monthlyReal },
            { label: 'Gunluk Potansiyel Ofis Gideri', value: summary.dailyPotential },
            { label: 'Aylik Potansiyel Ofis Gideri', value: summary.monthlyPotential },
          ]}
        />

        {/* Section Title */}
        <h2 className="font-commons text-xl font-bold text-[#171717] mb-4">
          Ofis Giderleri
        </h2>

        {/* Table */}
        <div className="bg-white/50 rounded-xl overflow-hidden shadow-sm">
          <CostTable
            columns={columns}
            data={data}
            onAdd={handleAdd}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        </div>

        {/* Error/Success Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed bottom-6 right-6 bg-red-500 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3"
            >
              <span className="font-commons text-sm">{error}</span>
              <button onClick={() => setError(null)} className="text-white/70 hover:text-white">
                &times;
              </button>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed bottom-6 right-6 bg-green-500 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3"
            >
              <Save className="w-5 h-5" />
              <span className="font-commons text-sm">Kaydedildi!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
};

export default OfficeCostsPage;
