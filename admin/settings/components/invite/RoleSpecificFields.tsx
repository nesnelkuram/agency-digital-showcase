import React from 'react';
import { Plus, X } from 'lucide-react';
import { UserRole, InvitationExtraFields, User, HourlyCurrency } from '@/shared/types/user';
import UserPicker from './UserPicker';
import ProjectMultiSelect from './ProjectMultiSelect';

interface RoleSpecificFieldsProps {
  role: UserRole;
  value: InvitationExtraFields;
  onChange: (next: InvitationExtraFields) => void;
  tenantUsers: User[];
  errors?: Partial<Record<keyof InvitationExtraFields, string>>;
}

const DEPARTMENTS = ['Yönetim', 'Kreatif', 'Satış', 'Operasyon', 'Finans', 'Teknik', 'Diğer'];
const SKILL_SUGGESTIONS = ['video', 'grafik', 'copy', 'motion', 'foto', 'UI/UX', '3D', 'animasyon'];
const CURRENCIES: HourlyCurrency[] = ['TRY', 'USD', 'EUR'];

const labelClass = 'block font-grotesk text-xs font-medium text-neutral-700 mb-1.5';
const inputClass =
  'w-full px-3 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400 bg-white';
const requiredBadge = (
  <span className="ml-1 text-[10px] text-red-500 font-normal">(zorunlu)</span>
);

interface ChipMultiInputProps {
  values: string[];
  suggestions: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}

const ChipMultiInput: React.FC<ChipMultiInputProps> = ({ values, suggestions, onChange, placeholder }) => {
  const [input, setInput] = React.useState('');

  const add = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setInput('');
  };

  const remove = (val: string) => {
    onChange(values.filter((v) => v !== val));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-[#171717] text-white text-xs font-grotesk"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              className="p-0.5 hover:bg-white/10 rounded-full"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(input);
            }
          }}
          placeholder={placeholder || 'Ekle + Enter'}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => add(input)}
          className="px-3 py-2.5 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4 text-neutral-700" />
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {suggestions
            .filter((s) => !values.includes(s))
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="text-[11px] font-grotesk px-2 py-0.5 rounded-full bg-neutral-50 text-neutral-500 hover:bg-neutral-100 border border-neutral-200"
              >
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

const RoleSpecificFields: React.FC<RoleSpecificFieldsProps> = ({
  role,
  value,
  onChange,
  tenantUsers,
  errors,
}) => {
  const set = (patch: Partial<InvitationExtraFields>) => onChange({ ...value, ...patch });

  if (role === 'admin' || role === 'account_manager' || role === 'staff') {
    return (
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Departman</label>
          <select
            value={value.department || ''}
            onChange={(e) => set({ department: e.target.value || undefined })}
            className={inputClass}
          >
            <option value="">— seçin —</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Yönetici</label>
          <UserPicker
            users={tenantUsers.filter((u) => ['admin', 'super_admin', 'account_manager'].includes(u.role))}
            value={value.managerId}
            onChange={(uid) => set({ managerId: uid })}
            placeholder="Yönetici seçin..."
          />
        </div>
      </div>
    );
  }

  if (role === 'editor') {
    return (
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Uzmanlık alanları</label>
          <ChipMultiInput
            values={value.skills || []}
            suggestions={SKILL_SUGGESTIONS}
            onChange={(skills) => set({ skills })}
            placeholder="ör. video, motion..."
          />
        </div>
        <div>
          <label className={labelClass}>Departman</label>
          <select
            value={value.department || 'Kreatif'}
            onChange={(e) => set({ department: e.target.value })}
            className={inputClass}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Atanacak projeler (opsiyonel)</label>
          <ProjectMultiSelect
            value={value.assignedProjectIds || []}
            onChange={(ids) => set({ assignedProjectIds: ids })}
            placeholder="Proje ara..."
          />
        </div>
      </div>
    );
  }

  if (role === 'client') {
    return (
      <div className="space-y-4">
        <div>
          <label className={labelClass}>
            Şirket adı{requiredBadge}
          </label>
          <input
            type="text"
            value={value.clientCompany || ''}
            onChange={(e) => set({ clientCompany: e.target.value })}
            placeholder="ör. Acme A.Ş."
            className={`${inputClass} ${errors?.clientCompany ? 'border-red-400' : ''}`}
          />
          {errors?.clientCompany && (
            <p className="mt-1 text-[11px] text-red-500 font-grotesk">{errors.clientCompany}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>
            Projeler{requiredBadge}
          </label>
          <ProjectMultiSelect
            value={value.assignedProjectIds || []}
            onChange={(ids) => set({ assignedProjectIds: ids })}
            placeholder="Mevcut projelerden seç..."
          />
          <p className="mt-1 text-[11px] text-neutral-400 font-grotesk">
            En az bir proje seçin. Proje sonradan eklenecekse bu müşteriyi daha sonra davet edin.
          </p>
          {errors?.assignedProjectIds && (
            <p className="mt-1 text-[11px] text-red-500 font-grotesk">{errors.assignedProjectIds}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Fatura e-postası (farklıysa)</label>
          <input
            type="email"
            value={value.billingEmail || ''}
            onChange={(e) => set({ billingEmail: e.target.value })}
            placeholder="muhasebe@sirket.com"
            className={inputClass}
          />
        </div>
      </div>
    );
  }

  if (role === 'freelancer') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>
              Saatlik ücret{requiredBadge}
            </label>
            <input
              type="number"
              min={0}
              value={value.hourlyRate ?? ''}
              onChange={(e) => set({ hourlyRate: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="ör. 500"
              className={`${inputClass} ${errors?.hourlyRate ? 'border-red-400' : ''}`}
            />
            {errors?.hourlyRate && (
              <p className="mt-1 text-[11px] text-red-500 font-grotesk">{errors.hourlyRate}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Para birimi</label>
            <select
              value={value.hourlyCurrency || 'TRY'}
              onChange={(e) => set({ hourlyCurrency: e.target.value as HourlyCurrency })}
              className={inputClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Uzmanlık alanları</label>
          <ChipMultiInput
            values={value.skills || []}
            suggestions={SKILL_SUGGESTIONS}
            onChange={(skills) => set({ skills })}
            placeholder="ör. video, 3D..."
          />
        </div>
        <div>
          <label className={labelClass}>Atanacak projeler (opsiyonel)</label>
          <ProjectMultiSelect
            value={value.assignedProjectIds || []}
            onChange={(ids) => set({ assignedProjectIds: ids })}
            placeholder="Proje ara..."
          />
        </div>
      </div>
    );
  }

  if (role === 'super_admin') {
    return (
      <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl">
        <p className="font-grotesk text-sm text-violet-900">
          Süper admin yetkileri yalnızca mevcut süper adminler tarafından atanabilir. Tenant ataması davet kabul edildikten sonra ayrı olarak yapılır.
        </p>
      </div>
    );
  }

  return null;
};

export default RoleSpecificFields;
