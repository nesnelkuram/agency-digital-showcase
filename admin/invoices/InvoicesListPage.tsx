import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ReceiptText, Plus, Send, ExternalLink, Trash2, Loader2, Check, FileText } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useInvoices } from '@/shared/hooks/useInvoices';
import { updateInvoiceStatus, deleteInvoice } from '@/shared/services/invoiceService';
import { sendInvoiceEmail } from './sendInvoiceEmail';
import type { Invoice, InvoiceStatus } from '@/shared/types/invoice';
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  formatInvoiceAmount,
} from '@/shared/types/invoice';

function fmtDate(ts?: Timestamp): string {
  if (!ts) return '—';
  try {
    const d = typeof (ts as any).toDate === 'function' ? (ts as any).toDate() : new Date((ts as any).seconds * 1000);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

const STATUS_FILTERS: { value: InvoiceStatus | ''; label: string }[] = [
  { value: '', label: 'Tümü' },
  { value: 'draft', label: 'Taslak' },
  { value: 'sent', label: 'Gönderildi' },
  { value: 'paid', label: 'Ödendi' },
  { value: 'overdue', label: 'Vadesi Geçti' },
  { value: 'cancelled', label: 'İptal' },
];

const InvoicesListPage: React.FC = () => {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const { invoices, loading, error } = useInvoices();

  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const filtered = statusFilter ? invoices.filter((i) => i.status === statusFilter) : invoices;

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSend = async (invoice: Invoice) => {
    setBusyId(invoice.id);
    try {
      await sendInvoiceEmail(invoice, user?.displayName || undefined);
      await updateInvoiceStatus(tenantId, invoice.id, 'sent');
      showToast('ok', `Fatura ${invoice.customerName} adresine gönderildi.`);
    } catch (err: any) {
      showToast('err', err.message || 'E-posta gönderilemedi.');
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusChange = async (invoice: Invoice, status: InvoiceStatus) => {
    setBusyId(invoice.id);
    try {
      await updateInvoiceStatus(tenantId, invoice.id, status);
    } catch (err: any) {
      showToast('err', err.message || 'Durum güncellenemedi.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (invoice: Invoice) => {
    setBusyId(invoice.id);
    try {
      await deleteInvoice(tenantId, invoice.id);
      setDeleteConfirm(null);
    } catch (err: any) {
      showToast('err', err.message || 'Fatura silinemedi.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e] flex items-center gap-3">
            <ReceiptText className="w-7 h-7" /> Faturalar
          </h1>
          <p className="font-commons text-sm text-neutral-500 mt-0.5">
            Fatura PDF'lerini yükleyin ve karşı tarafa bilgilendirme maili gönderin.
          </p>
        </div>
        <Link
          to="/admin/invoices/new"
          className="px-4 py-2 bg-[#171717] text-white rounded-xl font-commons text-sm font-medium hover:bg-neutral-800 inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Yeni Fatura
        </Link>
      </div>

      {/* Filtre çipleri */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-full font-commons text-xs transition-colors ${
              statusFilter === f.value ? 'bg-[#171717] text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {toast && (
        <div
          className={`rounded-xl px-4 py-3 font-commons text-sm border ${
            toast.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-commons text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-48 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 text-center px-6">
          <ReceiptText className="w-10 h-10 text-neutral-300 mb-3" />
          <p className="font-commons text-neutral-500">Henüz fatura yok.</p>
          <Link to="/admin/invoices/new" className="mt-3 text-sm text-indigo-600 hover:underline">
            İlk faturanı yükle →
          </Link>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((inv, i) => {
            const colors = INVOICE_STATUS_COLORS[inv.status];
            const busy = busyId === inv.id;
            return (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="bg-white rounded-2xl border border-neutral-200 p-4 flex flex-wrap items-center gap-4"
              >
                {/* Sol: bilgi */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-neutral-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-commons font-semibold text-sm text-neutral-800 truncate">{inv.invoiceNumber}</p>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-commons text-[10px] ${colors.bg} ${colors.text} border ${colors.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} /> {INVOICE_STATUS_LABELS[inv.status]}
                      </span>
                    </div>
                    <p className="font-commons text-xs text-neutral-500 truncate">
                      {inv.customerName} · {inv.recipientEmail}
                    </p>
                  </div>
                </div>

                {/* Orta: tutar + tarih */}
                <div className="text-right shrink-0">
                  <p className="font-commons font-semibold text-sm text-neutral-800">
                    {formatInvoiceAmount(inv.amount, inv.currency)}
                  </p>
                  <p className="font-commons text-[11px] text-neutral-400">
                    {fmtDate(inv.issueDate)}
                    {inv.dueDate ? ` · vade ${fmtDate(inv.dueDate)}` : ''}
                  </p>
                </div>

                {/* Sağ: aksiyonlar */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Durum hızlı değiştir */}
                  <select
                    value={inv.status}
                    onChange={(e) => handleStatusChange(inv, e.target.value as InvoiceStatus)}
                    disabled={busy}
                    className="px-2 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-xs focus:outline-none focus:border-indigo-400"
                    title="Durum"
                  >
                    {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {INVOICE_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>

                  {/* Görüntüleme sayfası (public) */}
                  <a
                    href={`/fatura/${inv.shareToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                    title="Görüntüleme sayfasını aç"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  {/* Mail gönder / tekrar gönder */}
                  <button
                    onClick={() => handleSend(inv)}
                    disabled={busy}
                    className="p-2 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
                    title={inv.sentAt ? 'Tekrar gönder' : 'Bilgilendirme maili gönder'}
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>

                  {/* Sil */}
                  {deleteConfirm === inv.id ? (
                    <button
                      onClick={() => handleDelete(inv)}
                      disabled={busy}
                      className="px-2 py-1.5 rounded-lg bg-red-500 text-white font-commons text-xs hover:bg-red-600 inline-flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Sil
                    </button>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(inv.id)}
                      className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InvoicesListPage;
