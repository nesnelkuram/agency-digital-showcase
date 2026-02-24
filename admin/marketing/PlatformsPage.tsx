import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Zap, Check, AlertCircle, RefreshCw, Loader2, X, Building2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlatformAccount, AdPlatform } from '@/shared/types/marketing';
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/shared/types/marketing';
import {
  getPlatformAccounts,
  savePlatformAccount,
  disconnectPlatformAccount,
  deepSyncFromMeta,
  syncCampaignsForAccount,
} from '@/shared/services/marketingService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import { useTenantId } from '@/shared/hooks/useTenant';
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
  const tenantId = useTenantId();
  const { projectId, basePath, isProjectScoped } = useProjectScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Account picker state
  const [pickerData, setPickerData] = useState<AccountPickerData | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pickerSaving, setPickerSaving] = useState(false);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPlatformAccounts(tenantId, projectId);
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load platform accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, projectId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Handle OAuth callback redirect — single account auto-saved
  useEffect(() => {
    const connectedParam = searchParams.get('connected');
    if (!connectedParam) return;

    (async () => {
      try {
        const accountData = JSON.parse(decodeURIComponent(connectedParam));
        const resolvedProjectId = accountData.projectId || projectId;
        await savePlatformAccount(tenantId, {
          ...accountData,
          ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
        });
        await fetchAccounts();
        setSyncStatus('Kampanyalar senkronize ediliyor (detayli)...');
        deepSyncFromMeta(tenantId, resolvedProjectId || undefined, accountData.platform || 'meta')
          .then((result) => {
            setSyncStatus(result.error || `${result.synced} kampanya senkronize edildi (adSets + ads dahil)`);
            setTimeout(() => setSyncStatus(null), 5000);
          })
          .catch(() => setSyncStatus(null));
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
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to parse account picker data:', err);
    }

    searchParams.delete('selectAccount');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Returns all connected accounts for a platform
  const getAccountsForPlatform = (platform: AdPlatform) =>
    accounts.filter(a => a.platform === platform && a.status === 'connected');

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
      await disconnectPlatformAccount(tenantId, account.id);
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

  const toggleAccount = (id: string, isActive: boolean) => {
    if (!isActive) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!pickerData) return;
    const activeIds = pickerData.accounts.filter(a => a.status === 1).map(a => a.id);
    if (selectedIds.size === activeIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeIds));
    }
  };

  const handleSaveSelected = async () => {
    if (!pickerData || selectedIds.size === 0) return;

    const resolvedProjectId = pickerData.projectId || projectId;
    setPickerSaving(true);
    try {
      const selectedAccounts = pickerData.accounts.filter(a => selectedIds.has(a.id));

      // Save all selected accounts in parallel, collect their Firestore IDs
      const savedAccountIds = await Promise.all(
        selectedAccounts.map(acc =>
          savePlatformAccount(tenantId, {
            platform: pickerData.platform,
            accountId: acc.id,
            accountName: acc.name,
            status: 'connected',
            permissions: pickerData.permissions || ['ads_management', 'ads_read', 'business_management'],
            metadata: {
              accessToken: pickerData.accessToken,
              adAccountId: acc.id,
              userId: pickerData.userId,
              userName: pickerData.userName,
              ...((pickerData as any).pageId ? { pageId: (pickerData as any).pageId, pageName: (pickerData as any).pageName } : {}),
            },
            ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
          })
        )
      );

      setPickerData(null);
      setSelectedIds(new Set());
      await fetchAccounts();

      // Sync each saved account individually with deepSync
      setSyncStatus('Kampanyalar senkronize ediliyor (detayli)...');
      Promise.all(
        savedAccountIds.map(accId => syncCampaignsForAccount(tenantId, accId, { deepSync: true }))
      )
        .then((results) => {
          const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
          const errors = results.filter(r => r.error).map(r => r.error);
          setSyncStatus(errors.length > 0 ? errors.join('; ') : `${totalSynced} kampanya senkronize edildi (adSets + ads dahil)`);
          setTimeout(() => setSyncStatus(null), 5000);
        })
        .catch(() => setSyncStatus(null));
    } catch (err) {
      console.error('Failed to save selected accounts:', err);
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
            const connectedAccounts = getAccountsForPlatform(platform);
            const isConnected = connectedAccounts.length > 0;

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
                          <Check className="w-3 h-3" />
                          {connectedAccounts.length} hesap bagli
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
                  <div className="space-y-2">
                    {/* List all connected accounts */}
                    {connectedAccounts.map(account => (
                      <div key={account.id} className="bg-green-50 rounded-lg p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-commons font-medium text-green-800 truncate">
                            {account.accountName}
                          </p>
                          <p className="text-xs font-commons text-green-600 mt-0.5">
                            ID: {account.accountId}
                          </p>
                          {account.lastSyncAt && (
                            <p className="text-xs font-commons text-green-500 mt-0.5">
                              Son sync: {account.lastSyncAt.toDate().toLocaleDateString('tr-TR')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={async () => {
                              setSyncingAccountId(account.id);
                              try {
                                const result = await syncCampaignsForAccount(tenantId, account.id);
                                setSyncStatus(result.error || `${result.synced} kampanya senkronize edildi`);
                                setTimeout(() => setSyncStatus(null), 5000);
                              } catch {
                                setSyncStatus('Senkronizasyon basarisiz');
                                setTimeout(() => setSyncStatus(null), 5000);
                              } finally {
                                setSyncingAccountId(null);
                              }
                            }}
                            disabled={syncingAccountId === account.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-green-200 text-green-700 hover:bg-green-50 transition-colors font-commons text-xs disabled:opacity-50"
                          >
                            {syncingAccountId === account.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            Sync
                          </button>
                          <button
                            onClick={() => handleDisconnect(account)}
                            disabled={actionLoading === account.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-commons text-xs disabled:opacity-50"
                          >
                            {actionLoading === account.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                            Kes
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Add more accounts button */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleRefresh}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors font-commons text-xs"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Yenile
                      </button>
                      <button
                        onClick={() => handleConnect(platform)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors font-commons text-xs"
                      >
                        <Plus className="w-3 h-3" />
                        Hesap Ekle
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

      {/* ── Account Picker Modal (multi-select) ── */}
      <AnimatePresence>
        {pickerData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => !pickerSaving && setPickerData(null)}
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
                  <h2 className="font-grotesk text-lg font-bold text-[#171717]">
                    Reklam Hesaplarini Secin
                  </h2>
                  <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                    {pickerData.userName} &mdash; {pickerData.accounts.length} hesap bulundu
                  </p>
                </div>
                <button
                  onClick={() => !pickerSaving && setPickerData(null)}
                  disabled={pickerSaving}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4 text-neutral-500" />
                </button>
              </div>

              {/* Select All */}
              {pickerData.accounts.filter(a => a.status === 1).length > 1 && (
                <div className="px-6 pt-3 pb-1">
                  <button
                    onClick={handleSelectAll}
                    disabled={pickerSaving}
                    className="text-xs font-commons text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    {selectedIds.size === pickerData.accounts.filter(a => a.status === 1).length
                      ? 'Secimi Kaldir'
                      : 'Tumunu Sec'}
                  </button>
                </div>
              )}

              {/* Account List */}
              <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
                {pickerData.accounts.map((acc) => {
                  const statusInfo = AD_ACCOUNT_STATUS[acc.status] || AD_ACCOUNT_STATUS[2];
                  const isActive = acc.status === 1;
                  const isSelected = selectedIds.has(acc.id);

                  return (
                    <button
                      key={acc.id}
                      onClick={() => toggleAccount(acc.id, isActive)}
                      disabled={!isActive || pickerSaving}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        isActive
                          ? isSelected
                            ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                            : 'border-neutral-200 hover:border-neutral-300 cursor-pointer'
                          : 'border-neutral-100 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-neutral-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>

                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-grotesk text-sm font-medium text-[#171717] truncate">
                              {acc.name}
                            </p>
                            <span className={`text-[10px] font-grotesk font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <p className="font-grotesk text-xs text-neutral-400 mt-0.5">
                            {acc.id}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 rounded-b-2xl flex items-center justify-between gap-3">
                <p className="font-grotesk text-xs text-neutral-400">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} hesap secildi`
                    : 'Baglamak istediginiz hesaplari secin'}
                </p>
                <button
                  onClick={handleSaveSelected}
                  disabled={selectedIds.size === 0 || pickerSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171717] text-white font-commons text-sm hover:bg-[#2a2a2a] disabled:bg-neutral-200 disabled:text-neutral-400 transition-all"
                >
                  {pickerSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      {selectedIds.size > 0 ? `${selectedIds.size} Hesabi Bagla` : 'Hesap Sec'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PlatformsPage;
