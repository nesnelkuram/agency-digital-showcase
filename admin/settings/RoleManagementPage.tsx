import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shield,
  Save,
  Check,
  Menu as MenuIcon,
  Key,
  ChevronRight,
  Lock,
  LayoutDashboard,
  Users2,
  Users,
  FolderKanban,
  HardDrive,
  CheckSquare,
  Video,
  ImageIcon,
  GraduationCap,
  Bot,
  GitBranch,
  ClipboardList,
  Megaphone,
  Share2,
  BookOpen,
  FileCheck,
  Wallet,
  Calculator,
  Settings,
  RotateCcw,
} from 'lucide-react';
import { useRoleConfig } from '@/shared/hooks/useRoleConfig';
import { ROLES } from '@/lib/rbac/roles';
import type { RoleMenuConfig } from '@/shared/services/roleConfigService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MENU_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/team', label: 'Ekip', icon: Users2 },
  { path: '/admin/leads', label: 'Basvurular', icon: Users },
  { path: '/admin/projects', label: 'Projeler', icon: FolderKanban },
  { path: '/admin/filing', label: 'Dosyalama', icon: HardDrive },
  { path: '/admin/approvals', label: 'Onaylar', icon: CheckSquare },
  { path: '/admin/feedback', label: 'Geribildirim', icon: Video },
  { path: '/admin/assets', label: 'Assets', icon: ImageIcon },
  { path: '/admin/training', label: 'Egitim', icon: GraduationCap },
  { path: '/admin/persona-chat', label: 'Danisman AI', icon: Bot },
  { path: '/admin/workflows', label: 'Workflows', icon: GitBranch },
  { path: '/admin/tasks', label: 'Gorevlerim', icon: ClipboardList },
  { path: '/admin/agents', label: 'AI Ajanlar', icon: Bot },
  { path: '/admin/marketing', label: 'Pazarlama', icon: Megaphone },
  { path: '/admin/social-media', label: 'Sosyal Medya', icon: Share2 },
  { path: '/admin/pricing/catalog', label: 'Hizmet Katalogu', icon: BookOpen },
  { path: '/admin/pricing/proposals', label: 'Teklif Dokumanlari', icon: FileCheck },
  { path: '/admin/pricing/costs', label: 'Finansal Yonetim', icon: Wallet },
  { path: '/admin/pricing', label: 'Fiyat Teklifi', icon: Calculator },
  { path: '/admin/settings', label: 'Ayarlar', icon: Settings },
] as const;

