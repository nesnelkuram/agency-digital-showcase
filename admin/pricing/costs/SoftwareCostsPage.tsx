import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CostSummaryCards from './components/CostSummaryCards';
import CostTable, { Column } from './components/CostTable';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, setDoc, addDoc, Timestamp } from 'firebase/firestore';
import type { SoftwareSubscription, SoftwareCategory, CostStatus } from '@/shared/types/pricing';
import { SOFTWARE_CATEGORY_LABELS, DEFAULT_PRICING_CONFIG } from '@/shared/types/pricing';

const WORKING_DAYS = DEFAULT_PRICING_CONFIG.workingDaysPerMonth;

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: 'Aylik',
  yearly: 'Yillik',
};

const SoftwareCostsPage: React.FC = () => {
  const [data, setData] = useState<SoftwareSubscription[]>([]);
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
        const snapshot = await getDocs(collection(db, 'pricing', 'data', 'software'));
        const items: SoftwareSubscription[] = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as SoftwareSubscription),
          id: docSnap.id,
        }));
        setData(items.filter(item => item.isActive));
      } catch (err) {
        console.error('Error fetching software:', err);
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

    const realMonthly = realItems.reduce((sum, s) => sum + (s.monthlyCost || 0), 0);
    const potentialMonthly = potentialItems.reduce((sum, s) => sum + (s.monthlyCost || 0), 0);

    return {
      dailyReal: realMonthly / WORKING_DAYS,
      monthlyReal: realMonthly,
      dailyPotential: potentialMonthly / WORKING_DAYS,
      monthlyPotential: potentialMonthly,
    };
  }, [data]);

  // Column definitions
  const columns: Column<SoftwareSubscription>[] = [
    { key: 'name', label: 'Yazilim Adi', type: 'text', width: '25%' },
    {
      key: 'category',
      label: 'Kategori',
      type: 'select',
      width: '15%',
      options: Object.entries(SOFTWARE_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    },
    { key: 'description', label: 'Aciklama', type: 'text', width: '20%' },
    { key: 'monthlyCost', label: 'Aylik Maliyet', type: 'currency', width: '15%' },
    {
      key: 'billingCycle',
      label: 'Odeme Dongu',
      type: 'select',
      width: '10%',
      options: Object.entries(BILLING_CYCLE_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      key: 'isDeductible',
      label: 'Gider',
      type: 'boolean',
      width: '8%',
    },
    { key: 'status', label: 'Durum', type: 'status', width: '10%' },
  ];

  // Handle add new row
  const handleAdd = async () => {
    if (!db) return;

    const newItem: Omit<SoftwareSubscription, 'id'> = {
      name: 'Yeni Yazilim',
      category: 'design' as SoftwareCategory,
      description: '',
      monthlyCost: 0,
      billingCycle: 'monthly',
      isDeductible: true, // Varsayılan: gider gösterilebilir
      status: 'real' as CostStatus,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    try {
      const docRef = await addDoc(collection(db, 'pricing', 'data', 'software'), newItem);
      setData((prev) => [...prev, { ...newItem, id: docRef.id }]);
    } catch (err) {
      console.error('Error adding software:', err);
      setError('Ekleme sirasinda hata olustu');
    }
  };

  // Handle update
  const handleUpdate = async (id: string, field: keyof SoftwareSubscription, value: unknown) => {
    if (!db) return;

    const updateData = {
      [field]: value,
      updatedAt: Timestamp.now(),
    };

    try {
      await setDoc(doc(db, 'pricing', 'data', 'software', id), updateData, { merge: true });

      setData((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        )
      );

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('Error updating software:', err);
      setError('Guncelleme sirasinda hata olustu');
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!db) return;

    try {
      await setDoc(doc(db, 'pricing', 'data', 'software', id), { isActive: false }, { merge: true });
      setData((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Error deleting software:', err);
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
            Yazilim Lisanslari
          </h1>
        </div>

        {/* Summary Cards */}
        <CostSummaryCards
          cards={[
            { label: 'Gunluk Reel Yazilim Maliyeti', value: summary.dailyReal },
            { label: 'Aylik Reel Yazilim Maliyeti', value: summary.monthlyReal },
            { label: 'Gunluk Potansiyel Yazilim Maliyeti', value: summary.dailyPotential },
            { label: 'Aylik Potansiyel Yazilim Maliyeti', value: summary.monthlyPotential },
          ]}
        />

        {/* Section Title */}
        <h2 className="font-commons text-xl font-bold text-[#171717] mb-4">
          Yazilim Abonelikleri
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

export default SoftwareCostsPage;
