import { Settings2, UserCheck, Clock, LayoutGrid } from 'lucide-react';
import type { ApprovalConfig } from '@/shared/types/socialMedia';

interface ApprovalConfigSectionProps {
  config: ApprovalConfig;
  onChange: (config: ApprovalConfig) => void;
  disabled?: boolean;
}

export default function ApprovalConfigSection({
  config,
  onChange,
  disabled = false,
}: ApprovalConfigSectionProps) {
  const toggleField = (field: keyof ApprovalConfig) => {
    onChange({ ...config, [field]: !config[field] });
  };

  return (
    <div className="bg-white border border-neutral-100 rounded-xl p-4 font-grotesk">
      <div className="flex items-center gap-2 mb-3">
        <Settings2 size={16} className="text-neutral-500" />
        <h3 className="text-sm font-semibold text-[#171717]">Onay Ayarlari</h3>
      </div>

      <div className="space-y-3">
        <ToggleOption
          icon={UserCheck}
          label="Dahili Inceleme Gerektir"
          description="Account Manager, musteriye gondermeden once icerigi kontrol eder"
          checked={config.requireInternalReview}
          onChange={() => toggleField('requireInternalReview')}
          disabled={disabled}
        />

        <ToggleOption
          icon={Clock}
          label="Onay Sonrasi Otomatik Zamanla"
          description="Tum postlar onaylandiginda zamanlanmis duruma otomatik gecer"
          checked={config.autoScheduleOnApproval}
          onChange={() => toggleField('autoScheduleOnApproval')}
          disabled={disabled}
        />

        <ToggleOption
          icon={LayoutGrid}
          label="Post Bazinda Onay"
          description="Musteri her postu ayri ayri onaylayabilir veya reddedebilir"
          checked={config.allowPartialApproval}
          onChange={() => toggleField('allowPartialApproval')}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function ToggleOption({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon: typeof Settings2;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 p-2 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex-shrink-0 mt-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={onChange}
          disabled={disabled}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            checked ? 'bg-[#171717]' : 'bg-neutral-200'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              checked ? 'translate-x-4.5' : 'translate-x-0.5'
            }`}
            style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
          />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className="text-neutral-500" />
          <span className="text-xs font-medium text-[#171717]">{label}</span>
        </div>
        <p className="text-[10px] text-neutral-500 mt-0.5">{description}</p>
      </div>
    </label>
  );
}