const PERMISSION_CATEGORIES: {
  label: string;
  permissions: { key: string; label: string }[];
}[] = [
  {
    label: 'Leads',
    permissions: [
      { key: 'leads:view', label: 'Goruntuleme' },
      { key: 'leads:edit', label: 'Duzenleme' },
      { key: 'leads:delete', label: 'Silme' },
      { key: 'leads:assign', label: 'Atama' },
      { key: 'leads:convert', label: 'Donusturme' },
      { key: 'leads:ai_analyze', label: 'AI Analiz' },
    ],
  },
  {
    label: 'Projeler',
    permissions: [
      { key: 'projects:view', label: 'Goruntuleme' },
      { key: 'projects:view_own', label: 'Kendi Projelerini Gorme' },
      { key: 'projects:create', label: 'Olusturma' },
      { key: 'projects:edit', label: 'Duzenleme' },
      { key: 'projects:delete', label: 'Silme' },
      { key: 'projects:archive', label: 'Arsivleme' },
    ],
  },
  {
    label: 'Gorevler',
    permissions: [
      { key: 'tasks:view', label: 'Goruntuleme' },
      { key: 'tasks:create', label: 'Olusturma' },
      { key: 'tasks:edit', label: 'Duzenleme' },
      { key: 'tasks:assign', label: 'Atama' },
      { key: 'tasks:delete', label: 'Silme' },
    ],
  },
  {
    label: 'Onaylar',
    permissions: [
      { key: 'approvals:view', label: 'Goruntuleme' },
      { key: 'approvals:create', label: 'Olusturma' },
      { key: 'approvals:submit', label: 'Gonderme' },
      { key: 'approvals:review', label: 'Inceleme' },
      { key: 'approvals:approve', label: 'Onaylama' },
      { key: 'approvals:comment', label: 'Yorum' },
      { key: 'approvals:internal_review', label: 'Dahili Inceleme' },
      { key: 'approvals:skip_internal', label: 'Dahili Atlama' },
      { key: 'approvals:view_audit', label: 'Denetim Goruntusu' },
    ],
  },
  {
    label: 'Assets',
    permissions: [
      { key: 'assets:view', label: 'Goruntuleme' },
      { key: 'assets:upload', label: 'Yukleme' },
      { key: 'assets:edit', label: 'Duzenleme' },
      { key: 'assets:delete', label: 'Silme' },
      { key: 'assets:download', label: 'Indirme' },
      { key: 'brand_kit:view', label: 'Marka Kiti Gorme' },
      { key: 'brand_kit:edit', label: 'Marka Kiti Duzenleme' },
    ],
  },
  {
    label: 'Egitim',
    permissions: [
      { key: 'training:view', label: 'Goruntuleme' },
      { key: 'training:complete', label: 'Tamamlama' },
      { key: 'training:create', label: 'Olusturma' },
      { key: 'training:edit', label: 'Duzenleme' },
      { key: 'training:progress_view', label: 'Ilerleme Goruntusu' },
    ],
  },
  {
    label: 'Kullanicilar',
    permissions: [
      { key: 'users:view', label: 'Goruntuleme' },
      { key: 'users:invite', label: 'Davet Etme' },
      { key: 'users:edit', label: 'Duzenleme' },
      { key: 'users:delete', label: 'Silme' },
      { key: 'users:manage_roles', label: 'Rol Yonetimi' },
    ],
  },
  {
    label: 'Ayarlar',
    permissions: [
      { key: 'settings:view', label: 'Goruntuleme' },
      { key: 'settings:edit', label: 'Duzenleme' },
      { key: 'integrations:manage', label: 'Entegrasyon Yonetimi' },
    ],
  },
  {
    label: 'Analitik',
    permissions: [
      { key: 'analytics:view', label: 'Goruntuleme' },
      { key: 'analytics:export', label: 'Disari Aktarma' },
      { key: 'activity:view', label: 'Aktivite Logu' },
    ],
  },
  {
    label: 'Geribildirim',
    permissions: [
      { key: 'feedback:view', label: 'Goruntuleme' },
      { key: 'feedback:create', label: 'Olusturma' },
      { key: 'feedback:comment', label: 'Yorum' },
      { key: 'feedback:delete', label: 'Silme' },
      { key: 'feedback:manage', label: 'Yonetim' },
    ],
  },
  {
    label: 'Pazarlama',
    permissions: [
      { key: 'marketing:view', label: 'Goruntuleme' },
      { key: 'marketing:create', label: 'Olusturma' },
      { key: 'marketing:approve', label: 'Onaylama' },
      { key: 'marketing:execute', label: 'Calistirma' },
      { key: 'marketing:budget', label: 'Butce Yonetimi' },
      { key: 'marketing:delete', label: 'Silme' },
      { key: 'platforms:manage', label: 'Platform Yonetimi' },
    ],
  },
  {
    label: 'Sosyal Medya',
    permissions: [
      { key: 'social_media:view', label: 'Goruntuleme' },
      { key: 'social_media:create', label: 'Olusturma' },
      { key: 'social_media:edit', label: 'Duzenleme' },
      { key: 'social_media:approve', label: 'Onaylama' },
      { key: 'social_media:delete', label: 'Silme' },
    ],
  },
  {
    label: 'Workflows',
    permissions: [
      { key: 'workflows:view', label: 'Goruntuleme' },
      { key: 'workflows:create', label: 'Olusturma' },
      { key: 'workflows:edit', label: 'Duzenleme' },
      { key: 'workflows:delete', label: 'Silme' },
      { key: 'workflows:publish', label: 'Yayinlama' },
      { key: 'workflow_instances:view', label: 'Ornekleri Gorme' },
      { key: 'workflow_instances:view_own', label: 'Kendi Ornekleri' },
      { key: 'workflow_instances:manage', label: 'Ornek Yonetimi' },
      { key: 'workflow_instances:assign', label: 'Atama' },
      { key: 'workflow_steps:complete', label: 'Adim Tamamlama' },
      { key: 'workflow_steps:review', label: 'Inceleme' },
      { key: 'workflow_steps:ai_execute', label: 'AI Calistirma' },
      { key: 'sop:view', label: 'SOP Gorme' },
      { key: 'sop:create', label: 'SOP Olusturma' },
      { key: 'sop:edit', label: 'SOP Duzenleme' },
      { key: 'sop:delete', label: 'SOP Silme' },
    ],
  },
  {
    label: 'Dosyalama',
    permissions: [
      { key: 'filing:view', label: 'Goruntuleme' },
      { key: 'filing:create', label: 'Olusturma' },
      { key: 'filing:edit', label: 'Duzenleme' },
      { key: 'filing:delete', label: 'Silme' },
      { key: 'filing:templates_manage', label: 'Sablon Yonetimi' },
    ],
  },
  {
    label: 'Fiyatlandirma',
    permissions: [
      { key: 'pricing:view_price', label: 'Satis Fiyati' },
      { key: 'pricing:view_cost', label: 'Maliyet' },
      { key: 'pricing:view_margin', label: 'Kar Marji' },
      { key: 'pricing:view_staff', label: 'Personel Ucretleri' },
      { key: 'pricing:view_fixed', label: 'Sabit Giderler' },
      { key: 'pricing:full', label: 'Tam Erisim' },
    ],
  },
  {
    label: 'Tenant',
    permissions: [
      { key: 'tenants:view', label: 'Goruntuleme' },
      { key: 'tenants:create', label: 'Olusturma' },
      { key: 'tenants:edit', label: 'Duzenleme' },
      { key: 'tenants:delete', label: 'Silme' },
      { key: 'tenants:switch', label: 'Gecis Yapma' },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Yonetici',
  account_manager: 'Musteri Iliskileri',
  editor: 'Editor',
  staff: 'Personel',
  client: 'Musteri',
  freelancer: 'Freelancer',
};

const ALL_ROLES = [
  'super_admin',
  'admin',
  'account_manager',
  'editor',
  'staff',
  'client',
  'freelancer',
] as const;

const NON_EDITABLE_ROLES = new Set(['super_admin', 'admin']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDefaultPermissions(role: string): string[] {
  return ROLES[role]?.permissions ?? [];
}

function getDefaultHiddenPaths(_role: string): string[] {
  // By default no paths are hidden — the existing AdminLayout hiddenForRoles
  // logic handles defaults. An empty array means everything is visible.
  return [];
}

function buildDefaultConfig(role: string): RoleMenuConfig {
  return {
    hiddenMenuPaths: getDefaultHiddenPaths(role),
    permissions: [...getDefaultPermissions(role)],
  };
}

// Collect all permission keys for non-editable (full-access) roles
const ALL_PERMISSION_KEYS = PERMISSION_CATEGORIES.flatMap((cat) =>
  cat.permissions.map((p) => p.key)
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type TabId = 'menu' | 'permissions';

export default function RoleManagementPage() {
  const { config, loading, save } = useRoleConfig();

  const [selectedRole, setSelectedRole] = useState<string>('account_manager');
  const [activeTab, setActiveTab] = useState<TabId>('menu');
  const [localConfig, setLocalConfig] = useState<Record<string, RoleMenuConfig>>({});
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Seed local state from Firestore config or defaults
  useEffect(() => {
    if (loading) return;
    const seed: Record<string, RoleMenuConfig> = {};
    for (const role of ALL_ROLES) {
      if (config?.roles?.[role]) {
        seed[role] = {
          hiddenMenuPaths: [...config.roles[role].hiddenMenuPaths],
          permissions: [...config.roles[role].permissions],
        };
      } else {
        seed[role] = buildDefaultConfig(role);
      }
    }
    setLocalConfig(seed);
    setDirty(false);
  }, [config, loading]);

  const isNonEditable = NON_EDITABLE_ROLES.has(selectedRole);

  const currentRoleConfig = useMemo<RoleMenuConfig>(
    () =>
      localConfig[selectedRole] ?? {
        hiddenMenuPaths: [],
        permissions: getDefaultPermissions(selectedRole),
      },
    [localConfig, selectedRole]
  );

  // ------- Toggle handlers -------

  const toggleMenu = useCallback(
    (path: string) => {
      if (isNonEditable) return;
      setLocalConfig((prev) => {
        const rc = prev[selectedRole] ?? buildDefaultConfig(selectedRole);
        const hidden = new Set(rc.hiddenMenuPaths);
        if (hidden.has(path)) {
          hidden.delete(path);
        } else {
          hidden.add(path);
        }
        return {
          ...prev,
          [selectedRole]: { ...rc, hiddenMenuPaths: [...hidden] },
        };
      });
      setDirty(true);
    },
    [selectedRole, isNonEditable]
  );

  const togglePermission = useCallback(
    (key: string) => {
      if (isNonEditable) return;
      setLocalConfig((prev) => {
        const rc = prev[selectedRole] ?? buildDefaultConfig(selectedRole);
        const perms = new Set(rc.permissions);
        if (perms.has(key)) {
          perms.delete(key);
        } else {
          perms.add(key);
        }
        return {
          ...prev,
          [selectedRole]: { ...rc, permissions: [...perms] },
        };
      });
      setDirty(true);
    },
    [selectedRole, isNonEditable]
  );

  // ------- Save / Reset -------

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await save(localConfig);
      setDirty(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [localConfig, save]);

  const resetToDefault = useCallback(() => {
    if (isNonEditable) return;
    setLocalConfig((prev) => ({
      ...prev,
      [selectedRole]: buildDefaultConfig(selectedRole),
    }));
    setDirty(true);
  }, [selectedRole, isNonEditable]);

  // ------- Render helpers -------

  const isMenuVisible = (path: string): boolean => {
    if (isNonEditable) return true;
    return !currentRoleConfig.hiddenMenuPaths.includes(path);
  };

  const hasPermission = (key: string): boolean => {
    if (isNonEditable) return true;
    return currentRoleConfig.permissions.includes(key);
  };

  // ------- Loading state -------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#171717]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-grotesk text-2xl font-bold text-[#171717]">
          Rol ve Yetki Yonetimi
        </h1>
        <p className="font-grotesk text-sm text-neutral-500 mt-1">
          Kullanici rollerinin menu gorunurlugu ve yetkilerini duzenleyin.
        </p>
      </div>

      <div className="flex gap-6">
        {/* ---- Left: Role selector ---- */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-white rounded-xl border border-neutral-100 p-2 space-y-0.5">
            {ALL_ROLES.map((role) => {
              const selected = selectedRole === role;
              return (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    selected
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <Shield className="w-4 h-4 flex-shrink-0" />
                  <span className="font-grotesk text-sm font-medium flex-1 truncate">
                    {ROLE_LABELS[role] ?? role}
                  </span>
                  {selected && <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- Right: Content panel ---- */}
        <div className="flex-1 bg-white rounded-xl border border-neutral-100 flex flex-col min-h-0">
          {/* Tabs */}
          <div className="flex border-b border-neutral-100">
            <button
              onClick={() => setActiveTab('menu')}
              className={`flex items-center gap-2 px-5 py-3 font-grotesk text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'menu'
                  ? 'border-[#171717] text-[#171717]'
                  : 'border-transparent text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <MenuIcon className="w-4 h-4" />
              Menu Gorunurlugu
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`flex items-center gap-2 px-5 py-3 font-grotesk text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'permissions'
                  ? 'border-[#171717] text-[#171717]'
                  : 'border-transparent text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <Key className="w-4 h-4" />
              Yetkiler
            </button>
          </div>

          {/* Content */}
          <div className="p-6 flex-1 overflow-y-auto">
            {/* Non-editable banner */}
            {isNonEditable && (
              <div className="flex items-center gap-3 mb-6 p-4 rounded-lg bg-neutral-50 border border-neutral-100">
                <Lock className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                <p className="font-grotesk text-sm text-neutral-600">
                  Bu rol tum yetkilere sahiptir. Ayarlar duzenlenemez.
                </p>
              </div>
            )}

            {/* ---- Menu tab ---- */}
            {activeTab === 'menu' && (
              <div className="space-y-1">
                {MENU_ITEMS.map((item) => {
                  const visible = isMenuVisible(item.path);
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.path}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-neutral-400" />
                        <span className="font-grotesk text-sm text-[#171717]">
                          {item.label}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleMenu(item.path)}
                        disabled={isNonEditable}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          visible ? 'bg-[#171717]' : 'bg-neutral-200'
                        } ${isNonEditable ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            visible ? 'left-[22px]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ---- Permissions tab ---- */}
            {activeTab === 'permissions' && (
              <div className="space-y-6">
                {PERMISSION_CATEGORIES.map((cat) => (
                  <div key={cat.label}>
                    <h3 className="font-grotesk text-sm font-semibold text-neutral-900 mb-2">
                      {cat.label}
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-1">
                      {cat.permissions.map((perm) => {
                        const checked = hasPermission(perm.key);
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-center gap-2 py-1.5 px-2 rounded hover:bg-neutral-50 transition-colors ${
                              isNonEditable ? 'cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            <span
                              className={`flex items-center justify-center w-4 h-4 rounded border transition-colors flex-shrink-0 ${
                                checked
                                  ? 'bg-[#171717] border-[#171717]'
                                  : 'border-neutral-300 bg-white'
                              } ${isNonEditable ? 'opacity-60' : ''}`}
                            >
                              {checked && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              disabled={isNonEditable}
                              onChange={() => togglePermission(perm.key)}
                            />
                            <span className="font-grotesk text-sm text-neutral-700">
                              {perm.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with Save / Reset */}
          {!isNonEditable && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100">
              <button
                onClick={resetToDefault}
                className="flex items-center gap-1.5 font-grotesk text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Varsayilana Sifirla
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg font-grotesk text-sm font-medium transition-colors ${
                  showSuccess
                    ? 'bg-green-600 text-white'
                    : saving || !dirty
                      ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                      : 'bg-[#171717] text-white hover:bg-neutral-800'
                }`}
              >
                {showSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    Kaydedildi
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
