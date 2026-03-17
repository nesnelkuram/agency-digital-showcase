import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Minus,
  Plus,
  Mail,
  Phone,
  MapPin,
  FileText,
  Clock,
  CheckCircle,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  MessageCircle,
} from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { formatCurrency } from '@/shared/types/pricing';
import type { ProposalDocument, ProposalServiceLine, PrepaymentTier } from '@/shared/types/pricing/proposal';
import {
  calculateAllPaymentPlans,
  calculateLumpSumDiscount,
} from '@/shared/services/pricing/prepaymentCalculator';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface LineState {
  quantity: number;
  unitPrice: number;
  original: ProposalServiceLine;
}

// ─────────────────────────────────────────────
// Quantity Stepper
// ─────────────────────────────────────────────

const QuantityStepper: React.FC<{
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}> = ({ value, min = 0, max = 999, onChange }) => (
  <div className="flex items-center gap-1">
    <button
      onClick={() => onChange(Math.max(min, value - 1))}
      disabled={value <= min}
      className="w-7 h-7 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      <Minus className="w-3 h-3" />
    </button>
    <span className="w-8 text-center font-grotesk text-sm font-medium text-[#171717]">
      {value}
    </span>
    <button
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
      className="w-7 h-7 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      <Plus className="w-3 h-3" />
    </button>
  </div>
);

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

