import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  X,
  Save,
  FileText,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import {
  QuoteWizardState,
  INITIAL_WIZARD_STATE,
  StaffMember,
  Equipment,
  calculateStaffRates,
  calculateEquipmentDailyRate,
  DEFAULT_PRICING_CONFIG,
  Quote,
  QuoteStatus,
} from '@/shared/types/pricing';

import WizardProgress from './components/WizardProgress';
import Step1Client from './steps/Step1Client';
import Step2Category from './steps/Step2Category';
import Step3ServiceType from './steps/Step3ServiceType';
import Step4Variables from './steps/Step4Variables';
import Step5Team from './steps/Step5Team';
import Step6Extras from './steps/Step6Extras';
import Step7Summary from './steps/Step7Summary';

const STEPS = [
  { id: 1, title: 'Musteri', shortTitle: 'Musteri' },
  { id: 2, title: 'Kategori', shortTitle: 'Kategori' },
  { id: 3, title: 'Servis Tipi', shortTitle: 'Servis' },
  { id: 4, title: 'Degiskenler', shortTitle: 'Detaylar' },
  { id: 5, title: 'Ekip & Ekipman', shortTitle: 'Ekip' },
  { id: 6, title: 'Ek Masraflar', shortTitle: 'Masraflar' },
  { id: 7, title: 'Ozet & Fiyat', shortTitle: 'Ozet' },
];

const DRAFT_KEY = 'quote_wizard_draft';

function loadDraft(): { step: number; state: QuoteWizardState } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveDraft(step: number, state: QuoteWizardState) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, state }));
  } catch {}
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

const QuoteWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = useTenantId();

  // Load draft on first render
  const savedDraft = loadDraft();
  const [currentStep, setCurrentStep] = useState(savedDraft?.step ?? 1);
  const [wizardState, setWizardState] = useState<QuoteWizardState>(savedDraft?.state ?? INITIAL_WIZARD_STATE);
  const [draftRestored, setDraftRestored] = useState(!!savedDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Data from Firebase
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [dailyShopCost, setDailyShopCost] = useState(0);
  const [nonDeductibleMonthlyCost, setNonDeductibleMonthlyCost] = useState(0);

  // Fetch staff and equipment
  useEffect(() => {
    const fetchData = async () => {
      if (!db) return;

      try {
        // Fetch staff
        const staffSnapshot = await getDocs(collection(db, 'pricing/staff/members'));
        const staff: StaffMember[] = [];
        staffSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.isActive) {
            staff.push({ id: doc.id, ...data } as StaffMember);
          }
        });
        setStaffList(staff);

        // Fetch equipment
        const equipSnapshot = await getDocs(collection(db, 'pricing/equipment/items'));
        const equipment: Equipment[] = [];
        equipSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.isActive) {
            equipment.push({ id: doc.id, ...data } as Equipment);
          }
        });
        setEquipmentList(equipment);

        // Fetch daily shop cost from settings
        const settingsSnapshot = await getDocs(collection(db, 'pricing/software/items'));
        let softwareCost = 0;
        let nonDeductibleSoftware = 0;
        settingsSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.isActive) {
            softwareCost += data.monthlyCost || 0;
            // isDeductible varsayılan true, sadece açıkça false ise faturalandırılamaz
            if (data.isDeductible === false) {
              nonDeductibleSoftware += data.monthlyCost || 0;
            }
          }
        });

        const overheadSnapshot = await getDocs(collection(db, 'pricing/overhead/items'));
        let overheadCost = 0;
        let nonDeductibleOverhead = 0;
        overheadSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.isActive) {
            overheadCost += data.monthlyCost || 0;
            if (data.isDeductible === false) {
              nonDeductibleOverhead += data.monthlyCost || 0;
            }
          }
        });

        // Calculate total monthly fixed costs (excluding staff and equipment)
        const monthlyFixed = softwareCost + overheadCost;
        setDailyShopCost(monthlyFixed / 20);

        // Faturalandırılamayan aylık maliyet
        setNonDeductibleMonthlyCost(nonDeductibleSoftware + nonDeductibleOverhead);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchData();
  }, []);

  // Calculate costs whenever team, equipment, or extras change
  const calculatedCosts = useMemo(() => {
    // Labor cost (FBLR-based daily rates)
    const laborCost = wizardState.team.reduce((sum, member) => sum + member.total, 0);

    // Equipment cost
    const equipmentCost = wizardState.equipment.reduce((sum, eq) => sum + eq.total, 0);

    // Total days for fixed cost allocation
    const totalDays = Math.max(
      wizardState.team.reduce((max, m) => Math.max(max, m.days), 0),
      wizardState.equipment.reduce((max, e) => Math.max(max, e.days), 0),
      1
    );

    // Fixed cost share based on days
    const fixedCostShare = dailyShopCost * totalDays;

    // Extras
    const extrasBase =
      wizardState.extras.travel +
      wizardState.extras.accommodation +
      wizardState.extras.stock +
      wizardState.extras.other;

    // External crew (Kiralıkkamera724) + Rental items (Kiralacek)
    const externalCrewCost = wizardState.externalCrew.reduce((s, i) => s + i.total, 0);
    const rentalCost = wizardState.rentalItems.reduce((s, i) => s + i.total, 0);

    const extras = extrasBase + externalCrewCost + rentalCost;

    // Total cost
    const total = laborCost + equipmentCost + fixedCostShare + extras;

    // Break-even (no margin)
    const breakEven = total;

    // Sell price with margin
    const sellPrice = wizardState.margin >= 1 ? total : total / (1 - wizardState.margin);
    const profit = sellPrice - total;

    return {
      costs: {
        labor: Math.round(laborCost),
        equipment: Math.round(equipmentCost),
        fixedCostShare: Math.round(fixedCostShare),
        extras: Math.round(extras),
        total: Math.round(total),
        breakEven: Math.round(breakEven),
      },
      sellPrice: Math.round(sellPrice),
      profit: Math.round(profit),
    };
  }, [wizardState.team, wizardState.equipment, wizardState.extras, wizardState.externalCrew, wizardState.rentalItems, wizardState.margin, dailyShopCost]);

  // Update wizard state with calculated costs
  useEffect(() => {
    setWizardState((prev) => ({
      ...prev,
      costs: calculatedCosts.costs,
      sellPrice: calculatedCosts.sellPrice,
      profit: calculatedCosts.profit,
    }));
  }, [calculatedCosts]);

  // Auto-save draft on every change
  useEffect(() => {
    saveDraft(currentStep, wizardState);
  }, [currentStep, wizardState]);

  // Update wizard state helper
  const updateWizardState = (updates: Partial<QuoteWizardState>) => {
    setWizardState((prev) => ({ ...prev, ...updates }));
  };

  const handleNewQuote = () => {
    clearDraft();
    setWizardState(INITIAL_WIZARD_STATE);
    setCurrentStep(1);
    setDraftRestored(false);
  };

  // Navigation
  const canGoNext = useMemo(() => {
    switch (currentStep) {
      case 1:
        return wizardState.client.clientName.trim() !== '' && wizardState.client.projectName.trim() !== '';
      case 2:
        return wizardState.category !== null;
      case 3:
        return wizardState.serviceType !== null;
      case 4:
        return true; // Variables are optional
      case 5:
        return true; // Team & equipment are optional
      case 6:
        return true; // Extras are optional
      case 7:
        return true;
      default:
        return false;
    }
  }, [currentStep, wizardState]);

  const handleNext = () => {
    if (canGoNext && currentStep < 7) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleStepClick = (step: number) => {
    // Only allow clicking on completed or current steps
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  };

  // Format currency — converts TRY internal amount to selected display currency
  const formatCurrency = (amount: number) => {
    const currency = wizardState.currency;
    const rate = wizardState.exchangeRate || 1;
    const displayAmount = currency === 'TRY' ? amount : amount / rate;
    const localeMap: Record<typeof currency, string> = {
      TRY: 'tr-TR',
      USD: 'en-US',
      EUR: 'de-DE',
      GBP: 'en-GB',
    };
    return new Intl.NumberFormat(localeMap[currency], {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(displayAmount);
  };

  // PDF print
  const handlePrintPDF = () => {
    const _cur = wizardState.currency;
    const _rate = wizardState.exchangeRate || 1;
    const _localeMap: Record<typeof _cur, string> = { TRY: 'tr-TR', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
    const fmt = (n: number) => {
      const v = _cur === 'TRY' ? n : n / _rate;
      return new Intl.NumberFormat(_localeMap[_cur], { style: 'currency', currency: _cur, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
    };
    const today = new Date().toLocaleDateString('tr-TR');
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + wizardState.client.validityDays);
    const validUntilStr = validUntil.toLocaleDateString('tr-TR');

    const teamRows = wizardState.team.map((m) =>
      `<tr><td>${m.name}</td><td>${m.days} gün</td><td style="text-align:right">${fmt(m.dailyRate * m.days)}</td></tr>`
    ).join('');
    const equipRows = wizardState.equipment.map((e) =>
      `<tr><td>${e.name}</td><td>${e.days} gün</td><td style="text-align:right">${fmt(e.dailyRate * e.days)}</td></tr>`
    ).join('');
    const rentalRows = [...wizardState.externalCrew, ...wizardState.rentalItems].map((r) =>
      `<tr><td>${r.name}</td><td>${r.days} gün</td><td style="text-align:right">${fmt(r.dailyPrice * r.days)}</td></tr>`
    ).join('');
    const hasExtras = wizardState.extras.travel + wizardState.extras.accommodation + wizardState.extras.stock + wizardState.extras.other > 0;
    const extraRows = hasExtras ? `
      ${wizardState.extras.travel > 0 ? `<tr><td>Yol / Ulaşım</td><td></td><td style="text-align:right">${fmt(wizardState.extras.travel)}</td></tr>` : ''}
      ${wizardState.extras.accommodation > 0 ? `<tr><td>Konaklama</td><td></td><td style="text-align:right">${fmt(wizardState.extras.accommodation)}</td></tr>` : ''}
      ${wizardState.extras.stock > 0 ? `<tr><td>Stok Materyal</td><td></td><td style="text-align:right">${fmt(wizardState.extras.stock)}</td></tr>` : ''}
      ${wizardState.extras.other > 0 ? `<tr><td>Diğer${wizardState.extras.otherDescription ? ` (${wizardState.extras.otherDescription})` : ''}</td><td></td><td style="text-align:right">${fmt(wizardState.extras.other)}</td></tr>` : ''}
    ` : '';

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
    <title>Teklif — ${wizardState.client.clientName}</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #171717; padding: 40px; max-width: 800px; margin: 0 auto; }
      h1 { font-size: 26px; font-weight: 700; margin: 0 0 4px; }
      .meta { color: #666; font-size: 13px; margin-bottom: 32px; }
      h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #888; margin: 24px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; font-size: 14px; }
      td, th { padding: 7px 4px; }
      th { font-weight: 600; text-align: left; font-size: 12px; color: #555; }
      tr:nth-child(even) td { background: #f9f9f9; }
      .total-box { margin-top: 32px; background: #171717; color: #fff; padding: 20px 24px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; }
      .total-box .label { font-size: 14px; opacity: .8; }
      .total-box .price { font-size: 28px; font-weight: 700; }
      .validity { margin-top: 16px; font-size: 12px; color: #888; text-align: right; }
      .note { margin-top: 24px; font-size: 12px; color: #aaa; border-top: 1px solid #eee; padding-top: 16px; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    <h1>${wizardState.client.projectName || 'Fiyat Teklifi'}</h1>
    <div class="meta">Müşteri: <strong>${wizardState.client.clientName}</strong> &nbsp;•&nbsp; Tarih: ${today} &nbsp;•&nbsp; Geçerlilik: ${validUntilStr}</div>

    ${teamRows ? `<h2>Ekip</h2><table><tr><th>Ad</th><th>Süre</th><th style="text-align:right">Tutar</th></tr>${teamRows}</table>` : ''}
    ${equipRows ? `<h2>Ekipman</h2><table><tr><th>Ad</th><th>Süre</th><th style="text-align:right">Tutar</th></tr>${equipRows}</table>` : ''}
    ${rentalRows ? `<h2>Kiralık Ekipman & Ekip</h2><table><tr><th>Ad</th><th>Süre</th><th style="text-align:right">Tutar</th></tr>${rentalRows}</table>` : ''}
    ${extraRows ? `<h2>Ek Masraflar</h2><table><tr><th>Açıklama</th><th></th><th style="text-align:right">Tutar</th></tr>${extraRows}</table>` : ''}

    <div class="total-box">
      <div class="label">Teklif Fiyatı (KDV Hariç)</div>
      <div class="price">${fmt(wizardState.sellPrice)}</div>
    </div>
    ${wizardState.kdvRate > 0 ? `
    <table style="margin-top:16px">
      <tr><td>Net Toplam (KDV hariç)</td><td style="text-align:right">${fmt(wizardState.sellPrice)}</td></tr>
      <tr><td>KDV (%${Math.round(wizardState.kdvRate * 100)})</td><td style="text-align:right">${fmt(wizardState.sellPrice * wizardState.kdvRate)}</td></tr>
      <tr><td><strong>Genel Toplam (KDV dahil)</strong></td><td style="text-align:right"><strong>${fmt(wizardState.sellPrice * (1 + wizardState.kdvRate))}</strong></td></tr>
    </table>
    ` : ''}
    ${wizardState.currency !== 'TRY' ? `<div class="note" style="border:none;padding-top:8px;color:#888">Para birimi: <strong>${wizardState.currency}</strong> · Kur: 1 ${wizardState.currency} = ${wizardState.exchangeRate} TRY</div>` : ''}
    <div class="validity">Bu teklif ${validUntilStr} tarihine kadar geçerlidir.</div>
    <div class="note">Bu belge fiyat teklifi niteliğindedir ve sözleşme yerine geçmez.</div>
    <script>window.onload = () => { window.print(); }</script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) { w.document.write(html); w.document.close(); }
  };

  // Save quote to Firestore
  const saveQuote = async (status: QuoteStatus) => {
    if (!db) {
      setSaveError('Veritabanı bağlantısı kurulamadı');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const now = Timestamp.now();
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + wizardState.client.validityDays);

      const totalDaysForSave = wizardState.team.length > 0
        ? Math.max(...wizardState.team.map((m) => m.days))
        : wizardState.equipment.length > 0
        ? Math.max(...wizardState.equipment.map((e) => e.days))
        : 1;

      // Build serviceLines from wizard state so ProposalViewPage can generate line-by-line proposals
      const serviceLines: Array<{ name: string; totalCost: number; quantity: number; unit: string }> = [];

      wizardState.team.forEach((m) => {
        serviceLines.push({ name: m.name, totalCost: m.dailyRate * m.days, quantity: m.days, unit: 'gün' });
      });
      wizardState.equipment.forEach((e) => {
        serviceLines.push({ name: e.name, totalCost: e.dailyRate * e.days, quantity: e.days, unit: 'gün' });
      });
      [...wizardState.externalCrew, ...wizardState.rentalItems].forEach((r) => {
        serviceLines.push({ name: r.name, totalCost: r.dailyPrice * r.days, quantity: r.days, unit: 'gün' });
      });
      if (wizardState.extras.travel > 0) serviceLines.push({ name: 'Yol / Ulaşım', totalCost: wizardState.extras.travel, quantity: 1, unit: 'kalem' });
      if (wizardState.extras.accommodation > 0) serviceLines.push({ name: 'Konaklama', totalCost: wizardState.extras.accommodation, quantity: 1, unit: 'kalem' });
      if (wizardState.extras.stock > 0) serviceLines.push({ name: 'Stok Materyal', totalCost: wizardState.extras.stock, quantity: 1, unit: 'kalem' });
      if (wizardState.extras.other > 0) serviceLines.push({ name: wizardState.extras.otherDescription || 'Diğer Masraf', totalCost: wizardState.extras.other, quantity: 1, unit: 'kalem' });

      const quoteData: Omit<Quote, 'id'> = {
        tenantId,
        clientName: wizardState.client.clientName,
        projectTitle: wizardState.client.projectName,
        projectDescription: wizardState.client.projectDescription || undefined,
        serviceLines: serviceLines.length > 0 ? serviceLines : undefined,
        items: [],
        totalLaborCost: wizardState.costs.labor,
        totalEquipmentCost: wizardState.costs.equipment,
        totalFixedCostAllocation: wizardState.costs.fixedCostShare,
        additionalExpenses: wizardState.costs.extras,
        subtotal: wizardState.costs.total,
        discountAmount: 0,
        targetMarginPercent: wizardState.margin,
        safetyBufferPercent: 0,
        kdvRate: wizardState.kdvRate,
        currency: wizardState.currency,
        exchangeRate: wizardState.exchangeRate,
        rawCost: wizardState.costs.total,
        sellPrice: wizardState.sellPrice,
        profit: wizardState.profit,
        actualMarginPercent: wizardState.sellPrice > 0 ? wizardState.profit / wizardState.sellPrice : 0,
        totalEstimatedHours: wizardState.team.reduce((sum, m) => sum + m.days * 8, 0),
        totalEstimatedDays: totalDaysForSave,
        status,
        validUntil: Timestamp.fromDate(validUntilDate),
        billingType: wizardState.client.billingType,
        ...(wizardState.client.billingType === 'recurring' && { billingPeriodMonths: wizardState.client.billingPeriodMonths }),
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: user?.uid || 'unknown',
        createdByName: user?.displayName || user?.email || 'Kullanıcı',
      } as Omit<Quote, 'id'>;

      // Strip undefined fields (Firestore rejects them)
      const cleanData = Object.fromEntries(
        Object.entries(quoteData as Record<string, unknown>).filter(([, v]) => v !== undefined)
      );
      await addDoc(collection(db, 'quotes'), cleanData);
      clearDraft();
      navigate('/admin/pricing/projections');
    } catch (err) {
      console.error('Error saving quote:', err);
      setSaveError('Teklif kaydedilirken bir hata olustu');
    } finally {
      setIsSaving(false);
    }
  };

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1Client
            data={wizardState.client}
            onChange={(client) => updateWizardState({ client })}
          />
        );
      case 2:
        return (
          <Step2Category
            selected={wizardState.category}
            onChange={(category) => updateWizardState({ category, serviceType: null, variables: {} })}
          />
        );
      case 3:
        return (
          <Step3ServiceType
            category={wizardState.category}
            selected={wizardState.serviceType}
            onChange={(serviceType) => updateWizardState({ serviceType, variables: {} })}
          />
        );
      case 4:
        return (
          <Step4Variables
            category={wizardState.category}
            serviceType={wizardState.serviceType}
            variables={wizardState.variables}
            onChange={(variables) => updateWizardState({ variables })}
          />
        );
      case 5:
        return (
          <Step5Team
            staffList={staffList}
            equipmentList={equipmentList}
            selectedTeam={wizardState.team}
            selectedEquipment={wizardState.equipment}
            externalCrew={wizardState.externalCrew}
            rentalItems={wizardState.rentalItems}
            onTeamChange={(team) => updateWizardState({ team })}
            onEquipmentChange={(equipment) => updateWizardState({ equipment })}
            onExternalCrewChange={(externalCrew) => updateWizardState({ externalCrew })}
            onRentalItemsChange={(rentalItems) => updateWizardState({ rentalItems })}
            formatCurrency={formatCurrency}
          />
        );
      case 6:
        return (
          <Step6Extras
            extras={wizardState.extras}
            onChange={(extras) => updateWizardState({ extras })}
            formatCurrency={formatCurrency}
          />
        );
      case 7:
        // Projedeki gün sayısına orantılı faturalandırılamayan maliyet
        const totalDays = Math.max(
          wizardState.team.reduce((max, m) => Math.max(max, m.days), 0),
          wizardState.equipment.reduce((max, e) => Math.max(max, e.days), 0),
          1
        );
        const nonDeductibleForProject = (nonDeductibleMonthlyCost / 20) * totalDays;

        return (
          <Step7Summary
            wizardState={wizardState}
            onMarginChange={(margin) => updateWizardState({ margin })}
            onKdvRateChange={(kdvRate) => updateWizardState({ kdvRate })}
            onCurrencyChange={(currency, rate) => updateWizardState({ currency, exchangeRate: rate })}
            onExchangeRateChange={(exchangeRate) => updateWizardState({ exchangeRate })}
            formatCurrency={formatCurrency}
            nonDeductibleCost={nonDeductibleForProject}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin/pricing">
                <motion.button
                  className="p-2 bg-neutral-100 text-neutral-600 rounded-lg hover:bg-neutral-200 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </Link>
              <div>
                <h1 className="font-grotesk text-xl font-bold text-[#171717]">
                  Fiyat Teklifi Olustur
                </h1>
                <p className="font-grotesk text-sm text-neutral-500">
                  Adim {currentStep} / 7 - {STEPS[currentStep - 1].title}
                </p>
              </div>
            </div>

            {/* Live price preview */}
            {currentStep >= 5 && wizardState.costs.total > 0 && (
              <div className="text-right">
                <p className="font-grotesk text-xs text-neutral-500">Tahmini Fiyat</p>
                <p className="font-grotesk text-2xl font-bold text-[#171717]">
                  {formatCurrency(wizardState.sellPrice)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Draft restored banner */}
        {draftRestored && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
            <span className="font-grotesk text-sm text-amber-800">
              Kaydedilmemiş taslak geri yüklendi — <strong>{wizardState.client.clientName || 'İsimsiz teklif'}</strong>
            </span>
            <button
              type="button"
              onClick={handleNewQuote}
              className="font-grotesk text-xs text-amber-700 underline hover:text-amber-900 ml-4"
            >
              Temizle, yeniden başla
            </button>
          </div>
        )}

      {/* Progress */}
        <WizardProgress
          steps={STEPS}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 py-4 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 1}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-neutral-300 text-neutral-700 rounded-xl font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            Geri
          </button>

          <div className="flex items-center gap-3">
            {currentStep === 7 ? (
              <>
                {saveError && (
                  <p className="text-red-600 text-sm font-grotesk mr-4">{saveError}</p>
                )}
                <motion.button
                  onClick={() => saveQuote('draft')}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-neutral-300 text-neutral-700 rounded-xl font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Taslak Kaydet
                </motion.button>
                <motion.button
                  onClick={handlePrintPDF}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-neutral-300 text-neutral-700 rounded-xl font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FileText className="w-4 h-4" />
                  PDF Indir
                </motion.button>
                <motion.button
                  onClick={() => saveQuote('accepted')}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl font-grotesk text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Teklifi Onayla
                </motion.button>
              </>
            ) : (
              <motion.button
                onClick={handleNext}
                disabled={!canGoNext}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#171717] text-white rounded-xl font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: canGoNext ? 1.02 : 1 }}
                whileTap={{ scale: canGoNext ? 0.98 : 1 }}
              >
                Devam Et
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteWizard;
