import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CostSummaryCards from './components/CostSummaryCards';
import CostTable, { Column } from './components/CostTable';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import type { StaffMember, StaffRole, CostStatus } from '@/shared/types/pricing';
import { STAFF_ROLE_LABELS, DEFAULT_PRICING_CONFIG, calculateStaffRates } from '@/shared/types/pricing';

// Extended type for UI display
interface PersonnelRow extends StaffMember {
  totalCost: number;
  displayHourlyRate?: number; // For displaying calculated hourly rate
  hasInvoice?: boolean;       // Fatura durumu (freelancer için)
}

const WORKING_DAYS = DEFAULT_PRICING_CONFIG.workingDaysPerMonth;

// ========================================
// 2026 Türkiye Maaş Hesaplama Sabitleri
// ========================================

// Çalışan Kesinti Oranları
const EMPLOYEE_DEDUCTION_RATE = 0.15;  // SGK işçi %14 + İşsizlik %1 = %15

// İşveren Maliyet Oranları (SGK + İşsizlik)
const EMPLOYER_COST_RATE_WITH_INCENTIVE = 0.175;    // %15.5 (teşvikli) + %2 = %17.5
const EMPLOYER_COST_RATE_WITHOUT_INCENTIVE = 0.225; // %20.5 (teşviksiz) + %2 = %22.5

// Asgari Ücret (2026)
const MINIMUM_WAGE_NET = 28075.50;     // Net asgari ücret

// Gelir Vergisi Dilimleri (2026 - Yıllık kümülatif)
const TAX_BRACKETS = [
  { limit: 158000, rate: 0.15 },
  { limit: 330000, rate: 0.20 },
  { limit: 800000, rate: 0.27 },
  { limit: 4300000, rate: 0.35 },
  { limit: Infinity, rate: 0.40 },
];

// Damga Vergisi
const STAMP_TAX_RATE = 0.00759;

// Ay seçenekleri
const MONTH_OPTIONS = [
  { value: '1', label: 'Ocak' },
  { value: '2', label: 'Şubat' },
  { value: '3', label: 'Mart' },
  { value: '4', label: 'Nisan' },
  { value: '5', label: 'Mayıs' },
  { value: '6', label: 'Haziran' },
  { value: '7', label: 'Temmuz' },
  { value: '8', label: 'Ağustos' },
  { value: '9', label: 'Eylül' },
  { value: '10', label: 'Ekim' },
  { value: '11', label: 'Kasım' },
  { value: '12', label: 'Aralık' },
];

// ========================================
// Hesaplama Fonksiyonları
// ========================================

// Brütten Net Hesaplama (kümülatif vergi ile)
const calculateNetFromGross = (grossSalary: number, taxMonth: number = 1): number => {
  if (grossSalary <= 0) return 0;

  const minWageGross = MINIMUM_WAGE_NET / 0.85;

  // Çalışan kesintileri (%15)
  const employeeDeductions = grossSalary * EMPLOYEE_DEDUCTION_RATE;

  // Vergi matrahı
  const taxableBase = grossSalary - employeeDeductions;

  // Asgari ücret vergi istisnası
  const minWageTaxBase = minWageGross - (minWageGross * EMPLOYEE_DEDUCTION_RATE);

  // Aylık vergilenecek tutar (asgari ücret üstü kısım)
  const monthlyTaxableAmount = Math.max(0, taxableBase - minWageTaxBase);

  // Gelir vergisi hesaplama (kümülatif)
  let incomeTax = 0;
  if (monthlyTaxableAmount > 0) {
    // Kümülatif matrah (önceki aylar + bu ay)
    const cumulativeTaxable = monthlyTaxableAmount * taxMonth;
    const previousCumulative = monthlyTaxableAmount * (taxMonth - 1);

    // Bu aya kadar toplam vergi
    const totalTaxUntilNow = calculateCumulativeTax(cumulativeTaxable);
    // Önceki aylara kadar toplam vergi
    const totalTaxUntilPrevious = calculateCumulativeTax(previousCumulative);

    // Bu ayın vergisi = fark
    incomeTax = totalTaxUntilNow - totalTaxUntilPrevious;
  }

  // Damga vergisi (asgari ücret üstü için)
  const stampTax = monthlyTaxableAmount > 0 ? grossSalary * STAMP_TAX_RATE : 0;

  // Net maaş
  return grossSalary - employeeDeductions - incomeTax - stampTax;
};

