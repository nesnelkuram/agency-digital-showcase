import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  Send,
  Save,
  Loader2,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  TrendingDown,
  Shield,
  BadgePercent,
  Info,
  ChevronDown,
  ChevronUp,
  Edit3,
  Receipt,
  Link,
  Copy,
  Check,
} from 'lucide-react';
import { db } from '@/lib/firebase/config';
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { formatCurrency, Quote } from '@/shared/types/pricing';
import { usePermission } from '@/shared/hooks/usePermission';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import {
  ProposalDocument,
  ProposalServiceLine,
  ProposalTerms,
  PrepaymentTier,
  EconomicParameters,
  DEFAULT_ECONOMIC_PARAMETERS,
  DEFAULT_PROPOSAL_TERMS,
  generateProposalNumber,
  ProposalDocStatus,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
  PrepaymentPeriod,
} from '@/shared/types/pricing/proposal';
import {
  calculateAllPaymentPlans,
  generateEconomicSummary,
  calculateLumpSumDiscount,
} from '@/shared/services/pricing/prepaymentCalculator';

// ============================================
// COMPANY DEFAULTS (Ajans bilgileri)
// ============================================

const COMPANY_INFO = {
  name: 'intiba.',
  title: 'intiba Dijital Medya',
  address: 'Istanbul, Turkiye',
  phone: '+90 xxx xxx xx xx',
  email: 'info@intiba.co',
  taxId: '',
  taxOffice: '',
};

const ProposalViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const quoteId = searchParams.get('quoteId');
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [proposal, setProposal] = useState<ProposalDocument | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [showEconomicDetails, setShowEconomicDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [editTerms, setEditTerms] = useState<ProposalTerms>(DEFAULT_PROPOSAL_TERMS);
  const [editParams, setEditParams] = useState<EconomicParameters>(DEFAULT_ECONOMIC_PARAMETERS);
  const [editClientCompany, setEditClientCompany] = useState('');
  const [editClientAddress, setEditClientAddress] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [editValidityDays, setEditValidityDays] = useState(30);
  const printRef = useRef<HTMLDivElement>(null);

  const { can } = usePermission();
  const canViewCost = can(PERMISSIONS.PRICING_VIEW_COST);

  const isNewProposal = !id && quoteId;

  useEffect(() => {
    if (id) {
      loadProposal(id);
    } else if (quoteId) {
      loadQuoteAndGenerate(quoteId);
    }
  }, [id, quoteId]);

  const loadProposal = async (proposalId: string) => {
    if (!db) return;
    try {
      const docSnap = await getDoc(doc(db, 'proposals', proposalId));
      if (docSnap.exists()) {
        setProposal({ id: docSnap.id, ...docSnap.data() } as ProposalDocument);
      }
    } catch (err) {
      console.error('Error loading proposal:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadQuoteAndGenerate = async (qId: string) => {
    if (!db) return;
    try {
      const docSnap = await getDoc(doc(db, 'quotes', qId));
      if (docSnap.exists()) {
        const quoteData = { id: docSnap.id, ...docSnap.data() };
        setQuote(quoteData);
        generateProposal(quoteData);
      }
    } catch (err) {
      console.error('Error loading quote:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateProposal = (quoteData: any) => {
    const price = quoteData.finalPrice || quoteData.sellPrice || 0;
    const projectType = quoteData.projectType || quoteData.billingType || 'one_time';
    const isRecurring = projectType === 'retainer' || quoteData.billingType === 'recurring';

    // Hizmet kalemleri olustur
    const serviceLines: ProposalServiceLine[] = [];

    // 1) Katalogdan gelen detayli serviceLines varsa kullan
    //    ONEMLI: serviceLines icindeki degerler dahili maliyetlerdir (ornegin 147K).
    //    Ancak musteriye gosterilecek fiyat sellPrice'dir (ornegin 220K).
    //    Bu yuzden her kalemi orantili olarak sellPrice'a yukseltiriz.
    if (quoteData.serviceLines && quoteData.serviceLines.length > 0) {
      const rawCostTotal = quoteData.serviceLines.reduce(
        (sum: number, l: any) => sum + (l.totalCost || 0), 0
      );
      // Markup orani: sellPrice / toplam maliyet (ornegin 220K / 147K = 1.50)
      const markupRatio = (rawCostTotal > 0 && price > 0) ? price / rawCostTotal : 1;

      quoteData.serviceLines.forEach((line: any) => {
        const adjustedTotal = Math.round((line.totalCost || 0) * markupRatio);
        const qty = line.quantity || 1;
        serviceLines.push({
          name: line.name,
          description: '',
          quantity: qty,
          unit: 'kalem',
          unitPrice: Math.round(adjustedTotal / qty),
          total: adjustedTotal,
        });
      });
    }
    // 2) CostEngine breakdown varsa kullan
    else if (quoteData.breakdown) {
      const bd = quoteData.breakdown;
      if (bd.laborCosts?.ownerTotal > 0) {
        serviceLines.push({
          name: 'Kreatif Yonetim & Cekim',
          description: 'Profesyonel kreatif yonetim, konsept gelistirme ve cekim yonetimi',
          quantity: bd.laborCosts.ownerDays || 1,
          unit: 'gun',
          unitPrice: Math.round(bd.laborCosts.ownerTotal / (bd.laborCosts.ownerDays || 1)),
          total: bd.laborCosts.ownerTotal,
        });
      }
      if (bd.laborCosts?.juniorTotal > 0) {
        const isHourly = bd.laborCosts.juniorHours > 0;
        serviceLines.push({
          name: isHourly ? 'Sosyal Medya Yonetimi' : 'Icerik Uretimi & Produksiyon',
          description: isHourly
            ? 'Sosyal medya icerik planlama, paylasim ve topluluk yonetimi'
            : 'Video/fotograf icerik uretimi, kurgu ve post-produksiyon',
          quantity: isHourly ? bd.laborCosts.juniorHours : bd.laborCosts.juniorDays,
          unit: isHourly ? 'saat' : 'gun',
          unitPrice: Math.round(bd.laborCosts.juniorTotal / (isHourly ? bd.laborCosts.juniorHours : bd.laborCosts.juniorDays || 1)),
          total: bd.laborCosts.juniorTotal,
        });
      }
      if (bd.gearCosts?.cameraTotal > 0) {
        serviceLines.push({
          name: 'Profesyonel Ekipman',
          description: 'Kamera, lens, isik ve ses ekipman kullanimi',
          quantity: bd.gearCosts.cameraDays || 1,
          unit: 'gun',
          unitPrice: Math.round((bd.gearCosts.cameraTotal + (bd.gearCosts.lightTotal || 0) + (bd.gearCosts.workstationTotal || 0)) / (bd.gearCosts.cameraDays || 1)),
          total: (bd.gearCosts.cameraTotal || 0) + (bd.gearCosts.lightTotal || 0) + (bd.gearCosts.workstationTotal || 0),
        });
      }
      if (bd.additionalExpenses > 0) {
        serviceLines.push({
          name: 'Lojistik & Ek Giderler',
          description: 'Ulasim, konaklama ve diger proje giderleri',
          quantity: 1,
          unit: 'kalem',
          unitPrice: bd.additionalExpenses,
          total: bd.additionalExpenses,
        });
      }
    }
    // 3) QuoteWizard items varsa kullan
    else if (quoteData.items && quoteData.items.length > 0) {
      quoteData.items.forEach((item: any) => {
        serviceLines.push({
          name: item.serviceName || 'Hizmet',
          description: item.notes || '',
          quantity: item.quantity || 1,
          unit: 'adet',
          unitPrice: item.useOverride ? item.priceOverride : item.subtotal,
          total: (item.useOverride ? item.priceOverride : item.subtotal) * (item.quantity || 1),
        });
      });
    }

    // Eger hizmet kalemi yoksa tek kalem olarak ekle
    if (serviceLines.length === 0) {
      serviceLines.push({
        name: isRecurring ? 'Aylik Dijital Hizmet Paketi' : 'Dijital Produksiyon Hizmeti',
        description: isRecurring
          ? 'Aylik dijital icerik uretimi, sosyal medya yonetimi ve kreatif hizmetler'
          : 'Profesyonel dijital icerik uretimi ve produksiyon hizmeti',
        quantity: 1,
        unit: isRecurring ? 'ay' : 'proje',
        unitPrice: price,
        total: price,
      });
    }

    // ONEMLI: subtotal her zaman sellPrice (onerilen fiyat) olmali.
    // serviceLines toplami yuvarlamadan dolayi kucuk fark verebilir,
    // bu yuzden price (sellPrice) varsa onu kullaniyoruz.
    const serviceLinesTotal = serviceLines.reduce((sum, line) => sum + line.total, 0);
    const subtotal = price > 0 ? price : serviceLinesTotal;
    const netTotal = subtotal;
    const kdvRate = 0.20;
    const kdvAmount = Math.round(netTotal * kdvRate);
    const grandTotal = netTotal + kdvAmount;

    // Odeme planlari hesapla
    let paymentPlans: PrepaymentTier[] = [];
    if (isRecurring) {
      // Aylik tekrar eden hizmetler icin pesin odeme iskontosu
      paymentPlans = calculateAllPaymentPlans(price, editParams);
    } else {
      // Tek seferlik projelerde pesin odeme bilgisi
      const lumpSum = calculateLumpSumDiscount(grandTotal, editParams);
      paymentPlans = [
        {
          period: 1 as PrepaymentPeriod,
          label: 'Standart Odeme',
          discountPercent: 0,
          fairDiscount: 0,
          incentiveExtra: 0,
          monthlyAmount: grandTotal,
          totalWithoutDiscount: grandTotal,
          discountAmount: 0,
          totalWithDiscount: grandTotal,
          savingsDescription: 'Fatura tarihinden itibaren 7 is gunu icerisinde odeme.',
        },
        {
          period: 3 as PrepaymentPeriod,
          label: 'Pesin Odeme',
          discountPercent: lumpSum.discountPercent,
          fairDiscount: lumpSum.discountPercent * 0.6,
          incentiveExtra: lumpSum.discountPercent * 0.4,
          monthlyAmount: 0,
          totalWithoutDiscount: grandTotal,
          discountAmount: lumpSum.discountAmount,
          totalWithDiscount: lumpSum.discountedPrice,
          savingsDescription: lumpSum.description,
        },
      ];
    }

    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + editValidityDays);

    const proposalData: Omit<ProposalDocument, 'id' | 'createdAt' | 'updatedAt'> = {
      quoteId: quoteData.id,
      quoteVersion: 1,
      proposalNumber: generateProposalNumber(1),
      companyName: COMPANY_INFO.name,
      companyTitle: COMPANY_INFO.title,
      companyAddress: COMPANY_INFO.address,
      companyPhone: COMPANY_INFO.phone,
      companyEmail: COMPANY_INFO.email,
      clientName: quoteData.clientName || '',
      clientCompany: editClientCompany || quoteData.clientCompany || '',
      clientEmail: quoteData.clientEmail || '',
      clientPhone: quoteData.clientPhone || '',
      clientAddress: editClientAddress,
      projectTitle: quoteData.projectTitle || quoteData.serviceName || quoteData.clientName || 'Dijital Hizmet Teklifi',
      projectDescription: editProjectDescription || quoteData.serviceDescription || (isRecurring
        ? 'Aylik dijital icerik uretimi, sosyal medya yonetimi ve kreatif hizmetler kapsaminda hazirlanmis tekliftir.'
        : 'Profesyonel dijital icerik uretimi ve produksiyon hizmeti kapsaminda hazirlanmis tekliftir.'),
      serviceLines,
      internalCost: quoteData.totalInternalCost || quoteData.rawCost || 0,
      internalMargin: quoteData.actualMargin || quoteData.actualMarginPercent || 0,
      subtotal,
      discountAmount: 0,
      netTotal,
      kdvRate,
      kdvAmount,
      grandTotal,
      paymentPlans,
      economicParameters: editParams,
      terms: editTerms,
      validityDays: editValidityDays,
      validUntil: Timestamp.fromDate(validUntilDate),
      status: 'draft' as ProposalDocStatus,
      createdBy: 'admin',
      version: 1,
    };

    setProposal(proposalData as ProposalDocument);
    setIsEditing(true);
  };

  const saveProposal = async () => {
    if (!db || !proposal) return;
    setIsSaving(true);

    try {
      // Teklif numarasi icin mevcut sayiyi bul
      const proposalsRef = collection(db, 'proposals');
      const countSnap = await getDocs(query(proposalsRef, orderBy('createdAt', 'desc'), limit(1)));
      let nextNumber = 1;
      if (!countSnap.empty) {
        const lastProposal = countSnap.docs[0].data();
        const lastNumber = parseInt(lastProposal.proposalNumber?.split('-').pop() || '0');
        nextNumber = lastNumber + 1;
      }

      const proposalToSave = {
        ...proposal,
        proposalNumber: generateProposalNumber(nextNumber),
        status: 'ready',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // id alanini cikar
      const { id: _id, ...dataToSave } = proposalToSave;

      if (proposal.id) {
        // Guncelle
        await updateDoc(doc(db, 'proposals', proposal.id), {
          ...dataToSave,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Yeni olustur
        const docRef = await addDoc(proposalsRef, dataToSave);
        setProposal({ ...proposal, id: docRef.id, proposalNumber: generateProposalNumber(nextNumber), status: 'ready' });
      }

      setIsEditing(false);
    } catch (err) {
      console.error('Error saving proposal:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // ── Service Line Editing ──────────────────────
  const applyServiceLines = (lines: ProposalServiceLine[]) => {
    if (!proposal) return;
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const kdvAmount = Math.round(subtotal * proposal.kdvRate);
    setProposal({
      ...proposal,
      serviceLines: lines,
      subtotal,
      netTotal: subtotal,
      kdvAmount,
      grandTotal: subtotal + kdvAmount,
    });
  };

  const updateServiceLine = (
    index: number,
    field: keyof ProposalServiceLine,
    value: string | number
  ) => {
    if (!proposal) return;
    const updated = proposal.serviceLines.map((line, i) => {
      if (i !== index) return line;
      const next = { ...line, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        next.total = Number(next.quantity) * Number(next.unitPrice);
      }
      return next;
    });
    applyServiceLines(updated);
  };

  const addServiceLine = () => {
    if (!proposal) return;
    applyServiceLines([
      ...proposal.serviceLines,
      { name: 'Yeni Hizmet', description: '', quantity: 1, unit: 'kalem', unitPrice: 0, total: 0 },
    ]);
  };

  const removeServiceLine = (index: number) => {
    if (!proposal || proposal.serviceLines.length <= 1) return;
    applyServiceLines(proposal.serviceLines.filter((_, i) => i !== index));
  };

  const handleShareLink = async () => {
    if (!proposal) return;
    setIsGeneratingLink(true);

    try {
      let token = proposal.shareToken;

      // Token yoksa oluştur ve Firestore'a kaydet
      if (!token) {
        token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        if (db && proposal.id) {
          await updateDoc(doc(db, 'proposals', proposal.id), { shareToken: token });
        }
        setProposal({ ...proposal, shareToken: token });
      }

      const url = `${window.location.origin}/teklif/${token}`;
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    } catch (err) {
      console.error('Share link error:', err);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // Odeme planlari yeniden hesapla
  const recalculatedPlans = useMemo(() => {
    if (!proposal) return [];
    const isRecurring = proposal.paymentPlans.length > 2;
    if (isRecurring) {
      // Aylik fiyat: netTotal (onerilen satis fiyati)
      return calculateAllPaymentPlans(proposal.netTotal, editParams);
    }
    return proposal.paymentPlans;
  }, [proposal, editParams]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#171717]" />
          <p className="font-grotesk text-sm text-neutral-500">Teklif yukleniyor...</p>
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="text-center py-16">
        <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
        <p className="font-grotesk text-neutral-500">Teklif bulunamadi</p>
      </div>
    );
  }

  const activePlans = recalculatedPlans.length > 0 ? recalculatedPlans : proposal.paymentPlans;
  const isRecurring = activePlans.length > 2;

  return (
    <div className="space-y-6">
      {/* Toolbar - sadece ekranda goster, yazdirirken gizle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/pricing/proposals')}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-700" />
          </button>
          <div>
            <h1 className="text-xl font-grotesk font-bold text-[#171717]">
              {proposal.proposalNumber || 'Yeni Teklif'}
            </h1>
            <p className="font-grotesk text-sm text-neutral-500">
              {proposal.clientName} - {proposal.projectTitle}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing && (
            <motion.button
              onClick={saveProposal}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-full font-grotesk text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Kaydet
            </motion.button>
          )}
          {proposal?.id && (
            <motion.button
              onClick={handleShareLink}
              disabled={isGeneratingLink}
              className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isGeneratingLink ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : linkCopied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Link className="w-4 h-4" />
              )}
              {linkCopied ? 'Kopyalandı!' : proposal.shareToken ? 'Link Kopyala' : 'Link Oluştur'}
            </motion.button>
          )}
          <motion.button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Printer className="w-4 h-4" />
            Yazdir / PDF
          </motion.button>
        </div>
      </div>

      {/* Editing Panel - isNew ise goster (sadece admin/cost yetkisi olanlar) */}
      {isEditing && canViewCost && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 print:hidden">
          <h3 className="font-grotesk text-sm font-semibold text-amber-800 mb-4 flex items-center gap-2">
            <Edit3 className="w-4 h-4" />
            Teklif Bilgilerini Duzenle
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-grotesk text-xs text-amber-700 mb-1">Musteri Firma</label>
              <input
                type="text"
                value={editClientCompany}
                onChange={(e) => setEditClientCompany(e.target.value)}
                placeholder="ABC Sirket A.S."
                className="w-full px-3 py-2 rounded-lg border border-amber-200 font-grotesk text-sm focus:outline-none focus:border-amber-400 bg-white"
              />
            </div>
            <div>
              <label className="block font-grotesk text-xs text-amber-700 mb-1">Musteri Adresi</label>
              <input
                type="text"
                value={editClientAddress}
                onChange={(e) => setEditClientAddress(e.target.value)}
                placeholder="Istanbul, Turkiye"
                className="w-full px-3 py-2 rounded-lg border border-amber-200 font-grotesk text-sm focus:outline-none focus:border-amber-400 bg-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-grotesk text-xs text-amber-700 mb-1">Proje Aciklamasi</label>
              <textarea
                value={editProjectDescription}
                onChange={(e) => setEditProjectDescription(e.target.value)}
                rows={2}
                placeholder="Profesyonel dijital icerik uretimi..."
                className="w-full px-3 py-2 rounded-lg border border-amber-200 font-grotesk text-sm focus:outline-none focus:border-amber-400 bg-white resize-none"
              />
            </div>
            <div>
              <label className="block font-grotesk text-xs text-amber-700 mb-1">Gecerlilik (gun)</label>
              <select
                value={editValidityDays}
                onChange={(e) => setEditValidityDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-amber-200 font-grotesk text-sm focus:outline-none focus:border-amber-400 bg-white"
              >
                <option value={7}>7 gun</option>
                <option value={15}>15 gun</option>
                <option value={30}>30 gun</option>
              </select>
            </div>
            <div>
              <label className="block font-grotesk text-xs text-amber-700 mb-1">Mevduat Faizi (%)</label>
              <input
                type="number"
                value={Math.round(editParams.annualDepositRate * 100)}
                onChange={(e) => setEditParams({ ...editParams, annualDepositRate: Number(e.target.value) / 100 })}
                className="w-full px-3 py-2 rounded-lg border border-amber-200 font-grotesk text-sm focus:outline-none focus:border-amber-400 bg-white"
              />
            </div>
          </div>
          {/* Service Lines Editor */}
          <div className="mt-5 border-t border-amber-200 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-grotesk text-xs font-semibold text-amber-800">
                Hizmet Kalemleri
              </h4>
              <button
                onClick={addServiceLine}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white rounded-lg font-grotesk text-xs font-medium hover:bg-amber-700 transition-colors"
              >
                + Satır Ekle
              </button>
            </div>

            <datalist id="unit-options">
              <option value="kalem" />
              <option value="gün" />
              <option value="saat" />
              <option value="adet" />
              <option value="ay" />
              <option value="proje" />
              <option value="hafta" />
              <option value="kişi" />
              <option value="set" />
            </datalist>

            <div className="overflow-x-auto rounded-lg border border-amber-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-amber-100/60">
                    <th className="text-left py-2 px-3 font-grotesk font-semibold text-amber-800 min-w-[160px]">Hizmet Adı</th>
                    <th className="text-center py-2 px-2 font-grotesk font-semibold text-amber-800 w-20">Miktar</th>
                    <th className="text-center py-2 px-2 font-grotesk font-semibold text-amber-800 w-24">Birim</th>
                    <th className="text-right py-2 px-2 font-grotesk font-semibold text-amber-800 w-28">Birim Fiyat</th>
                    <th className="text-right py-2 px-2 font-grotesk font-semibold text-amber-800 w-24">Toplam</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {proposal.serviceLines.map((line, i) => (
                    <tr key={i} className="border-t border-amber-100">
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={line.name}
                          onChange={(e) => updateServiceLine(i, 'name', e.target.value)}
                          className="w-full px-2 py-1 rounded border border-amber-200 font-grotesk text-xs focus:outline-none focus:border-amber-400 bg-white"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          min={0}
                          value={line.quantity}
                          onChange={(e) => updateServiceLine(i, 'quantity', Number(e.target.value))}
                          className="w-full px-2 py-1 rounded border border-amber-200 font-grotesk text-xs text-center focus:outline-none focus:border-amber-400 bg-white"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          list="unit-options"
                          value={line.unit}
                          onChange={(e) => updateServiceLine(i, 'unit', e.target.value)}
                          placeholder="kalem"
                          className="w-full px-2 py-1 rounded border border-amber-200 font-grotesk text-xs text-center focus:outline-none focus:border-amber-400 bg-white"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          min={0}
                          value={line.unitPrice}
                          onChange={(e) => updateServiceLine(i, 'unitPrice', Number(e.target.value))}
                          className="w-full px-2 py-1 rounded border border-amber-200 font-grotesk text-xs text-right focus:outline-none focus:border-amber-400 bg-white"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-right font-grotesk text-amber-900 font-medium whitespace-nowrap">
                        {formatCurrency(line.total)} TL
                      </td>
                      <td className="py-1.5 px-1">
                        <button
                          onClick={() => removeServiceLine(i)}
                          disabled={proposal.serviceLines.length <= 1}
                          className="w-6 h-6 flex items-center justify-center text-amber-400 hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors rounded"
                          title="Satırı sil"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-amber-300 bg-amber-50">
                    <td colSpan={4} className="py-2 px-3 text-right font-grotesk font-semibold text-amber-800 text-xs">
                      Ara Toplam
                    </td>
                    <td className="py-2 px-2 text-right font-grotesk font-bold text-amber-900 text-xs whitespace-nowrap">
                      {formatCurrency(proposal.subtotal)} TL
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                if (quote) generateProposal(quote);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg font-grotesk text-xs font-medium hover:bg-amber-700 transition-colors"
            >
              Yeniden Hesapla
            </button>
          </div>
        </div>
      )}

      {/* PROPOSAL DOCUMENT */}
      <div ref={printRef} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden print:border-none print:rounded-none print:shadow-none">

        {/* Letterhead */}
        <div className="bg-[#171717] text-white p-8 md:p-12">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div>
              <h1 className="font-grotesk text-4xl font-bold tracking-tight">
                {proposal.companyName}
              </h1>
              <p className="font-grotesk text-neutral-400 mt-1">{proposal.companyTitle}</p>
            </div>
            <div className="text-right">
              <p className="font-grotesk text-2xl font-bold text-white/90">HIZMET TEKLIFI</p>
              <p className="font-grotesk text-sm text-neutral-400 mt-1">
                {proposal.proposalNumber || 'TASLAK'}
              </p>
              <p className="font-grotesk text-xs text-neutral-500 mt-2">
                {new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Client & Company Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 md:p-12 border-b border-neutral-100">
          <div>
            <h3 className="font-grotesk text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              TEKLIF VEREN
            </h3>
            <div className="space-y-1.5">
              <p className="font-grotesk text-sm font-medium text-[#171717]">{proposal.companyTitle}</p>
              <p className="font-grotesk text-sm text-neutral-500 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" /> {proposal.companyAddress}
              </p>
              <p className="font-grotesk text-sm text-neutral-500 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> {proposal.companyPhone}
              </p>
              <p className="font-grotesk text-sm text-neutral-500 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" /> {proposal.companyEmail}
              </p>
            </div>
          </div>
          <div>
            <h3 className="font-grotesk text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              TEKLIF ALAN
            </h3>
            <div className="space-y-1.5">
              <p className="font-grotesk text-sm font-medium text-[#171717]">
                {proposal.clientCompany || proposal.clientName}
              </p>
              <p className="font-grotesk text-sm text-neutral-600">
                Sayin {proposal.clientName}
              </p>
              {proposal.clientAddress && (
                <p className="font-grotesk text-sm text-neutral-500 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" /> {proposal.clientAddress}
                </p>
              )}
              {proposal.clientEmail && (
                <p className="font-grotesk text-sm text-neutral-500 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" /> {proposal.clientEmail}
                </p>
              )}
              {proposal.clientPhone && (
                <p className="font-grotesk text-sm text-neutral-500 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" /> {proposal.clientPhone}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Project Description */}
        <div className="p-8 md:p-12 border-b border-neutral-100">
          <h2 className="font-grotesk text-xl font-bold text-[#171717] mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Proje Hakkinda
          </h2>
          <p className="font-grotesk text-sm text-neutral-600 leading-relaxed">
            {proposal.projectDescription}
          </p>
        </div>

        {/* Service Lines Table */}
        <div className="p-8 md:p-12 border-b border-neutral-100">
          <h2 className="font-grotesk text-xl font-bold text-[#171717] mb-6 flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Hizmet Kalemleri
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-neutral-200">
                  <th className="text-left py-3 px-2 font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Hizmet
                  </th>
                  <th className="text-center py-3 px-2 font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Miktar
                  </th>
                  <th className="text-center py-3 px-2 font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Birim
                  </th>
                  <th className="text-right py-3 px-2 font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Birim Fiyat
                  </th>
                  <th className="text-right py-3 px-2 font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Toplam
                  </th>
                </tr>
              </thead>
              <tbody>
                {proposal.serviceLines.map((line, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="py-4 px-2">
                      <p className="font-grotesk text-sm font-medium text-[#171717]">{line.name}</p>
                      {line.description && (
                        <p className="font-grotesk text-xs text-neutral-400 mt-0.5">{line.description}</p>
                      )}
                    </td>
                    <td className="py-4 px-2 text-center font-grotesk text-sm text-neutral-700">
                      {line.quantity}
                    </td>
                    <td className="py-4 px-2 text-center font-grotesk text-sm text-neutral-500">
                      {line.unit}
                    </td>
                    <td className="py-4 px-2 text-right font-grotesk text-sm text-neutral-700">
                      {formatCurrency(line.unitPrice)} TL
                    </td>
                    <td className="py-4 px-2 text-right font-grotesk text-sm font-medium text-[#171717]">
                      {formatCurrency(line.total)} TL
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-200">
                  <td colSpan={4} className="py-3 px-2 text-right font-grotesk text-sm text-neutral-600">
                    Ara Toplam
                  </td>
                  <td className="py-3 px-2 text-right font-grotesk text-sm font-medium text-[#171717]">
                    {formatCurrency(proposal.subtotal)} TL
                  </td>
                </tr>
                {proposal.discountAmount > 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 px-2 text-right font-grotesk text-sm text-green-600">
                      Iskonto ({proposal.discountPercent ? `%${proposal.discountPercent * 100}` : ''})
                    </td>
                    <td className="py-2 px-2 text-right font-grotesk text-sm font-medium text-green-600">
                      -{formatCurrency(proposal.discountAmount)} TL
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={4} className="py-2 px-2 text-right font-grotesk text-sm text-neutral-600">
                    KDV (%{proposal.kdvRate * 100})
                  </td>
                  <td className="py-2 px-2 text-right font-grotesk text-sm text-neutral-600">
                    {formatCurrency(proposal.kdvAmount)} TL
                  </td>
                </tr>
                <tr className="bg-[#171717]">
                  <td colSpan={4} className="py-4 px-4 text-right font-grotesk text-sm font-bold text-white">
                    GENEL TOPLAM (KDV Dahil)
                  </td>
                  <td className="py-4 px-4 text-right font-grotesk text-xl font-bold text-white">
                    {formatCurrency(proposal.grandTotal)} TL
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* PAYMENT PLANS - Ana ozellik */}
        <div className="p-8 md:p-12 border-b border-neutral-100">
          <h2 className="font-grotesk text-xl font-bold text-[#171717] mb-2 flex items-center gap-2">
            <BadgePercent className="w-5 h-5" />
            Odeme Planlari & Iskonto Secenekleri
          </h2>
          <p className="font-grotesk text-sm text-neutral-500 mb-6">
            {isRecurring
              ? 'Toplu odeme secenekleriyle onemli tasarruflar elde edebilirsiniz. Iskonto oranlari guncel ekonomik verilere dayali olarak hesaplanmistir.'
              : 'Odeme secenek ve kosullarimiz asagidaki gibidir.'
            }
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {activePlans.map((plan, index) => {
              const isPopular = plan.period === 12;
              const hasDiscount = plan.discountPercent > 0;

              return (
                <motion.div
                  key={plan.period}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className={`relative rounded-2xl border-2 p-5 transition-all ${
                    isPopular
                      ? 'border-[#171717] bg-[#171717] text-white'
                      : hasDiscount
                      ? 'border-green-200 bg-green-50/50 hover:border-green-300'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-green-500 text-white text-xs font-grotesk font-medium px-3 py-1 rounded-full">
                        En Avantajli
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-4">
                    <p className={`font-grotesk text-xs font-semibold uppercase tracking-wider mb-1 ${
                      isPopular ? 'text-neutral-400' : 'text-neutral-500'
                    }`}>
                      {plan.label}
                    </p>
                    {hasDiscount && (
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-grotesk font-bold ${
                        isPopular ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'
                      }`}>
                        <TrendingDown className="w-3 h-3" />
                        %{(plan.discountPercent * 100).toFixed(0)} iskonto
                      </div>
                    )}
                  </div>

                  {isRecurring ? (
                    <>
                      {plan.period === 1 ? (
                        <div className="text-center mb-4">
                          <p className={`font-grotesk text-2xl font-bold ${isPopular ? 'text-white' : 'text-[#171717]'}`}>
                            {formatCurrency(plan.monthlyAmount)} TL
                          </p>
                          <p className={`font-grotesk text-xs ${isPopular ? 'text-neutral-400' : 'text-neutral-500'}`}>
                            / ay (KDV haric)
                          </p>
                        </div>
                      ) : (
                        <div className="text-center mb-4">
                          <p className={`font-grotesk text-xs line-through ${isPopular ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            {formatCurrency(plan.totalWithoutDiscount)} TL
                          </p>
                          <p className={`font-grotesk text-2xl font-bold ${isPopular ? 'text-white' : 'text-[#171717]'}`}>
                            {formatCurrency(plan.totalWithDiscount)} TL
                          </p>
                          <p className={`font-grotesk text-xs ${isPopular ? 'text-neutral-400' : 'text-neutral-500'}`}>
                            / {plan.period} ay toplam (KDV haric)
                          </p>
                          <p className={`font-grotesk text-xs mt-1 ${isPopular ? 'text-green-400' : 'text-green-600'}`}>
                            {formatCurrency(plan.discountAmount)} TL tasarruf
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center mb-4">
                      {hasDiscount ? (
                        <>
                          <p className={`font-grotesk text-xs line-through ${isPopular ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            {formatCurrency(plan.totalWithoutDiscount)} TL
                          </p>
                          <p className={`font-grotesk text-2xl font-bold ${isPopular ? 'text-white' : 'text-[#171717]'}`}>
                            {formatCurrency(plan.totalWithDiscount)} TL
                          </p>
                          <p className={`font-grotesk text-xs mt-1 ${isPopular ? 'text-green-400' : 'text-green-600'}`}>
                            {formatCurrency(plan.discountAmount)} TL tasarruf
                          </p>
                        </>
                      ) : (
                        <p className={`font-grotesk text-2xl font-bold ${isPopular ? 'text-white' : 'text-[#171717]'}`}>
                          {formatCurrency(plan.totalWithDiscount)} TL
                        </p>
                      )}
                    </div>
                  )}

                  <p className={`font-grotesk text-xs text-center leading-relaxed ${
                    isPopular ? 'text-neutral-400' : 'text-neutral-500'
                  }`}>
                    {plan.savingsDescription}
                  </p>

                  {/* Advantages */}
                  {hasDiscount && (
                    <div className={`mt-4 pt-4 border-t ${isPopular ? 'border-white/10' : 'border-neutral-200'}`}>
                      <ul className="space-y-1.5">
                        <li className={`flex items-center gap-1.5 font-grotesk text-xs ${
                          isPopular ? 'text-neutral-300' : 'text-neutral-600'
                        }`}>
                          <CheckCircle className={`w-3 h-3 flex-shrink-0 ${isPopular ? 'text-green-400' : 'text-green-500'}`} />
                          Oncelikli hizmet
                        </li>
                        {plan.period >= 12 && (
                          <li className={`flex items-center gap-1.5 font-grotesk text-xs ${
                            isPopular ? 'text-neutral-300' : 'text-neutral-600'
                          }`}>
                            <CheckCircle className={`w-3 h-3 flex-shrink-0 ${isPopular ? 'text-green-400' : 'text-green-500'}`} />
                            Yillik strateji planlamasi
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Economic Basis - sadece maliyet yetkisi olanlar gorur */}
          {isRecurring && canViewCost && (
            <div className="mt-6">
              <button
                onClick={() => setShowEconomicDetails(!showEconomicDetails)}
                className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 transition-colors print:hidden"
              >
                <Info className="w-4 h-4" />
                <span className="font-grotesk text-xs">Iskonto hesaplama detaylari</span>
                {showEconomicDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showEconomicDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 bg-neutral-50 rounded-xl p-5 print:hidden"
                >
                  <h4 className="font-grotesk text-xs font-semibold text-neutral-700 mb-3">
                    Ekonomik Parametreler (Subat 2026)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="font-grotesk text-xs text-neutral-500">TCMB Politika Faizi</p>
                      <p className="font-grotesk text-sm font-medium text-[#171717]">
                        %{(proposal.economicParameters.tcmbPolicyRate * 100).toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="font-grotesk text-xs text-neutral-500">Mevduat Faizi (yillik)</p>
                      <p className="font-grotesk text-sm font-medium text-[#171717]">
                        %{(proposal.economicParameters.annualDepositRate * 100).toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="font-grotesk text-xs text-neutral-500">Beklenen Enflasyon</p>
                      <p className="font-grotesk text-sm font-medium text-[#171717]">
                        %{(proposal.economicParameters.expectedInflation * 100).toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="font-grotesk text-xs text-neutral-500">Ajans Risk Primi</p>
                      <p className="font-grotesk text-sm font-medium text-[#171717]">
                        %{(proposal.economicParameters.agencyRiskPremium * 100).toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-neutral-200 pt-3">
                    <h4 className="font-grotesk text-xs font-semibold text-neutral-700 mb-2">
                      Iskonto Hesaplama Yontemi
                    </h4>
                    <p className="font-grotesk text-xs text-neutral-500 leading-relaxed">
                      Iskonto oranlari, musterinin pesin odemesi durumunda kaybedecegi mevduat faiz getirisi
                      (firsat maliyeti) ile ajansimizin elde ettigi nakit akis guvencesi, tahsilat riski azalmasi
                      ve yonetim tasarrufu dengelenerek NPV (Net Bugunki Deger) yontemiyle hesaplanmistir.
                      Aylik bilisik mevduat orani (~%{((Math.pow(1 + proposal.economicParameters.annualDepositRate, 1/12) - 1) * 100).toFixed(2)})
                      uzerinden her donem icin adil iskonto hesaplanmis, ustune ajans risk primi (%{(proposal.economicParameters.agencyRiskPremium * 100).toFixed(1)}) ile tesvik iskontosu eklenmistir.
                    </p>
                  </div>

                  {/* Donem bazli detay tablosu */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200">
                          <th className="text-left py-2 px-2 font-grotesk font-semibold text-neutral-600">Donem</th>
                          <th className="text-right py-2 px-2 font-grotesk font-semibold text-neutral-600">NPV Iskontosu</th>
                          <th className="text-right py-2 px-2 font-grotesk font-semibold text-neutral-600">Tesvik Eki</th>
                          <th className="text-right py-2 px-2 font-grotesk font-semibold text-neutral-600">Toplam Iskonto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePlans.filter(p => p.period > 1).map(plan => (
                          <tr key={plan.period} className="border-b border-neutral-100">
                            <td className="py-2 px-2 font-grotesk text-neutral-700">{plan.label}</td>
                            <td className="py-2 px-2 text-right font-grotesk text-neutral-600">
                              %{(plan.fairDiscount * 100).toFixed(1)}
                            </td>
                            <td className="py-2 px-2 text-right font-grotesk text-neutral-600">
                              %{(plan.incentiveExtra * 100).toFixed(1)}
                            </td>
                            <td className="py-2 px-2 text-right font-grotesk font-medium text-green-700">
                              %{(plan.discountPercent * 100).toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Terms & Conditions */}
        <div className="p-8 md:p-12 border-b border-neutral-100">
          <h2 className="font-grotesk text-xl font-bold text-[#171717] mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Kosullar & Sartlar
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                  Odeme Kosullari
                </h4>
                <p className="font-grotesk text-sm text-neutral-600">
                  {proposal.terms.paymentTerms}
                </p>
              </div>
              <div>
                <h4 className="font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                  Teslim Suresi
                </h4>
                <p className="font-grotesk text-sm text-neutral-600">
                  {proposal.terms.deliveryTimeline}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                  Revizyon Politikasi
                </h4>
                <p className="font-grotesk text-sm text-neutral-600">
                  {proposal.terms.revisionPolicy}
                </p>
              </div>
              <div>
                <h4 className="font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                  Iptal Politikasi
                </h4>
                <p className="font-grotesk text-sm text-neutral-600">
                  {proposal.terms.cancellationPolicy}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Validity & Signature */}
        <div className="p-8 md:p-12">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            {/* Validity */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-grotesk text-sm font-semibold text-[#171717]">
                  Teklif Gecerliligi
                </h4>
                <p className="font-grotesk text-sm text-neutral-600">
                  Bu teklif, duzenleme tarihinden itibaren <strong>{proposal.validityDays} gun</strong> sureyle gecerlidir.
                </p>
                {proposal.validUntil && (
                  <p className="font-grotesk text-xs text-neutral-400 mt-1">
                    Son gecerlilik: {(() => {
                      try {
                        const d = proposal.validUntil.toDate ? proposal.validUntil.toDate() : new Date();
                        return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
                      } catch { return '-'; }
                    })()}
                  </p>
                )}
              </div>
            </div>

            {/* Signature Area */}
            <div className="flex-shrink-0 w-64">
              <div className="border-t-2 border-[#171717] pt-4 mt-12">
                <p className="font-grotesk text-sm font-medium text-[#171717]">Onay Imzasi</p>
                <p className="font-grotesk text-xs text-neutral-500 mt-1">
                  Tarih: ___________________
                </p>
                <p className="font-grotesk text-xs text-neutral-500 mt-1">
                  Ad Soyad: ___________________
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-neutral-100 text-center">
            <p className="font-grotesk text-lg font-bold text-[#171717]">{proposal.companyName}</p>
            <p className="font-grotesk text-xs text-neutral-400 mt-1">
              {proposal.companyTitle} | {proposal.companyPhone} | {proposal.companyEmail}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalViewPage;