const ProposalSharePage: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();

  const [proposal, setProposal] = useState<ProposalDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lines, setLines] = useState<LineState[]>([]);
  const [showTerms, setShowTerms] = useState(false);
  const [isCustomized, setIsCustomized] = useState(false);

  // ── Load proposal by shareToken ──────────────
  useEffect(() => {
    if (!shareToken || !db) return;

    const load = async () => {
      try {
        const q = query(
          collection(db!, 'proposals'),
          where('shareToken', '==', shareToken)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          setNotFound(true);
        } else {
          const docRef = snap.docs[0].ref;
          const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as ProposalDocument;
          setProposal(data);
          setLines(
            data.serviceLines.map((l) => ({
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              original: l,
            }))
          );

          // Track view: update viewedAt + log activity
          try {
            if (!data.viewedAt) {
              await updateDoc(doc(db!, 'proposals', data.id), {
                viewedAt: serverTimestamp(),
                status: data.status === 'sent' ? 'viewed' : data.status,
              });
            }
            await addDoc(collection(docRef, 'activity'), {
              type: 'viewed',
              createdAt: new Date(),
            });
          } catch (viewErr) {
            console.error('View tracking error (non-fatal):', viewErr);
          }
        }
      } catch (err) {
        console.error('Error loading shared proposal:', err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [shareToken]);

  // ── Live calculations ─────────────────────────
  const calculated = useMemo(() => {
    if (!proposal) return null;

    const lineItems = lines.map((l) => ({
      ...l.original,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      total: l.quantity * l.unitPrice,
    }));

    const subtotal = lineItems.reduce((s, l) => s + l.total, 0);
    const kdvAmount = Math.round(subtotal * (proposal.kdvRate ?? 0.2));
    const grandTotal = subtotal + kdvAmount;
    const savings = proposal.grandTotal - grandTotal;

    // Ödeme planlarını güncel fiyata göre yeniden hesapla
    const isRecurring = proposal.paymentPlans.length > 2;
    const params = proposal.economicParameters;
    let paymentPlans: PrepaymentTier[];

    if (isRecurring) {
      paymentPlans = calculateAllPaymentPlans(subtotal, params);
    } else {
      const lump = calculateLumpSumDiscount(grandTotal, params);
      paymentPlans = [
        {
          period: 1,
          label: 'Standart Ödeme',
          discountPercent: 0,
          fairDiscount: 0,
          incentiveExtra: 0,
          monthlyAmount: grandTotal,
          totalWithoutDiscount: grandTotal,
          discountAmount: 0,
          totalWithDiscount: grandTotal,
          savingsDescription: 'Fatura tarihinden itibaren 7 iş günü içerisinde ödeme.',
        },
        {
          period: 3,
          label: 'Peşin Ödeme',
          discountPercent: lump.discountPercent,
          fairDiscount: lump.discountPercent * 0.6,
          incentiveExtra: lump.discountPercent * 0.4,
          monthlyAmount: 0,
          totalWithoutDiscount: grandTotal,
          discountAmount: lump.discountAmount,
          totalWithDiscount: lump.discountedPrice,
          savingsDescription: lump.description,
        },
      ] as PrepaymentTier[];
    }

    return { lineItems, subtotal, kdvAmount, grandTotal, savings, paymentPlans, isRecurring };
  }, [lines, proposal]);

  const handleQuantityChange = (index: number, qty: number) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, quantity: qty } : l)));
    setIsCustomized(true);
  };

  const handleReset = () => {
    if (!proposal) return;
    setLines(
      proposal.serviceLines.map((l) => ({
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        original: l,
      }))
    );
    setIsCustomized(false);
  };

  // ── Validity date ──────────────────────────
  const validUntilStr = useMemo(() => {
    if (!proposal?.validUntil) return null;
    try {
      const d = (proposal.validUntil as any).toDate
        ? (proposal.validUntil as any).toDate()
        : new Date();
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return null;
    }
  }, [proposal]);

  // ── States ────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#171717]" />
          <p className="font-grotesk text-sm text-neutral-500">Teklif yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (notFound || !proposal || !calculated) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center px-6">
          <AlertCircle className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <h2 className="font-grotesk text-xl font-bold text-[#171717] mb-2">
            Teklif Bulunamadı
          </h2>
          <p className="font-grotesk text-sm text-neutral-500">
            Bu bağlantı geçersiz ya da süresi dolmuş olabilir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ── Header ─────────────────────────────── */}
      <div className="bg-[#171717] text-white">
        <div className="max-w-4xl mx-auto px-6 py-8 md:py-12">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="font-grotesk text-3xl md:text-4xl font-bold tracking-tight">
                {proposal.companyName}
              </h1>
              <p className="font-grotesk text-neutral-400 mt-1 text-sm">{proposal.companyTitle}</p>
            </div>
            <div className="md:text-right">
              <p className="font-grotesk text-lg font-bold text-white/90">HİZMET TEKLİFİ</p>
              <p className="font-grotesk text-xs text-neutral-400 mt-1">
                {proposal.proposalNumber}
              </p>
              {validUntilStr && (
                <p className="font-grotesk text-xs text-neutral-500 mt-1 flex items-center gap-1 md:justify-end">
                  <Clock className="w-3 h-3" />
                  {validUntilStr} tarihine kadar geçerli
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Client Info ───────────────────────── */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="font-grotesk text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                TEKLİF VEREN
              </p>
              <p className="font-grotesk text-sm font-medium text-[#171717]">{proposal.companyTitle}</p>
              {proposal.companyAddress && (
                <p className="font-grotesk text-xs text-neutral-500 flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" /> {proposal.companyAddress}
                </p>
              )}
              {proposal.companyPhone && (
                <p className="font-grotesk text-xs text-neutral-500 flex items-center gap-1.5 mt-1">
                  <Phone className="w-3 h-3 flex-shrink-0" /> {proposal.companyPhone}
                </p>
              )}
              {proposal.companyEmail && (
                <p className="font-grotesk text-xs text-neutral-500 flex items-center gap-1.5 mt-1">
                  <Mail className="w-3 h-3 flex-shrink-0" /> {proposal.companyEmail}
                </p>
              )}
            </div>
            <div>
              <p className="font-grotesk text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                TEKLİF ALAN
              </p>
              <p className="font-grotesk text-sm font-medium text-[#171717]">
                {proposal.clientCompany || proposal.clientName}
              </p>
              {proposal.clientCompany && (
                <p className="font-grotesk text-xs text-neutral-600 mt-0.5">
                  Sayın {proposal.clientName}
                </p>
              )}
              {proposal.clientAddress && (
                <p className="font-grotesk text-xs text-neutral-500 flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" /> {proposal.clientAddress}
                </p>
              )}
              {proposal.clientEmail && (
                <p className="font-grotesk text-xs text-neutral-500 flex items-center gap-1.5 mt-1">
                  <Mail className="w-3 h-3 flex-shrink-0" /> {proposal.clientEmail}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Project Description ───────────────── */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <h2 className="font-grotesk text-base font-bold text-[#171717] mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Proje Hakkında
          </h2>
          <p className="font-grotesk text-sm text-neutral-600 leading-relaxed">
            {proposal.projectDescription}
          </p>
        </div>

        {/* ── Interactive Service Lines ─────────── */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="p-6 border-b border-neutral-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-grotesk text-base font-bold text-[#171717]">
                  Hizmet Kalemleri
                </h2>
                <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                  Miktarları ihtiyacınıza göre ayarlayarak fiyatı hesaplayabilirsiniz.
                </p>
              </div>
              {isCustomized && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 text-neutral-600 rounded-full font-grotesk text-xs hover:bg-neutral-50 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Sıfırla
                </motion.button>
              )}
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100">
                  <th className="text-left py-3 px-6 font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Hizmet
                  </th>
                  <th className="text-center py-3 px-4 font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Miktar
                  </th>
                  <th className="text-center py-3 px-4 font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Birim
                  </th>
                  <th className="text-right py-3 px-4 font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Birim Fiyat
                  </th>
                  <th className="text-right py-3 px-6 font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Toplam
                  </th>
                </tr>
              </thead>
              <tbody>
                {calculated.lineItems.map((line, i) => {
                  const isRemoved = line.quantity === 0;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-neutral-100 transition-opacity ${
                        isRemoved ? 'opacity-40' : 'opacity-100'
                      }`}
                    >
                      <td className="py-4 px-6">
                        <p className={`font-grotesk text-sm font-medium ${isRemoved ? 'line-through text-neutral-400' : 'text-[#171717]'}`}>
                          {line.name}
                        </p>
                        {line.description && (
                          <p className="font-grotesk text-xs text-neutral-400 mt-0.5">
                            {line.description}
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center">
                          <QuantityStepper
                            value={lines[i].quantity}
                            min={0}
                            onChange={(v) => handleQuantityChange(i, v)}
                          />
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center font-grotesk text-sm text-neutral-500">
                        {line.unit}
                      </td>
                      <td className="py-4 px-4 text-right font-grotesk text-sm text-neutral-600">
                        {formatCurrency(line.unitPrice)} TL
                      </td>
                      <td className="py-4 px-6 text-right">
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={line.total}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`font-grotesk text-sm font-semibold ${
                              isRemoved ? 'text-neutral-300' : 'text-[#171717]'
                            }`}
                          >
                            {formatCurrency(line.total)} TL
                          </motion.span>
                        </AnimatePresence>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-neutral-100">
            {calculated.lineItems.map((line, i) => {
              const isRemoved = line.quantity === 0;
              return (
                <div
                  key={i}
                  className={`p-4 transition-opacity ${isRemoved ? 'opacity-40' : 'opacity-100'}`}
                >
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className={`font-grotesk text-sm font-medium ${isRemoved ? 'line-through text-neutral-400' : 'text-[#171717]'}`}>
                        {line.name}
                      </p>
                      {line.description && (
                        <p className="font-grotesk text-xs text-neutral-400 mt-0.5">{line.description}</p>
                      )}
                    </div>
                    <QuantityStepper
                      value={lines[i].quantity}
                      min={0}
                      onChange={(v) => handleQuantityChange(i, v)}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-grotesk text-xs text-neutral-500">
                      {formatCurrency(line.unitPrice)} TL / {line.unit}
                    </span>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={line.total}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`font-grotesk text-sm font-semibold ${
                          isRemoved ? 'text-neutral-300' : 'text-[#171717]'
                        }`}
                      >
                        {formatCurrency(line.total)} TL
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="border-t-2 border-neutral-200">
            <div className="p-6 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-grotesk text-sm text-neutral-600">Ara Toplam</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={calculated.subtotal}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-grotesk text-sm font-medium text-[#171717]"
                  >
                    {formatCurrency(calculated.subtotal)} TL
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-grotesk text-sm text-neutral-600">
                  KDV (%{Math.round((proposal.kdvRate ?? 0.2) * 100)})
                </span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={calculated.kdvAmount}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-grotesk text-sm text-neutral-500"
                  >
                    {formatCurrency(calculated.kdvAmount)} TL
                  </motion.span>
                </AnimatePresence>
              </div>
              {isCustomized && calculated.savings !== 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex justify-between items-center"
                >
                  <span className="font-grotesk text-xs text-green-600">
                    {calculated.savings > 0 ? 'Orijinal teklife göre tasarruf' : 'Orijinal teklife göre ek'}
                  </span>
                  <span className={`font-grotesk text-xs font-medium ${calculated.savings > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {calculated.savings > 0 ? '-' : '+'}{formatCurrency(Math.abs(calculated.savings))} TL
                  </span>
                </motion.div>
              )}
            </div>
            <div className="bg-[#171717] px-6 py-4 flex justify-between items-center">
              <span className="font-grotesk text-sm font-bold text-white">GENEL TOPLAM (KDV Dahil)</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={calculated.grandTotal}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="font-grotesk text-xl font-bold text-white"
                >
                  {formatCurrency(calculated.grandTotal)} TL
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Payment Plans ────────────────────── */}
        {calculated.paymentPlans.length > 0 && (proposal as any).showPaymentPlans !== false && (
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="p-6 border-b border-neutral-100">
              <h2 className="font-grotesk text-base font-bold text-[#171717]">
                Ödeme Seçenekleri
              </h2>
              <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                {calculated.isRecurring
                  ? 'Toplu ödeme seçenekleriyle tasarruf elde edebilirsiniz.'
                  : 'Ödeme seçeneğinizi belirleyin.'}
              </p>
            </div>

            <div className={`p-6 grid gap-4 ${calculated.paymentPlans.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
              {calculated.paymentPlans.map((plan, index) => {
                const isPopular = plan.period === 12;
                const hasDiscount = plan.discountPercent > 0;

                return (
                  <motion.div
                    key={plan.period}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.06 }}
                    className={`relative rounded-2xl border-2 p-5 ${
                      isPopular
                        ? 'border-[#171717] bg-[#171717] text-white'
                        : hasDiscount
                        ? 'border-green-200 bg-green-50/50'
                        : 'border-neutral-200 bg-neutral-50'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-green-500 text-white text-xs font-grotesk font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                          En Avantajlı
                        </span>
                      </div>
                    )}

                    <div className="text-center mb-3">
                      <p className={`font-grotesk text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                        isPopular ? 'text-neutral-400' : 'text-neutral-500'
                      }`}>
                        {plan.label}
                      </p>
                      {hasDiscount && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-grotesk font-bold ${
                          isPopular ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'
                        }`}>
                          %{(plan.discountPercent * 100).toFixed(0)} indirim
                        </span>
                      )}
                    </div>

                    {calculated.isRecurring ? (
                      plan.period === 1 ? (
                        <div className="text-center">
                          <AnimatePresence mode="wait">
                            <motion.p key={plan.monthlyAmount} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              className={`font-grotesk text-2xl font-bold ${isPopular ? 'text-white' : 'text-[#171717]'}`}>
                              {formatCurrency(plan.monthlyAmount)} TL
                            </motion.p>
                          </AnimatePresence>
                          <p className={`font-grotesk text-xs ${isPopular ? 'text-neutral-400' : 'text-neutral-500'}`}>
                            / ay (KDV hariç)
                          </p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className={`font-grotesk text-xs line-through ${isPopular ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            {formatCurrency(plan.totalWithoutDiscount)} TL
                          </p>
                          <AnimatePresence mode="wait">
                            <motion.p key={plan.totalWithDiscount} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              className={`font-grotesk text-2xl font-bold ${isPopular ? 'text-white' : 'text-[#171717]'}`}>
                              {formatCurrency(plan.totalWithDiscount)} TL
                            </motion.p>
                          </AnimatePresence>
                          <p className={`font-grotesk text-xs ${isPopular ? 'text-neutral-400' : 'text-neutral-500'}`}>
                            / {plan.period} ay toplam (KDV hariç)
                          </p>
                          <p className={`font-grotesk text-xs mt-1 ${isPopular ? 'text-green-400' : 'text-green-600'}`}>
                            {formatCurrency(plan.discountAmount)} TL tasarruf
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="text-center">
                        {hasDiscount ? (
                          <>
                            <p className={`font-grotesk text-xs line-through ${isPopular ? 'text-neutral-500' : 'text-neutral-400'}`}>
                              {formatCurrency(plan.totalWithoutDiscount)} TL
                            </p>
                            <AnimatePresence mode="wait">
                              <motion.p key={plan.totalWithDiscount} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className={`font-grotesk text-2xl font-bold ${isPopular ? 'text-white' : 'text-[#171717]'}`}>
                                {formatCurrency(plan.totalWithDiscount)} TL
                              </motion.p>
                            </AnimatePresence>
                            <p className={`font-grotesk text-xs mt-1 ${isPopular ? 'text-green-400' : 'text-green-600'}`}>
                              {formatCurrency(plan.discountAmount)} TL tasarruf
                            </p>
                          </>
                        ) : (
                          <AnimatePresence mode="wait">
                            <motion.p key={plan.totalWithDiscount} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              className={`font-grotesk text-2xl font-bold ${isPopular ? 'text-white' : 'text-[#171717]'}`}>
                              {formatCurrency(plan.totalWithDiscount)} TL
                            </motion.p>
                          </AnimatePresence>
                        )}
                      </div>
                    )}

                    <p className={`font-grotesk text-xs text-center leading-relaxed mt-3 ${
                      isPopular ? 'text-neutral-400' : 'text-neutral-500'
                    }`}>
                      {plan.savingsDescription}
                    </p>

                    {hasDiscount && (
                      <div className={`mt-3 pt-3 border-t ${isPopular ? 'border-white/10' : 'border-neutral-200'}`}>
                        <p className={`flex items-center gap-1.5 font-grotesk text-xs ${isPopular ? 'text-neutral-300' : 'text-neutral-600'}`}>
                          <CheckCircle className={`w-3 h-3 flex-shrink-0 ${isPopular ? 'text-green-400' : 'text-green-500'}`} />
                          Öncelikli hizmet
                        </p>
                        {plan.period >= 12 && (
                          <p className={`flex items-center gap-1.5 font-grotesk text-xs mt-1 ${isPopular ? 'text-neutral-300' : 'text-neutral-600'}`}>
                            <CheckCircle className={`w-3 h-3 flex-shrink-0 ${isPopular ? 'text-green-400' : 'text-green-500'}`} />
                            Yıllık strateji planlaması
                          </p>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Terms (collapsible) ───────────────── */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <button
            onClick={() => setShowTerms(!showTerms)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-neutral-50 transition-colors"
          >
            <span className="font-grotesk text-base font-bold text-[#171717]">Koşullar ve Şartlar</span>
            {showTerms ? (
              <ChevronUp className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            )}
          </button>

          <AnimatePresence>
            {showTerms && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-neutral-100 pt-5">
                  <div>
                    <h4 className="font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                      Ödeme Koşulları
                    </h4>
                    <p className="font-grotesk text-sm text-neutral-600">{proposal.terms.paymentTerms}</p>
                  </div>
                  <div>
                    <h4 className="font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                      Teslim Süresi
                    </h4>
                    <p className="font-grotesk text-sm text-neutral-600">{proposal.terms.deliveryTimeline}</p>
                  </div>
                  <div>
                    <h4 className="font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                      Revizyon Politikası
                    </h4>
                    <p className="font-grotesk text-sm text-neutral-600">{proposal.terms.revisionPolicy}</p>
                  </div>
                  <div>
                    <h4 className="font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                      İptal Politikası
                    </h4>
                    <p className="font-grotesk text-sm text-neutral-600">{proposal.terms.cancellationPolicy}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Validity Banner ───────────────────── */}
        {validUntilStr && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="font-grotesk text-sm text-amber-800">
              Bu teklif <strong>{validUntilStr}</strong> tarihine kadar geçerlidir.
            </p>
          </div>
        )}

        {/* ── CTA ──────────────────────────────── */}
        <div className="bg-[#171717] rounded-2xl p-8 text-center">
          <h3 className="font-grotesk text-xl font-bold text-white mb-2">
            Teklifi Onaylamak İster misiniz?
          </h3>
          <p className="font-grotesk text-sm text-neutral-400 mb-6">
            Seçtiğiniz hizmetler için bizimle iletişime geçin, süreci hemen başlatalım.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {proposal.companyEmail && (
              <a
                href={`mailto:${proposal.companyEmail}?subject=Teklif ${proposal.proposalNumber} - Onay`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#171717] rounded-full font-grotesk text-sm font-semibold hover:bg-neutral-100 transition-colors"
              >
                <Mail className="w-4 h-4" />
                E-posta Gönder
              </a>
            )}
            {proposal.companyPhone && (
              <a
                href={`tel:${proposal.companyPhone.replace(/\s/g, '')}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/20 text-white rounded-full font-grotesk text-sm font-medium hover:bg-white/10 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Ara
              </a>
            )}
          </div>
        </div>

        {/* ── Footer ───────────────────────────── */}
        <div className="text-center pb-8">
          <p className="font-grotesk text-xs text-neutral-400">
            {proposal.companyTitle} · {proposal.companyEmail}
          </p>
        </div>

      </div>
    </div>
  );
};

export default ProposalSharePage;
