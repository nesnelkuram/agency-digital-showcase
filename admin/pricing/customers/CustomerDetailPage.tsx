import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Save, ArrowLeft, Plus, Trash2, Check, X, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import type { Customer, CustomerServiceItem, CustomerStatus, ServiceItemUnit } from '@/shared/types/pricing';
import {
  CUSTOMER_STATUS_LABELS,
  SERVICE_ITEM_UNIT_LABELS,
  SERVICE_CATEGORY_LABELS,
  calculateServiceItemTotal,
  calculateCustomerMonthlyFee,
} from '@/shared/types/pricing';
import type { ServiceCategory } from '@/shared/types/pricing';

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Edit states
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editingContact, setEditingContact] = useState(false);
  const [editContact, setEditContact] = useState({ contactPerson: '', email: '', phone: '' });

  // Service edit states
  const [editingService, setEditingService] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // New service form
  const [showNewServiceForm, setShowNewServiceForm] = useState(false);
  const [newService, setNewService] = useState<Partial<CustomerServiceItem>>({
    serviceCategory: 'social_media',
    serviceName: '',
    unitPrice: 0,
    quantity: 1,
    unit: 'ay',
  });

  // Fetch customer data
  useEffect(() => {
    const fetchCustomer = async () => {
      if (!db || !id) {
        setError('Musteri bulunamadi');
        setLoading(false);
        return;
      }

      try {
        const docSnap = await getDoc(doc(db, 'pricing', 'data', 'customers', id));
        if (docSnap.exists()) {
          const data = { ...docSnap.data(), id: docSnap.id } as Customer;
          setCustomer(data);
          setEditName(data.name);
          setEditContact({
            contactPerson: data.contactPerson || '',
            email: data.email || '',
            phone: data.phone || '',
          });
        } else {
          setError('Musteri bulunamadi');
        }
      } catch (err) {
        console.error('Error fetching customer:', err);
        setError('Veri yuklenirken hata olustu');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [id]);

  // Save customer to Firestore
  const saveCustomer = async (updatedCustomer: Customer) => {
    if (!db || !id) return;

    setSaving(true);
    try {
      await setDoc(doc(db, 'pricing', 'data', 'customers', id), {
        ...updatedCustomer,
        updatedAt: Timestamp.now(),
      });
      setCustomer(updatedCustomer);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('Error saving customer:', err);
      setError('Kaydetme sirasinda hata olustu');
    } finally {
      setSaving(false);
    }
  };

  // Handle name save
  const handleSaveName = () => {
    if (!customer) return;
    const updated = { ...customer, name: editName };
    saveCustomer(updated);
    setEditingName(false);
  };

  // Handle contact save
  const handleSaveContact = () => {
    if (!customer) return;
    const updated = {
      ...customer,
      contactPerson: editContact.contactPerson,
      email: editContact.email,
      phone: editContact.phone,
    };
    saveCustomer(updated);
    setEditingContact(false);
  };

  // Handle status change
  const handleStatusChange = (newStatus: CustomerStatus) => {
    if (!customer) return;
    const updated = { ...customer, status: newStatus };
    saveCustomer(updated);
  };

  // Handle add service
  const handleAddService = () => {
    if (!customer || !newService.serviceName || !newService.unitPrice) return;

    const totalPrice = calculateServiceItemTotal(newService.unitPrice || 0, newService.quantity || 1);
    const service: CustomerServiceItem = {
      id: crypto.randomUUID(),
      serviceCategory: newService.serviceCategory as ServiceCategory,
      serviceName: newService.serviceName,
      unitPrice: newService.unitPrice || 0,
      quantity: newService.quantity || 1,
      unit: newService.unit as ServiceItemUnit,
      totalPrice,
    };

    const updatedServices = [...(customer.services || []), service];
    const updatedCustomer = {
      ...customer,
      services: updatedServices,
      monthlyFee: calculateCustomerMonthlyFee(updatedServices),
    };

    saveCustomer(updatedCustomer);
    setShowNewServiceForm(false);
    setNewService({
      serviceCategory: 'social_media',
      serviceName: '',
      unitPrice: 0,
      quantity: 1,
      unit: 'ay',
    });
  };

  // Handle delete service
  const handleDeleteService = (serviceId: string) => {
    if (!customer) return;

    const updatedServices = customer.services.filter((s) => s.id !== serviceId);
    const updatedCustomer = {
      ...customer,
      services: updatedServices,
      monthlyFee: calculateCustomerMonthlyFee(updatedServices),
    };

    saveCustomer(updatedCustomer);
    setDeleteConfirm(null);
  };

  // Handle update service
  const handleUpdateService = (serviceId: string, field: keyof CustomerServiceItem, value: unknown) => {
    if (!customer) return;

    const updatedServices = customer.services.map((s) => {
      if (s.id !== serviceId) return s;

      const updated = { ...s, [field]: value };
      // Recalculate total if price or quantity changed
      if (field === 'unitPrice' || field === 'quantity') {
        updated.totalPrice = calculateServiceItemTotal(
          field === 'unitPrice' ? (value as number) : s.unitPrice,
          field === 'quantity' ? (value as number) : s.quantity
        );
      }
      return updated;
    });

    const updatedCustomer = {
      ...customer,
      services: updatedServices,
      monthlyFee: calculateCustomerMonthlyFee(updatedServices),
    };

    saveCustomer(updatedCustomer);
    setEditingService(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="font-commons text-[#171717]/70">Musteri bulunamadi</p>
        <button
          onClick={() => navigate('/admin/pricing/customers')}
          className="mt-4 text-indigo-600 hover:underline font-commons"
        >
          Musteri listesine don
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Back Button & Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/pricing/customers')}
          className="flex items-center gap-2 text-[#171717]/60 hover:text-[#171717] mb-4 font-commons text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Musteri Listesi
        </button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Customer Name */}
            {editingName ? (
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="font-commons text-2xl md:text-3xl font-bold text-[#171717] bg-white border border-indigo-300 rounded px-2 py-1"
                  autoFocus
                />
                <button onClick={handleSaveName} className="p-1 text-green-600 hover:bg-green-50 rounded">
                  <Check className="w-5 h-5" />
                </button>
                <button onClick={() => setEditingName(false)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <h1
                onClick={() => setEditingName(true)}
                className="font-commons text-2xl md:text-3xl font-bold text-[#171717] pb-2 border-b-2 border-indigo-500 inline-block cursor-pointer hover:opacity-80 group"
              >
                {customer.name}
                <Pencil className="w-4 h-4 inline-block ml-2 opacity-0 group-hover:opacity-50" />
              </h1>
            )}

            {/* Contact Info */}
            {editingContact ? (
              <div className="mt-4 space-y-2 max-w-md">
                <input
                  type="text"
                  value={editContact.contactPerson}
                  onChange={(e) => setEditContact({ ...editContact, contactPerson: e.target.value })}
                  placeholder="Iletisim Kisisi"
                  className="w-full px-3 py-2 border border-indigo-300 rounded font-commons text-sm"
                />
                <input
                  type="email"
                  value={editContact.email}
                  onChange={(e) => setEditContact({ ...editContact, email: e.target.value })}
                  placeholder="E-posta"
                  className="w-full px-3 py-2 border border-indigo-300 rounded font-commons text-sm"
                />
                <input
                  type="tel"
                  value={editContact.phone}
                  onChange={(e) => setEditContact({ ...editContact, phone: e.target.value })}
                  placeholder="Telefon"
                  className="w-full px-3 py-2 border border-indigo-300 rounded font-commons text-sm"
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveContact} className="px-3 py-1 bg-green-500 text-white rounded font-commons text-sm">
                    Kaydet
                  </button>
                  <button onClick={() => setEditingContact(false)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded font-commons text-sm">
                    Iptal
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingContact(true)}
                className="mt-2 font-commons text-sm text-[#171717]/60 cursor-pointer hover:text-[#171717]/80 group"
              >
                {customer.contactPerson && <span>{customer.contactPerson}</span>}
                {customer.email && <span className="ml-3">{customer.email}</span>}
                {customer.phone && <span className="ml-3">{customer.phone}</span>}
                {!customer.contactPerson && !customer.email && !customer.phone && (
                  <span className="italic">Iletisim bilgisi ekle...</span>
                )}
                <Pencil className="w-3 h-3 inline-block ml-2 opacity-0 group-hover:opacity-50" />
              </div>
            )}
          </div>

          {/* Status */}
          <select
            value={customer.status}
            onChange={(e) => handleStatusChange(e.target.value as CustomerStatus)}
            className={`
              px-3 py-2 rounded font-medium font-commons border-0 cursor-pointer
              ${customer.status === 'active' ? 'bg-green-100 text-green-700' : ''}
              ${customer.status === 'inactive' ? 'bg-gray-100 text-gray-600' : ''}
              ${customer.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
            `}
          >
            {Object.entries(CUSTOMER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Monthly Fee Summary */}
      <div className="bg-indigo-100 rounded-lg p-4 mb-6">
        <p className="font-commons text-sm text-[#171717]/70">Aylik Toplam Fee</p>
        <p className="font-commons text-3xl font-bold text-[#171717]">
          {formatCurrency(customer.monthlyFee || 0)} TL
        </p>
      </div>

      {/* Services Section */}
      <div className="mb-6">
        <h2 className="font-commons text-xl font-bold text-[#171717] mb-4">
          Servis Kalemleri
        </h2>

        <div className="bg-white/50 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ backgroundColor: '#DDD6FE' }}>
                  <th className="px-4 py-3 text-left font-commons text-sm font-semibold text-[#171717]" style={{ width: '20%' }}>
                    Kategori
                  </th>
                  <th className="px-4 py-3 text-left font-commons text-sm font-semibold text-[#171717]" style={{ width: '25%' }}>
                    Servis Adi
                  </th>
                  <th className="px-4 py-3 text-left font-commons text-sm font-semibold text-[#171717]" style={{ width: '15%' }}>
                    Birim Fiyat
                  </th>
                  <th className="px-4 py-3 text-left font-commons text-sm font-semibold text-[#171717]" style={{ width: '10%' }}>
                    Miktar
                  </th>
                  <th className="px-4 py-3 text-left font-commons text-sm font-semibold text-[#171717]" style={{ width: '10%' }}>
                    Birim
                  </th>
                  <th className="px-4 py-3 text-left font-commons text-sm font-semibold text-[#171717]" style={{ width: '15%' }}>
                    Toplam
                  </th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {customer.services?.map((service, index) => (
                  <tr
                    key={service.id}
                    className="border-b border-indigo-100 group"
                    style={{ backgroundColor: index % 2 === 0 ? '#EDE9FE' : '#F5F3FF' }}
                  >
                    <td className="px-4 py-3 font-commons text-sm text-[#171717]">
                      {SERVICE_CATEGORY_LABELS[service.serviceCategory]}
                    </td>
                    <td className="px-4 py-3 font-commons text-sm text-[#171717] font-medium">
                      {service.serviceName}
                    </td>
                    <td className="px-4 py-3 font-commons text-sm text-[#171717]">
                      {formatCurrency(service.unitPrice)} TL
                    </td>
                    <td className="px-4 py-3 font-commons text-sm text-[#171717]">
                      {service.quantity}
                    </td>
                    <td className="px-4 py-3 font-commons text-sm text-[#171717]">
                      {SERVICE_ITEM_UNIT_LABELS[service.unit]}
                    </td>
                    <td className="px-4 py-3 font-commons text-sm text-[#171717] font-medium">
                      {formatCurrency(service.totalPrice)} TL
                    </td>
                    <td className="px-4 py-3">
                      {deleteConfirm === service.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteService(service.id)}
                            className="p-1 text-white bg-red-500 hover:bg-red-600 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="p-1 text-gray-600 bg-gray-200 hover:bg-gray-300 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(service.id)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {/* Total Row */}
                {customer.services?.length > 0 && (
                  <tr style={{ backgroundColor: '#DDD6FE' }}>
                    <td colSpan={5} className="px-4 py-3 font-commons text-sm font-bold text-[#171717] text-right">
                      TOPLAM
                    </td>
                    <td className="px-4 py-3 font-commons text-sm font-bold text-[#171717]">
                      {formatCurrency(customer.monthlyFee || 0)} TL
                    </td>
                    <td></td>
                  </tr>
                )}

                {/* New Service Form */}
                {showNewServiceForm ? (
                  <tr style={{ backgroundColor: '#F5F3FF' }}>
                    <td className="px-4 py-3">
                      <select
                        value={newService.serviceCategory}
                        onChange={(e) => setNewService({ ...newService, serviceCategory: e.target.value as ServiceCategory })}
                        className="w-full px-2 py-1 border border-indigo-300 rounded font-commons text-sm"
                      >
                        {Object.entries(SERVICE_CATEGORY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={newService.serviceName}
                        onChange={(e) => setNewService({ ...newService, serviceName: e.target.value })}
                        placeholder="Servis adi..."
                        className="w-full px-2 py-1 border border-indigo-300 rounded font-commons text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={newService.unitPrice}
                        onChange={(e) => setNewService({ ...newService, unitPrice: Number(e.target.value) })}
                        placeholder="0"
                        className="w-full px-2 py-1 border border-indigo-300 rounded font-commons text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={newService.quantity}
                        onChange={(e) => setNewService({ ...newService, quantity: Number(e.target.value) })}
                        min={1}
                        className="w-full px-2 py-1 border border-indigo-300 rounded font-commons text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={newService.unit}
                        onChange={(e) => setNewService({ ...newService, unit: e.target.value as ServiceItemUnit })}
                        className="w-full px-2 py-1 border border-indigo-300 rounded font-commons text-sm"
                      >
                        {Object.entries(SERVICE_ITEM_UNIT_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 font-commons text-sm text-[#171717]">
                      {formatCurrency((newService.unitPrice || 0) * (newService.quantity || 1))} TL
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleAddService}
                          className="p-1 text-white bg-green-500 hover:bg-green-600 rounded"
                          disabled={!newService.serviceName || !newService.unitPrice}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowNewServiceForm(false)}
                          className="p-1 text-gray-600 bg-gray-200 hover:bg-gray-300 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr style={{ backgroundColor: customer.services?.length % 2 === 0 ? '#EDE9FE' : '#F5F3FF' }}>
                    <td className="px-4 py-3 font-commons text-sm text-[#171717]/30" colSpan={6}>
                      Yeni servis ekle...
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setShowNewServiceForm(true)}
                        className="p-1.5 text-white bg-indigo-500 hover:bg-indigo-600 rounded"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
        {saving && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed bottom-6 right-6 bg-indigo-500 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3"
          >
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-commons text-sm">Kaydediliyor...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerDetailPage;
