import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Send,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  Crown,
  Shield,
  Users as UsersIcon,
  Sparkles,
  Building2,
  User as UserIcon,
  Save,
  BookmarkPlus,
  Copy,
  Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { UserRole, User, InvitationExtraFields } from '@/shared/types/user';
import { useAuth } from '@/contexts/AuthContext';
import RoleCard from './RoleCard';
import RoleSpecificFields from './RoleSpecificFields';
import PermissionPreview from './PermissionPreview';
import {
  InviteTemplate,
  listInviteTemplates,
  saveInviteTemplate,
  deleteInviteTemplate,
} from '@/shared/constants/inviteTemplates';

export interface InvitePayload {
  email: string;
  displayName: string;
  role: UserRole;
  extraFields?: InvitationExtraFields;
  forceTwoFactor?: boolean;
  expiresInDays?: number;
  useTemporaryPassword?: boolean;
}

interface InviteUserWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: InvitePayload) => Promise<{ temporaryPassword?: string } | void>;
  tenantUsers: User[];
  currentUserRole?: UserRole;
  /** Belirli bir rolde kilitle (proje bağlamında davet için) */
  lockedRole?: UserRole;
  /** Başlangıç değerleri (proje kimliği, şirket adı vs.) */
  prefillExtra?: InvitationExtraFields;
  /** Başlık (context'e göre override) */
  title?: string;
}

interface RoleOption {
  role: UserRole;
  label: string;
  description: string;
  icon: LucideIcon;
  chips: string[];
  accentColor: string;
  group: 'internal' | 'external' | 'system';
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'admin',
    label: 'Yönetici',
    description: 'Tenant içinde tam yetki — tüm modüllere erişir',
    icon: Crown,
    chips: ['Tüm modüller', 'Kullanıcı yönet', 'Fiyatlandırma'],
    accentColor: 'from-purple-500 to-fuchsia-500',
    group: 'internal',
  },
  {
    role: 'account_manager',
    label: 'Hesap Yöneticisi',
    description: 'Müşteri ilişkileri; sadece satış fiyatı görür',
    icon: UsersIcon,
    chips: ['Başvurular', 'Projeler', 'Onaylar', 'Satış fiyatı'],
    accentColor: 'from-indigo-500 to-blue-500',
    group: 'internal',
  },
  {
    role: 'editor',
    label: 'Editör',
    description: 'Kreatif ekip — fiyatlandırma görmez',
    icon: Sparkles,
    chips: ['Projeler', 'Görevler', 'Sosyal Medya', 'Brand Kit'],
    accentColor: 'from-sky-500 to-cyan-500',
    group: 'internal',
  },
  {
    role: 'staff',
    label: 'Çalışan',
    description: 'Ajans çalışanı — tüm proje yönetimine erişir',
    icon: Shield,
    chips: ['Başvurular', 'Projeler', 'Görevler', 'Pazarlama'],
    accentColor: 'from-blue-500 to-indigo-500',
    group: 'internal',
  },
  {
    role: 'client',
    label: 'Müşteri',
    description: 'Dış paydaş — kendi projesini görür ve onaylar',
    icon: Building2,
    chips: ['Kendi projeleri', 'Onaylar', 'Brand Kit görüntüle'],
    accentColor: 'from-emerald-500 to-green-500',
    group: 'external',
  },
  {
    role: 'freelancer',
    label: 'Freelancer',
    description: 'Dış yüklenici — sadece atanan işleri görür',
    icon: UserIcon,
    chips: ['Atanan görevler', 'Yükleme', 'Geri bildirim'],
    accentColor: 'from-amber-500 to-orange-500',
    group: 'external',
  },
  {
    role: 'super_admin',
    label: 'Süper Admin',
    description: 'Tüm tenant\'lara global erişim',
    icon: Crown,
    chips: ['Multi-tenant', 'Sistem yönetimi'],
    accentColor: 'from-violet-500 to-purple-500',
    group: 'system',
  },
];

const ROLE_BY_KEY: Record<UserRole, RoleOption> = ROLE_OPTIONS.reduce(
  (acc, opt) => {
    acc[opt.role] = opt;
    return acc;
  },
  {} as Record<UserRole, RoleOption>
);

const labelClass = 'block font-grotesk text-xs font-medium text-neutral-700 mb-1.5';
const inputClass =
  'w-full px-3 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400 bg-white';

