import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Save, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CostSummaryCards from './components/CostSummaryCards';
import CostTable, { Column } from './components/CostTable';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, setDoc, addDoc, Timestamp } from 'firebase/firestore';
import type { Equipment, EquipmentCategory, CostStatus } from '@/shared/types/pricing';
import { EQUIPMENT_CATEGORY_LABELS, EQUIPMENT_COST_METHOD_LABELS, DEFAULT_PRICING_CONFIG } from '@/shared/types/pricing';
import { seedRentalEquipment } from '../catalog/seedRentalEquipment';

const WORKING_DAYS = DEFAULT_PRICING_CONFIG.workingDaysPerMonth;

// Extend Equipment with calculated monthly cost
interface EquipmentRow extends Equipment {
  monthlyCost: number;
}

const EquipmentCostsPage: React.FC = () => {
  const [data, setData] = useState<EquipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ added: number; skipped: number } | null>(null);

  // Calculate monthly cost for equipment
  const calculateMonthlyCost = (item: Equipment): number => {
    if (item.costMethod === 'rental_value') {
      return (item.rentalValueDaily || 0) * WORKING_DAYS;
    }
    if (item.usefulLifeMonths && item.usefulLifeMonths > 0) {
      return item.purchasePrice / item.usefulLifeMonths;
    }
    return 0;
  };

  // Fetch data from Firestore
  useEffect(() => {
    const fetchData = async () => {
      if (!db) {
        setError('Firebase baglantisi bulunamadi');
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDocs(collection(db, 'pricing', 'data', 'equipment'));
        const items: EquipmentRow[] = snapshot.docs.map((docSnap) => {
          const docData = docSnap.data() as Equipment;
          return {
            ...docData,
            id: docSnap.id,
            monthlyCost: calculateMonthlyCost(docData),
          };
        });
        setData(items.filter(item => item.isActive));
      } catch (err) {
        console.error('Error fetching equipment:', err);
        setError('Veriler yuklenirken hata olustu');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate summary values
  const summary = useMemo(() => {
    const realItems = data.filter((s) => s.status === 'real');
    const potentialItems = data.filter((s) => s.status === 'potential');

    const realMonthly = realItems.reduce((sum, s) => sum + s.monthlyCost, 0);
    const potentialMonthly = potentialItems.reduce((sum, s) => sum + s.monthlyCost, 0);

    return {
      dailyReal: realMonthly / WORKING_DAYS,
      monthlyReal: realMonthly,
      dailyPotential: potentialMonthly / WORKING_DAYS,
      monthlyPotential: potentialMonthly,
    };
  }, [data]);

  // Column definitions
  const columns: Column<EquipmentRow>[] = [
    { key: 'name', label: 'Ekipman Adi', type: 'text', width: '18%' },
    {
      key: 'category',
      label: 'Kategori',
      type: 'select',
      width: '12%',
      options: Object.entries(EQUIPMENT_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    },
    { key: 'purchasePrice', label: 'Satin Alma', type: 'currency', width: '12%' },
    { key: 'rentalValueDaily', label: 'Gunluk Kiralama', type: 'currency', width: '12%' },
    {
      key: 'costMethod',
      label: 'Yontem',
      type: 'select',
      width: '12%',
      options: Object.entries(EQUIPMENT_COST_METHOD_LABELS).map(([value, label]) => ({ value, label })),
    },
    { key: 'usefulLifeMonths', label: 'Omur (Ay)', type: 'number', width: '10%' },
    {
      key: 'monthlyCost',
      label: 'Aylik Maliyet',
      type: 'currency',
      width: '14%',
      editable: false,
    },
    { key: 'status', label: 'Durum', type: 'status', width: '10%' },
  ];

  // Handle add new row
  const handleAdd = async () => {
    if (!db) return;

    const newItem: Omit<Equipment, 'id'> = {
      name: 'Yeni Ekipman',
      category: 'camera' as EquipmentCategory,
      purchasePrice: 0,
      costMethod: 'depreciation',
      usefulLifeMonths: 36,
      status: 'real' as CostStatus,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    try {
      const docRef = await addDoc(collection(db, 'pricing', 'data', 'equipment'), newItem);
      setData((prev) => [...prev, { ...newItem, id: docRef.id, monthlyCost: 0 }]);
    } catch (err) {
      console.error('Error adding equipment:', err);
      setError('Ekleme sirasinda hata olustu');
    }
  };

  // Handle update
  const handleUpdate = async (id: string, field: keyof EquipmentRow, value: unknown) => {
    if (!db) return;

    const updateData = {
      [field]: value,
      updatedAt: Timestamp.now(),
    };

    try {
      await setDoc(doc(db, 'pricing', 'data', 'equipment', id), updateData, { merge: true });

      setData((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const updated = { ...item, [field]: value };
          updated.monthlyCost = calculateMonthlyCost(updated);
          return updated;
        })
      );

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('Error updating equipment:', err);
      setError('Guncelleme sirasinda hata olustu');
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!db) return;

    try {
      await setDoc(doc(db, 'pricing', 'data', 'equipment', id), { isActive: false }, { merge: true });
      setData((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Error deleting equipment:', err);
      setError('Silme sirasinda hata olustu');
    }
  };

  // Handle seed rental equipment
  const handleSeedRentalEquipment = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const result = await seedRentalEquipment();
      setSeedResult(result);

      // Refresh data after seeding
      if (db && result.added > 0) {
        const snapshot = await getDocs(collection(db, 'pricing', 'data', 'equipment'));
        const items: EquipmentRow[] = snapshot.docs.map((docSnap) => {
          const docData = docSnap.data() as Equipment;
          return {
            ...docData,
            id: docSnap.id,
            monthlyCost: calculateMonthlyCost(docData),
          };
        });
        setData(items.filter(item => item.isActive));
      }
    } catch (err) {
      console.error('Error seeding rental equipment:', err);
      setError('Kiralik ekipman eklenirken hata olustu');
    } finally {
      setSeeding(false);
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-commons text-2xl md:text-3xl font-bold text-[#171717] pb-2 border-b-2 border-indigo-500 inline-block">
            Ekipman Amortismani
          </h1>
          <motion.button
            onClick={handleSeedRentalEquipment}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg font-commons text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {seeding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Ekleniyor...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Kiralik Ekipman Yukle
              </>
            )}
          </motion.button>
        </div>

        {/* Seed Result */}
        {seedResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-indigo-100 text-indigo-700 rounded-lg font-commons text-sm"
          >
            {seedResult.added} yeni ekipman eklendi, {seedResult.skipped} ekipman zaten mevcuttu.
          </motion.div>
        )}

        {/* Summary Cards */}
        <CostSummaryCards
          cards={[
            { label: 'Gunluk Reel Ekipman Maliyeti', value: summary.dailyReal },
            { label: 'Aylik Reel Ekipman Maliyeti', value: summary.monthlyReal },
            { label: 'Gunluk Potansiyel Ekipman Maliyeti', value: summary.dailyPotential },
            { label: 'Aylik Potansiyel Ekipman Maliyeti', value: summary.monthlyPotential },
          ]}
        />

        {/* Section Title */}
        <h2 className="font-commons text-xl font-bold text-[#171717] mb-4">
          Ekipman Listesi
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

export default EquipmentCostsPage;
