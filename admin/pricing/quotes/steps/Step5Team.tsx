import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, User, Package, ChevronDown, ChevronUp } from 'lucide-react';
import {
  StaffMember,
  Equipment,
  TeamMemberSelection,
  EquipmentSelection,
  calculateStaffRates,
  calculateEquipmentDailyRate,
  STAFF_ROLE_LABELS,
  EQUIPMENT_CATEGORY_LABELS,
  DEFAULT_PRICING_CONFIG,
} from '@/shared/types/pricing';

interface Step5TeamProps {
  staffList: StaffMember[];
  equipmentList: Equipment[];
  selectedTeam: TeamMemberSelection[];
  selectedEquipment: EquipmentSelection[];
  onTeamChange: (team: TeamMemberSelection[]) => void;
  onEquipmentChange: (equipment: EquipmentSelection[]) => void;
  formatCurrency: (amount: number) => string;
}

const Step5Team: React.FC<Step5TeamProps> = ({
  staffList,
  equipmentList,
  selectedTeam,
  selectedEquipment,
  onTeamChange,
  onEquipmentChange,
  formatCurrency,
}) => {
  const [showStaff, setShowStaff] = useState(true);
  const [showEquipment, setShowEquipment] = useState(true);

  // Helper: Get daily rate for a staff member
  const getStaffDailyRate = (staff: StaffMember): number => {
    const rates = calculateStaffRates(staff, DEFAULT_PRICING_CONFIG);
    return rates.dailyRate;
  };

  // Helper: Get daily rate for equipment
  const getEquipmentDailyRate = (equipment: Equipment): number => {
    return calculateEquipmentDailyRate(equipment, DEFAULT_PRICING_CONFIG);
  };

  // Check if staff member is selected
  const isStaffSelected = (staffId: string): boolean => {
    return selectedTeam.some((t) => t.staffId === staffId);
  };

  // Get selected staff member data
  const getSelectedStaff = (staffId: string): TeamMemberSelection | undefined => {
    return selectedTeam.find((t) => t.staffId === staffId);
  };

  // Toggle staff selection
  const toggleStaff = (staff: StaffMember) => {
    if (isStaffSelected(staff.id)) {
      // Remove
      onTeamChange(selectedTeam.filter((t) => t.staffId !== staff.id));
    } else {
      // Add with 1 day default
      const dailyRate = getStaffDailyRate(staff);
      onTeamChange([
        ...selectedTeam,
        {
          staffId: staff.id,
          name: staff.name,
          role: staff.role,
          days: 1,
          dailyRate,
          total: dailyRate,
        },
      ]);
    }
  };

  // Update staff days
  const updateStaffDays = (staffId: string, days: number) => {
    if (days < 1) return;
    onTeamChange(
      selectedTeam.map((t) =>
        t.staffId === staffId
          ? { ...t, days, total: t.dailyRate * days }
          : t
      )
    );
  };

  // Check if equipment is selected
  const isEquipmentSelected = (equipmentId: string): boolean => {
    return selectedEquipment.some((e) => e.equipmentId === equipmentId);
  };

  // Get selected equipment data
  const getSelectedEquipment = (equipmentId: string): EquipmentSelection | undefined => {
    return selectedEquipment.find((e) => e.equipmentId === equipmentId);
  };

  // Toggle equipment selection
  const toggleEquipment = (equipment: Equipment) => {
    if (isEquipmentSelected(equipment.id)) {
      // Remove
      onEquipmentChange(selectedEquipment.filter((e) => e.equipmentId !== equipment.id));
    } else {
      // Add with 1 day default
      const dailyRate = getEquipmentDailyRate(equipment);
      onEquipmentChange([
        ...selectedEquipment,
        {
          equipmentId: equipment.id,
          name: equipment.name,
          category: equipment.category,
          days: 1,
          dailyRate,
          total: dailyRate,
        },
      ]);
    }
  };

  // Update equipment days
  const updateEquipmentDays = (equipmentId: string, days: number) => {
    if (days < 1) return;
    onEquipmentChange(
      selectedEquipment.map((e) =>
        e.equipmentId === equipmentId
          ? { ...e, days, total: e.dailyRate * days }
          : e
      )
    );
  };

  // Calculate totals
  const staffTotal = selectedTeam.reduce((sum, t) => sum + t.total, 0);
  const equipmentTotal = selectedEquipment.reduce((sum, e) => sum + e.total, 0);

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="font-grotesk text-2xl font-bold text-[#171717] mb-2">
          Ekip & Ekipman
        </h2>
        <p className="font-grotesk text-neutral-500">
          Projede gorev alacak personel ve kullanilacak ekipmanı secin
        </p>
      </div>

      <div className="space-y-6">
        {/* Staff Section */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <button
            onClick={() => setShowStaff(!showStaff)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <h3 className="font-grotesk font-medium text-[#171717]">Personel</h3>
                <p className="font-grotesk text-sm text-neutral-500">
                  {selectedTeam.length} kisi secildi
                  {staffTotal > 0 && ` • ${formatCurrency(staffTotal)}`}
                </p>
              </div>
            </div>
            {showStaff ? (
              <ChevronUp className="w-5 h-5 text-neutral-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-neutral-400" />
            )}
          </button>

          <AnimatePresence>
            {showStaff && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 border-t border-neutral-100 pt-4">
                  {staffList.length === 0 ? (
                    <p className="text-center text-neutral-500 font-grotesk text-sm py-4">
                      Henuz personel kaydı yok. Ayarlardan personel ekleyin.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {staffList.map((staff) => {
                        const isSelected = isStaffSelected(staff.id);
                        const selection = getSelectedStaff(staff.id);
                        const dailyRate = getStaffDailyRate(staff);

                        return (
                          <div
                            key={staff.id}
                            className={`p-4 rounded-xl border transition-all ${
                              isSelected
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-neutral-200 hover:border-neutral-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => toggleStaff(staff)}
                                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'border-neutral-300 hover:border-blue-400'
                                  }`}
                                >
                                  {isSelected && (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                </button>
                                <div>
                                  <p className="font-grotesk font-medium text-[#171717]">{staff.name}</p>
                                  <p className="font-grotesk text-sm text-neutral-500">
                                    {STAFF_ROLE_LABELS[staff.role]} • {formatCurrency(dailyRate)}/gun
                                  </p>
                                </div>
                              </div>

                              {isSelected && selection && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateStaffDays(staff.id, selection.days - 1)}
                                    disabled={selection.days <= 1}
                                    className="w-8 h-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <span className="w-12 text-center font-grotesk font-medium">
                                    {selection.days} gun
                                  </span>
                                  <button
                                    onClick={() => updateStaffDays(staff.id, selection.days + 1)}
                                    className="w-8 h-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-50"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                  <span className="ml-3 font-grotesk font-medium text-blue-600 min-w-[80px] text-right">
                                    {formatCurrency(selection.total)}
                                  </span>
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

        {/* Equipment Section */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <button
            onClick={() => setShowEquipment(!showEquipment)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <h3 className="font-grotesk font-medium text-[#171717]">Ekipman</h3>
                <p className="font-grotesk text-sm text-neutral-500">
                  {selectedEquipment.length} ekipman secildi
                  {equipmentTotal > 0 && ` • ${formatCurrency(equipmentTotal)}`}
                </p>
              </div>
            </div>
            {showEquipment ? (
              <ChevronUp className="w-5 h-5 text-neutral-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-neutral-400" />
            )}
          </button>

          <AnimatePresence>
            {showEquipment && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 border-t border-neutral-100 pt-4">
                  {equipmentList.length === 0 ? (
                    <p className="text-center text-neutral-500 font-grotesk text-sm py-4">
                      Henuz ekipman kaydi yok. Ayarlardan ekipman ekleyin.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {equipmentList.map((equipment) => {
                        const isSelected = isEquipmentSelected(equipment.id);
                        const selection = getSelectedEquipment(equipment.id);
                        const dailyRate = getEquipmentDailyRate(equipment);

                        return (
                          <div
                            key={equipment.id}
                            className={`p-4 rounded-xl border transition-all ${
                              isSelected
                                ? 'border-purple-300 bg-purple-50'
                                : 'border-neutral-200 hover:border-neutral-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => toggleEquipment(equipment)}
                                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? 'bg-purple-600 border-purple-600 text-white'
                                      : 'border-neutral-300 hover:border-purple-400'
                                  }`}
                                >
                                  {isSelected && (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                </button>
                                <div>
                                  <p className="font-grotesk font-medium text-[#171717]">{equipment.name}</p>
                                  <p className="font-grotesk text-sm text-neutral-500">
                                    {EQUIPMENT_CATEGORY_LABELS[equipment.category]} • {formatCurrency(dailyRate)}/gun
                                  </p>
                                </div>
                              </div>

                              {isSelected && selection && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateEquipmentDays(equipment.id, selection.days - 1)}
                                    disabled={selection.days <= 1}
                                    className="w-8 h-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <span className="w-12 text-center font-grotesk font-medium">
                                    {selection.days} gun
                                  </span>
                                  <button
                                    onClick={() => updateEquipmentDays(equipment.id, selection.days + 1)}
                                    className="w-8 h-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-50"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                  <span className="ml-3 font-grotesk font-medium text-purple-600 min-w-[80px] text-right">
                                    {formatCurrency(selection.total)}
                                  </span>
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
      </div>

      {/* Summary */}
      {(staffTotal > 0 || equipmentTotal > 0) && (
        <div className="mt-6 p-4 bg-neutral-100 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="font-grotesk text-neutral-600">Bu adim toplami:</span>
            <span className="font-grotesk text-xl font-bold text-[#171717]">
              {formatCurrency(staffTotal + equipmentTotal)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step5Team;