function validate(role: UserRole | null, form: FormState): {
  valid: boolean;
  errors: Record<string, string>;
  extraErrors: Partial<Record<keyof InvitationExtraFields, string>>;
} {
  const errors: Record<string, string> = {};
  const extraErrors: Partial<Record<keyof InvitationExtraFields, string>> = {};

  if (!role) {
    errors._role = 'Rol seçin';
    return { valid: false, errors, extraErrors };
  }
  if (!form.email.trim()) errors.email = 'E-posta zorunlu';
  else if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Geçersiz e-posta';
  if (!form.displayName.trim()) errors.displayName = 'Ad soyad zorunlu';

  if (role === 'client') {
    if (!form.extraFields.clientCompany?.trim()) extraErrors.clientCompany = 'Şirket adı zorunlu';
    if (!form.extraFields.assignedProjectIds || form.extraFields.assignedProjectIds.length === 0) {
      extraErrors.assignedProjectIds = 'En az bir proje seçin';
    }
  }
  if (role === 'freelancer') {
    if (!form.extraFields.hourlyRate || form.extraFields.hourlyRate <= 0) {
      extraErrors.hourlyRate = 'Saatlik ücret > 0 olmalı';
    }
  }

  const valid = Object.keys(errors).length === 0 && Object.keys(extraErrors).length === 0;
  return { valid, errors, extraErrors };
}

interface FormState {
  email: string;
  displayName: string;
  phone: string;
  title: string;
  extraFields: InvitationExtraFields;
  useTemporaryPassword: boolean;
  forceTwoFactor: boolean;
  expiresInDays: number;
}

const initialForm: FormState = {
  email: '',
  displayName: '',
  phone: '',
  title: '',
  extraFields: {},
  useTemporaryPassword: false,
  forceTwoFactor: false,
  expiresInDays: 7,
};

