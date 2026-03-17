import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { getAuth } from 'firebase/auth';

interface Integration {
  id: string;
  name: string;
  description: string;
  logo: string;
  status: 'connected' | 'coming_soon' | 'available';
  connectLabel?: string;
  dynamicStatus?: boolean;
}

const integrations: Integration[] = [
  {
    id: 'canva',
    name: 'Canva',
    description: 'Canva tasarımlarını doğrudan içerik planlarına ekleyin.',
    logo: '🎨',
    status: 'coming_soon',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Drive dosyalarına doğrudan erişin ve projelere yükleyin.',
    logo: '📁',
    status: 'available',
    dynamicStatus: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Slack kanallarına bildirim gönderin.',
    logo: '💬',
    status: 'coming_soon',
  },
  {
    id: 'meta',
    name: 'Meta Business',
    description: 'Facebook ve Instagram reklam hesaplarını bağlayın.',
    logo: '📱',
    status: 'coming_soon',
  },
  {
    id: 'google-ads',
    name: 'Google Ads',
    description: 'Google Ads kampanya verilerini senkronize edin.',
    logo: '🔍',
    status: 'coming_soon',
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Müşteri davet e-postaları için kullanılıyor.',
    logo: '✉️',
    status: 'connected',
  },
];

const statusBadge = {
  connected: (
    <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-grotesk text-xs font-medium">
      <CheckCircle className="w-3 h-3" />
      Bağlı
    </span>
  ),
  coming_soon: (
    <span className="flex items-center gap-1 px-2.5 py-1 bg-neutral-100 text-neutral-500 rounded-full font-grotesk text-xs font-medium">
      <Clock className="w-3 h-3" />
      Yakında
    </span>
  ),
  available: (
    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full font-grotesk text-xs font-medium">
      Bağlan
    </span>
  ),
};

const IntegrationsPage: React.FC = () => {
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkDriveStatus = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const resp = await fetch('/api/drive/connection-status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          setDriveConnected(data.connected);
          setDriveEmail(data.email || null);
        }
      } catch { /* ignore */ }
    };
    checkDriveStatus();
  }, []);

  const getIntegrationStatus = (integration: Integration) => {
    if (integration.id === 'google-drive' && integration.dynamicStatus) {
      return driveConnected ? 'connected' : 'available';
    }
    return integration.status;
  };

  const handleConnect = (integration: Integration) => {
    if (integration.id === 'google-drive') {
      const state = JSON.stringify({
        platform: 'google_drive',
        redirectPath: '/admin/settings/integrations',
      });
      window.location.href = `/api/marketing/platforms/connect?platform=google_drive&state=${encodeURIComponent(state)}`;
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <a
          href="/admin/settings"
          className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-neutral-600" />
        </a>
        <div>
          <h1 className="text-2xl font-grotesk font-bold text-[#1a1a2e]">Entegrasyonlar</h1>
          <p className="font-grotesk text-neutral-500 text-sm mt-0.5">
            Harici araçları bağlayarak iş akışınızı geliştirin.
          </p>
        </div>
      </div>

      {/* Integration cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {integrations.map((integration, i) => (
          <motion.div
            key={integration.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className="bg-white rounded-xl border border-neutral-100 p-4 hover:border-neutral-200 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center text-xl flex-shrink-0">
                  {integration.logo}
                </div>
                <div>
                  <p className="font-grotesk font-semibold text-[#171717] text-sm">{integration.name}</p>
                  <p className="font-grotesk text-xs text-neutral-500 mt-0.5 leading-relaxed">
                    {integration.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-50">
              {statusBadge[getIntegrationStatus(integration)]}
              {getIntegrationStatus(integration) === 'connected' && (
                <div className="flex items-center gap-2">
                  {integration.id === 'google-drive' && driveEmail && (
                    <span className="font-grotesk text-xs text-neutral-400">{driveEmail}</span>
                  )}
                  <button className="flex items-center gap-1 font-grotesk text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
                    Yönet
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
              {getIntegrationStatus(integration) === 'available' && (
                <button
                  onClick={() => handleConnect(integration)}
                  className="px-3 py-1 bg-blue-600 text-white rounded-full font-grotesk text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  Bağla
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
        <p className="font-grotesk text-sm text-neutral-600 font-medium">
          Entegrasyon öneriniz mi var?
        </p>
        <p className="font-grotesk text-xs text-neutral-400 mt-1">
          Hangi araçların entegre edilmesini istediğinizi bildirin — en çok talep edilen entegrasyonlar öncelikli olarak eklenecektir.
        </p>
      </div>
    </div>
  );
};

export default IntegrationsPage;
