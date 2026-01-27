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

const QuoteWizard: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardState, setWizardState] = useState<QuoteWizardState>(INITIAL_WIZARD_STATE);
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
    const extras =
      wizardState.extras.travel +
      wizardState.extras.accommodation +
      wizardState.extras.stock +
      wizardState.extras.other;

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
  }, [wizardState.team, wizardState.equipment, wizardState.extras, wizardState.margin, dailyShopCost]);

  // Update wizard state with calculated costs
  useEffect(() => {
    setWizardState((prev) => ({
      ...prev,
      costs: calculatedCosts.costs,
      sellPrice: calculatedCosts.sellPrice,
      profit: calculatedCosts.profit,
    }));
  }, [calculatedCosts]);

  // Update wizard state helper
  const updateWizardState = (updates: Partial<QuoteWizardState>) => {
    setWizardState((prev) => ({ ...prev, ...updates }));
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
        return wizardState.team.length > 0; // At least one team member
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

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Save quote to Firestore
  const saveQuote = async (status: QuoteStatus) => {
    if (!db) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const now = Timestamp.now();
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + wizardState.client.validityDays);

      const quoteData: Omit<Quote, 'id'> = {
        clientName: wizardState.client.clientName,
        projectTitle: wizardState.client.projectName,
        items: [],
        totalLaborCost: wizardState.costs.labor,
        totalEquipmentCost: wizardState.costs.equipment,
        totalFixedCostAllocation: wizardState.costs.fixedCostShare,
        additionalExpenses: wizardState.costs.extras,
        subtotal: wizardState.costs.total,
        discountAmount: 0,
        targetMarginPercent: wizardState.margin,
        safetyBufferPercent: 0,
        rawCost: wizardState.costs.total,
        sellPrice: wizardState.sellPrice,
        profit: wizardState.profit,
        actualMarginPercent: wizardState.sellPrice > 0 ? wizardState.profit / wizardState.sellPrice : 0,
        totalEstimatedHours: wizardState.team.reduce((sum, m) => sum + m.days * 8, 0),
        totalEstimatedDays: Math.max(...wizardState.team.map(m => m.days), 1),
        status,
        validUntil: Timestamp.fromDate(validUntilDate),
        billingType: wizardState.client.billingType,
        billingPeriodMonths: wizardState.client.billingType === 'recurring' ? wizardState.client.billingPeriodMonths : undefined,
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
        createdByName: 'Sistem',
      };

      await addDoc(collection(db, 'quotes'), quoteData);

      // Navigate to projections or quotes list
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
            onTeamChange={(team) => updateWizardState({ team })}
            onEquipmentChange={(equipment) => updateWizardState({ equipment })}
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
                <h1 className="font-ramillas text-xl font-bold text-[#171717]">
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
                <p className="font-ramillas text-2xl font-bold text-[#171717]">
                  {formatCurrency(wizardState.sellPrice)}
                </p>
              </div>
            )}
          </div>
        </div>

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
