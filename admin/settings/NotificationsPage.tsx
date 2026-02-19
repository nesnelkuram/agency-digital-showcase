import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Mail, Smartphone, Clock, ChevronLeft, Check, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationSetting {
  key: 'email' | 'push' | 'approvalReminders';
  label: string;
  description: string;
  icon: React.ReactNode;
}

const settings: NotificationSetting[] = [
  {
    key: 'email',
    label: 'E-posta Bildirimleri',
    description: 'Önemli güncellemeler e-posta olarak gelsin.',
    icon: <Mail className="w-5 h-5 text-blue-500" />,
  },
  {
    key: 'push',
    label: 'Anlık Bildirimler',
    description: 'Tarayıcı veya mobil uygulama bildirimleri.',
    icon: <Smartphone className="w-5 h-5 text-purple-500" />,
  },
  {
    key: 'approvalReminders',
    label: 'Onay Hatırlatıcıları',
    description: 'Bekleyen onaylar için hatırlatıcı al.',
    icon: <Clock className="w-5 h-5 text-amber-500" />,
  },
];

const NotificationsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [prefs, setPrefs] = useState({
    email: user?.settings?.notifications?.email ?? true,
    push: user?.settings?.notifications?.push ?? true,
    approvalReminders: user?.settings?.notifications?.approvalReminders ?? true,
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = async (key: keyof typeof prefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);

    if (!db || !user?.uid) return;

    setSaving(true);
    setSaved(false);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        'settings.notifications.email': updated.email,
        'settings.notifications.push': updated.push,
        'settings.notifications.approvalReminders': updated.approvalReminders,
      });
      await refreshUser?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Error saving notification settings:', err);
      // Revert on error
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <a
          href="/admin/settings"
          className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-neutral-600" />
        </a>
        <div>
          <h1 className="text-2xl font-grotesk font-bold text-[#1a1a2e]">Bildirimler</h1>
          <p className="font-grotesk text-neutral-500 text-sm mt-0.5">
            Hangi bildirimleri almak istediğinizi seçin.
          </p>
        </div>
      </div>

      {/* Settings Card */}
      <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
          <Bell className="w-5 h-5 text-neutral-500" />
          <h2 className="font-grotesk font-semibold text-[#171717]">Bildirim Tercihleri</h2>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-neutral-400 ml-auto" />}
          {saved && !saving && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-grotesk">
              <Check className="w-3.5 h-3.5" />
              Kaydedildi
            </span>
          )}
        </div>

        <div className="divide-y divide-neutral-50">
          {settings.map((setting) => (
            <div key={setting.key} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-neutral-50 flex items-center justify-center">
                  {setting.icon}
                </div>
                <div>
                  <p className="font-grotesk font-medium text-[#171717] text-sm">{setting.label}</p>
                  <p className="font-grotesk text-xs text-neutral-500 mt-0.5">{setting.description}</p>
                </div>
              </div>

              {/* Toggle */}
              <motion.button
                onClick={() => toggle(setting.key)}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                  prefs[setting.key] ? 'bg-[#171717]' : 'bg-neutral-200'
                }`}
                disabled={saving}
              >
                <motion.div
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm"
                  animate={{ x: prefs[setting.key] ? 26 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </motion.button>
            </div>
          ))}
        </div>
      </div>

      <p className="font-grotesk text-xs text-neutral-400 text-center">
        Değişiklikler otomatik olarak kaydedilir.
      </p>
    </div>
  );
};

export default NotificationsPage;
