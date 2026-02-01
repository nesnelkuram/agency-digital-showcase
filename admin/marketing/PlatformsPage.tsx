import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Zap, Check, AlertCircle, RefreshCw, Loader2, X, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlatformAccount, AdPlatform } from '@/shared/types/marketing';
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/shared/types/marketing';
import {
  getPlatformAccounts,
  savePlatformAccount,
  disconnectPlatformAccount,
  syncCampaignsFromMeta,
} from '@/shared/services/marketingService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';

// ── Types ──

interface AdAccountOption {
  id: string;
  name: string;
  status: number; // 1=Active, 2=Disabled, 3=Unsettled
}

interface AccountPickerData {
  platform: AdPlatform;
  accessToken: string;
  tokenExpiresAt: number;
  userName: string;
  userId: string;
  permissions: string[];
  projectId?: string;
  accounts: AdAccountOption[];
}

const AD_ACCOUNT_STATUS: Record<number, { label: string; color: string }> = {
  1: { label: 'Aktif', color: 'text-green-600 bg-green-50' },
  2: { label: 'Deaktif', color: 'text-neutral-500 bg-neutral-100' },
  3: { label: 'Askida', color: 'text-amber-600 bg-amber-50' },
};

// ── Platform Configs ──

const ALL_PLATFORMS: { platform: AdPlatform; description: string; setupSteps: string[] }[] = [
  {
    platform: 'meta',
    description: 'Facebook ve Instagram reklamlarini yonetin',
    setupSteps: [
      'developers.facebook.com adresinde Business tipinde uygulama olusturun',
      'Marketing API urununu ekleyin',
      'ads_management, ads_read izinleri icin App Review tamamlayin',
      'Business Manager ve Ad Account ID bilgilerini hazirlayin',
    ],
  },
  {
    platform: 'google',
    description: 'Google Search, Display ve YouTube reklamlari',
    setupSteps: [
      'Google Ads Developer Token alin',
      'Google Cloud Console projesi olusturun',
      'OAuth 2.0 credentials olusturun',
      'MCC (Manager) hesabi baglayin',
    ],
  },
  {
    platform: 'tiktok',
    description: 'TikTok In-Feed, TopView ve Spark reklamlari',
    setupSteps: [
      'TikTok for Business hesabi olusturun',
      'Marketing API uygulamasi kaydedin',
      'Uygulama incelemesini tamamlayin',
      'Pixel entegrasyonunu yapin',
    ],
  },
  {
    platform: 'linkedin',
    description: 'LinkedIn Sponsored Content ve Lead Gen reklamlari',
    setupSteps: [
      'LinkedIn Marketing Developer Platform erisimi alin',
      'OAuth uygulamasi olusturun',
      'rw_ads permission alin',
      'Campaign Manager hesabini baglayin',
    ],
  },
  {
    platform: 'email',
    description: 'Email kampanyalari ve otomasyonlari (Resend)',
    setupSteps: [
      'Resend hesabi olusturun',
      'API key olusturun',
      'Domain dogrulamasi yapin',
      'Gonderici adresini ayarlayin',
    ],
  },
];

// ── Component ──

