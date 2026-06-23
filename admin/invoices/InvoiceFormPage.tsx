import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { ChevronLeft, Upload, FileText, Loader2, Save, Send, X, Sparkles } from 'lucide-react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import { createInvoice, getInvoice, updateInvoice, updateInvoiceStatus } from '@/shared/services/invoiceService';
import { sendInvoiceEmail } from './sendInvoiceEmail';
import EmailChipsInput from './EmailChipsInput';
import type { Customer } from '@/shared/types/pricing';
import type { InvoiceCurrency } from '@/shared/types/invoice';
import { INVOICE_CURRENCY_LABELS } from '@/shared/types/invoice';

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400';
const labelClass = 'block font-commons text-xs font-medium text-neutral-600 mb-1';

const InvoiceFormPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetCustomerId = searchParams.get('customerId');
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const tenantId = useTenantId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Müşteri listesi
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Form alanları
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<InvoiceCurrency>('TRY');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Düzenleme modunda mevcut fatura PDF'i (yeni dosya yüklenmezse korunur)
  const [existingPdfUrl, setExistingPdfUrl] = useState<string>('');
  const [existingPdfName, setExistingPdfName] = useState<string>('');
  const [existingStatus, setExistingStatus] = useState<string>('draft');

  const [loadingInvoice, setLoadingInvoice] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState<string | null>(null);

  // Düzenleme: mevcut faturayı yükle
  useEffect(() => {
    if (!isEdit || !id || !tenantId) return;
    let cancelled = false;
    (async () => {
      try {
        const inv = await getInvoice(tenantId, id);
        if (cancelled || !inv) {
          if (!cancelled) setError('Fatura bulunamadı.');
          return;
        }
        setInvoiceNumber(inv.invoiceNumber || '');
        setCustomerName(inv.customerName || '');
        setEmails([inv.recipientEmail, ...(inv.additionalEmails || [])].filter(Boolean));
        setRecipientName(inv.recipientName || '');
        setSelectedCustomerId(inv.customerId || '');
        setAmount(inv.amount != null ? String(inv.amount) : '');
        setCurrency(inv.currency || 'TRY');
        if (inv.issueDate) setIssueDate(new Date((inv.issueDate as any).seconds * 1000).toISOString().slice(0, 10));
        if (inv.dueDate) setDueDate(new Date((inv.dueDate as any).seconds * 1000).toISOString().slice(0, 10));
        setDescription(inv.description || '');
        setExistingPdfUrl(inv.pdfUrl || '');
        setExistingPdfName(inv.pdfFileName || '');
        setExistingStatus(inv.status || 'draft');
      } catch (err) {
        if (!cancelled) setError('Fatura yüklenemedi.');
      } finally {
        if (!cancelled) setLoadingInvoice(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, id, tenantId]);

  // Müşterileri çek
  useEffect(() => {
    const fetchCustomers = async () => {
      if (!db) return;
      try {
        const snap = await getDocs(collection(db, 'pricing', 'data', 'customers'));
        const items = snap.docs
          .map((d) => ({ ...(d.data() as Customer), id: d.id }))
          .filter((c) => c.isActive);
        setCustomers(items);
        // Müşteriler sayfasından "Yeni Fatura" ile gelindiyse müşteriyi önseç
        if (presetCustomerId) {
          const c = items.find((x) => x.id === presetCustomerId);
          if (c) {
            setSelectedCustomerId(c.id);
            setCustomerName(c.name);
            setEmails(c.email ? [c.email] : []);
            setRecipientName(c.contactPerson || '');
          }
        }
      } catch (err) {
        console.error('Müşteriler yüklenemedi:', err);
      }
    };
    fetchCustomers();
  }, []);

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c) {
      setCustomerName(c.name);
      setEmails(c.email ? [c.email] : []);
      setRecipientName(c.contactPerson || '');
    }
  };

  const fileToBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  // PDF'i Gemini'ye okutup form alanlarını otomatik doldurur (boş alanları).
  const runExtraction = async (f: File) => {
    // Vercel istek gövdesi limiti (~4.5MB); base64 ~1.33x büyütür → 3MB üstünü atla.
    if (f.size > 3 * 1024 * 1024) {
      setExtractNote('Dosya büyük olduğu için otomatik okuma atlandı; alanları elle girebilirsiniz.');
      return;
    }
    setExtracting(true);
    setExtractNote(null);
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) return;
      const pdfData = await fileToBase64(f);
      const res = await fetch('/api/invoices/extract-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pdfData, mimeType: f.type }),
      });
      if (!res.ok) {
        setExtractNote('Otomatik okuma yapılamadı; alanları elle girebilirsiniz.');
        return;
      }
      const { data } = await res.json();
      // Yalnızca boş alanları doldur — kullanıcının girdiğini ezme
      if (data.invoiceNumber && !invoiceNumber) setInvoiceNumber(data.invoiceNumber);
      if (data.amount && !amount) setAmount(String(data.amount));
      if (data.currency) setCurrency(data.currency);
      if (data.issueDate) setIssueDate(data.issueDate);
      if (data.dueDate && !dueDate) setDueDate(data.dueDate);
      if (data.description && !description) setDescription(data.description);
      // Müşteri listeden seçilmediyse müşteri bilgilerini de öner
      if (!selectedCustomerId) {
        if (data.customerName && !customerName) setCustomerName(data.customerName);
        if (data.recipientEmail && emails.length === 0) setEmails([data.recipientEmail]);
      }
      setExtractNote('Alanlar fatura PDF\'inden AI ile dolduruldu. Lütfen kontrol edip gönderin.');
    } catch (err) {
      console.error('Fatura okunamadı:', err);
      setExtractNote('Otomatik okuma yapılamadı; alanları elle girebilirsiniz.');
    } finally {
      setExtracting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setError('Lütfen PDF formatında bir fatura yükleyin.');
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setError('Dosya boyutu 25MB sınırını aşıyor.');
      return;
    }
    setError(null);
    setFile(f);
    runExtraction(f);
  };

  const validate = (): string | null => {
    if (!invoiceNumber.trim()) return 'Fatura numarası zorunludur.';
    if (!customerName.trim()) return 'Müşteri adı zorunludur.';
    if (emails.length === 0) return 'En az bir alıcı e-postası ekleyin.';
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return 'Geçerli bir tutar girin.';
    if (!file && !existingPdfUrl) return 'Fatura PDF dosyası zorunludur.';
    return null;
  };

  const handleSave = async (sendEmail: boolean) => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!tenantId) return;

    setSaving(true);
    setError(null);

    try {
      // PDF: yeni dosya seçildiyse yükle, yoksa mevcut PDF korunur
      let pdfUrl = existingPdfUrl;
      let pdfFileName = existingPdfName;
      let pdfSize: number | undefined;
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `invoices/${tenantId}/${Date.now()}_${safeName}`;
        const storageRef = ref(storage!, filePath);
        await uploadBytes(storageRef, file);
        pdfUrl = await getDownloadURL(storageRef);
        pdfFileName = file.name;
        pdfSize = file.size;
      }

      const baseData: any = {
        invoiceNumber: invoiceNumber.trim(),
        description: description.trim() || undefined,
        customerId: selectedCustomerId || undefined,
        customerName: customerName.trim(),
        recipientEmail: emails[0],
        additionalEmails: emails.slice(1), // her zaman dizi → edit'te silinenler temizlenir
        recipientName: recipientName.trim() || undefined,
        amount: Number(amount),
        currency,
        issueDate: Timestamp.fromDate(new Date(issueDate)),
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : undefined,
        pdfUrl,
        pdfFileName,
      };
      if (pdfSize != null) baseData.pdfSize = pdfSize;

      let invoiceId: string;
      if (isEdit && id) {
        await updateInvoice(tenantId, id, baseData);
        invoiceId = id;
      } else {
        invoiceId = await createInvoice(tenantId, {
          ...baseData,
          status: 'draft',
          createdBy: user?.uid || '',
          createdByName: user?.displayName || undefined,
        });
      }

      // İstenirse bildirim maili gönder
      if (sendEmail) {
        const saved = await getInvoice(tenantId, invoiceId);
        if (saved) {
          await sendInvoiceEmail(saved, user?.displayName || undefined);
          await updateInvoiceStatus(tenantId, invoiceId, 'sent');
        }
      }

      navigate('/admin/invoices');
    } catch (err: any) {
      console.error('Fatura kaydedilemedi:', err);
      setError(err.message || 'Fatura kaydedilirken bir hata oluştu.');
      setSaving(false);
    }
  };

  if (loadingInvoice) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/invoices')} className="text-neutral-400 hover:text-neutral-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-grotesk font-bold text-[#1a1a2e]">{isEdit ? 'Faturayı Düzenle' : 'Yeni Fatura'}</h1>
          <p className="font-commons text-sm text-neutral-500 mt-0.5">
            {isEdit
              ? 'Fatura bilgilerini güncelleyin. PDF değiştirmek istemezseniz mevcut dosya korunur.'
              : 'PDF faturayı yükleyin, alıcıyı seçin ve bilgilendirme maili gönderin.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-commons text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
        {/* Müşteri seçimi */}
        <div>
          <label className={labelClass}>Müşteri (kayıtlılardan seç)</label>
          <select value={selectedCustomerId} onChange={(e) => handleSelectCustomer(e.target.value)} className={inputClass}>
            <option value="">— Manuel gir —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.email ? ` (${c.email})` : ''}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-neutral-400 mt-1">
            Listeden seçince ad ve e-posta otomatik dolar; istersen aşağıdan düzenleyebilirsin.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fatura No *</label>
            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="2026-0042" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Müşteri Adı *</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Alıcı E-posta(lar) *</label>
            <EmailChipsInput emails={emails} onChange={setEmails} />
            <p className="text-[11px] text-neutral-400 mt-1">Birden fazla adres için virgül veya Enter ile ayır; her biri fatura mailini alır.</p>
          </div>
          <div>
            <label className={labelClass}>İletişim Kişisi</label>
            <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Tutar *</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Para Birimi</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as InvoiceCurrency)} className={inputClass}>
              {Object.entries(INVOICE_CURRENCY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Düzenlenme Tarihi</label>
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Son Ödeme Tarihi</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Açıklama</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Hizmet özeti veya not (opsiyonel)" className={inputClass} />
        </div>

        {/* PDF yükleme */}
        <div>
          <label className={labelClass}>Fatura PDF *</label>
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileSelect} className="hidden" />
          {file ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-red-500 shrink-0" />
                <div className="min-w-0">
                  <p className="font-commons text-sm text-neutral-700 truncate">{file.name}</p>
                  <p className="text-[11px] text-neutral-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button onClick={() => setFile(null)} className="text-neutral-400 hover:text-red-500 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : existingPdfUrl ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-red-500 shrink-0" />
                <div className="min-w-0">
                  <a href={existingPdfUrl} target="_blank" rel="noreferrer" className="font-commons text-sm text-neutral-700 truncate hover:underline block">
                    {existingPdfName || 'Mevcut fatura PDF'}
                  </a>
                  <p className="text-[11px] text-neutral-400">Mevcut dosya — değiştirmezsen korunur</p>
                </div>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-600 font-commons text-xs hover:bg-neutral-50 shrink-0">
                Değiştir
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
            >
              <Upload className="w-6 h-6 text-neutral-400" />
              <span className="font-commons text-sm text-neutral-500">PDF faturayı seçmek için tıklayın</span>
              <span className="text-[11px] text-neutral-400">Maks. 25MB</span>
            </button>
          )}
          {extracting && (
            <div className="mt-2 flex items-center gap-2 text-indigo-600 font-commons text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fatura AI ile okunuyor, alanlar dolduruluyor...
            </div>
          )}
          {!extracting && extractNote && (
            <div className="mt-2 flex items-center gap-2 text-emerald-600 font-commons text-xs">
              <Sparkles className="w-3.5 h-3.5 shrink-0" /> {extractNote}
            </div>
          )}
        </div>
      </div>

      {/* Aksiyonlar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="px-4 py-2 bg-[#171717] text-white rounded-xl font-commons text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Kaydet ve Gönder
        </button>
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-xl font-commons text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isEdit ? 'Değişiklikleri Kaydet' : 'Taslak Kaydet'}
        </button>
      </div>
    </div>
  );
};

export default InvoiceFormPage;
