import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Phone, Briefcase, Save, Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Yönetici',
  account_manager: 'Müşteri İlişkileri Yöneticisi',
  editor: 'Editör',
  staff: 'Personel',
  client: 'Müşteri',
  freelancer: 'Freelancer',
};

const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState(user?.profile?.phone || '');
  const [title, setTitle] = useState(user?.profile?.title || '');
  const [department, setDepartment] = useState(user?.profile?.department || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !auth?.currentUser || !user) return;

    setProfileError('');
    setProfileSuccess(false);
    setIsSavingProfile(true);

    try {
      // Update Firebase Auth display name
      await updateProfile(auth.currentUser, { displayName: displayName.trim() });

      // Update Firestore user document
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
        'profile.phone': phone.trim(),
        'profile.title': title.trim(),
        'profile.department': department.trim(),
        'metadata.updatedAt': serverTimestamp(),
      });

      await refreshUser();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      console.error('[ProfilePage] Save error:', err);
      setProfileError('Profil güncellenirken bir hata oluştu.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.currentUser || !user) return;

    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError('Yeni şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError('Yeni şifreler eşleşmiyor.');
      return;
    }
    if (!currentPassword) {
      setPasswordError('Mevcut şifrenizi girmeniz gerekiyor.');
      return;
    }

    setIsSavingPassword(true);

    try {
      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Update password
      await updatePassword(auth.currentUser, newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPasswordError('Mevcut şifre yanlış.');
      } else {
        setPasswordError('Şifre güncellenirken bir hata oluştu.');
      }
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-grotesk font-bold text-[#171717]">Profilim</h1>
        <p className="font-grotesk text-sm text-neutral-500 mt-1">
          Kişisel bilgilerinizi güncelleyin
        </p>
      </div>

      {/* Profile Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-neutral-200 overflow-hidden"
      >
        {/* Avatar Section */}
        <div className="flex items-center gap-4 p-6 border-b border-neutral-100">
          <div className="w-16 h-16 rounded-full bg-[#171717] flex items-center justify-center flex-shrink-0">
            <span className="font-grotesk text-xl font-bold text-white">
              {user.displayName?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-grotesk font-semibold text-[#171717]">{user.displayName || user.email}</p>
            <p className="font-grotesk text-sm text-neutral-500">{user.email}</p>
            <span className="inline-flex items-center mt-1 px-2.5 py-0.5 bg-neutral-100 rounded-full font-grotesk text-xs text-neutral-600">
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                  placeholder="Adınız Soyadınız"
                />
              </div>
            </div>

            <div>
              <label className="block font-grotesk text-xs font-medium text-neutral-700 mb-1.5">
                E-posta
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-100 rounded-xl font-grotesk text-sm bg-neutral-50 text-neutral-400 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block font-grotesk text-xs font-medium text-neutral-700 mb-1.5">
                Telefon
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                  placeholder="+90 5xx xxx xx xx"
                />
              </div>
            </div>

            <div>
              <label className="block font-grotesk text-xs font-medium text-neutral-700 mb-1.5">
                Unvan
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                  placeholder="Kreatif Direktör"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block font-grotesk text-xs font-medium text-neutral-700 mb-1.5">
                Departman
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                placeholder="Kreatif Ekip"
              />
            </div>
          </div>

          {profileError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="font-grotesk text-xs text-red-700">{profileError}</p>
            </div>
          )}

          {profileSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-100">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <p className="font-grotesk text-xs text-green-700">Profil başarıyla güncellendi.</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-white rounded-xl font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {isSavingProfile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Kaydet
            </button>
          </div>
        </form>
      </motion.div>

      {/* Change Password Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-neutral-200 overflow-hidden"
      >
        <div className="p-6 border-b border-neutral-100">
          <h2 className="font-grotesk text-base font-semibold text-[#171717] flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Şifre Değiştir
          </h2>
        </div>

        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
          <div>
            <label className="block font-grotesk text-xs font-medium text-neutral-700 mb-1.5">
              Mevcut Şifre
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                placeholder="Mevcut şifreniz"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-grotesk text-xs font-medium text-neutral-700 mb-1.5">
                Yeni Şifre
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                  placeholder="En az 8 karakter"
                />
              </div>
            </div>
            <div>
              <label className="block font-grotesk text-xs font-medium text-neutral-700 mb-1.5">
                Yeni Şifre Tekrar
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                  placeholder="Tekrar girin"
                />
              </div>
            </div>
          </div>

          {passwordError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="font-grotesk text-xs text-red-700">{passwordError}</p>
            </div>
          )}

          {passwordSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-100">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <p className="font-grotesk text-xs text-green-700">Şifre başarıyla güncellendi.</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingPassword}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-white rounded-xl font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {isSavingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Şifreyi Güncelle
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ProfilePage;
