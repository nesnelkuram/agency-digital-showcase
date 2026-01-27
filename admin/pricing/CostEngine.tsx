import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator,
  Save,
  RefreshCw,
  Briefcase,
  Clock,
  Camera,
  Monitor,
  User,
  TrendingUp,
  Receipt,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Settings,
  Building,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

// Default values for fixed costs (fallback if Firestore is unavailable)
const DEFAULT_FINANCIAL_SETTINGS = {
  staff_junior: 53362,
  staff_senior_target: 150000,
  accountant: 8000,
  software_subscriptions: 10000,
  virtual_office: 1667,
  amortization_fund: 12500,
  misc_buffer: 1500,
};

// Default Unit Economics - will be calculated from Firestore data
const DEFAULT_UNIT_ECONOMICS = {
  juniorStaff: { label: 'Junior Staff (Seyma)', dailyRate: 2668, hourlyRate: 333, unit: 'gun' },
  agencyOwner: { label: 'Agency Owner', dailyRate: 7500, hourlyRate: 938, unit: 'gun' },
  cameraKit: { label: 'Kamera/Lens Kit', dailyRate: 4000, unit: 'gun' },
  lightAudio: { label: 'Isik/Ses Ekipmani', dailyRate: 1500, unit: 'gun' },
  workstation: { label: 'Workstation', dailyRate: 1000, unit: 'gun' },
};

type ProjectType = 'production' | 'retainer';

interface FinancialSettings {
  staff_junior: number;
  staff_senior_target: number;
  accountant: number;
  software_subscriptions: number;
  virtual_office: number;
  amortization_fund: number;
  misc_buffer: number;
}

interface UnitEconomics {
  juniorStaff: { label: string; dailyRate: number; hourlyRate: number; unit: string };
  agencyOwner: { label: string; dailyRate: number; hourlyRate: number; unit: string };
  cameraKit: { label: string; dailyRate: number; unit: string };
  lightAudio: { label: string; dailyRate: number; unit: string };
  workstation: { label: string; dailyRate: number; unit: string };
}

interface QuoteBreakdown {
  projectType: ProjectType;
  laborCosts: {
    juniorDays: number;
    juniorHours: number;
    juniorTotal: number;
    ownerDays: number;
    ownerTotal: number;
  };
  gearCosts: {
    cameraDays: number;
    cameraTotal: number;
    lightDays: number;
    lightTotal: number;
    workstationDays: number;
    workstationTotal: number;
  };
  overheadCost: number;
  additionalExpenses: number;
  margin: number;
}