const PlatformsPage: React.FC = () => {
  const { projectId, basePath, isProjectScoped } = useProjectScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Account picker state
  const [pickerData, setPickerData] = useState<AccountPickerData | null>(null);
  const [pickerSaving, setPickerSaving] = useState(false);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPlatformAccounts(projectId);
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load platform accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Load accounts on mount and when projectId changes
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Handle OAuth callback redirect — save connected account (single account)
  useEffect(() => {
    const connectedParam = searchParams.get('connected');
    if (!connectedParam) return;

    (async () => {
      try {
        const accountData = JSON.parse(decodeURIComponent(connectedParam));
        const resolvedProjectId = accountData.projectId || projectId;
        await savePlatformAccount({
          ...accountData,
          ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
        });
        await fetchAccounts();
        // Trigger campaign sync in background
        if (resolvedProjectId) {
          setSyncStatus('Kampanyalar senkronize ediliyor...');
          syncCampaignsFromMeta(resolvedProjectId, accountData.platform || 'meta')
            .then((result) => {
              setSyncStatus(result.error || `${result.synced} kampanya senkronize edildi`);
              setTimeout(() => setSyncStatus(null), 5000);
            })
            .catch(() => setSyncStatus(null));
        }
      } catch (err) {
        console.error('Failed to save connected account:', err);
      } finally {
        searchParams.delete('connected');
        searchParams.delete('error');
        setSearchParams(searchParams, { replace: true });
      }
    })();
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle account picker redirect (multiple accounts)
  useEffect(() => {
    const selectParam = searchParams.get('selectAccount');
    if (!selectParam) return;

    try {
      const data: AccountPickerData = JSON.parse(decodeURIComponent(selectParam));
      setPickerData(data);
    } catch (err) {
      console.error('Failed to parse account picker data:', err);
    }

    // Clear param immediately
    searchParams.delete('selectAccount');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const getAccountForPlatform = (platform: AdPlatform) =>
    accounts.find(a => a.platform === platform && a.status === 'connected');

  const handleConnect = (platform: AdPlatform) => {
    const currentPath = isProjectScoped
      ? `/admin/projects/${projectId}/marketing/platforms`
      : '/admin/marketing/platforms';

    const state = JSON.stringify({
      platform,
      redirectPath: currentPath,
      ...(projectId ? { projectId } : {}),
    });

    window.location.href = `/api/marketing/platforms/connect?platform=${platform}&state=${encodeURIComponent(state)}`;
  };

  const handleDisconnect = async (account: PlatformAccount) => {
    setActionLoading(account.id);
    try {
      await disconnectPlatformAccount(account.id);
      setAccounts(prev =>
        prev.map(a => a.id === account.id ? { ...a, status: 'disconnected' as const } : a)
      );
    } catch (err) {
      console.error('Failed to disconnect:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefresh = async () => {
    await fetchAccounts();
  };

  const handlePickAccount = async (account: AdAccountOption) => {
    if (!pickerData || account.status !== 1) return;

    const resolvedProjectId = pickerData.projectId || projectId;
    setPickerSaving(true);
    try {
      await savePlatformAccount({
        platform: pickerData.platform,
        accountId: account.id,
        accountName: account.name,
        status: 'connected',
        permissions: pickerData.permissions || ['ads_management', 'ads_read', 'business_management'],
        metadata: {
          accessToken: pickerData.accessToken,
          adAccountId: account.id,
          userId: pickerData.userId,
          userName: pickerData.userName,
        },
        ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
      });
      setPickerData(null);
      await fetchAccounts();
      // Trigger campaign sync in background
      if (resolvedProjectId) {
        setSyncStatus('Kampanyalar senkronize ediliyor...');
        syncCampaignsFromMeta(resolvedProjectId, pickerData.platform)
          .then((result) => {
            setSyncStatus(result.error || `${result.synced} kampanya senkronize edildi`);
            setTimeout(() => setSyncStatus(null), 5000);
          })
          .catch(() => setSyncStatus(null));
      }
    } catch (err) {
      console.error('Failed to save selected account:', err);
    } finally {
      setPickerSaving(false);
    }
  };

  const errorParam = searchParams.get('error');

  return (
    <div className="space-y-6">
      {isProjectScoped && projectId && <ProjectBreadcrumb projectId={projectId} currentPage="Platform Baglantilari" />}
      <div>
        <h1 className="text-2xl font-commons font-bold text-[#171717]">Platform Baglantilari</h1>
        <p className="text-sm font-commons text-neutral-500 mt-1">
          {isProjectScoped
            ? 'Bu projenin reklam platform baglantilarini yonetin'
            : 'Reklam platformlarini baglayin ve yonetin'}
        </p>
      </div>

      {errorParam && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm font-commons text-red-700">{decodeURIComponent(errorParam)}</p>
          <button
            onClick={() => { searchParams.delete('error'); setSearchParams(searchParams, { replace: true }); }}
            className="ml-auto text-xs font-commons text-red-500 hover:text-red-700"
          >
            Kapat
          </button>
        </div>
      )}

      {syncStatus && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-500 flex-shrink-0 animate-spin" />
          <p className="text-sm font-commons text-blue-700">{syncStatus}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ALL_PLATFORMS.map(({ platform, description, setupSteps }) => {
            const account = getAccountForPlatform(platform);
            const isConnected = !!account;
            const isDisconnecting = account && actionLoading === account.id;

            return (
              <div
                key={platform}
                className={`bg-white rounded-xl border p-6 ${
                  isConnected ? 'border-green-200' : 'border-neutral-200/50'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-commons font-medium ${PLATFORM_COLORS[platform]}`}>
                        {PLATFORM_LABELS[platform]}
                      </span>
                      {isConnected ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <Check className="w-3 h-3" /> Bagli
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
                          <AlertCircle className="w-3 h-3" /> Bagli degil
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-commons text-neutral-500">{description}</p>
                  </div>
                </div>

                {isConnected ? (
                  <div className="space-y-3">
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-sm font-commons text-green-700">
                        {account.accountName}
                      </p>
                      <p className="text-xs font-commons text-green-600 mt-1">
                        ID: {account.accountId}
                      </p>
                      {account.lastSyncAt && (
                        <p className="text-xs font-commons text-green-500 mt-1">
                          Son senkronizasyon: {account.lastSyncAt.toDate().toLocaleDateString('tr-TR')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleRefresh}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors font-commons text-xs"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Yenile
                      </button>
                      <button
                        onClick={() => handleDisconnect(account)}
                        disabled={!!isDisconnecting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-commons text-xs disabled:opacity-50"
                      >
                        {isDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Baglantiayi Kes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-neutral-50 rounded-lg p-3">
                      <p className="text-xs font-commons font-medium text-neutral-600 mb-2">Kurulum adimlari:</p>
                      <ol className="space-y-1">
                        {setupSteps.map((step, i) => (
                          <li key={i} className="text-xs font-commons text-neutral-500 flex gap-2">
                            <span className="text-neutral-400 flex-shrink-0">{i + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                    <button
                      onClick={() => handleConnect(platform)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#171717] text-white hover:bg-[#2a2a2a] transition-colors font-commons text-sm"
                    >
                      <Zap className="w-4 h-4" />
                      Bagla
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Account Picker Modal ── */}
      <AnimatePresence>
        {pickerData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setPickerData(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                <div>
                  <h2 className="font-ramillas text-lg font-bold text-[#171717]">
                    Reklam Hesabi Secin
                  </h2>
                  <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                    {pickerData.userName} &mdash; {pickerData.accounts.length} hesap bulundu
                  </p>
                </div>
                <button
                  onClick={() => setPickerData(null)}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-4 h-4 text-neutral-500" />
                </button>
              </div>

              {/* Account List */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                {pickerData.accounts.map((acc) => {
                  const statusInfo = AD_ACCOUNT_STATUS[acc.status] || AD_ACCOUNT_STATUS[2];
                  const isActive = acc.status === 1;

                  return (
                    <button
                      key={acc.id}
                      onClick={() => handlePickAccount(acc)}
                      disabled={!isActive || pickerSaving}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        isActive
                          ? 'border-neutral-200 hover:border-[#171717] hover:shadow-sm cursor-pointer'
                          : 'border-neutral-100 opacity-50 cursor-not-allowed'
                      } ${pickerSaving ? 'pointer-events-none' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-grotesk text-sm font-medium text-[#171717] truncate">
                              {acc.name}
                            </p>
                            <span className={`text-[10px] font-grotesk font-medium px-1.5 py-0.5 rounded-full ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <p className="font-grotesk text-xs text-neutral-400 mt-0.5">
                            {acc.id}
                          </p>
                        </div>
                        {pickerSaving && isActive && (
                          <Loader2 className="w-4 h-4 text-neutral-400 animate-spin flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-neutral-100 bg-neutral-50 rounded-b-2xl">
                <p className="font-grotesk text-[11px] text-neutral-400 text-center">
                  Sadece aktif reklam hesaplari secilebilir
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PlatformsPage;
