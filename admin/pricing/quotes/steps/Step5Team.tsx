import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Minus, User, Package, ChevronDown, ChevronUp,
  Users, Search, X, ExternalLink, Pencil, Check, FileText,
} from 'lucide-react';
import {
  StaffMember,
  Equipment,
  TeamMemberSelection,
  EquipmentSelection,
  RentalLineItem,
  calculateStaffRates,
  calculateEquipmentDailyRate,
  STAFF_ROLE_LABELS,
  EQUIPMENT_CATEGORY_LABELS,
  DEFAULT_PRICING_CONFIG,
} from '@/shared/types/pricing';
import { EXTERNAL_CREW_CATALOG, EXTERNAL_CREW_ROLES, ExternalCrewItem } from '@/shared/data/externalCrewCatalog';
import { useRentalCatalog } from '@/shared/hooks/useRentalCatalog';

interface Step5TeamProps {
  staffList: StaffMember[];
  equipmentList: Equipment[];
  selectedTeam: TeamMemberSelection[];
  selectedEquipment: EquipmentSelection[];
  externalCrew: RentalLineItem[];
  rentalItems: RentalLineItem[];
  onTeamChange: (team: TeamMemberSelection[]) => void;
  onEquipmentChange: (equipment: EquipmentSelection[]) => void;
  onExternalCrewChange: (crew: RentalLineItem[]) => void;
  onRentalItemsChange: (items: RentalLineItem[]) => void;
  formatCurrency: (amount: number) => string;
}

// ── Price cell — defined OUTSIDE component to avoid remount on each render ──
interface PriceCellProps {
  itemKey: string;
  price: number;
  color: string;
  editingKey: string | null;
  editingValue: string;
  onStartEdit: (key: string, price: number) => void;
  onChangeValue: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}
