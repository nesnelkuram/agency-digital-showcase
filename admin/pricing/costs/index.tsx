import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Building2,
  Monitor,
  Cpu,
  Megaphone,
  ArrowRight,
  Calculator,
  Loader2,
  Flag,
  Receipt,
} from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { StaffMember, Equipment, SoftwareSubscription, OverheadCost, MarketingCost } from '@/shared/types/pricing';

interface CostCategory {
  label: string;
  path: string;
  icon: React.ElementType;
  amount: number;
  deductibleAmount: number;
  loading?: boolean;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const CostsOverviewPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CostCategory[]>([
    { label: 'Personel Giderleri', path: '/admin/pricing/costs/personnel', icon: Users, amount: 0, deductibleAmount: 0 },
    { label: 'Ekipman Amortismani', path: '/admin/pricing/costs/equipment', icon: Cpu, amount: 0, deductibleAmount: 0 },
    { label: 'Yazilim Lisanslari', path: '/admin/pricing/costs/software', icon: Monitor, amount: 0, deductibleAmount: 0 },
    { label: 'Ofis Giderleri', path: '/admin/pricing/costs/office', icon: Building2, amount: 0, deductibleAmount: 0 },
    { label: 'Pazarlama Faaliyetleri', path: '/admin/pricing/costs/marketing', icon: Megaphone, amount: 0, deductibleAmount: 0 },
  ]);