const CostEngine: React.FC = () => {
  // Financial Settings from Firestore
  const [financialSettings, setFinancialSettings] = useState<FinancialSettings>(DEFAULT_FINANCIAL_SETTINGS);
  const [unitEconomics, setUnitEconomics] = useState<UnitEconomics>(DEFAULT_UNIT_ECONOMICS);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [dailyShopCost, setDailyShopCost] = useState(0);

  // Form State
  const [clientName, setClientName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('production');

  // Labor Inputs
  const [juniorDays, setJuniorDays] = useState(0);
  const [juniorHours, setJuniorHours] = useState(0);
  const [ownerDays, setOwnerDays] = useState(0);

  // Gear Inputs
  const [cameraDays, setCameraDays] = useState(0);
  const [lightDays, setLightDays] = useState(0);
  const [workstationDays, setWorkstationDays] = useState(0);

  // Additional
  const [additionalExpenses, setAdditionalExpenses] = useState(0);
  const [margin, setMargin] = useState(30);

  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch financial settings from Firestore
  useEffect(() => {
    const fetchFinancialSettings = async () => {
      if (!db) {
        console.warn('Firebase not configured, using defaults');
        calculateDerivedValues(DEFAULT_FINANCIAL_SETTINGS);
        setIsLoadingSettings(false);
        return;
      }

      try {
        const docRef = doc(db, 'settings', 'financials');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as FinancialSettings;
          const settings = { ...DEFAULT_FINANCIAL_SETTINGS, ...data };
          setFinancialSettings(settings);
          calculateDerivedValues(settings);
        } else {
          // Use defaults if no document exists
          calculateDerivedValues(DEFAULT_FINANCIAL_SETTINGS);
        }
      } catch (err) {
        console.error('Error fetching financial settings:', err);
        calculateDerivedValues(DEFAULT_FINANCIAL_SETTINGS);
      } finally {
        setIsLoadingSettings(false);
      }
    };

    fetchFinancialSettings();
  }, []);

  // Calculate derived values from financial settings
  const calculateDerivedValues = (settings: FinancialSettings) => {
    // Calculate total monthly fixed costs
    const totalMonthlyFixed =
      settings.staff_junior +
      settings.staff_senior_target +
      settings.accountant +
      settings.software_subscriptions +
      settings.virtual_office +
      settings.amortization_fund +
      settings.misc_buffer;

    // Daily shop cost = Total Monthly / 20 working days
    const dailyCost = totalMonthlyFixed / 20;
    setDailyShopCost(dailyCost);

    // Calculate daily rates from monthly values
    // Junior: monthly salary / 20 working days
    const juniorDailyRate = Math.round(settings.staff_junior / 20);
    // Junior hourly: daily rate / 8 hours
    const juniorHourlyRate = Math.round(juniorDailyRate / 8);
    // Owner: monthly target / 20 working days
    const ownerDailyRate = Math.round(settings.staff_senior_target / 20);
    const ownerHourlyRate = Math.round(ownerDailyRate / 8);

    setUnitEconomics({
      juniorStaff: { label: 'Seyma (Sosyal Medya)', dailyRate: juniorDailyRate, hourlyRate: juniorHourlyRate, unit: 'gun' },
      agencyOwner: { label: 'Agency Owner', dailyRate: ownerDailyRate, hourlyRate: ownerHourlyRate, unit: 'gun' },
      cameraKit: { label: 'Kamera/Lens Kit', dailyRate: 4000, unit: 'gun' },
      lightAudio: { label: 'Isik/Ses Ekipmani', dailyRate: 1500, unit: 'gun' },
      workstation: { label: 'Workstation', dailyRate: 1000, unit: 'gun' },
    });
  };

  // Calculate total project days for overhead allocation
  const totalProjectDays = useMemo(() => {
    if (projectType === 'retainer') {
      // For retainer, convert hours to days (8 hours = 1 day) for overhead calculation
      return Math.max(Math.ceil(juniorHours / 8), 1);
    }
    return Math.max(juniorDays, ownerDays, cameraDays, lightDays, workstationDays, 1);
  }, [projectType, juniorDays, juniorHours, ownerDays, cameraDays, lightDays, workstationDays]);

  // Calculations
  const calculations = useMemo(() => {
    let juniorTotal = 0;
    let ownerTotal = 0;
    let totalLaborCost = 0;
    let cameraTotal = 0;
    let lightTotal = 0;
    let workstationTotal = 0;
    let totalGearCost = 0;
    let overheadCost = 0;

    if (projectType === 'retainer') {
      // RETAINER MODE: Hourly billing for Şeyma only, no gear, no owner
      juniorTotal = juniorHours * unitEconomics.juniorStaff.hourlyRate;
      ownerTotal = 0;
      totalLaborCost = juniorTotal;

      // No gear costs for retainer
      cameraTotal = 0;
      lightTotal = 0;
      workstationTotal = 0;
      totalGearCost = 0;

      // Overhead based on hours worked (convert to days)
      const workDays = Math.ceil(juniorHours / 8);
      overheadCost = dailyShopCost * workDays;
    } else {
      // PRODUCTION MODE: Daily billing with full gear and owner options
      juniorTotal = juniorDays * unitEconomics.juniorStaff.dailyRate;
      ownerTotal = ownerDays * unitEconomics.agencyOwner.dailyRate;
      totalLaborCost = juniorTotal + ownerTotal;

      // Gear Costs
      cameraTotal = cameraDays * unitEconomics.cameraKit.dailyRate;
      lightTotal = lightDays * unitEconomics.lightAudio.dailyRate;
      workstationTotal = workstationDays * unitEconomics.workstation.dailyRate;
      totalGearCost = cameraTotal + lightTotal + workstationTotal;

      // Overhead Cost (Daily Shop Cost * Project Days)
      overheadCost = dailyShopCost * totalProjectDays;
    }

    // Raw Cost (including overhead)
    const rawCost = totalLaborCost + totalGearCost + overheadCost + additionalExpenses;

    // Safety Buffer (10%)
    const safetyBuffer = rawCost * 1.1;

    // Sell Price = Safety Buffer / (1 - (Margin / 100))
    const sellPrice = margin >= 100 ? 0 : safetyBuffer / (1 - margin / 100);

    // Profit
    const profit = sellPrice - rawCost;
    const actualMargin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;

    return {
      juniorTotal,
      ownerTotal,
      totalLaborCost,
      cameraTotal,
      lightTotal,
      workstationTotal,
      totalGearCost,
      overheadCost,
      rawCost,
      safetyBuffer,
      sellPrice,
      profit,
      actualMargin,
    };
  }, [projectType, juniorDays, juniorHours, ownerDays, cameraDays, lightDays, workstationDays, additionalExpenses, margin, unitEconomics, dailyShopCost, totalProjectDays]);

  // Profit color based on margin
  const getProfitColor = () => {
    if (calculations.actualMargin < 20) return 'text-red-600';
    if (calculations.actualMargin >= 40) return 'text-green-600';
    return 'text-[#171717]';
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

  // Save Quote to Firebase
  const saveQuoteToFirebase = async () => {
    if (!clientName.trim()) {
      setSaveError('Lutfen musteri adi girin');
      return;
    }

    if (!db) {
      setSaveError('Firebase baglantisi bulunamadi');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const breakdown: QuoteBreakdown = {
      projectType,
      laborCosts: {
        juniorDays: projectType === 'production' ? juniorDays : 0,
        juniorHours: projectType === 'retainer' ? juniorHours : 0,
        juniorTotal: calculations.juniorTotal,
        ownerDays: projectType === 'production' ? ownerDays : 0,
        ownerTotal: calculations.ownerTotal,
      },
      gearCosts: {
        cameraDays: projectType === 'production' ? cameraDays : 0,
        cameraTotal: calculations.cameraTotal,
        lightDays: projectType === 'production' ? lightDays : 0,
        lightTotal: calculations.lightTotal,
        workstationDays: projectType === 'production' ? workstationDays : 0,
        workstationTotal: calculations.workstationTotal,
      },
      overheadCost: calculations.overheadCost,
      additionalExpenses,
      margin,
    };

    try {
      await addDoc(collection(db, 'quotes'), {
        clientName: clientName.trim(),
        projectType,
        totalInternalCost: calculations.rawCost,
        finalPrice: calculations.sellPrice,
        profit: calculations.profit,
        actualMargin: calculations.actualMargin,
        dailyShopCostUsed: dailyShopCost,
        projectDays: totalProjectDays,
        breakdown,
        calculatedAt: serverTimestamp(),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Firebase save error:', error);
      setSaveError('Kayit sirasinda hata olustu');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset Form
  const resetForm = () => {
    setClientName('');
    setJuniorDays(0);
    setJuniorHours(0);
    setOwnerDays(0);
    setCameraDays(0);
    setLightDays(0);
    setWorkstationDays(0);
    setAdditionalExpenses(0);
    setMargin(30);
    setSaveError(null);
    setSaveSuccess(false);
  };

  // Loading state
  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#171717]" />
          <p className="font-grotesk text-sm text-neutral-500">Ayarlar yukleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-ramillas font-bold text-[#171717]">
            Cost Engine
          </h1>
          <p className="font-grotesk text-neutral-600 mt-1">
            Proje maliyet ve fiyat hesaplayicisi
          </p>
        </div>
        <div className="flex gap-2">
          <motion.button
            onClick={resetForm}
            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCw className="w-4 h-4" />
            Sifirla
          </motion.button>
          <Link to="/admin/pricing/costs">
            <motion.button
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Settings className="w-4 h-4" />
              Gider Ayarlari
            </motion.button>
          </Link>
        </div>
      </div>

      {/* Daily Shop Cost Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Building className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-grotesk text-sm font-medium text-blue-900">
              Gunluk Dukkan Maliyeti: {formatCurrency(dailyShopCost)}
            </p>
            <p className="font-grotesk text-xs text-blue-600">
              Bu tutar her proje gunune otomatik eklenir
            </p>
          </div>
        </div>
        <Link to="/admin/pricing/costs" className="font-grotesk text-xs text-blue-600 hover:text-blue-800 underline">
          Duzenle
        </Link>
      </motion.div>

      {/* Main Grid - Split Card Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side - Configuration */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden"
        >
          {/* Client & Project Type */}
          <div className="p-6 border-b border-neutral-100">
            <h2 className="font-ramillas text-lg font-bold text-[#171717] mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Proje Bilgileri
            </h2>

            {/* Client Name */}
            <div className="mb-4">
              <label className="block font-grotesk text-sm text-neutral-600 mb-2">
                Musteri Adi
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ornek: ABC Sirket"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all"
              />
            </div>

            {/* Project Type Toggle */}
            <div>
              <label className="block font-grotesk text-sm text-neutral-600 mb-2">
                Proje Tipi
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setProjectType('production')}
                  className={`flex-1 px-4 py-3 rounded-xl font-grotesk text-sm font-medium transition-all ${
                    projectType === 'production'
                      ? 'bg-[#171717] text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  <Camera className="w-4 h-4 inline mr-2" />
                  Production (Gunluk)
                </button>
                <button
                  onClick={() => setProjectType('retainer')}
                  className={`flex-1 px-4 py-3 rounded-xl font-grotesk text-sm font-medium transition-all ${
                    projectType === 'retainer'
                      ? 'bg-[#171717] text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  <Clock className="w-4 h-4 inline mr-2" />
                  Retainer (Saatlik)
                </button>
              </div>
            </div>
          </div>

          {/* Labor Costs */}
          <div className="p-6 border-b border-neutral-100">
            <h2 className="font-ramillas text-lg font-bold text-[#171717] mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Iscilik Maliyetleri
            </h2>

            <div className="space-y-4">
              {projectType === 'retainer' ? (
                /* RETAINER MODE - Şeyma Saatlik */
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="font-grotesk text-sm text-neutral-600">
                      {unitEconomics.juniorStaff.label}
                    </label>
                    <span className="font-grotesk text-xs text-neutral-400">
                      {formatCurrency(unitEconomics.juniorStaff.hourlyRate)}/saat
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="160"
                      value={juniorHours}
                      onChange={(e) => setJuniorHours(Number(e.target.value))}
                      className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#171717]"
                    />
                    <input
                      type="number"
                      min="0"
                      value={juniorHours}
                      onChange={(e) => setJuniorHours(Math.max(0, Number(e.target.value)))}
                      className="w-16 px-3 py-2 rounded-lg border border-neutral-200 font-grotesk text-sm text-center focus:outline-none focus:border-[#171717]"
                    />
                    <span className="font-grotesk text-sm text-neutral-500 w-8">saat</span>
                  </div>
                  <p className="font-grotesk text-xs text-neutral-400 mt-2">
                    {juniorHours > 0 && `≈ ${(juniorHours / 8).toFixed(1)} is gunu`}
                  </p>
                </div>
              ) : (
                /* PRODUCTION MODE - Günlük */
                <>
                  {/* Junior Staff - Days */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="font-grotesk text-sm text-neutral-600">
                        {unitEconomics.juniorStaff.label}
                      </label>
                      <span className="font-grotesk text-xs text-neutral-400">
                        {formatCurrency(unitEconomics.juniorStaff.dailyRate)}/gun
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={juniorDays}
                        onChange={(e) => setJuniorDays(Number(e.target.value))}
                        className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#171717]"
                      />
                      <input
                        type="number"
                        min="0"
                        value={juniorDays}
                        onChange={(e) => setJuniorDays(Math.max(0, Number(e.target.value)))}
                        className="w-16 px-3 py-2 rounded-lg border border-neutral-200 font-grotesk text-sm text-center focus:outline-none focus:border-[#171717]"
                      />
                      <span className="font-grotesk text-sm text-neutral-500 w-8">gun</span>
                    </div>
                  </div>

                  {/* Agency Owner - Days */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="font-grotesk text-sm text-neutral-600">
                        {unitEconomics.agencyOwner.label}
                      </label>
                      <span className="font-grotesk text-xs text-neutral-400">
                        {formatCurrency(unitEconomics.agencyOwner.dailyRate)}/gun
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={ownerDays}
                        onChange={(e) => setOwnerDays(Number(e.target.value))}
                        className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#171717]"
                      />
                      <input
                        type="number"
                        min="0"
                        value={ownerDays}
                        onChange={(e) => setOwnerDays(Math.max(0, Number(e.target.value)))}
                        className="w-16 px-3 py-2 rounded-lg border border-neutral-200 font-grotesk text-sm text-center focus:outline-none focus:border-[#171717]"
                      />
                      <span className="font-grotesk text-sm text-neutral-500 w-8">gun</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Gear Costs - Only for Production Mode */}
          {projectType === 'production' && (
            <div className="p-6 border-b border-neutral-100">
              <h2 className="font-ramillas text-lg font-bold text-[#171717] mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Ekipman Maliyetleri
              </h2>

              <div className="space-y-4">
                {/* Camera Kit */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="font-grotesk text-sm text-neutral-600">
                      {unitEconomics.cameraKit.label}
                    </label>
                    <span className="font-grotesk text-xs text-neutral-400">
                      {formatCurrency(unitEconomics.cameraKit.dailyRate)}/gun
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="15"
                      value={cameraDays}
                      onChange={(e) => setCameraDays(Number(e.target.value))}
                      className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#171717]"
                    />
                    <input
                      type="number"
                      min="0"
                      value={cameraDays}
                      onChange={(e) => setCameraDays(Math.max(0, Number(e.target.value)))}
                      className="w-16 px-3 py-2 rounded-lg border border-neutral-200 font-grotesk text-sm text-center focus:outline-none focus:border-[#171717]"
                    />
                    <span className="font-grotesk text-sm text-neutral-500 w-8">gun</span>
                  </div>
                </div>

                {/* Light/Audio */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="font-grotesk text-sm text-neutral-600">
                      {unitEconomics.lightAudio.label}
                    </label>
                    <span className="font-grotesk text-xs text-neutral-400">
                      {formatCurrency(unitEconomics.lightAudio.dailyRate)}/gun
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="15"
                      value={lightDays}
                      onChange={(e) => setLightDays(Number(e.target.value))}
                      className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#171717]"
                    />
                    <input
                      type="number"
                      min="0"
                      value={lightDays}
                      onChange={(e) => setLightDays(Math.max(0, Number(e.target.value)))}
                      className="w-16 px-3 py-2 rounded-lg border border-neutral-200 font-grotesk text-sm text-center focus:outline-none focus:border-[#171717]"
                    />
                    <span className="font-grotesk text-sm text-neutral-500 w-8">gun</span>
                  </div>
                </div>

                {/* Workstation */}
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="font-grotesk text-sm text-neutral-600">
                      {unitEconomics.workstation.label}
                    </label>
                    <span className="font-grotesk text-xs text-neutral-400">
                      {formatCurrency(unitEconomics.workstation.dailyRate)}/gun
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={workstationDays}
                      onChange={(e) => setWorkstationDays(Number(e.target.value))}
                      className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#171717]"
                    />
                    <input
                      type="number"
                      min="0"
                      value={workstationDays}
                      onChange={(e) => setWorkstationDays(Math.max(0, Number(e.target.value)))}
                      className="w-16 px-3 py-2 rounded-lg border border-neutral-200 font-grotesk text-sm text-center focus:outline-none focus:border-[#171717]"
                    />
                    <span className="font-grotesk text-sm text-neutral-500 w-8">gun</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Additional Expenses & Margin */}
          <div className="p-6">
            <h2 className="font-ramillas text-lg font-bold text-[#171717] mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Ek Giderler & Kar Marji
            </h2>

            <div className="space-y-4">
              {/* Additional Expenses */}
              <div>
                <label className="block font-grotesk text-sm text-neutral-600 mb-2">
                  Ek Giderler (Ulasim, Konaklama, vb.)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-grotesk text-sm text-neutral-400">
                    TL
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={additionalExpenses}
                    onChange={(e) => setAdditionalExpenses(Math.max(0, Number(e.target.value)))}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-neutral-200 font-grotesk text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] transition-all"
                  />
                </div>
              </div>

              {/* Margin Slider */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="font-grotesk text-sm text-neutral-600">Hedef Kar Marji</label>
                  <span className="font-grotesk text-sm font-bold text-[#171717]">%{margin}</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  className="w-full h-3 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-lg appearance-none cursor-pointer accent-[#171717]"
                />
                <div className="flex justify-between mt-1">
                  <span className="font-grotesk text-xs text-red-500">%20 (Min)</span>
                  <span className="font-grotesk text-xs text-green-500">%80 (Max)</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Side - Receipt */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden"
        >
          <div className="p-6 bg-[#171717] text-white">
            <div className="flex items-center justify-between">
              <h2 className="font-ramillas text-lg font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Fiyat Dokumu
              </h2>
              <span className="font-grotesk text-xs bg-white/20 px-3 py-1 rounded-full">
                {projectType === 'production' ? 'Production' : 'Retainer'}
              </span>
            </div>
            {clientName && (
              <p className="font-grotesk text-white/70 mt-2">Musteri: {clientName}</p>
            )}
          </div>

          <div className="p-6 space-y-6">
            {/* Labor Breakdown */}
            <div>
              <h3 className="font-grotesk text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                Iscilik
              </h3>
              <div className="space-y-2">
                {projectType === 'retainer' ? (
                  /* Retainer - Saatlik */
                  <div className="flex justify-between font-grotesk text-sm">
                    <span className="text-neutral-600">
                      {unitEconomics.juniorStaff.label} ({juniorHours} saat x {formatCurrency(unitEconomics.juniorStaff.hourlyRate)})
                    </span>
                    <span className="text-[#171717]">{formatCurrency(calculations.juniorTotal)}</span>
                  </div>
                ) : (
                  /* Production - Günlük */
                  <>
                    <div className="flex justify-between font-grotesk text-sm">
                      <span className="text-neutral-600">
                        {unitEconomics.juniorStaff.label} ({juniorDays} gun x {formatCurrency(unitEconomics.juniorStaff.dailyRate)})
                      </span>
                      <span className="text-[#171717]">{formatCurrency(calculations.juniorTotal)}</span>
                    </div>
                    <div className="flex justify-between font-grotesk text-sm">
                      <span className="text-neutral-600">
                        Agency Owner ({ownerDays} gun x {formatCurrency(unitEconomics.agencyOwner.dailyRate)})
                      </span>
                      <span className="text-[#171717]">{formatCurrency(calculations.ownerTotal)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-grotesk text-sm pt-2 border-t border-dashed border-neutral-200">
                  <span className="font-medium text-neutral-700">Iscilik Toplam</span>
                  <span className="font-medium text-[#171717]">
                    {formatCurrency(calculations.totalLaborCost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Gear Breakdown - Only for Production */}
            {projectType === 'production' && (
              <div>
                <h3 className="font-grotesk text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  Ekipman
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between font-grotesk text-sm">
                    <span className="text-neutral-600">
                      Kamera/Lens ({cameraDays} gun x {formatCurrency(unitEconomics.cameraKit.dailyRate)})
                    </span>
                    <span className="text-[#171717]">{formatCurrency(calculations.cameraTotal)}</span>
                  </div>
                  <div className="flex justify-between font-grotesk text-sm">
                    <span className="text-neutral-600">
                      Isik/Ses ({lightDays} gun x {formatCurrency(unitEconomics.lightAudio.dailyRate)})
                    </span>
                    <span className="text-[#171717]">{formatCurrency(calculations.lightTotal)}</span>
                  </div>
                  <div className="flex justify-between font-grotesk text-sm">
                    <span className="text-neutral-600">
                      Workstation ({workstationDays} gun x {formatCurrency(unitEconomics.workstation.dailyRate)})
                    </span>
                    <span className="text-[#171717]">
                      {formatCurrency(calculations.workstationTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between font-grotesk text-sm pt-2 border-t border-dashed border-neutral-200">
                    <span className="font-medium text-neutral-700">Ekipman Toplam</span>
                    <span className="font-medium text-[#171717]">
                      {formatCurrency(calculations.totalGearCost)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Overhead Costs - NEW SECTION */}
            <div>
              <h3 className="font-grotesk text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Building className="w-4 h-4" />
                Sabit Gider Payi
              </h3>
              <div className="space-y-2 bg-blue-50/50 -mx-6 px-6 py-3 border-y border-blue-100">
                <div className="flex justify-between font-grotesk text-sm">
                  <span className="text-blue-700">
                    Dukkan Maliyeti ({totalProjectDays} gun x {formatCurrency(dailyShopCost)})
                  </span>
                  <span className="text-blue-700 font-medium">{formatCurrency(calculations.overheadCost)}</span>
                </div>
                <p className="font-grotesk text-xs text-blue-500">
                  Ayarlardan guncellenen sabit giderler otomatik hesaplandi
                </p>
              </div>
            </div>

            {/* Additional Expenses */}
            {additionalExpenses > 0 && (
              <div>
                <h3 className="font-grotesk text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  Ek Giderler
                </h3>
                <div className="flex justify-between font-grotesk text-sm">
                  <span className="text-neutral-600">Ulasim, Konaklama, vb.</span>
                  <span className="text-[#171717]">{formatCurrency(additionalExpenses)}</span>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="pt-4 border-t-2 border-neutral-200 space-y-3">
              <div className="flex justify-between font-grotesk text-sm">
                <span className="text-neutral-600">Ham Maliyet</span>
                <span className="text-[#171717]">{formatCurrency(calculations.rawCost)}</span>
              </div>
              <div className="flex justify-between font-grotesk text-sm">
                <span className="text-neutral-600">Guvenlik Tamponu (+10%)</span>
                <span className="text-[#171717]">{formatCurrency(calculations.safetyBuffer)}</span>
              </div>
              <div className="flex justify-between font-grotesk text-sm">
                <span className="text-neutral-600">Hedef Kar Marji</span>
                <span className="text-[#171717]">%{margin}</span>
              </div>
            </div>

            {/* Final Price */}
            <div className="bg-[#fffceb] -mx-6 px-6 py-5">
              <div className="flex justify-between items-center mb-3">
                <span className="font-ramillas text-lg font-bold text-[#171717]">
                  Satis Fiyati
                </span>
                <span className="font-ramillas text-3xl font-bold text-[#171717]">
                  {formatCurrency(calculations.sellPrice)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-grotesk text-sm text-neutral-600 flex items-center gap-2">
                  {calculations.actualMargin < 20 ? (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  ) : calculations.actualMargin >= 40 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : null}
                  Net Kar
                </span>
                <span className={`font-grotesk text-xl font-bold ${getProfitColor()}`}>
                  {formatCurrency(calculations.profit)}{' '}
                  <span className="text-sm font-normal">(%{calculations.actualMargin.toFixed(1)})</span>
                </span>
              </div>
            </div>

            {/* Warning/Success Messages */}
            {calculations.actualMargin < 20 && calculations.rawCost > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-grotesk text-sm font-medium text-red-700">Dusuk Kar Marji!</p>
                  <p className="font-grotesk text-xs text-red-600 mt-1">
                    Kar marji %20'nin altinda. Fiyatlandirmayi gozden gecirin.
                  </p>
                </div>
              </div>
            )}

            {calculations.actualMargin >= 40 && calculations.rawCost > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-grotesk text-sm font-medium text-green-700">Iyi Kar Marji!</p>
                  <p className="font-grotesk text-xs text-green-600 mt-1">
                    Kar marji %40'in uzerinde. Saglam bir fiyatlandirma.
                  </p>
                </div>
              </div>
            )}

            {/* Save Error */}
            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="font-grotesk text-sm text-red-700">{saveError}</p>
              </div>
            )}

            {/* Save Success */}
            {saveSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="font-grotesk text-sm text-green-700">
                  Teklif basariyla kaydedildi!
                </p>
              </div>
            )}

            {/* Save Button */}
            <motion.button
              onClick={saveQuoteToFirebase}
              disabled={isSaving || calculations.rawCost === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-[#171717] text-white rounded-xl font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: calculations.rawCost > 0 ? 1.02 : 1 }}
              whileTap={{ scale: calculations.rawCost > 0 ? 0.98 : 1 }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Teklifi Kaydet
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CostEngine;
