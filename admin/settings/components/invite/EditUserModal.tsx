import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Loader2, AlertCircle } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { User, InvitationExtraFields, UserRole } from '@/shared/types/user';
import RoleSpecificFields from './RoleSpecificFields';
import PermissionPreview from './PermissionPreview';

interface EditUserModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  tenantUsers: User[];
  onSaved?: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Süper Admin',
  admin: 'Yönetici',
  account_manager: 'Hesap Yöneticisi',
  editor: 'Editör',
  staff: 'Çalışan',
  client: 'Müşteri',
  freelancer: 'Freelancer',
};

const labelClass = 'block font-grotesk text-xs font-medium text-neutral-700 mb-1.5';
const inputClass =
  'w-full px-3 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400 bg-white';

function profileToExtraFields(user: User): InvitationExtraFields {
  const p = user.profile || {};
  return {
    phone: p.phone,
    title: p.title,
    department: p.department,
    skills: (p as any).skills,
    hourlyRate: (p as any).hourlyRate,
    hourlyCurrency: (p as any).hourlyCurrency,
    clientCompany: (p as any).clientCompany,
    billingEmail: (p as any).billingEmail,
    assignedProjectIds: (p as any).assignedProjectIds,
    managerId: (p as any).managerId,
  };
}

const EditUserModal: React.FC<EditUserModalProps> = ({
  open,
  onClose,
  user,
  tenantUsers,
  onSaved,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [extras, setExtras] = useState<InvitationExtraFields>({});
  const [initialProjectIds, setInitialProjectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      setDisplayName(user.displayName || '');
      const ex = profileToExtraFields(user);
      setExtras(ex);
      setInitialProjectIds(ex.assignedProjectIds || []);
      setError(null);
    }
  }, [open, user]);

  if (!user) return null;

  const handleSave = async () => {
    if (!db) return;
    if (!displayName.trim()) {
      setError('Ad soyad gerekli');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // users/{uid} profile + displayName güncelle
      const cleanProfile: Record<string, any> = {};
      if (extras.phone) cleanProfile.phone = extras.phone;
      if (extras.title) cleanProfile.title = extras.title;
      if (extras.department) cleanProfile.department = extras.department;
      if (extras.skills?.length) cleanProfile.skills = extras.skills;
      if (typeof extras.hourlyRate === 'number') cleanProfile.hourlyRate = extras.hourlyRate;
      if (extras.hourlyCurrency) cleanProfile.hourlyCurrency = extras.hourlyCurrency;
      if (extras.clientCompany) cleanProfile.clientCompany = extras.clientCompany;
      if (extras.billingEmail) cleanProfile.billingEmail = extras.billingEmail;
      if (extras.managerId) cleanProfile.managerId = extras.managerId;
      if (extras.assignedProjectIds) cleanProfile.assignedProjectIds = extras.assignedProjectIds;

      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
        profile: cleanProfile,
        'metadata.updatedAt': serverTimestamp(),
      });

      // Projeler değiştiyse projects/{id}.teamMembers senkronize et
      const currentIds = extras.assignedProjectIds || [];
      const addedIds = currentIds.filter((id) => !initialProjectIds.includes(id));
      const removedIds = initialProjectIds.filter((id) => !currentIds.includes(id));

      if (addedIds.length > 0 || removedIds.length > 0) {
        const batch = writeBatch(db);
        const member = {
          uid: user.uid,
          name: displayName.trim(),
          role: user.role,
        };
        for (const pid of addedIds) {
          batch.update(doc(db, 'projects', pid), {
            teamMembers: arrayUnion(member),
            updatedAt: serverTimestamp(),
          });
        }
        for (const pid of removedIds) {
          // arrayRemove tam eşleşme ister — hem eski hem yeni varyantı temizle
          batch.update(doc(db, 'projects', pid), {
            teamMembers: arrayRemove(member),
            updatedAt: serverTimestamp(),
          });
        }
        try {
          await batch.commit();
        } catch (e) {
          console.warn('[EditUserModal] project team sync partial failure', e);
        }
      }

      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error('[EditUserModal] Save failed', err);
      setError(err?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && user && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex"
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => !saving && onClose()} />
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
                <h2 className="font-grotesk text-xl font-bold text-[#171717]">
                  Kullanıcıyı Düzenle
                </h2>
                <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                  {user.email} · {ROLE_LABELS[user.role] || user.role}
                </p>
              </div>
              <button
                onClick={() => !saving && onClose()}
                className="p-2 hover:bg-neutral-100 rounded-lg"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Basic info */}
              <div>
                <label className={labelClass}>Ad Soyad</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Telefon</label>
                  <input
                    type="tel"
                    value={extras.phone || ''}
                    onChange={(e) => setExtras({ ...extras, phone: e.target.value })}
                    placeholder="+90 ..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Başlık / Pozisyon</label>
                  <input
                    type="text"
                    value={extras.title || ''}
                    onChange={(e) => setExtras({ ...extras, title: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Role-specific fields */}
              <div className="pt-3 border-t border-neutral-100">
                <h4 className="font-grotesk text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
                  Rol bilgileri
                </h4>
                <RoleSpecificFields
                  role={user.role}
                  value={extras}
                  onChange={setExtras}
                  tenantUsers={tenantUsers}
                />
              </div>

              {/* Permission preview */}
              <PermissionPreview role={user.role} />

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="font-grotesk text-xs text-red-700">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => !saving && onClose()}
                className="px-4 py-2.5 font-grotesk text-sm text-neutral-600 hover:text-[#171717]"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Kaydediliyor...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Kaydet
                  </>
                )}
              </button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EditUserModal;
