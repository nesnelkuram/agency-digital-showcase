import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Download, FileText, Loader2, AlertCircle } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { getInvoiceByShareToken, markInvoiceViewed } from '@/shared/services/invoiceService';
import type { Invoice } from '@/shared/types/invoice';
import {
  INVOICE_STATUS_LABELS,
  formatInvoiceAmount,
} from '@/shared/types/invoice';

function fmtDate(ts?: Timestamp): string {
  if (!ts) return '—';
  try {
    const d = typeof (ts as any).toDate === 'function' ? (ts as any).toDate() : new Date((ts as any).seconds * 1000);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return '—';
  }
}

const InvoiceSharePage: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const viewedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      if (!shareToken) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        const inv = await getInvoiceByShareToken(shareToken);
        if (!inv) {
          setNotFound(true);
        } else {
          setInvoice(inv);
          // İlk görüntülemeyi işaretle (yalnızca bir kez)
          if (!inv.viewedAt && !viewedRef.current) {
            viewedRef.current = true;
            markInvoiceViewed(inv.id);
          }
        }
      } catch (err) {
        console.error('Fatura yüklenemedi:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (notFound || !invoice) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="w-12 h-12 text-neutral-300 mb-4" />
        <h1 className="text-xl font-grotesk font-bold text-neutral-700">Fatura bulunamadı</h1>
        <p className="font-commons text-sm text-neutral-500 mt-1">
          Bu bağlantı geçersiz olabilir veya fatura kaldırılmış olabilir.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Marka başlığı */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-grotesk font-extrabold tracking-tight text-[#171717]">intiba.</h1>
          <p className="font-commons text-xs text-neutral-400 mt-0.5">Dijital Ajans Platformu</p>
        </div>

        {/* Fatura kartı */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="bg-[#171717] text-white px-6 py-5 flex items-center justify-between">
            <div>
              <p className="font-commons text-xs text-white/50">Fatura No</p>
              <p className="font-grotesk font-bold text-lg">{invoice.invoiceNumber}</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-white/10 font-commons text-xs">
              {INVOICE_STATUS_LABELS[invoice.status]}
            </span>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <p className="font-commons text-xs text-neutral-400">Tutar</p>
              <p className="font-grotesk font-bold text-2xl text-[#1a1a2e]">
                {formatInvoiceAmount(invoice.amount, invoice.currency)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-neutral-100">
              <div>
                <p className="font-commons text-xs text-neutral-400">Müşteri</p>
                <p className="font-commons text-sm text-neutral-700">{invoice.customerName}</p>
              </div>
              <div>
                <p className="font-commons text-xs text-neutral-400">Düzenlenme</p>
                <p className="font-commons text-sm text-neutral-700">{fmtDate(invoice.issueDate)}</p>
              </div>
              {invoice.dueDate && (
                <div>
                  <p className="font-commons text-xs text-neutral-400">Son Ödeme</p>
                  <p className="font-commons text-sm text-neutral-700">{fmtDate(invoice.dueDate)}</p>
                </div>
              )}
            </div>

            {invoice.description && (
              <div className="pt-2 border-t border-neutral-100">
                <p className="font-commons text-xs text-neutral-400 mb-1">Açıklama</p>
                <p className="font-commons text-sm text-neutral-600">{invoice.description}</p>
              </div>
            )}

            {/* İndirme */}
            <a
              href={invoice.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#171717] text-white rounded-xl font-commons text-sm font-medium hover:bg-neutral-800 transition-colors"
            >
              <Download className="w-4 h-4" /> Faturayı İndir (PDF)
            </a>
            <div className="flex items-center justify-center gap-1.5 text-neutral-400">
              <FileText className="w-3.5 h-3.5" />
              <span className="font-commons text-[11px] truncate">{invoice.pdfFileName}</span>
            </div>
          </div>
        </div>

        <p className="text-center font-commons text-[11px] text-neutral-400 mt-6">
          Bu bağlantı size özeldir. Sorularınız için e-postanızı yanıtlayabilirsiniz.
        </p>
      </div>
    </div>
  );
};

export default InvoiceSharePage;