// Kümülatif vergi hesaplama
const calculateCumulativeTax = (cumulativeAmount: number): number => {
  let tax = 0;
  let remainingIncome = cumulativeAmount;
  let previousLimit = 0;

  for (const bracket of TAX_BRACKETS) {
    if (remainingIncome <= 0) break;
    const bracketSize = bracket.limit - previousLimit;
    const taxableInBracket = Math.min(remainingIncome, bracketSize);
    tax += taxableInBracket * bracket.rate;
    remainingIncome -= taxableInBracket;
    previousLimit = bracket.limit;
  }

  return tax;
};

// Netten Brüt Hesaplama
const calculateGrossFromNet = (targetNet: number, taxMonth: number = 1): number => {
  if (targetNet <= 0) return 0;

  // Asgari ücret veya altı: basit formül
  if (targetNet <= MINIMUM_WAGE_NET) {
    return Number((targetNet / 0.85).toFixed(2));
  }

  // Asgari ücret üstü: iteratif brütleştirme (Gross-up)
  let gross = targetNet / 0.70; // İlk tahmin
  let iterations = 0;
  const maxIterations = 100;
  const tolerance = 0.01;

  while (iterations < maxIterations) {
    const calculatedNet = calculateNetFromGross(gross, taxMonth);
    const diff = targetNet - calculatedNet;

    if (Math.abs(diff) < tolerance) break;

    // Yaklaşımı iyileştir
    gross += diff * 1.1;
    iterations++;
  }

  return Number(gross.toFixed(2));
};

// İşveren SGK Maliyeti Hesaplama
const calculateSGKCost = (grossSalary: number, hasIncentive: boolean = true): number => {
  if (grossSalary <= 0) return 0;
  const rate = hasIncentive ? EMPLOYER_COST_RATE_WITH_INCENTIVE : EMPLOYER_COST_RATE_WITHOUT_INCENTIVE;
  return Number((grossSalary * rate).toFixed(2));
};

// Toplam Maliyet Hesaplama
// Toplam = Brüt + İşveren SGK + Yemek + Elden
// Veya doğrudan: Net × 1.38235 (sadece asgari ücret için)
const calculateTotalCost = (grossSalary: number, sgkCost: number, mealCard: number, cashPayment: number = 0): number => {
  return Number((grossSalary + sgkCost + mealCard + cashPayment).toFixed(2));
};

