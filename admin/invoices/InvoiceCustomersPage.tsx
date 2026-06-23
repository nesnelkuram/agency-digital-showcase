import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users2, Plus, ReceiptText, Loader2, Mail, Phone, ChevronDown, X, Check, FileText,
} from 'lucide-react';
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useInvoices } from '@/shared/hooks/useInvoices';
import type { Customer, CustomerStatus } from '@/shared/types/pricing';
import { CUSTOMER_STATUS_LABELS } from '@/shared/types/pricing';
import type { Invoice } from '@/shared/types/invoice';
import {
  formatInvoiceAmount, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS,
} from '@/shared/types/invoice';

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400';

const CUSTOMER_STATUS_DOT: Record<CustomerStatus, string> = {
  active: 'bg-emerald-500',
  inactive: 'bg-neutral-400',
  pending: 'bg-amber-500',
};

const InvoiceCustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const { invoices } = useInvoices();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Yeni müşteri formu
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', contactPerson: '', email: '', phone: '' });

  const fetchCustomers = async () => {
    if (!db) {
      setError('Firebase bağlantısı bulunamadı');
      setLoading(false);
      return;
    }
    try {
      const snap = await getDocs(collection(db, 'pricing', 'data', 'customers'));
      const items = snap.docs
        .map((d) => ({ ...(d.data() as Customer), id: d.id }))
        .filter((c) => c.isActive);
      setCustomers(items);
    } catch (err) {
      console.error('Müşteriler yüklenemedi:', err);
      setError('Müşteriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // customerId → faturalar
  const invoicesByCustomer = useMemo(() => {
    const map = new Map<string, Invoice[]>();
    for (const inv of invoices) {
      if (!inv.customerId) continue;
      const list = map.get(inv.customerId) || [];
      list.push(inv);
      map.set(inv.customerId, list);
    }
    return map;
  }, [invoices]);

  const handleAddCustomer = async () => {
    if (!form.name.trim()) {
      setError('Müşteri adı zorunludur.');
      return;
    }
    if (!db) return;
    setSaving(true);
    setError(null);
    try {
      await addDoc(collection(db, 'pricing', 'data', 'customers'), {
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim() || '',
        email: form.email.trim() || '',
        phone: form.phone.trim() || '',
        services: [],
        monthlyFee: 0,
        status: 'active' as CustomerStatus,
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      setForm({ name: '', contactPerson: '', email: '', phone: '' });
      setShowAdd(false);
      await fetchCustomers();
    } catch (err: any) {
      console.error('Müşteri eklenemedi:', err);
      setError(err.message || 'Müşteri eklenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e] flex items-center gap-3">
            <Users2 className="w-7 h-7" /> Müşteriler
          </h1>
          <p className="font-commons text-sm text-neutral-500 mt-0.5">
            Fatura kesilecek müşteriler. Bir müşteriye tıklayıp faturalarını görebilir veya yeni fatura kesebilirsin.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="px-4 py-2 bg-[#171717] text-white rounded-xl font-commons text-sm font-medium hover:bg-neutral-800 inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Yeni Müşteri
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-commons text-sm">{error}</div>
      )}

      {/* Yeni müşteri formu */}
      {showAdd && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Müşteri / Firma adı *" className={inputClass} />
            <input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} placeholder="İletişim kişisi" className={inputClass} />
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-posta" className={inputClass} />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Telefon" className={inputClass} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleAddCustomer} disabled={saving} className="px-4 py-2 bg-[#171717] text-white rounded-xl font-commons text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 inline-flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Kaydet
            </button>
            <button onClick={() => { setShowAdd(false); setError(null); }} className="px-3 py-2 text-neutral-500 font-commons text-sm hover:text-neutral-700">Vazgeç</button>
          </div>
        </motion.div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-48 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {!loading && customers.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 text-center px-6">
          <Users2 className="w-10 h-10 text-neutral-300 mb-3" />
          <p className="font-commons text-neutral-500">Henüz müşteri yok.</p>
        </div>
      )}

      {!loading && customers.length > 0 && (
        <div className="space-y-3">
          {customers.map((cust, i) => {
            const custInvoices = (invoicesByCustomer.get(cust.id) || []).sort(
              (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
            );
            const unpaidCount = custInvoices.filter((inv) => inv.status === 'sent' || inv.status === 'overdue').length;
            const expanded = expandedId === cust.id;
            return (
              <motion.div
                key={cust.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="bg-white rounded-2xl border border-neutral-200 overflow-hidden"
              >
                {/* Müşteri satırı */}
                <div className="p-4 flex flex-wrap items-center gap-4">
                  <button
                    onClick={() => setExpandedId(expanded ? null : cust.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${CUSTOMER_STATUS_DOT[cust.status]}`} title={CUSTOMER_STATUS_LABELS[cust.status]} />
                    <div className="min-w-0">
                      <p className="font-commons font-semibold text-sm text-neutral-800 truncate">{cust.name}</p>
                      <p className="font-commons text-xs text-neutral-500 truncate flex items-center gap-3">
                        {cust.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{cust.email}</span>}
                        {cust.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{cust.phone}</span>}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="font-commons text-xs text-neutral-500">{custInvoices.length} fatura</p>
                      {unpaidCount > 0 && <p className="font-commons text-[11px] text-amber-600">{unpaidCount} ödenmemiş</p>}
                    </div>
                    <button
                      onClick={() => navigate(`/admin/invoices/new?customerId=${cust.id}`)}
                      className="px-3 py-1.5 rounded-lg bg-[#171717] text-white font-commons text-xs hover:bg-neutral-800 inline-flex items-center gap-1.5"
                    >
                      <ReceiptText className="w-3.5 h-3.5" /> Yeni Fatura
                    </button>
                    <button onClick={() => setExpandedId(expanded ? null : cust.id)} className="text-neutral-400 hover:text-neutral-600">
                      <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Faturalar (genişlet) */}
                {expanded && (
                  <div className="border-t border-neutral-100 bg-neutral-50/50 px-4 py-3">
                    {custInvoices.length === 0 ? (
                      <p className="font-commons text-xs text-neutral-400 py-2">Bu müşteriye ait fatura yok.</p>
                    ) : (
                      <div className="space-y-2">
                        {custInvoices.map((inv) => {
                          const colors = INVOICE_STATUS_COLORS[inv.status];
                          return (
                            <a
                              key={inv.id}
                              href={`/fatura/${inv.shareToken}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white border border-neutral-200 hover:border-neutral-300"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span className="font-commons text-sm text-neutral-700 truncate">{inv.invoiceNumber}</span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-commons text-[10px] ${colors.bg} ${colors.text} border ${colors.border}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} /> {INVOICE_STATUS_LABELS[inv.status]}
                                </span>
                              </span>
                              <span className="font-commons text-sm font-medium text-neutral-700 shrink-0">{formatInvoiceAmount(inv.amount, inv.currency)}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InvoiceCustomersPage;
