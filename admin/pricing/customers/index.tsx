import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Save, Plus, Trash2, Check, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CostSummaryCards from '../costs/components/CostSummaryCards';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, setDoc, addDoc, Timestamp } from 'firebase/firestore';
import type { Customer, CustomerStatus } from '@/shared/types/pricing';
import { CUSTOMER_STATUS_LABELS } from '@/shared/types/pricing';

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch data from Firestore
  useEffect(() => {
    const fetchData = async () => {
      if (!db) {
        setError('Firebase baglantisi bulunamadi');
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDocs(collection(db, 'pricing', 'data', 'customers'));
        const items: Customer[] = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as Customer),
          id: docSnap.id,
        }));
        setData(items.filter(item => item.isActive));
      } catch (err) {
        console.error('Error fetching customers:', err);
        setError('Veriler yuklenirken hata olustu');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate summary values
  const summary = useMemo(() => {
    const activeCustomers = data.filter((c) => c.status === 'active');
    const totalMonthlyRevenue = activeCustomers.reduce((sum, c) => sum + (c.monthlyFee || 0), 0);

    return {
      totalMonthlyRevenue,
      activeCustomerCount: activeCustomers.length,
      totalCustomerCount: data.length,
    };
  }, [data]);

  // Handle add new customer
  const handleAdd = async () => {
    if (!db) return;

    const newItem: Omit<Customer, 'id'> = {
      name: 'Yeni Musteri',
      services: [],
      monthlyFee: 0,
      status: 'active' as CustomerStatus,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    try {
      const docRef = await addDoc(collection(db, 'pricing', 'data', 'customers'), newItem);
      const newCustomer = { ...newItem, id: docRef.id };
      setData((prev) => [...prev, newCustomer]);
      // Navigate to detail page
      navigate(`/admin/pricing/customers/${docRef.id}`);
    } catch (err) {
      console.error('Error adding customer:', err);
      setError('Ekleme sirasinda hata olustu');
    }
  };

  // Handle delete
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!db) return;

    try {
      await setDoc(doc(db, 'pricing', 'data', 'customers', id), { isActive: false }, { merge: true });
      setData((prev) => prev.filter((item) => item.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting customer:', err);
      setError('Silme sirasinda hata olustu');
    }
  };

  // Handle status change
  const handleStatusChange = async (id: string, newStatus: CustomerStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!db) return;

    try {
      await setDoc(doc(db, 'pricing', 'data', 'customers', id), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      }, { merge: true });

      setData((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: newStatus } : item
        )
      );
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Durum guncellenirken hata olustu');
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
          Musteriler
        </h1>
      </div>

      {/* Summary Cards */}
      <CostSummaryCards
        cards={[
          { label: 'Toplam Aylik Gelir', value: summary.totalMonthlyRevenue },
          { label: 'Aktif Musteri Sayisi', value: summary.activeCustomerCount, isCurrency: false },
        ]}
      />

      {/* Table */}
      <div className="bg-white/50 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* Header */}
            <thead>
              <tr style={{ backgroundColor: '#DDD6FE' }}>
                <th className="px-4 py-3 text-left font-commons text-sm font-semibold text-[#171717]" style={{ width: '25%' }}>
                  Musteri Adi
                </th>
                <th className="px-4 py-3 text-left font-commons text-sm font-semibold text-[#171717]" style={{ width: '20%' }}>
                  Iletisim
                </th>
                <th className="px-4 py-3 text-left font-commons text-sm font-semibold text-[#171717]" style={{ width: '15%' }}>
                  Servis Sayisi
                </th>
                <th className="px-4 py-3 text-left font-commons text-sm font-semibold text-[#171717]" style={{ width: '15%' }}>
                  Aylik Fee
                </th>
                <th className="px-4 py-3 text-left font-commons text-sm font-semibold text-[#171717]" style={{ width: '15%' }}>
                  Durum
                </th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {data.map((customer, rowIndex) => (
                <tr
                  key={customer.id}
                  className="border-b border-indigo-100 group cursor-pointer hover:bg-indigo-50/50 transition-colors"
                  style={{ backgroundColor: rowIndex % 2 === 0 ? '#EDE9FE' : '#F5F3FF' }}
                  onClick={() => navigate(`/admin/pricing/customers/${customer.id}`)}
                >
                  <td className="px-4 py-3 font-commons text-sm text-[#171717] font-medium">
                    {customer.name}
                  </td>
                  <td className="px-4 py-3 font-commons text-sm text-[#171717]/70">
                    {customer.contactPerson || customer.email || '-'}
                  </td>
                  <td className="px-4 py-3 font-commons text-sm text-[#171717]">
                    {customer.services?.length || 0} servis
                  </td>
                  <td className="px-4 py-3 font-commons text-sm text-[#171717] font-medium">
                    {formatCurrency(customer.monthlyFee || 0)} TL
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={customer.status}
                      onChange={(e) => handleStatusChange(customer.id, e.target.value as CustomerStatus, e as unknown as React.MouseEvent)}
                      onClick={(e) => e.stopPropagation()}
                      className={`
                        px-2 py-1 rounded text-xs font-medium font-commons border-0 cursor-pointer
                        ${customer.status === 'active' ? 'bg-green-100 text-green-700' : ''}
                        ${customer.status === 'inactive' ? 'bg-gray-100 text-gray-600' : ''}
                        ${customer.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                      `}
                    >
                      {Object.entries(CUSTOMER_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {deleteConfirm === customer.id ? (
                        <>
                          <button
                            onClick={(e) => handleDelete(customer.id, e)}
                            className="p-1.5 text-white bg-red-500 hover:bg-red-600 rounded"
                            title="Onayla"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                            className="p-1.5 text-gray-600 bg-gray-200 hover:bg-gray-300 rounded"
                            title="Iptal"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(customer.id); }}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {/* Empty row for adding */}
              <tr style={{ backgroundColor: data.length % 2 === 0 ? '#EDE9FE' : '#F5F3FF' }}>
                <td className="px-4 py-3 font-commons text-sm text-[#171717]/30" colSpan={5}>
                  Yeni musteri ekle...
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={handleAdd}
                    className="p-1.5 text-white bg-indigo-500 hover:bg-indigo-600 rounded"
                    title="Yeni musteri ekle"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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

export default CustomersPage;