const PersonnelCostsPage: React.FC = () => {
  const [data, setData] = useState<PersonnelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch data from Firestore
  useEffect(() => {
    const fetchData = async () => {
      if (!db) {
        setError('Firebase baglantisi bulunamadi');
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDocs(collection(db, 'pricing', 'data', 'staff'));
        const items: PersonnelRow[] = snapshot.docs.map((docSnap) => {
          const docData = docSnap.data() as StaffMember;
          // Set defaults for new fields if not present
          const sgkIncentive = docData.sgkIncentive ?? true;
          const taxMonth = docData.taxMonth ?? 1;
          // Freelancer için varsayılan fatura durumu: yok (false)
          // Sabit çalışan için varsayılan: var (true) - SGK ile çalıştığı için gider gösterilebilir
          const hasInvoice = docData.hasInvoice ?? (docData.role !== 'freelancer');

          let totalCost: number;
          let displayHourlyRate: number;

          if (docData.role === 'freelancer') {
            // Freelancer: doğrudan saatlik ücret
            displayHourlyRate = docData.freelancerHourlyRate || 0;
            totalCost = 0; // Freelancer için toplam gösterilmeyecek
          } else {
            // Sabit çalışan: hesaplanmış saatlik ücret
            const rates = calculateStaffRates(docData, DEFAULT_PRICING_CONFIG);
            displayHourlyRate = rates.hourlyRate;
            totalCost = (docData.monthlySalary || 0) +
                       (docData.socialSecurityCost || 0) +
                       (docData.benefits?.mealCard || 0) +
                       (docData.cashPayment || 0);
          }

          return {
            ...docData,
            id: docSnap.id,
            sgkIncentive,
            taxMonth,
            hasInvoice,
            cashPayment: docData.cashPayment || 0,
            totalCost,
            displayHourlyRate,
          };
        });
        setData(items.filter(item => item.isActive));
      } catch (err) {
        console.error('Error fetching personnel:', err);
        setError('Veriler yuklenirken hata olustu');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate summary values
  const summary = useMemo(() => {
    const realStaff = data.filter((s) => s.status === 'real');
    const potentialStaff = data.filter((s) => s.status === 'potential');

    const realMonthly = realStaff.reduce((sum, s) => sum + s.totalCost, 0);
    const potentialMonthly = potentialStaff.reduce((sum, s) => sum + s.totalCost, 0);

    return {
      dailyReal: realMonthly / WORKING_DAYS,
      monthlyReal: realMonthly,
      dailyPotential: potentialMonthly / WORKING_DAYS,
      monthlyPotential: potentialMonthly,
    };
  }, [data]);

  // Column definitions - changes based on role
  const columns: Column<PersonnelRow>[] = [
    { key: 'name', label: 'Personel Adi', type: 'text', width: '12%' },
    {
      key: 'role',
      label: 'Rolu',
      type: 'select',
      width: '10%',
      options: Object.entries(STAFF_ROLE_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      key: 'taxMonth',
      label: 'Ay',
      type: 'select',
      width: '7%',
      options: MONTH_OPTIONS,
      hideForRoles: ['freelancer'],
    },
    {
      key: 'sgkIncentive',
      label: 'SGK Tesviki',
      type: 'select',
      width: '7%',
      options: [
        { value: 'true', label: 'Var' },
        { value: 'false', label: 'Yok' },
      ],
      hideForRoles: ['freelancer'],
    },
    { key: 'netSalary', label: 'Net Maas', type: 'currency', width: '10%', hideForRoles: ['freelancer'] },
    { key: 'monthlySalary', label: 'Brut', type: 'currency', width: '9%', editable: false, hideForRoles: ['freelancer'] },
    { key: 'socialSecurityCost', label: 'SGK', type: 'currency', width: '8%', editable: false, hideForRoles: ['freelancer'] },
    { key: 'benefits.mealCard', label: 'Yemek', type: 'currency', width: '7%', hideForRoles: ['freelancer'] },
    { key: 'cashPayment', label: 'Elden', type: 'currency', width: '7%', hideForRoles: ['freelancer'] },
    {
      key: 'displayHourlyRate',
      label: 'Saatlik Ucret',
      type: 'currency',
      width: '10%',
      editableForRoles: ['freelancer'], // Sadece freelancer düzenleyebilir
    },
    {
      key: 'hasInvoice',
      label: 'Fatura',
      type: 'select',
      width: '7%',
      options: [
        { value: 'true', label: 'Var' },
        { value: 'false', label: 'Yok' },
      ],
      showForRoles: ['freelancer'], // Sadece freelancer için göster
    },
    {
      key: 'totalCost',
      label: 'Toplam',
      type: 'currency',
      width: '10%',
      editable: false,
      hideForRoles: ['freelancer'], // Freelancer için gösterme
    },
    { key: 'status', label: 'Durum', type: 'status', width: '8%' },
  ];

  // Handle add new row
  const handleAdd = async () => {
    if (!db) return;

    const newItem: Omit<StaffMember, 'id'> = {
      name: 'Yeni Personel',
      role: 'junior' as StaffRole,
      monthlySalary: 0,
      netSalary: 0,
      socialSecurityCost: 0,
      benefits: { mealCard: 0, transportation: 0, healthInsurance: 0, other: 0 },
      sgkIncentive: true,
      taxMonth: 1,
      status: 'real' as CostStatus,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    try {
      const docRef = await addDoc(collection(db, 'pricing', 'data', 'staff'), newItem);
      const newRow: PersonnelRow = {
        ...newItem,
        id: docRef.id,
        totalCost: 0,
      };
      setData((prev) => [...prev, newRow]);
    } catch (err) {
      console.error('Error adding personnel:', err);
      setError('Ekleme sirasinda hata olustu');
    }
  };

  // Handle update
  const handleUpdate = async (id: string, field: keyof PersonnelRow, value: unknown) => {
    if (!db) return;

    const currentItem = data.find((d) => d.id === id);
    if (!currentItem) return;

    // Handle nested field (benefits.mealCard)
    const fieldPath = String(field);
    const isNestedField = fieldPath.includes('.');

    let updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    // Get current taxMonth and sgkIncentive values
    const currentTaxMonth = currentItem.taxMonth ?? 1;
    const currentSgkIncentive = currentItem.sgkIncentive ?? true;

    // If net salary is changed, auto-calculate gross and SGK
    if (field === 'netSalary') {
      const netSalary = value as number;
      const grossSalary = calculateGrossFromNet(netSalary, currentTaxMonth);
      const sgkCost = calculateSGKCost(grossSalary, currentSgkIncentive);

      updateData = {
        ...updateData,
        netSalary,
        monthlySalary: grossSalary,
        socialSecurityCost: sgkCost,
      };
    } else if (field === 'taxMonth') {
      // Recalculate gross and SGK when taxMonth changes
      const newTaxMonth = Number(value);
      const netSalary = currentItem.netSalary || 0;
      const grossSalary = calculateGrossFromNet(netSalary, newTaxMonth);
      const sgkCost = calculateSGKCost(grossSalary, currentSgkIncentive);

      updateData = {
        ...updateData,
        taxMonth: newTaxMonth,
        monthlySalary: grossSalary,
        socialSecurityCost: sgkCost,
      };
    } else if (field === 'sgkIncentive') {
      // Recalculate SGK cost when incentive changes
      const newSgkIncentive = value === true || value === 'true';
      const grossSalary = currentItem.monthlySalary || 0;
      const sgkCost = calculateSGKCost(grossSalary, newSgkIncentive);

      updateData = {
        ...updateData,
        sgkIncentive: newSgkIncentive,
        socialSecurityCost: sgkCost,
      };
    } else if (field === 'displayHourlyRate' || field === 'freelancerHourlyRate') {
      // Freelancer saatlik ücret değiştiğinde (displayHourlyRate UI'dan, freelancerHourlyRate Firestore'a)
      const hourlyRate = value as number;
      updateData = {
        ...updateData,
        freelancerHourlyRate: hourlyRate,
        // Freelancer için diğer maaş alanlarını sıfırla
        monthlySalary: 0,
        netSalary: 0,
        socialSecurityCost: 0,
        benefits: { mealCard: 0, transportation: 0, healthInsurance: 0, other: 0 },
      };
    } else if (field === 'hasInvoice') {
      // Fatura durumu değiştiğinde
      const hasInvoice = value === true || value === 'true';
      updateData = {
        ...updateData,
        hasInvoice,
      };
    } else if (field === 'cashPayment') {
      // Elden ödeme değiştiğinde
      const cashPayment = value as number;
      updateData = {
        ...updateData,
        cashPayment,
      };
    } else if (field === 'role') {
      // Rol değiştiğinde, freelancer'a dönüşürse maaş alanlarını sıfırla
      const newRole = value as StaffRole;
      if (newRole === 'freelancer') {
        updateData = {
          ...updateData,
          role: newRole,
          monthlySalary: 0,
          netSalary: 0,
          socialSecurityCost: 0,
          benefits: { mealCard: 0, transportation: 0, healthInsurance: 0, other: 0 },
          hasInvoice: false, // Freelancer varsayılan olarak faturasız
        };
      } else {
        // Freelancer'dan başka role dönerse, freelancerHourlyRate'i sıfırla
        updateData = {
          ...updateData,
          role: newRole,
          freelancerHourlyRate: 0,
          hasInvoice: true, // Sabit çalışan varsayılan olarak faturalı
        };
      }
    } else if (isNestedField) {
      const [parent, child] = fieldPath.split('.');
      const parentObj = (currentItem as Record<string, unknown>)?.[parent] as Record<string, unknown> || {};
      updateData = {
        ...updateData,
        [parent]: { ...parentObj, [child]: value },
      };
    } else {
      updateData = {
        ...updateData,
        [field]: value,
      };
    }

    try {
      await setDoc(doc(db, 'pricing', 'data', 'staff', id), updateData, { merge: true });

      // Update local state
      setData((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;

          let updatedItem: PersonnelRow;

          const itemTaxMonth = item.taxMonth ?? 1;
          const itemSgkIncentive = item.sgkIncentive ?? true;
          const mealCard = item.benefits?.mealCard || 0;
          const cashPayment = item.cashPayment || 0;

          // If net salary changed, update all calculated fields
          if (field === 'netSalary') {
            const netSalary = value as number;
            const grossSalary = calculateGrossFromNet(netSalary, itemTaxMonth);
            const sgkCost = calculateSGKCost(grossSalary, itemSgkIncentive);

            // Saatlik ücreti hesapla
            const tempItem = { ...item, netSalary, monthlySalary: grossSalary, socialSecurityCost: sgkCost };
            const rates = calculateStaffRates(tempItem, DEFAULT_PRICING_CONFIG);

            updatedItem = {
              ...item,
              netSalary,
              monthlySalary: grossSalary,
              socialSecurityCost: sgkCost,
              totalCost: calculateTotalCost(grossSalary, sgkCost, mealCard, cashPayment),
              displayHourlyRate: rates.hourlyRate,
            };
          } else if (field === 'taxMonth') {
            const newTaxMonth = Number(value);
            const netSalary = item.netSalary || 0;
            const grossSalary = calculateGrossFromNet(netSalary, newTaxMonth);
            const sgkCost = calculateSGKCost(grossSalary, itemSgkIncentive);

            // Saatlik ücreti hesapla
            const tempItem = { ...item, taxMonth: newTaxMonth, monthlySalary: grossSalary, socialSecurityCost: sgkCost };
            const rates = calculateStaffRates(tempItem, DEFAULT_PRICING_CONFIG);

            updatedItem = {
              ...item,
              taxMonth: newTaxMonth,
              monthlySalary: grossSalary,
              socialSecurityCost: sgkCost,
              totalCost: calculateTotalCost(grossSalary, sgkCost, mealCard, cashPayment),
              displayHourlyRate: rates.hourlyRate,
            };
          } else if (field === 'sgkIncentive') {
            const newSgkIncentive = value === true || value === 'true';
            const grossSalary = item.monthlySalary || 0;
            const sgkCost = calculateSGKCost(grossSalary, newSgkIncentive);

            // Saatlik ücreti hesapla
            const tempItem = { ...item, sgkIncentive: newSgkIncentive, socialSecurityCost: sgkCost };
            const rates = calculateStaffRates(tempItem, DEFAULT_PRICING_CONFIG);

            updatedItem = {
              ...item,
              sgkIncentive: newSgkIncentive,
              socialSecurityCost: sgkCost,
              totalCost: calculateTotalCost(grossSalary, sgkCost, mealCard, cashPayment),
              displayHourlyRate: rates.hourlyRate,
            };
          } else if (field === 'displayHourlyRate' || field === 'freelancerHourlyRate') {
            const hourlyRate = value as number;

            updatedItem = {
              ...item,
              freelancerHourlyRate: hourlyRate,
              displayHourlyRate: hourlyRate,
              monthlySalary: 0,
              netSalary: 0,
              socialSecurityCost: 0,
              benefits: { mealCard: 0, transportation: 0, healthInsurance: 0, other: 0 },
              totalCost: 0, // Freelancer için toplam gösterilmiyor
            };
          } else if (field === 'hasInvoice') {
            const hasInvoice = value === true || value === 'true';
            updatedItem = {
              ...item,
              hasInvoice,
            };
          } else if (field === 'role') {
            const newRole = value as StaffRole;
            if (newRole === 'freelancer') {
              updatedItem = {
                ...item,
                role: newRole,
                monthlySalary: 0,
                netSalary: 0,
                socialSecurityCost: 0,
                benefits: { mealCard: 0, transportation: 0, healthInsurance: 0, other: 0 },
                displayHourlyRate: item.freelancerHourlyRate || 0,
                hasInvoice: false, // Freelancer varsayılan olarak faturasız
                totalCost: 0,
              };
            } else {
              // Sabit çalışana dönüşünce saatlik ücreti hesapla
              const tempItem = { ...item, role: newRole, freelancerHourlyRate: 0 };
              const rates = calculateStaffRates(tempItem, DEFAULT_PRICING_CONFIG);
              updatedItem = {
                ...item,
                role: newRole,
                freelancerHourlyRate: 0,
                displayHourlyRate: rates.hourlyRate,
                hasInvoice: true, // Sabit çalışan varsayılan olarak faturalı
                totalCost: calculateTotalCost(
                  item.monthlySalary || 0,
                  item.socialSecurityCost || 0,
                  item.benefits?.mealCard || 0,
                  item.cashPayment || 0
                ),
              };
            }
          } else if (isNestedField) {
            const [parent, child] = fieldPath.split('.');
            const parentObj = (item as Record<string, unknown>)[parent] as Record<string, unknown> || {};
            updatedItem = {
              ...item,
              [parent]: { ...parentObj, [child]: value },
            } as PersonnelRow;

            // Recalculate total and hourly rate if meal card changed
            if (fieldPath === 'benefits.mealCard') {
              const rates = calculateStaffRates(updatedItem, DEFAULT_PRICING_CONFIG);
              updatedItem.totalCost = calculateTotalCost(
                updatedItem.monthlySalary || 0,
                updatedItem.socialSecurityCost || 0,
                value as number,
                updatedItem.cashPayment || 0
              );
              updatedItem.displayHourlyRate = rates.hourlyRate;
            }
          } else if (field === 'cashPayment') {
            // Elden ödeme değiştiğinde
            const newCashPayment = value as number;
            updatedItem = { ...item, cashPayment: newCashPayment } as PersonnelRow;
            const rates = calculateStaffRates(updatedItem, DEFAULT_PRICING_CONFIG);
            updatedItem.totalCost = calculateTotalCost(
              updatedItem.monthlySalary || 0,
              updatedItem.socialSecurityCost || 0,
              updatedItem.benefits?.mealCard || 0,
              newCashPayment
            );
            updatedItem.displayHourlyRate = rates.hourlyRate;
          } else {
            updatedItem = { ...item, [field]: value } as PersonnelRow;

            // Recalculate total
            updatedItem.totalCost = calculateTotalCost(
              updatedItem.monthlySalary || 0,
              updatedItem.socialSecurityCost || 0,
              updatedItem.benefits?.mealCard || 0,
              updatedItem.cashPayment || 0
            );
          }

          return updatedItem;
        })
      );

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error('Error updating personnel:', err);
      setError('Guncelleme sirasinda hata olustu');
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!db) return;

    try {
      // Soft delete - set isActive to false
      await setDoc(doc(db, 'pricing', 'data', 'staff', id), { isActive: false }, { merge: true });
      setData((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Error deleting personnel:', err);
      setError('Silme sirasinda hata olustu');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-commons text-2xl md:text-3xl font-bold text-[#171717] pb-2 border-b-2 border-indigo-500 inline-block">
            Sabit Maliyetler
          </h1>
        </div>

        {/* Summary Cards */}
        <CostSummaryCards
          cards={[
            { label: 'Gunluk Reel Personel Maliyeti', value: summary.dailyReal },
            { label: 'Aylik Reel Personel Maliyeti', value: summary.monthlyReal },
            { label: 'Gunluk Potansiyel Personel Maliyeti', value: summary.dailyPotential },
            { label: 'Aylik Potansiyel Personel Maliyeti', value: summary.monthlyPotential },
          ]}
        />

        {/* Section Title */}
        <h2 className="font-commons text-xl font-bold text-[#171717] mb-4">
          Personel Giderleri
        </h2>

        {/* Table */}
        <div className="bg-white/50 rounded-xl overflow-hidden shadow-sm">
          <CostTable
            columns={columns}
            data={data}
            onAdd={handleAdd}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        </div>

        {/* Error/Success Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed bottom-6 right-6 bg-red-500 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3"
            >
              <span className="font-commons text-sm">{error}</span>
              <button onClick={() => setError(null)} className="text-white/70 hover:text-white">
                &times;
              </button>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed bottom-6 right-6 bg-green-500 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3"
            >
              <Save className="w-5 h-5" />
              <span className="font-commons text-sm">Kaydedildi!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
};

export default PersonnelCostsPage;