  useEffect(() => {
    const fetchCosts = async () => {
      if (!db) {
        setLoading(false);
        return;
      }

      try {
        // Fetch only REAL (reel) cost data in parallel
        const [staffSnap, equipmentSnap, softwareSnap, overheadSnap, marketingSnap] = await Promise.all([
          getDocs(query(collection(db, 'pricing', 'data', 'staff'), where('isActive', '==', true), where('status', '==', 'real'))),
          getDocs(query(collection(db, 'pricing', 'data', 'equipment'), where('isActive', '==', true), where('status', '==', 'real'))),
          getDocs(query(collection(db, 'pricing', 'data', 'software'), where('isActive', '==', true), where('status', '==', 'real'))),
          getDocs(query(collection(db, 'pricing', 'data', 'overhead'), where('isActive', '==', true), where('status', '==', 'real'))),
          getDocs(query(collection(db, 'pricing', 'data', 'marketing'), where('isActive', '==', true), where('status', '==', 'real'))),
        ]);

        // Calculate totals (personel her zaman gider gösterilebilir - maaş bordrosu var)
        const staffTotal = staffSnap.docs.reduce((sum, doc) => {
          const data = doc.data() as StaffMember;
          return sum + (data.monthlySalary || 0) + (data.socialSecurityCost || 0) + (data.benefits?.mealCard || 0);
        }, 0);
        const staffDeductible = staffTotal; // Personel giderleri her zaman deductible

        // Ekipman (amortisman her zaman gider gösterilebilir)
        const equipmentTotal = equipmentSnap.docs.reduce((sum, doc) => {
          const data = doc.data() as Equipment;
          if (data.costMethod === 'rental_value') {
            return sum + (data.rentalValueDaily || 0) * 20;
          }
          if (data.usefulLifeMonths && data.usefulLifeMonths > 0) {
            return sum + (data.purchasePrice / data.usefulLifeMonths);
          }
          return sum;
        }, 0);
        const equipmentDeductible = equipmentTotal; // Ekipman amortismanı her zaman deductible

        // Yazılım - isDeductible kontrolü
        const softwareTotal = softwareSnap.docs.reduce((sum, doc) => {
          const data = doc.data() as SoftwareSubscription;
          return sum + (data.monthlyCost || 0);
        }, 0);
        const softwareDeductible = softwareSnap.docs.reduce((sum, doc) => {
          const data = doc.data() as SoftwareSubscription;
          if (data.isDeductible !== false) {
            return sum + (data.monthlyCost || 0);
          }
          return sum;
        }, 0);

        // Ofis - isDeductible kontrolü
        const overheadTotal = overheadSnap.docs.reduce((sum, doc) => {
          const data = doc.data() as OverheadCost;
          return sum + (data.monthlyCost || 0);
        }, 0);
        const overheadDeductible = overheadSnap.docs.reduce((sum, doc) => {
          const data = doc.data() as OverheadCost;
          if (data.isDeductible !== false) {
            return sum + (data.monthlyCost || 0);
          }
          return sum;
        }, 0);

        // Pazarlama - isDeductible kontrolü
        const marketingTotal = marketingSnap.docs.reduce((sum, doc) => {
          const data = doc.data() as MarketingCost;
          return sum + (data.monthlyCost || 0);
        }, 0);
        const marketingDeductible = marketingSnap.docs.reduce((sum, doc) => {
          const data = doc.data() as MarketingCost;
          if (data.isDeductible !== false) {
            return sum + (data.monthlyCost || 0);
          }
          return sum;
        }, 0);

        setCategories([
          { label: 'Personel Giderleri', path: '/admin/pricing/costs/personnel', icon: Users, amount: staffTotal, deductibleAmount: staffDeductible },
          { label: 'Ekipman Amortismani', path: '/admin/pricing/costs/equipment', icon: Cpu, amount: equipmentTotal, deductibleAmount: equipmentDeductible },
          { label: 'Yazilim Lisanslari', path: '/admin/pricing/costs/software', icon: Monitor, amount: softwareTotal, deductibleAmount: softwareDeductible },
          { label: 'Ofis Giderleri', path: '/admin/pricing/costs/office', icon: Building2, amount: overheadTotal, deductibleAmount: overheadDeductible },
          { label: 'Pazarlama Faaliyetleri', path: '/admin/pricing/costs/marketing', icon: Megaphone, amount: marketingTotal, deductibleAmount: marketingDeductible },
        ]);
      } catch (error) {
        console.error('Error fetching costs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCosts();
  }, []);

  const totalMonthlyCost = categories.reduce((sum, cat) => sum + cat.amount, 0);
  const totalDeductible = categories.reduce((sum, cat) => sum + cat.deductibleAmount, 0);
  const totalNonDeductible = totalMonthlyCost - totalDeductible;

  return (
    <div className="max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-commons text-sm text-indigo-600 font-medium">intiba</span>
          </div>
          <h1 className="font-commons text-3xl md:text-4xl font-bold text-[#171717] mb-4">
            Finansal Yonetim
          </h1>
          <p className="font-commons text-[#171717]/70 max-w-2xl">
            Karmasik kreatif servislerin fiyatlandirmasi sadece "zaman" ile olculemez. Sabit
            gider tabanindan baslayip, projenin degisen teknik gereksinimlerine uzanan
            katmanli bir fiyatlandirma stratejisi olusturuyoruz.
          </p>
        </div>

        {/* Section Title */}
        <div className="mb-6">
          <h2 className="font-commons text-xl font-bold text-[#171717] pb-2 border-b-2 border-indigo-500 inline-block">
            Aylik Sabit Maliyetler (Reel)
          </h2>
        </div>

        {/* Cost Categories */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {categories.map((category, index) => (
              <motion.div
                key={category.path}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={category.path}
                  className="flex items-center justify-between py-3 group hover:bg-white/50 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <category.icon className="w-5 h-5 text-indigo-600" />
                    <span className="font-commons text-[#171717] underline underline-offset-2 group-hover:text-indigo-600 transition-colors">
                      {category.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-commons text-[#171717] font-medium">
                      {formatCurrency(category.amount)} TL
                    </span>
                    <ArrowRight className="w-4 h-4 text-[#171717]/30 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              </motion.div>
            ))}

            {/* Total */}
            <div className="pt-4 mt-4 border-t border-[#171717]/10">
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="font-commons text-[#171717] font-semibold">Aylik Toplam Maliyet</span>
                <span className="font-commons text-xl font-bold text-[#171717]">
                  {formatCurrency(totalMonthlyCost)} TL
                </span>
              </div>
            </div>

            {/* Daily Break-Even */}
            <div className="mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <h3 className="font-commons text-sm font-semibold text-indigo-700 mb-3">
                Basabas Noktasi (Break-Even)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="font-commons text-xs text-neutral-500 mb-1">Gunluk Kazanman Gereken</p>
                  <p className="font-commons text-xl font-bold text-indigo-600">
                    {formatCurrency(totalMonthlyCost / 20)} TL
                  </p>
                  <p className="font-commons text-xs text-neutral-400 mt-0.5">20 is gunu / ay</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="font-commons text-xs text-neutral-500 mb-1">Saatlik Kazanman Gereken</p>
                  <p className="font-commons text-xl font-bold text-indigo-600">
                    {formatCurrency(totalMonthlyCost / 20 / 8)} TL
                  </p>
                  <p className="font-commons text-xs text-neutral-400 mt-0.5">8 saat / gun</p>
                </div>
              </div>
              <p className="font-commons text-xs text-indigo-600/70 mt-3 text-center">
                Bu degerler sadece sabit giderleri karsilar. Kar elde etmek icin bunun uzerinde kazanmalisin.
              </p>
            </div>

            {/* Tax Deductible Section */}
            <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100">
              <h3 className="font-commons text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Vergi Matrahi Etkisi
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="bg-white rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Flag className="w-3.5 h-3.5 text-green-600" />
                    <p className="font-commons text-xs text-neutral-500">Gider Gosterilebilir</p>
                  </div>
                  <p className="font-commons text-lg font-bold text-green-600">
                    {formatCurrency(totalDeductible)} TL
                  </p>
                  <p className="font-commons text-xs text-neutral-400 mt-0.5">
                    Vergi matrahini dusurur
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Flag className="w-3.5 h-3.5 text-red-500" />
                    <p className="font-commons text-xs text-neutral-500">Gider Gosterilemeyen</p>
                  </div>
                  <p className="font-commons text-lg font-bold text-red-500">
                    {formatCurrency(totalNonDeductible)} TL
                  </p>
                  <p className="font-commons text-xs text-neutral-400 mt-0.5">
                    Vergi matrahini dusur<strong>mez</strong>
                  </p>
                </div>
              </div>
              <p className="font-commons text-xs text-amber-600/80">
                Kirmizi bayrakli giderler (faturasiz, kisisel, vb.) karlilik hesabinda yer alir ama vergi matrahini dusur<strong>mez</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Quote Module Button */}
        <Link to="/admin/pricing">
          <motion.button
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#171717] text-white rounded-lg font-commons text-sm font-medium hover:bg-neutral-800 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Calculator className="w-4 h-4" />
            Fiyat Teklif Modulu
          </motion.button>
        </Link>
      </div>
  );
};

export default CostsOverviewPage;