const InviteUserWizard: React.FC<InviteUserWizardProps> = ({
  open,
  onClose,
  onSubmit,
  tenantUsers,
  currentUserRole,
  lockedRole,
  prefillExtra,
  title,
}) => {
  const { user: currentUser } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [extraErrors, setExtraErrors] = useState<Partial<Record<keyof InvitationExtraFields, string>>>({});
  const [templates, setTemplates] = useState<InviteTemplate[]>([]);
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset on open — lockedRole varsa 2. adımdan başla, rolü seç, extras'ı prefill et
  useEffect(() => {
    if (open) {
      if (lockedRole) {
        setSelectedRole(lockedRole);
        setStep(2);
      } else {
        setStep(1);
        setSelectedRole(null);
      }
      setForm({
        ...initialForm,
        extraFields: prefillExtra || {},
        phone: prefillExtra?.phone || '',
        title: prefillExtra?.title || '',
      });
      setSubmitError(null);
      setFieldErrors({});
      setExtraErrors({});
      setTempPassword(null);
      if (currentUser?.uid) {
        setTemplates(listInviteTemplates(currentUser.uid));
      }
    }
  }, [open, currentUser?.uid, lockedRole, prefillExtra]);

  const visibleRoles = useMemo(() => {
    return ROLE_OPTIONS.filter((r) => {
      if (r.role === 'super_admin' && currentUserRole !== 'super_admin') return false;
      return true;
    });
  }, [currentUserRole]);

  const groups = useMemo(() => {
    return {
      internal: visibleRoles.filter((r) => r.group === 'internal'),
      external: visibleRoles.filter((r) => r.group === 'external'),
      system: visibleRoles.filter((r) => r.group === 'system'),
    };
  }, [visibleRoles]);

  const applyTemplate = (tpl: InviteTemplate) => {
    setSelectedRole(tpl.role);
    setForm((f) => ({
      ...f,
      extraFields: { ...tpl.extraFields },
      phone: tpl.extraFields.phone || '',
      title: tpl.extraFields.title || '',
    }));
    setStep(2);
  };

  const removeTemplate = (id: string) => {
    if (!currentUser?.uid) return;
    deleteInviteTemplate(currentUser.uid, id);
    setTemplates(listInviteTemplates(currentUser.uid));
  };

  const goNext = () => {
    if (!selectedRole) {
      setFieldErrors({ _role: 'Rol seçin' });
      return;
    }
    setFieldErrors({});
    setStep(2);
  };

  const handleSubmit = async () => {
    const { valid, errors, extraErrors: ex } = validate(selectedRole, form);
    if (!valid) {
      setFieldErrors(errors);
      setExtraErrors(ex);
      return;
    }
    setFieldErrors({});
    setExtraErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      const mergedExtras: InvitationExtraFields = {
        ...form.extraFields,
        phone: form.phone.trim() || undefined,
        title: form.title.trim() || undefined,
      };
      const result = await onSubmit({
        email: form.email.trim().toLowerCase(),
        displayName: form.displayName.trim(),
        role: selectedRole as UserRole,
        extraFields: mergedExtras,
        forceTwoFactor: form.forceTwoFactor,
        expiresInDays: form.expiresInDays,
        useTemporaryPassword: form.useTemporaryPassword,
      });
      if (result && result.temporaryPassword) {
        setTempPassword(result.temporaryPassword);
      } else {
        onClose();
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Davet gönderilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveTemplate = () => {
    if (!currentUser?.uid || !selectedRole) return;
    if (!templateName.trim()) return;
    saveInviteTemplate(currentUser.uid, {
      name: templateName.trim(),
      role: selectedRole,
      extraFields: {
        ...form.extraFields,
        phone: form.phone.trim() || undefined,
        title: form.title.trim() || undefined,
      },
    });
    setTemplates(listInviteTemplates(currentUser.uid));
    setShowTemplateSave(false);
    setTemplateName('');
  };

  const copyTempPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex"
        >
          <div className="absolute inset-0 bg-black/50" onClick={tempPassword ? undefined : onClose} />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative ml-auto w-full max-w-xl bg-white shadow-2xl flex flex-col h-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <div>
                <h2 className="font-grotesk text-xl font-bold text-[#171717]">{title || 'Kullanıcı Davet Et'}</h2>
                <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                  Adım {step} / 2 — {step === 1 ? 'Rol seçimi' : 'Bilgiler'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-neutral-100 rounded-lg"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {tempPassword ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <h3 className="font-grotesk font-semibold text-green-900">Kullanıcı oluşturuldu</h3>
                    <p className="font-grotesk text-sm text-green-800 mt-1">
                      Aşağıdaki geçici şifreyi kullanıcıya güvenli kanaldan iletin. Bu şifre yalnızca bir kez gösterilir.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 p-3 border border-neutral-200 rounded-xl bg-neutral-50">
                    <code className="flex-1 font-mono text-sm text-[#171717] break-all">{tempPassword}</code>
                    <button
                      type="button"
                      onClick={copyTempPassword}
                      className="p-2 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-neutral-600" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 bg-[#171717] text-white rounded-xl font-grotesk font-medium hover:bg-neutral-800"
                  >
                    Kapat
                  </button>
                </div>
              ) : step === 1 ? (
                <div className="space-y-6">
                  {templates.length > 0 && (
                    <div>
                      <h3 className="font-grotesk text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                        Şablonlar
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {templates.map((tpl) => (
                          <div
                            key={tpl.id}
                            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-[#fffceb] border border-amber-200"
                          >
                            <button
                              type="button"
                              onClick={() => applyTemplate(tpl)}
                              className="font-grotesk text-xs text-[#171717]"
                            >
                              {tpl.name}
                              <span className="ml-1 text-neutral-400">
                                · {ROLE_BY_KEY[tpl.role]?.label || tpl.role}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeTemplate(tpl.id)}
                              className="p-0.5 hover:bg-amber-100 rounded-full"
                            >
                              <X className="w-3 h-3 text-neutral-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="font-grotesk text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                      İç ekip
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {groups.internal.map((r) => (
                        <RoleCard
                          key={r.role}
                          role={r.role}
                          label={r.label}
                          description={r.description}
                          icon={r.icon}
                          chips={r.chips}
                          accentColor={r.accentColor}
                          selected={selectedRole === r.role}
                          onClick={() => setSelectedRole(r.role)}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-grotesk text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                      Dış paydaş
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {groups.external.map((r) => (
                        <RoleCard
                          key={r.role}
                          role={r.role}
                          label={r.label}
                          description={r.description}
                          icon={r.icon}
                          chips={r.chips}
                          accentColor={r.accentColor}
                          selected={selectedRole === r.role}
                          onClick={() => setSelectedRole(r.role)}
                        />
                      ))}
                    </div>
                  </div>

                  {groups.system.length > 0 && (
                    <div>
                      <h3 className="font-grotesk text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                        Sistem
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {groups.system.map((r) => (
                          <RoleCard
                            key={r.role}
                            role={r.role}
                            label={r.label}
                            description={r.description}
                            icon={r.icon}
                            chips={r.chips}
                            accentColor={r.accentColor}
                            selected={selectedRole === r.role}
                            onClick={() => setSelectedRole(r.role)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {fieldErrors._role && (
                    <p className="text-red-500 text-xs font-grotesk">{fieldErrors._role}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Selected role banner */}
                  {selectedRole && (
                    <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        {React.createElement(ROLE_BY_KEY[selectedRole].icon, {
                          className: 'w-4 h-4 text-neutral-600',
                        })}
                        <span className="font-grotesk text-sm font-medium text-[#171717]">
                          {ROLE_BY_KEY[selectedRole].label}
                        </span>
                      </div>
                      {!lockedRole && (
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="font-grotesk text-xs text-neutral-500 hover:text-[#171717]"
                        >
                          Değiştir
                        </button>
                      )}
                    </div>
                  )}

                  {/* Common fields */}
                  <div>
                    <label className={labelClass}>
                      E-posta <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="kullanici@sirket.com"
                      className={`${inputClass} ${fieldErrors.email ? 'border-red-400' : ''}`}
                    />
                    {fieldErrors.email && (
                      <p className="mt-1 text-[11px] text-red-500 font-grotesk">{fieldErrors.email}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>
                      Ad Soyad <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.displayName}
                      onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                      placeholder="Ahmet Yılmaz"
                      className={`${inputClass} ${fieldErrors.displayName ? 'border-red-400' : ''}`}
                    />
                    {fieldErrors.displayName && (
                      <p className="mt-1 text-[11px] text-red-500 font-grotesk">{fieldErrors.displayName}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Telefon</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+90 ..."
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Başlık / Pozisyon</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="ör. Sr. Video Editor"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Role-specific */}
                  {selectedRole && (
                    <div className="pt-3 border-t border-neutral-100">
                      <h4 className="font-grotesk text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
                        Rol bilgileri
                      </h4>
                      <RoleSpecificFields
                        role={selectedRole}
                        value={form.extraFields}
                        onChange={(extraFields) => setForm({ ...form, extraFields })}
                        tenantUsers={tenantUsers}
                        errors={extraErrors}
                      />
                    </div>
                  )}

                  {/* Permission preview */}
                  {selectedRole && <PermissionPreview role={selectedRole} />}

                  {/* Invite options */}
                  <div className="pt-3 border-t border-neutral-100 space-y-2.5">
                    <h4 className="font-grotesk text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                      Davet seçenekleri
                    </h4>
                    <label className="flex items-center gap-2 font-grotesk text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={!form.useTemporaryPassword}
                        onChange={(e) => setForm({ ...form, useTemporaryPassword: !e.target.checked })}
                        className="rounded border-neutral-300"
                      />
                      Davet e-postası gönder
                    </label>
                    <label className="flex items-center gap-2 font-grotesk text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={form.useTemporaryPassword}
                        onChange={(e) => setForm({ ...form, useTemporaryPassword: e.target.checked })}
                        className="rounded border-neutral-300"
                      />
                      Geçici şifre oluştur (e-posta göndermeden)
                    </label>
                    <label className="flex items-center gap-2 font-grotesk text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={form.forceTwoFactor}
                        onChange={(e) => setForm({ ...form, forceTwoFactor: e.target.checked })}
                        className="rounded border-neutral-300"
                      />
                      Zorla 2FA etkinleştir
                    </label>
                    <div>
                      <label className={labelClass}>Davet geçerlilik süresi</label>
                      <select
                        value={form.expiresInDays}
                        onChange={(e) => setForm({ ...form, expiresInDays: Number(e.target.value) })}
                        className={inputClass}
                      >
                        <option value={7}>7 gün</option>
                        <option value={14}>14 gün</option>
                        <option value={30}>30 gün</option>
                      </select>
                    </div>
                  </div>

                  {/* Save as template */}
                  {selectedRole && !showTemplateSave && (
                    <button
                      type="button"
                      onClick={() => setShowTemplateSave(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-grotesk text-neutral-500 hover:text-[#171717]"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      Bu ayarları şablon olarak kaydet
                    </button>
                  )}
                  {showTemplateSave && (
                    <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded-xl">
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Şablon adı (ör. Video Editörü)"
                        className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm focus:outline-none focus:border-neutral-400 bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleSaveTemplate}
                        className="p-2 bg-[#171717] text-white rounded-lg"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTemplateSave(false);
                          setTemplateName('');
                        }}
                        className="p-2 hover:bg-neutral-100 rounded-lg"
                      >
                        <X className="w-4 h-4 text-neutral-500" />
                      </button>
                    </div>
                  )}

                  {submitError && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="font-grotesk text-xs text-red-700">{submitError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {!tempPassword && (
              <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (step === 1 || lockedRole) onClose();
                    else setStep(1);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 font-grotesk text-sm text-neutral-600 hover:text-[#171717]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {step === 1 || lockedRole ? 'Vazgeç' : 'Geri'}
                </button>
                {step === 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!selectedRole}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Devam
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        {form.useTemporaryPassword ? 'Oluştur' : 'Davet Gönder'}
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InviteUserWizard;
