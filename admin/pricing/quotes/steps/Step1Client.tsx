import React from 'react';
import { User, FileText, Calendar, Repeat, CreditCard } from 'lucide-react';
import {
  WizardClientData,
  ValidityDays,
  BillingType,
  BillingPeriod,
  BILLING_TYPE_LABELS,
  BILLING_PERIOD_LABELS,
} from '@/shared/types/pricing';

interface Step1ClientProps {
  data: WizardClientData;
  onChange: (data: WizardClientData) => void;
}

const VALIDITY_OPTIONS: { value: ValidityDays; label: string }[] = [
  { value: 7, label: '7 Gun' },
  { value: 15, label: '15 Gun' },
  { value: 30, label: '30 Gun' },
];

const BILLING_TYPE_OPTIONS: { value: BillingType; label: string; description: string }[] = [
  { value: 'one_time', label: BILLING_TYPE_LABELS.one_time, description: 'Tek seferlik proje odemesi' },
  { value: 'recurring', label: BILLING_TYPE_LABELS.recurring, description: 'Aylik tekrarlayan odeme' },
];

const BILLING_PERIOD_OPTIONS: { value: BillingPeriod; label: string }[] = [
  { value: 1, label: BILLING_PERIOD_LABELS[1] },
  { value: 3, label: BILLING_PERIOD_LABELS[3] },
  { value: 6, label: BILLING_PERIOD_LABELS[6] },
  { value: 12, label: BILLING_PERIOD_LABELS[12] },
];

const Step1Client: React.FC<Step1ClientProps> = ({ data, onChange }) => {
  const handleChange = (field: keyof WizardClientData, value: string | ValidityDays | BillingType | BillingPeriod) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="font-grotesk text-2xl font-bold text-[#171717] mb-2">
          Musteri Bilgileri
        </h2>
        <p className="font-grotesk text-neutral-500">
          Teklif icin musteri ve proje bilgilerini girin
        </p>
      </div>

      <div className="space-y-6">
        {/* Client Name */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 font-grotesk text-sm font-medium text-neutral-700">
            <User className="w-4 h-4" />
            Musteri Adi
          </label>
          <input
            type="text"
            value={data.clientName}
            onChange={(e) => handleChange('clientName', e.target.value)}
            placeholder="Ornek: ABC Sirket"
            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl font-grotesk text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]"
          />
        </div>

        {/* Project Name */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 font-grotesk text-sm font-medium text-neutral-700">
            <FileText className="w-4 h-4" />
            Proje Adi
          </label>
          <input
            type="text"
            value={data.projectName}
            onChange={(e) => handleChange('projectName', e.target.value)}
            placeholder="Ornek: Tanitim Videosu Cekimi"
            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl font-grotesk text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717]"
          />
        </div>

        {/* Project Description */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 font-grotesk text-sm font-medium text-neutral-700">
            <FileText className="w-4 h-4" />
            Proje Aciklamasi <span className="text-neutral-400 font-normal">(opsiyonel)</span>
          </label>
          <textarea
            value={data.projectDescription || ''}
            onChange={(e) => handleChange('projectDescription', e.target.value)}
            placeholder="Projenin kapsamı, beklentiler veya özel notlar..."
            rows={3}
            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl font-grotesk text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#171717]/10 focus:border-[#171717] resize-none"
          />
        </div>

        {/* Billing Type */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 font-grotesk text-sm font-medium text-neutral-700">
            <CreditCard className="w-4 h-4" />
            Fatura Turu
          </label>
          <div className="grid grid-cols-2 gap-3">
            {BILLING_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleChange('billingType', option.value)}
                className={`
                  px-4 py-3 rounded-xl text-left transition-all
                  ${
                    data.billingType === option.value
                      ? 'bg-[#171717] text-white'
                      : 'bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300'
                  }
                `}
              >
                <span className="font-grotesk text-sm font-medium block">{option.label}</span>
                <span className={`font-grotesk text-xs ${data.billingType === option.value ? 'text-neutral-300' : 'text-neutral-500'}`}>
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Billing Period (only for recurring) */}
        {data.billingType === 'recurring' && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 font-grotesk text-sm font-medium text-neutral-700">
              <Repeat className="w-4 h-4" />
              Sozlesme Suresi
            </label>
            <div className="grid grid-cols-4 gap-3">
              {BILLING_PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange('billingPeriodMonths', option.value)}
                  className={`
                    px-4 py-3 rounded-xl font-grotesk text-sm font-medium transition-all
                    ${
                      data.billingPeriodMonths === option.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Validity Days */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 font-grotesk text-sm font-medium text-neutral-700">
            <Calendar className="w-4 h-4" />
            Teklif Gecerlilik Suresi
          </label>
          <div className="grid grid-cols-3 gap-3">
            {VALIDITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleChange('validityDays', option.value)}
                className={`
                  px-4 py-3 rounded-xl font-grotesk text-sm font-medium transition-all
                  ${
                    data.validityDays === option.value
                      ? 'bg-[#171717] text-white'
                      : 'bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Helper text */}
      <div className="mt-8 p-4 bg-blue-50 rounded-xl">
        <p className="font-grotesk text-sm text-blue-700">
          <strong>Not:</strong> Musteri ve proje adi teklif belgesinde gorunecektir.
          Gecerlilik suresi dolunca teklif otomatik olarak "Suresi Doldu" durumuna gecer.
        </p>
      </div>
    </div>
  );
};

export default Step1Client;
