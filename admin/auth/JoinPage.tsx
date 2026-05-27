import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, User, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import {
  getDoc,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  writeBatch,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { ROLES } from '@/lib/rbac/roles';

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Yönetici',
  account_manager: 'Müşteri İlişkileri Yöneticisi',
  editor: 'Editör',
  staff: 'Personel',
  client: 'Müşteri',
  freelancer: 'Freelancer',
};

const JoinPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [step, setStep] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [invitation, setInvitation] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMessage('Geçersiz davet linki. Lütfen size gönderilen emaildeki linki kullanın.');
      setStep('error');
      return;
    }
    validateToken(token);
  }, [token]);

  const validateToken = async (invitationId: string) => {
    if (!db) {
      setErrorMessage('Bağlantı hatası. Lütfen tekrar deneyin.');
      setStep('error');
      return;
    }

    try {
      const invitationDoc = await getDoc(doc(db, 'invitations', invitationId));

      if (!invitationDoc.exists()) {
        setErrorMessage('Davet bulunamadı. Link geçersiz veya süresi dolmuş olabilir.');
        setStep('error');
        return;
      }

      const data = invitationDoc.data();

      if (data.status === 'accepted') {
        setErrorMessage('Bu davet zaten kabul edilmiş. Giriş yapabilirsiniz.');
        setStep('error');
        return;
      }

      if (data.status === 'cancelled') {
        setErrorMessage('Bu davet iptal edilmiş. Lütfen yöneticinizle iletişime geçin.');
        setStep('error');
        return;
      }

      const expiresAt = data.expiresAt?.toDate?.();
      if (expiresAt && expiresAt < new Date()) {
        setErrorMessage('Bu davetin süresi dolmuş. Lütfen yöneticinizden yeni davet göndermesini isteyin.');
        setStep('error');
        return;
      }

      setInvitation({ id: invitationId, ...data });
      setDisplayName(data.displayName || '');
      setStep('form');
    } catch (err) {
      console.error('[JoinPage] Error validating token:', err);
      setErrorMessage('Davet doğrulanırken bir hata oluştu. Lütfen tekrar deneyin.');
      setStep('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!displayName.trim()) {
      setFormError('Ad Soyad zorunludur.');
      return;
    }
    if (password.length < 8) {
      setFormError('Şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (password !== passwordConfirm) {
      setFormError('Şifreler eşleşmiyor.');
      return;
    }

    if (!auth || !db || !invitation) return;

    setIsSubmitting(true);

    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        invitation.email,
        password
      );
      const { user: firebaseUser } = userCredential;

      // 2. Update Firebase Auth display name
      await updateProfile(firebaseUser, { displayName: displayName.trim() });

      // 3. Get role permissions
      const roleConfig = ROLES[invitation.role];
      const permissions = roleConfig?.permissions || [];

      // 4. Build profile from invitation extraFields
      const extras = invitation.extraFields || {};
      const profile: Record<string, any> = {};
      if (extras.phone) profile.phone = extras.phone;
      if (extras.title) profile.title = extras.title;
      if (extras.department) profile.department = extras.department;
      if (extras.skills && Array.isArray(extras.skills) && extras.skills.length > 0)
        profile.skills = extras.skills;
      if (typeof extras.hourlyRate === 'number') profile.hourlyRate = extras.hourlyRate;
      if (extras.hourlyCurrency) profile.hourlyCurrency = extras.hourlyCurrency;
      if (extras.clientCompany) profile.clientCompany = extras.clientCompany;
      if (extras.billingEmail) profile.billingEmail = extras.billingEmail;
      if (extras.managerId) profile.managerId = extras.managerId;
      if (
        extras.assignedProjectIds &&
        Array.isArray(extras.assignedProjectIds) &&
        extras.assignedProjectIds.length > 0
      ) {
        profile.assignedProjectIds = extras.assignedProjectIds;
      }

      // 5. Create Firestore user document
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        email: invitation.email,
        displayName: displayName.trim(),
        role: invitation.role,
        tenantId: invitation.tenantId,
        permissions,
        status: 'active',
        metadata: {
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          invitedBy: invitation.invitedBy,
        },
        profile,
        settings: {
          notifications: { email: true, push: true, approvalReminders: true },
        },
      });

      // 6. Mark invitation as accepted
      await updateDoc(doc(db, 'invitations', invitation.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        acceptedByUid: firebaseUser.uid,
      });

      // 7. assignedProjectIds varsa projelere teamMember ekle
      if (profile.assignedProjectIds && profile.assignedProjectIds.length > 0) {
        try {
          const batch = writeBatch(db);
          const member = {
            uid: firebaseUser.uid,
            name: displayName.trim(),
            role: invitation.role,
          };
          for (const projectId of profile.assignedProjectIds as string[]) {
            batch.update(doc(db, 'projects', projectId), {
              teamMembers: arrayUnion(member),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        } catch (projErr) {
          console.warn('[JoinPage] Failed to attach user to projects:', projErr);
        }
      }

      setStep('success');

      // Rol'e göre yönlendir: client → /portal, diğerleri → /admin
      const redirectTo = invitation.role === 'client' ? '/portal' : '/admin';
      setTimeout(() => {
        navigate(redirectTo);
      }, 2000);
    } catch (err: any) {
      console.error('[JoinPage] Error creating account:', err);
      if (err.code === 'auth/email-already-in-use') {
        setFormError('Bu email adresi zaten kayıtlı. Giriş yapmayı deneyin.');
      } else if (err.code === 'auth/weak-password') {
        setFormError('Şifre çok zayıf. En az 8 karakter kullanın.');
      } else {
        setFormError('Hesap oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-grotesk text-3xl font-bold text-[#171717] tracking-tight">
            intiba.
          </h1>
          <p className="font-grotesk text-sm text-neutral-500 mt-1">Dijital Ajans Platformu</p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          {/* Loading */}
          {step === 'loading' && (
            <div className="p-10 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
              <p className="font-grotesk text-sm text-neutral-500">Davet doğrulanıyor...</p>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="p-8">
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100 mb-6">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="font-grotesk text-sm text-red-700">{errorMessage}</p>
              </div>
              <button
                onClick={() => navigate('/admin/login')}
                className="w-full py-2.5 border border-neutral-200 text-neutral-700 rounded-xl font-grotesk text-sm hover:bg-neutral-50 transition-colors"
              >
                Giriş sayfasına git
              </button>
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="p-8 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <h2 className="font-grotesk text-lg font-bold text-[#171717]">
                  Hesabınız oluşturuldu!
                </h2>
                <p className="font-grotesk text-sm text-neutral-500 mt-1">
                  Platforma yönlendiriliyorsunuz...
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          {step === 'form' && invitation && (
            <div>
              {/* Invitation Info */}
              <div className="bg-[#171717] p-6">
                <p className="font-grotesk text-xs text-neutral-400 uppercase tracking-wider mb-1">
                  Davet
                </p>
                <p className="font-grotesk text-white font-semibold">
                  {invitation.invitedByName || 'intiba ekibi'} sizi davet etti
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-full">
                  <span className="font-grotesk text-xs text-neutral-300">
                    Rol: {ROLE_DISPLAY_NAMES[invitation.role] || invitation.role}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block font-grotesk text-xs font-medium text-neutral-700 mb-1.5">
                    E-posta
                  </label>
                  <div className="w-full px-3 py-2.5 bg-neutral-100 rounded-xl font-grotesk text-sm text-neutral-500 cursor-not-allowed">
                    {invitation.email}
                  </div>
                </div>

                <div>
                  <label className="block font-grotesk text-xs font-medium text-neutral-700 mb-1.5">
                    Ad Soyad
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Adınız Soyadınız"
                      className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400 bg-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-grotesk text-xs font-medium text-neutral-700 mb-1.5">
                    Şifre
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="En az 8 karakter"
                      className="w-full pl-10 pr-10 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400 bg-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-grotesk text-xs font-medium text-neutral-700 mb-1.5">
                    Şifre Tekrar
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="Şifreyi tekrar girin"
                      className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400 bg-white"
                      required
                    />
                  </div>
                </div>

                {formError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="font-grotesk text-xs text-red-700">{formError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-[#171717] text-white rounded-xl font-grotesk text-sm font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Hesap oluşturuluyor...
                    </>
                  ) : (
                    'Hesabı Oluştur ve Katıl'
                  )}
                </button>

                <p className="font-grotesk text-xs text-center text-neutral-400">
                  Zaten hesabınız var mı?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/admin/login')}
                    className="text-neutral-700 hover:underline"
                  >
                    Giriş yap
                  </button>
                </p>
              </form>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default JoinPage;