const PriceCell: React.FC<PriceCellProps> = ({
  itemKey, price, color, editingKey, editingValue,
  onStartEdit, onChangeValue, onCommit, onCancel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = editingKey === itemKey;

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          min={1}
          value={editingValue}
          onChange={(e) => onChangeValue(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit();
            if (e.key === 'Escape') onCancel();
          }}
          className="w-24 px-2 py-0.5 text-xs border border-neutral-300 rounded-md font-grotesk focus:outline-none focus:ring-1 focus:ring-[#171717]/20"
        />
        <span className="text-xs text-neutral-400">TL/g</span>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onCommit(); }}
          className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center hover:bg-green-200"
        >
          <Check className="w-3 h-3 text-green-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group/price">
      <span className={`font-grotesk text-xs ${color}`}>{price.toLocaleString('tr-TR')} TL/gün</span>
      <button
        type="button"
        onClick={() => onStartEdit(itemKey, price)}
        className="opacity-0 group-hover/price:opacity-100 transition-opacity w-5 h-5 rounded-full hover:bg-neutral-200 flex items-center justify-center"
      >
        <Pencil className="w-3 h-3 text-neutral-400" />
      </button>
    </div>
  );
};

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const Step5Team: React.FC<Step5TeamProps> = ({
  staffList, equipmentList,
  selectedTeam, selectedEquipment, externalCrew, rentalItems,
  onTeamChange, onEquipmentChange, onExternalCrewChange, onRentalItemsChange,
  formatCurrency,
}) => {
  const [showStaff, setShowStaff] = useState(true);
  const [showEquipment, setShowEquipment] = useState(true);
  const [showExternalCrew, setShowExternalCrew] = useState(false);
  const [showRental, setShowRental] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [extCrewRole, setExtCrewRole] = useState('Tümü');
  const [pendingCrewDays, setPendingCrewDays] = useState<Record<string, number>>({});
  const [pendingRentalDays, setPendingRentalDays] = useState<Record<string, number>>({});

  // price editing
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // manual item form
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualDays, setManualDays] = useState(1);

  const { items: rentalCatalog, loading: rentalLoading, categories, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory } = useRentalCatalog();

  // ── Internal staff ──────────────────────────────────────────────────────────
  const getStaffDailyRate = (s: StaffMember) => calculateStaffRates(s, DEFAULT_PRICING_CONFIG).dailyRate;
  const isStaffSelected = (id: string) => selectedTeam.some((t) => t.staffId === id);
  const getSelectedStaff = (id: string) => selectedTeam.find((t) => t.staffId === id);

  const toggleStaff = (staff: StaffMember) => {
    if (isStaffSelected(staff.id)) {
      onTeamChange(selectedTeam.filter((t) => t.staffId !== staff.id));
    } else {
      const dailyRate = getStaffDailyRate(staff);
      onTeamChange([...selectedTeam, { staffId: staff.id, name: staff.name, role: staff.role, days: 1, dailyRate, total: dailyRate }]);
    }
  };

  const updateStaffDays = (staffId: string, days: number) => {
    if (days < 1) return;
    onTeamChange(selectedTeam.map((t) => t.staffId === staffId ? { ...t, days, total: t.dailyRate * days } : t));
  };

  const updateStaffRate = (staffId: string, newRate: number) => {
    if (newRate <= 0) return;
    onTeamChange(selectedTeam.map((t) => t.staffId === staffId ? { ...t, dailyRate: newRate, total: newRate * t.days } : t));
  };

  // ── Internal equipment ──────────────────────────────────────────────────────
  const getEquipmentDailyRate = (e: Equipment) => calculateEquipmentDailyRate(e, DEFAULT_PRICING_CONFIG);
  const isEquipmentSelected = (id: string) => selectedEquipment.some((e) => e.equipmentId === id);
  const getSelectedEquipment = (id: string) => selectedEquipment.find((e) => e.equipmentId === id);

  const toggleEquipment = (equipment: Equipment) => {
    if (isEquipmentSelected(equipment.id)) {
      onEquipmentChange(selectedEquipment.filter((e) => e.equipmentId !== equipment.id));
    } else {
      const dailyRate = getEquipmentDailyRate(equipment);
      onEquipmentChange([...selectedEquipment, { equipmentId: equipment.id, name: equipment.name, category: equipment.category, days: 1, dailyRate, total: dailyRate }]);
    }
  };

  const updateEquipmentDays = (equipmentId: string, days: number) => {
    if (days < 1) return;
    onEquipmentChange(selectedEquipment.map((e) => e.equipmentId === equipmentId ? { ...e, days, total: e.dailyRate * days } : e));
  };

  const updateEquipmentRate = (equipmentId: string, newRate: number) => {
    if (newRate <= 0) return;
    onEquipmentChange(selectedEquipment.map((e) => e.equipmentId === equipmentId ? { ...e, dailyRate: newRate, total: newRate * e.days } : e));
  };

  // ── External crew ───────────────────────────────────────────────────────────
  const isCrewAdded = (id: string) => externalCrew.some((c) => c.catalogItemId === id);

  const addCrewMember = (item: ExternalCrewItem) => {
    const days = pendingCrewDays[item.id] || 1;
    if (isCrewAdded(item.id)) return;
    onExternalCrewChange([...externalCrew, {
      catalogItemId: item.id, name: item.name, category: item.role,
      categoryLabel: item.role, dailyPrice: item.dailyPrice,
      days, total: item.dailyPrice * days, imageUrl: item.imageUrl,
    }]);
  };

  const removeCrewMember = (id: string) => onExternalCrewChange(externalCrew.filter((c) => c.catalogItemId !== id));

  const updateCrewDays = (id: string, days: number) => {
    onExternalCrewChange(externalCrew.map((c) => c.catalogItemId === id ? { ...c, days, total: c.dailyPrice * days } : c));
  };

  const updateCrewPrice = (id: string, newPrice: number) => {
    if (newPrice <= 0) return;
    onExternalCrewChange(externalCrew.map((c) => c.catalogItemId === id ? { ...c, dailyPrice: newPrice, total: newPrice * c.days } : c));
  };

  const filteredCrew = extCrewRole === 'Tümü'
    ? EXTERNAL_CREW_CATALOG
    : EXTERNAL_CREW_CATALOG.filter((c) => c.role === extCrewRole);

  // ── Rental equipment ────────────────────────────────────────────────────────
  const isRentalAdded = (id: string) => rentalItems.some((r) => r.catalogItemId === id);

  const addRentalItem = (item: { id: string; name: string; category: string; categoryLabel: string; dailyPrice: number; imageUrl: string }) => {
    const days = pendingRentalDays[item.id] || 1;
    if (isRentalAdded(item.id)) return;
    onRentalItemsChange([...rentalItems, {
      catalogItemId: item.id, name: item.name, category: item.category,
      categoryLabel: item.categoryLabel, dailyPrice: item.dailyPrice,
      days, total: item.dailyPrice * days, imageUrl: item.imageUrl,
    }]);
  };

  const removeRentalItem = (id: string) => onRentalItemsChange(rentalItems.filter((r) => r.catalogItemId !== id));

  const updateRentalDays = (id: string, days: number) => {
    onRentalItemsChange(rentalItems.map((r) => r.catalogItemId === id ? { ...r, days, total: r.dailyPrice * days } : r));
  };

  const updateRentalPrice = (id: string, newPrice: number) => {
    if (newPrice <= 0) return;
    onRentalItemsChange(rentalItems.map((r) => r.catalogItemId === id ? { ...r, dailyPrice: newPrice, total: newPrice * r.days } : r));
  };

  // ── Manual items ────────────────────────────────────────────────────────────
  const manualItems = rentalItems.filter((r) => r.catalogItemId.startsWith('manual_'));

  const addManualItem = () => {
    const price = parseFloat(manualPrice);
    if (!manualName.trim() || isNaN(price) || price <= 0) return;
    const id = `manual_${Date.now()}`;
    onRentalItemsChange([...rentalItems, {
      catalogItemId: id, name: manualName.trim(), category: 'manuel',
      categoryLabel: 'Manuel', dailyPrice: price,
      days: manualDays, total: price * manualDays, imageUrl: '',
    }]);
    setManualName('');
    setManualPrice('');
    setManualDays(1);
  };

  // ── Price editing ───────────────────────────────────────────────────────────
  const startEdit = (key: string, price: number) => {
    setEditingKey(key);
    setEditingValue(String(price));
  };

  const commitEdit = () => {
    const val = parseFloat(editingValue);
    if (editingKey && !isNaN(val) && val > 0) {
      if (editingKey.startsWith('staff_')) updateStaffRate(editingKey.slice(6), val);
      else if (editingKey.startsWith('equip_')) updateEquipmentRate(editingKey.slice(6), val);
      else if (editingKey.startsWith('crew_')) updateCrewPrice(editingKey.slice(5), val);
      else if (editingKey.startsWith('rental_')) updateRentalPrice(editingKey.slice(7), val);
      else if (editingKey.startsWith('manual_')) updateRentalPrice(editingKey.slice(7), val);
    }
    setEditingKey(null);
  };

  const cancelEdit = () => setEditingKey(null);

  const priceCellProps = {
    editingKey, editingValue,
    onStartEdit: startEdit,
    onChangeValue: setEditingValue,
    onCommit: commitEdit,
    onCancel: cancelEdit,
  };

  // ── Totals ──────────────────────────────────────────────────────────────────
  const staffTotal = selectedTeam.reduce((s, t) => s + t.dailyRate * t.days, 0);
  const equipmentTotal = selectedEquipment.reduce((s, e) => s + e.dailyRate * e.days, 0);
  const externalCrewTotal = externalCrew.reduce((s, c) => s + c.dailyPrice * c.days, 0);
  const rentalTotal = rentalItems.reduce((s, r) => s + r.dailyPrice * r.days, 0);
  const grandTotal = staffTotal + equipmentTotal + externalCrewTotal + rentalTotal;

  // ── Shared sub-components ───────────────────────────────────────────────────
  const DayControl = ({ days, onMinus, onPlus, total, color }: { days: number; onMinus: () => void; onPlus: () => void; total: number; color: string }) => (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onMinus} disabled={days <= 1} className="w-8 h-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 disabled:opacity-50">
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-12 text-center font-grotesk font-medium">{days} gün</span>
      <button type="button" onClick={onPlus} className="w-8 h-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-50">
        <Plus className="w-4 h-4" />
      </button>
      <span className={`ml-3 font-grotesk font-medium ${color} min-w-[80px] text-right`}>{formatCurrency(total)}</span>
    </div>
  );

  const SectionHeader = ({ open, onToggle, icon, title, subtitle, badge }: {
    open: boolean; onToggle: () => void; icon: React.ReactNode;
    title: string; subtitle?: string; badge?: string;
  }) => (
    <button type="button" onClick={onToggle} className="w-full px-6 py-4 flex items-center justify-between hover:bg-neutral-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="shrink-0">{icon}</div>
        <div className="text-left">
          <h3 className="font-grotesk font-medium text-[#171717]">
            {title}
            {badge && <span className="ml-2 bg-teal-100 text-teal-700 text-xs font-semibold px-2 py-0.5 rounded-full">{badge}</span>}
          </h3>
          {subtitle && <p className="font-grotesk text-sm text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      {open ? <ChevronUp className="w-5 h-5 text-neutral-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-neutral-400 shrink-0" />}
    </button>
  );

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="font-grotesk text-2xl font-bold text-[#171717] mb-2">Ekip & Ekipman</h2>
        <p className="font-grotesk text-neutral-500">Projede gorev alacak personel ve ekipmanı secin</p>
      </div>

      <div className="space-y-4">
        {/* ── 1. İç Personel ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <SectionHeader
            open={showStaff} onToggle={() => setShowStaff(!showStaff)}
            icon={<div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><User className="w-5 h-5 text-blue-600" /></div>}
            title="İç Personel"
            subtitle={`${selectedTeam.length} kisi secildi${staffTotal > 0 ? ` • ${formatCurrency(staffTotal)}` : ''}`}
          />
          <AnimatePresence>
            {showStaff && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-6 pb-6 border-t border-neutral-100 pt-4">
                  {staffList.length === 0 ? (
                    <p className="text-center text-neutral-500 font-grotesk text-sm py-4">Henuz personel kaydı yok.</p>
                  ) : (
                    <div className="space-y-3">
                      {staffList.map((staff) => {
                        const isSelected = isStaffSelected(staff.id);
                        const selection = getSelectedStaff(staff.id);
                        const dailyRate = getStaffDailyRate(staff);
                        return (
                          <div key={staff.id} className={`p-4 rounded-xl border transition-all ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <button type="button" onClick={() => toggleStaff(staff)} className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-neutral-300 hover:border-blue-400'}`}>
                                  {isSelected && <CheckIcon />}
                                </button>
                                <div>
                                  <p className="font-grotesk font-medium text-[#171717]">{staff.name}</p>
                                  <div className="flex items-center gap-1 text-sm text-neutral-500">
                                    <span className="font-grotesk">{STAFF_ROLE_LABELS[staff.role]} •</span>
                                    {isSelected && selection ? (
                                      <PriceCell
                                        itemKey={`staff_${staff.id}`}
                                        price={selection.dailyRate}
                                        color="text-neutral-500"
                                        {...priceCellProps}
                                      />
                                    ) : (
                                      <span className="font-grotesk">{formatCurrency(dailyRate)}/gün</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isSelected && selection && (
                                <DayControl
                                  days={selection.days}
                                  onMinus={() => updateStaffDays(staff.id, selection.days - 1)}
                                  onPlus={() => updateStaffDays(staff.id, selection.days + 1)}
                                  total={selection.dailyRate * selection.days}
                                  color="text-blue-600"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── 2. İç Ekipman ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <SectionHeader
            open={showEquipment} onToggle={() => setShowEquipment(!showEquipment)}
            icon={<div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center"><Package className="w-5 h-5 text-purple-600" /></div>}
            title="İç Ekipman"
            subtitle={`${selectedEquipment.length} ekipman secildi${equipmentTotal > 0 ? ` • ${formatCurrency(equipmentTotal)}` : ''}`}
          />
          <AnimatePresence>
            {showEquipment && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-6 pb-6 border-t border-neutral-100 pt-4">
                  {equipmentList.length === 0 ? (
                    <p className="text-center text-neutral-500 font-grotesk text-sm py-4">Henuz ekipman kaydi yok.</p>
                  ) : (
                    <div className="space-y-3">
                      {equipmentList.map((equipment) => {
                        const isSelected = isEquipmentSelected(equipment.id);
                        const selection = getSelectedEquipment(equipment.id);
                        const dailyRate = getEquipmentDailyRate(equipment);
                        return (
                          <div key={equipment.id} className={`p-4 rounded-xl border transition-all ${isSelected ? 'border-purple-300 bg-purple-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <button type="button" onClick={() => toggleEquipment(equipment)} className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-neutral-300 hover:border-purple-400'}`}>
                                  {isSelected && <CheckIcon />}
                                </button>
                                <div>
                                  <p className="font-grotesk font-medium text-[#171717]">{equipment.name}</p>
                                  <div className="flex items-center gap-1 text-sm text-neutral-500">
                                    <span className="font-grotesk">{EQUIPMENT_CATEGORY_LABELS[equipment.category]} •</span>
                                    {isSelected && selection ? (
                                      <PriceCell
                                        itemKey={`equip_${equipment.id}`}
                                        price={selection.dailyRate}
                                        color="text-neutral-500"
                                        {...priceCellProps}
                                      />
                                    ) : (
                                      <span className="font-grotesk">{formatCurrency(dailyRate)}/gün</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isSelected && selection && (
                                <DayControl
                                  days={selection.days}
                                  onMinus={() => updateEquipmentDays(equipment.id, selection.days - 1)}
                                  onPlus={() => updateEquipmentDays(equipment.id, selection.days + 1)}
                                  total={selection.dailyRate * selection.days}
                                  color="text-purple-600"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── 3. Dış Ekip ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <SectionHeader
            open={showExternalCrew} onToggle={() => setShowExternalCrew(!showExternalCrew)}
            icon={<div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><Users className="w-5 h-5 text-amber-600" /></div>}
            title="Dış Ekip"
            subtitle={`Teknik ekip kiralamaları${externalCrewTotal > 0 ? ` • ${formatCurrency(externalCrewTotal)}` : ''}`}
            badge={externalCrew.length > 0 ? `${externalCrew.length} kişi` : undefined}
          />
          <AnimatePresence>
            {showExternalCrew && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-6 pb-6 border-t border-neutral-100 pt-4 space-y-4">
                  {externalCrew.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider">Seçilen Ekip</p>
                      {externalCrew.map((c) => (
                        <div key={c.catalogItemId} className="flex items-center gap-3 bg-amber-50 rounded-lg p-3">
                          {c.imageUrl && <img src={c.imageUrl} alt={c.name} className="w-10 h-10 object-cover rounded-md bg-white shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-grotesk text-sm font-medium text-[#171717] truncate">{c.name}</p>
                            <PriceCell
                              itemKey={`crew_${c.catalogItemId}`}
                              price={c.dailyPrice}
                              color="text-amber-600"
                              {...priceCellProps}
                            />
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button type="button" onClick={() => updateCrewDays(c.catalogItemId, Math.max(1, c.days - 1))} className="w-6 h-6 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-sm font-bold">−</button>
                            <span className="font-grotesk text-sm font-semibold w-8 text-center">{c.days}g</span>
                            <button type="button" onClick={() => updateCrewDays(c.catalogItemId, c.days + 1)} className="w-6 h-6 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-sm font-bold">+</button>
                            <span className="font-grotesk text-sm font-semibold text-amber-700 w-20 text-right">{formatCurrency(c.dailyPrice * c.days)}</span>
                            <button type="button" onClick={() => removeCrewMember(c.catalogItemId)} className="ml-1 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center hover:bg-red-200">
                              <X className="w-3 h-3 text-red-600" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {EXTERNAL_CREW_ROLES.map((role) => (
                      <button key={role} type="button" onClick={() => setExtCrewRole(role)}
                        className={`px-3 py-1 rounded-full text-xs font-grotesk font-medium transition-colors ${extCrewRole === role ? 'bg-[#171717] text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                        {role}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {filteredCrew.map((item) => {
                      const added = isCrewAdded(item.id);
                      return (
                        <div key={item.id} className={`rounded-xl border overflow-hidden transition-all ${added ? 'border-amber-400 bg-amber-50' : 'border-neutral-200 bg-white'}`}>
                          <div className="aspect-square bg-neutral-100 overflow-hidden">
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                          <div className="p-2">
                            <p className="font-grotesk text-xs font-medium text-[#171717] leading-tight line-clamp-2 mb-1">{item.name}</p>
                            <p className="font-grotesk text-xs text-amber-600 font-semibold">{formatCurrency(item.dailyPrice)}/gün</p>
                            {!added ? (
                              <div className="mt-2 flex items-center gap-1">
                                <input type="number" min={1} value={pendingCrewDays[item.id] || 1}
                                  onChange={(e) => setPendingCrewDays((p) => ({ ...p, [item.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                                  className="w-10 px-1 py-1 text-center text-xs border border-neutral-200 rounded-md font-grotesk focus:outline-none" title="Gün" />
                                <span className="text-xs text-neutral-400">g</span>
                                <button type="button" onClick={() => addCrewMember(item)}
                                  className="ml-auto bg-[#171717] text-white px-2 py-1 rounded-md text-xs font-grotesk hover:bg-neutral-700 flex items-center gap-0.5">
                                  <Plus className="w-3 h-3" />Ekle
                                </button>
                              </div>
                            ) : (
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-xs text-amber-600 font-grotesk font-semibold">✓ Eklendi</span>
                                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-600"><ExternalLink className="w-3 h-3" /></a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── 4. Kiralacek Ekipmanları ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <SectionHeader
            open={showRental} onToggle={() => setShowRental(!showRental)}
            icon={<div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center"><Package className="w-5 h-5 text-teal-600" /></div>}
            title="Kiralık Ekipman"
            subtitle={`Ekipman kiralamaları${rentalTotal > 0 ? ` • ${formatCurrency(rentalTotal)}` : ''}`}
            badge={rentalItems.filter((r) => !r.catalogItemId.startsWith('manual_')).length > 0
              ? `${rentalItems.filter((r) => !r.catalogItemId.startsWith('manual_')).length} ekipman`
              : undefined}
          />
          <AnimatePresence>
            {showRental && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-6 pb-6 border-t border-neutral-100 pt-4 space-y-4">
                  {rentalItems.filter((r) => !r.catalogItemId.startsWith('manual_')).length > 0 && (
                    <div className="space-y-2">
                      <p className="font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider">Seçilen Ekipmanlar</p>
                      {rentalItems.filter((r) => !r.catalogItemId.startsWith('manual_')).map((item) => (
                        <div key={item.catalogItemId} className="flex items-center gap-3 bg-teal-50 rounded-lg p-3">
                          {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-10 h-10 object-cover rounded-md bg-white shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-grotesk text-sm font-medium text-[#171717] truncate">{item.name}</p>
                            <PriceCell
                              itemKey={`rental_${item.catalogItemId}`}
                              price={item.dailyPrice}
                              color="text-teal-600"
                              {...priceCellProps}
                            />
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button type="button" onClick={() => updateRentalDays(item.catalogItemId, Math.max(1, item.days - 1))} className="w-6 h-6 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-sm font-bold">−</button>
                            <span className="font-grotesk text-sm font-semibold w-8 text-center">{item.days}g</span>
                            <button type="button" onClick={() => updateRentalDays(item.catalogItemId, item.days + 1)} className="w-6 h-6 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-sm font-bold">+</button>
                            <span className="font-grotesk text-sm font-semibold text-teal-700 w-20 text-right">{formatCurrency(item.dailyPrice * item.days)}</span>
                            <button type="button" onClick={() => removeRentalItem(item.catalogItemId)} className="ml-1 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center hover:bg-red-200">
                              <X className="w-3 h-3 text-red-600" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button key={cat.value} type="button" onClick={() => setSelectedCategory(cat.value)}
                        className={`px-3 py-1 rounded-full text-xs font-grotesk font-medium transition-colors ${selectedCategory === cat.value ? 'bg-[#171717] text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ekipman ara..."
                      className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg font-grotesk text-sm text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]" />
                  </div>

                  {rentalLoading ? (
                    <p className="text-center py-8 text-neutral-400 font-grotesk text-sm">Katalog yükleniyor...</p>
                  ) : rentalCatalog.length === 0 ? (
                    <p className="text-center py-8 text-neutral-400 font-grotesk text-sm">Sonuç bulunamadı</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
                      {rentalCatalog.map((item) => {
                        const added = isRentalAdded(item.id);
                        return (
                          <div key={item.id} className={`rounded-xl border overflow-hidden transition-all ${added ? 'border-teal-400 bg-teal-50' : 'border-neutral-200 bg-white hover:border-neutral-300'}`}>
                            <div className="aspect-square bg-neutral-100 overflow-hidden">
                              {item.imageUrl
                                ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                                : <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-neutral-300" /></div>}
                            </div>
                            <div className="p-2">
                              <p className="font-grotesk text-xs font-medium text-[#171717] leading-tight line-clamp-2 mb-1">{item.name}</p>
                              <p className="font-grotesk text-xs text-teal-600 font-semibold">{item.dailyPrice > 0 ? `${formatCurrency(item.dailyPrice)}/gün` : 'Fiyat yok'}</p>
                              {!added ? (
                                <div className="mt-2 flex items-center gap-1">
                                  <input type="number" min={1} value={pendingRentalDays[item.id] || 1}
                                    onChange={(e) => setPendingRentalDays((p) => ({ ...p, [item.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                                    className="w-10 px-1 py-1 text-center text-xs border border-neutral-200 rounded-md font-grotesk focus:outline-none" title="Gün" />
                                  <span className="text-xs text-neutral-400">g</span>
                                  <button type="button" onClick={() => addRentalItem(item)} disabled={item.dailyPrice === 0}
                                    className="ml-auto bg-[#171717] text-white px-2 py-1 rounded-md text-xs font-grotesk hover:bg-neutral-700 disabled:opacity-40 flex items-center gap-0.5">
                                    <Plus className="w-3 h-3" />Ekle
                                  </button>
                                </div>
                              ) : (
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="text-xs text-teal-600 font-grotesk font-semibold">✓ Eklendi</span>
                                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-600"><ExternalLink className="w-3 h-3" /></a>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── 5. Manuel Kalemler ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <SectionHeader
            open={showManual} onToggle={() => setShowManual(!showManual)}
            icon={<div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center"><FileText className="w-5 h-5 text-rose-600" /></div>}
            title="Manuel Kalemler"
            subtitle="Katalogda olmayan özel maliyet kalemleri"
            badge={manualItems.length > 0 ? `${manualItems.length} kalem` : undefined}
          />
          <AnimatePresence>
            {showManual && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-6 pb-6 border-t border-neutral-100 pt-4 space-y-4">
                  {/* Mevcut manuel kalemler */}
                  {manualItems.length > 0 && (
                    <div className="space-y-2">
                      {manualItems.map((item) => (
                        <div key={item.catalogItemId} className="flex items-center gap-3 bg-rose-50 rounded-lg p-3">
                          <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-rose-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-grotesk text-sm font-medium text-[#171717] truncate">{item.name}</p>
                            <PriceCell
                              itemKey={`rental_${item.catalogItemId}`}
                              price={item.dailyPrice}
                              color="text-rose-600"
                              {...priceCellProps}
                            />
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button type="button" onClick={() => updateRentalDays(item.catalogItemId, Math.max(1, item.days - 1))} className="w-6 h-6 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-sm font-bold">−</button>
                            <span className="font-grotesk text-sm font-semibold w-8 text-center">{item.days}g</span>
                            <button type="button" onClick={() => updateRentalDays(item.catalogItemId, item.days + 1)} className="w-6 h-6 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-sm font-bold">+</button>
                            <span className="font-grotesk text-sm font-semibold text-rose-700 w-20 text-right">{formatCurrency(item.dailyPrice * item.days)}</span>
                            <button type="button" onClick={() => removeRentalItem(item.catalogItemId)} className="ml-1 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center hover:bg-red-200">
                              <X className="w-3 h-3 text-red-600" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Yeni kalem formu */}
                  <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                    <p className="font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider">Yeni Kalem Ekle</p>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Kalem adı (örn: Jeneratör, Sahne kurulum...)"
                      className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg font-grotesk text-sm text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]"
                      onKeyDown={(e) => { if (e.key === 'Enter') addManualItem(); }}
                    />
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min={1}
                          value={manualPrice}
                          onChange={(e) => setManualPrice(e.target.value)}
                          placeholder="Fiyat (TL/gün)"
                          className="w-full px-3 py-2.5 pr-16 bg-white border border-neutral-200 rounded-lg font-grotesk text-sm text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]"
                          onKeyDown={(e) => { if (e.key === 'Enter') addManualItem(); }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 font-grotesk">TL/gün</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-lg px-3">
                        <button type="button" onClick={() => setManualDays(Math.max(1, manualDays - 1))} className="w-5 h-5 flex items-center justify-center text-neutral-500 hover:text-neutral-800 text-lg leading-none">−</button>
                        <span className="font-grotesk text-sm font-medium w-6 text-center">{manualDays}</span>
                        <button type="button" onClick={() => setManualDays(manualDays + 1)} className="w-5 h-5 flex items-center justify-center text-neutral-500 hover:text-neutral-800 text-lg leading-none">+</button>
                        <span className="font-grotesk text-xs text-neutral-400 ml-1">gün</span>
                      </div>
                      <button
                        type="button"
                        onClick={addManualItem}
                        disabled={!manualName.trim() || !manualPrice || parseFloat(manualPrice) <= 0}
                        className="bg-[#171717] text-white px-4 py-2.5 rounded-lg font-grotesk text-sm font-medium hover:bg-neutral-700 disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        Ekle
                      </button>
                    </div>
                    {manualName && manualPrice && parseFloat(manualPrice) > 0 && (
                      <p className="font-grotesk text-xs text-neutral-500">
                        Toplam: <span className="font-semibold text-[#171717]">{formatCurrency(parseFloat(manualPrice) * manualDays)}</span> ({manualDays} gün × {formatCurrency(parseFloat(manualPrice))})
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Toplam */}
      {grandTotal > 0 && (
        <div className="mt-6 p-4 bg-neutral-100 rounded-xl space-y-2">
          {staffTotal > 0 && <div className="flex justify-between text-sm"><span className="font-grotesk text-neutral-600">İç Personel:</span><span className="font-grotesk font-medium">{formatCurrency(staffTotal)}</span></div>}
          {equipmentTotal > 0 && <div className="flex justify-between text-sm"><span className="font-grotesk text-neutral-600">İç Ekipman:</span><span className="font-grotesk font-medium">{formatCurrency(equipmentTotal)}</span></div>}
          {externalCrewTotal > 0 && <div className="flex justify-between text-sm"><span className="font-grotesk text-neutral-600">Dış Ekip:</span><span className="font-grotesk font-medium text-amber-700">{formatCurrency(externalCrewTotal)}</span></div>}
          {rentalTotal > 0 && <div className="flex justify-between text-sm"><span className="font-grotesk text-neutral-600">Kiralacek + Manuel:</span><span className="font-grotesk font-medium text-teal-700">{formatCurrency(rentalTotal)}</span></div>}
          <div className="flex justify-between border-t border-neutral-200 pt-2">
            <span className="font-grotesk font-semibold text-[#171717]">Bu Adım Toplamı:</span>
            <span className="font-grotesk text-xl font-bold text-[#171717]">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step5Team;
