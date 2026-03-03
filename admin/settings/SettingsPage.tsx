import React from 'react';
import { Settings, User, Bell, Shield, Link, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/shared/hooks/usePermission';

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin } = usePermission();

  const settingsMenus = [
    {
      label: 'Profil',
      description: 'Kisisel bilgilerinizi guncelleyin',
      icon: <User className="w-5 h-5" />,
      href: '/admin/settings/profile',
    },
    {
      label: 'Bildirimler',
      description: 'Bildirim tercihlerinizi yonetin',
      icon: <Bell className="w-5 h-5" />,
      href: '/admin/settings/notifications',
    },
    ...(isAdmin()
      ? [
          {
            label: 'Kullanici Yonetimi',
            description: 'Kullanicilari davet edin ve yonetin',
            icon: <Shield className="w-5 h-5" />,
            href: '/admin/team',
          },
          {
            label: 'Entegrasyonlar',
            description: 'Canva, Google Drive ve diger entegrasyonlar',
            icon: <Link className="w-5 h-5" />,
            href: '/admin/settings/integrations',
          },
        ]
      : []),
    ...(isSuperAdmin()
      ? [
          {
            label: 'Tenant Yonetimi',
            description: 'Organizasyonlari olusturun ve yonetin',
            icon: <Building2 className="w-5 h-5" />,
            href: '/admin/settings/tenants',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
          Ayarlar
        </h1>
        <p className="font-grotesk text-neutral-500 mt-1">
          Hesap ve uygulama ayarlarinizi yonetin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsMenus.map((menu) => (
          <a
            key={menu.label}
            href={menu.href}
            className="bg-white rounded-xl p-6 border border-neutral-100 hover:border-neutral-200 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-[#fffceb] text-[#171717]">{menu.icon}</div>
              <div>
                <h3 className="font-grotesk font-semibold text-[#171717]">{menu.label}</h3>
                <p className="font-grotesk text-sm text-neutral-500 mt-1">
                  {menu.description}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Current User Info */}
      <div className="bg-white rounded-xl p-6 border border-neutral-100">
        <h2 className="font-grotesk text-lg font-bold text-[#171717] mb-4">
          Hesap Bilgileri
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-neutral-100">
            <span className="font-grotesk text-neutral-500">Ad Soyad</span>
            <span className="font-grotesk font-medium text-[#171717]">
              {user?.displayName || '-'}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-neutral-100">
            <span className="font-grotesk text-neutral-500">Email</span>
            <span className="font-grotesk font-medium text-[#171717]">
              {user?.email || '-'}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="font-grotesk text-neutral-500">Rol</span>
            <span className="font-grotesk font-medium text-[#171717] capitalize">
              {user?.role || '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
