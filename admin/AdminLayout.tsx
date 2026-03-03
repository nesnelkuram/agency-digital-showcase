import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  ImageIcon,
  GraduationCap,
  Settings,
  Menu,
  X,
  Search,
  LogOut,
  User,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
  Users2,
  Calculator,
  Wallet,
  Building2,
  Monitor,
  Cpu,
  Megaphone,
  BookOpen,
  TrendingUp,
  Video,
  FileCheck,
  Bot,
  Palette,
  Sparkles,
  FileText,
  FlaskConical,
  Link as LinkIcon,
  Zap,
  CalendarDays,
  FileBarChart,
  Eye,
  GitBranch,
  HardDrive,
  Share2,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/shared/hooks/usePermission';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import TenantSwitcher from './components/TenantSwitcher';
import NotificationDropdown from './components/NotificationDropdown';
import { NotificationsProvider } from './contexts/NotificationsContext';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  permission?: string;
  /** Bu roller bu item'ı HİÇ göremez */
  hiddenForRoles?: string[];
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Ekip',
    path: '/admin/team',
    icon: Users2,
    hiddenForRoles: ['client', 'freelancer'],
  },
  {
    label: 'Basvurular',
    path: '/admin/leads',
    icon: Users,
    permission: PERMISSIONS.LEADS_VIEW,
  },
  {
    label: 'Projeler',
    path: '/admin/projects',
    icon: FolderKanban,
    permission: PERMISSIONS.PROJECTS_VIEW,
  },
  {
    label: 'Dosyalama',
    path: '/admin/filing',
    icon: HardDrive,
    permission: PERMISSIONS.FILING_VIEW,
  },
  {
    label: 'Onaylar',
    path: '/admin/approvals',
    icon: CheckSquare,
    permission: PERMISSIONS.APPROVALS_VIEW,
  },
  {
    label: 'Geribildirim',
    path: '/admin/feedback',
    icon: Video,
    permission: PERMISSIONS.FEEDBACK_VIEW,
  },
  {
    label: 'Assets',
    path: '/admin/assets',
    icon: ImageIcon,
    permission: PERMISSIONS.ASSETS_VIEW,
  },
  {
    label: 'Egitim',
    path: '/admin/training',
    icon: GraduationCap,
    permission: PERMISSIONS.TRAINING_VIEW,
  },
  {
    label: 'Danisman AI',
    path: '/admin/persona-chat',
    icon: Bot,
  },
  {
    label: 'Workflows',
    path: '/admin/workflows',
    icon: GitBranch,
    permission: PERMISSIONS.WORKFLOWS_VIEW,
  },
  {
    label: 'Görevlerim',
    path: '/admin/tasks',
    icon: ClipboardList,
    hiddenForRoles: ['client'],
  },
  {
    label: 'AI Ajanlar',
    path: '/admin/agents',
    icon: Bot,
    hiddenForRoles: ['client', 'freelancer'],
  },
  {
    label: 'Pazarlama',
    path: '/admin/marketing',
    icon: Megaphone,
    permission: PERMISSIONS.MARKETING_VIEW,
    children: [
      // Core
      { label: 'AI Ajan', path: '/admin/marketing/agent', icon: Bot },
      { label: 'Dashboard', path: '/admin/marketing', icon: LayoutDashboard },
      { label: 'Kampanyalar', path: '/admin/marketing/campaigns', icon: FolderKanban },
      { label: 'AI Onerileri', path: '/admin/marketing/proposals', icon: Cpu },
      { label: 'Platformlar', path: '/admin/marketing/platforms', icon: Monitor },
      { label: 'Performans', path: '/admin/marketing/performance', icon: TrendingUp },
      { label: 'Butce', path: '/admin/marketing/budget', icon: Wallet },
      // Content & Creative
      { label: 'Kreatif Kutuphane', path: '/admin/marketing/creatives', icon: Palette },
      { label: 'AI Metin Uretici', path: '/admin/marketing/ai-copy', icon: Sparkles },
      { label: 'Sablonlar', path: '/admin/marketing/templates', icon: FileText },
      { label: 'A/B Testleri', path: '/admin/marketing/ab-tests', icon: FlaskConical },
      { label: 'UTM Builder', path: '/admin/marketing/utm', icon: LinkIcon },
      // Automation & Intelligence
      { label: 'Otomasyon Kurallari', path: '/admin/marketing/rules', icon: Zap },
      { label: 'Kampanya Takvimi', path: '/admin/marketing/calendar', icon: CalendarDays },
      // Reporting & Analysis
      { label: 'Raporlar', path: '/admin/marketing/reports', icon: FileBarChart },
      { label: 'Musteri Dashboard', path: '/admin/marketing/clients', icon: Users2 },
      { label: 'Rakip Izleme', path: '/admin/marketing/competitors', icon: Eye },
    ],
  },
  {
    label: 'Sosyal Medya',
    path: '/admin/social-media',
    icon: Share2,
    permission: PERMISSIONS.SOCIAL_MEDIA_VIEW,
    children: [
      { label: 'Takvim', path: '/admin/social-media', icon: CalendarDays },
      { label: 'Icerik Planlari', path: '/admin/social-media/plans', icon: FileText },
      { label: 'Yeni Icerik', path: '/admin/social-media/new', icon: Sparkles },
    ],
  },
  {
    label: 'Hizmet Katalogu',
    path: '/admin/pricing/catalog',
    icon: BookOpen,
    hiddenForRoles: ['editor', 'client', 'freelancer'],
  },
  {
    label: 'Teklif Dokumanlari',
    path: '/admin/pricing/proposals',
    icon: FileCheck,
    hiddenForRoles: ['editor', 'client', 'freelancer'],
  },
  {
    label: 'Finansal Yonetim',
    path: '/admin/pricing/costs',
    icon: Wallet,
    hiddenForRoles: ['editor', 'account_manager', 'client', 'freelancer'],
    children: [
      { label: 'Genel Bakis', path: '/admin/pricing/costs', icon: LayoutDashboard },
      { label: 'Personel', path: '/admin/pricing/costs/personnel', icon: Users },
      { label: 'Ofis', path: '/admin/pricing/costs/office', icon: Building2 },
      { label: 'Ekipman', path: '/admin/pricing/costs/equipment', icon: Cpu },
      { label: 'Yazilim', path: '/admin/pricing/costs/software', icon: Monitor },
      { label: 'Pazarlama', path: '/admin/pricing/costs/marketing', icon: Megaphone },
      { label: 'Musteriler', path: '/admin/pricing/customers', icon: Users2 },
      { label: 'Projeksiyonlar', path: '/admin/pricing/projections', icon: TrendingUp },
    ],
  },
  {
    label: 'Fiyat Teklifi',
    path: '/admin/pricing',
    icon: Calculator,
    hiddenForRoles: ['editor', 'account_manager', 'client', 'freelancer'],
  },
  {
    label: 'Ayarlar',
    path: '/admin/settings',
    icon: Settings,
  },
];

const SIDEBAR_STORAGE_KEY = 'admin-sidebar-collapsed';

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return stored === 'true';
  });
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { can } = usePermission();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Auto-expand parent menu if child is active
  useEffect(() => {
    navItems.forEach((item) => {
      if (item.children) {
        const isChildActive = item.children.some((child) =>
          location.pathname === child.path ||
          (child.path !== '/admin/pricing/costs' && location.pathname.startsWith(child.path))
        );
        if (isChildActive && !expandedMenus.includes(item.path)) {
          setExpandedMenus((prev) => [...prev, item.path]);
        }
      }
    });
  }, [location.pathname]);

  const filteredNavItems = navItems.filter((item) => {
    if (item.permission && !can(item.permission as any)) return false;
    if (item.hiddenForRoles && user?.role && item.hiddenForRoles.includes(user.role)) return false;
    return true;
  });

  const handleSignOut = async () => {
    await signOut();
  };

  const isActiveRoute = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    if (path === '/admin/pricing/costs') {
      return location.pathname === '/admin/pricing/costs';
    }
    if (path === '/admin/social-media') {
      return location.pathname.startsWith('/admin/social-media');
    }
    if (path === '/admin/pricing/catalog') {
      return location.pathname.startsWith('/admin/pricing/catalog');
    }
    if (path === '/admin/pricing') {
      return location.pathname === '/admin/pricing';
    }
    return location.pathname.startsWith(path);
  };

  const toggleMenu = (path: string) => {
    setExpandedMenus((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  return (
    <NotificationsProvider>
    <div className="min-h-screen flex admin-bg">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 72 : 260 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={`fixed top-0 left-0 h-full z-50 transform transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 flex-shrink-0 glass-surface border-r border-white/40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Content */}
        <div className="h-full flex flex-col relative">
          {/* Logo + Collapse Toggle */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-white/30">
            <AnimatePresence mode="wait">
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-commons text-xl font-bold text-[#171717] tracking-tight"
                >
                  intiba
                </motion.span>
              )}
            </AnimatePresence>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden lg:flex p-1.5 rounded-lg hover:bg-white/40 text-neutral-400 hover:text-neutral-600 transition-all duration-200"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-[#171717]/70 hover:text-[#171717]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveRoute(item.path);
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedMenus.includes(item.path);

              return (
                <div key={item.path}>
                  {hasChildren ? (
                    <>
                      <button
                        onClick={() => toggleMenu(item.path)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2 rounded-xl
                          transition-all duration-200
                          ${isActive || isExpanded
                            ? 'bg-white/60 text-[#171717] shadow-sm shadow-black/[0.03]'
                            : 'text-neutral-500 hover:bg-white/30 hover:text-[#171717]'
                          }
                        `}
                      >
                        <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-[#171717]' : ''}`} />
                        <AnimatePresence mode="wait">
                          {!sidebarCollapsed && (
                            <motion.div
                              initial={{ opacity: 0, width: 0 }}
                              animate={{ opacity: 1, width: 'auto' }}
                              exit={{ opacity: 0, width: 0 }}
                              className="flex-1 flex items-center justify-between overflow-hidden"
                            >
                              <span className="font-commons text-sm font-medium whitespace-nowrap">
                                {item.label}
                              </span>
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>

                      {/* Children */}
                      <AnimatePresence>
                        {isExpanded && !sidebarCollapsed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="ml-4 mt-0.5 space-y-0.5 overflow-hidden"
                          >
                            {item.children?.map((child) => {
                              const ChildIcon = child.icon;
                              const isChildActive = location.pathname === child.path;

                              return (
                                <Link
                                  key={child.path}
                                  to={child.path}
                                  className={`
                                    flex items-center gap-3 px-3 py-1.5 rounded-lg
                                    transition-all duration-200
                                    ${isChildActive
                                      ? 'bg-white/50 text-[#171717]'
                                      : 'text-neutral-400 hover:bg-white/25 hover:text-neutral-600'
                                    }
                                  `}
                                >
                                  <ChildIcon className={`w-4 h-4 ${isChildActive ? 'text-[#171717]' : ''}`} />
                                  <span className="font-commons text-sm">{child.label}</span>
                                </Link>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : (
                    <Link
                      to={item.path}
                      className={`
                        flex items-center gap-3 px-3 py-2 rounded-xl
                        transition-all duration-200
                        ${isActive
                          ? 'bg-white/60 text-[#171717] shadow-sm shadow-black/[0.03]'
                          : 'text-neutral-500 hover:bg-white/30 hover:text-[#171717]'
                        }
                      `}
                    >
                      <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-[#171717]' : ''}`} />
                      <AnimatePresence mode="wait">
                        {!sidebarCollapsed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            className="font-commons text-sm font-medium whitespace-nowrap overflow-hidden"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="p-3 border-t border-white/30">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center flex-shrink-0">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-4 h-4 text-neutral-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-commons text-[#171717] truncate">
                    {user?.displayName || 'User'}
                  </p>
                  <p className="text-xs font-commons text-neutral-400 capitalize">{user?.role}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 glass-surface border-b border-white/30 sticky top-0 z-30">
          <div className="h-full px-4 lg:px-6 flex items-center justify-between">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-neutral-600 hover:text-neutral-900"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Search */}
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Ara..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/[0.03] border border-white/50 font-commons text-sm focus:outline-none focus:bg-white/60 focus:border-white/70 placeholder:text-neutral-400 transition-all"
                />
              </div>
            </div>

            {/* Right side - intiba logo */}
            <div className="flex items-center gap-4">
              {/* Tenant Switcher (super_admin only) */}
              <TenantSwitcher />

              {/* Notifications */}
              <NotificationDropdown />

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 hover:bg-white/40 rounded-xl transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
                    {user?.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-4 h-4 text-neutral-600" />
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 top-full mt-2 w-48 glass-elevated rounded-2xl py-1.5 z-50"
                      >
                        <Link
                          to="/admin/settings/profile"
                          className="flex items-center gap-2 px-4 py-2 mx-1.5 rounded-lg text-sm font-commons text-neutral-700 hover:bg-white/50"
                        >
                          <User className="w-4 h-4" />
                          Profil
                        </Link>
                        <Link
                          to="/admin/settings"
                          className="flex items-center gap-2 px-4 py-2 mx-1.5 rounded-lg text-sm font-commons text-neutral-700 hover:bg-white/50"
                        >
                          <Settings className="w-4 h-4" />
                          Ayarlar
                        </Link>
                        <hr className="my-1.5 mx-3 border-white/40" />
                        <button
                          onClick={handleSignOut}
                          className="w-[calc(100%-12px)] mx-1.5 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-commons text-red-600 hover:bg-red-500/10"
                        >
                          <LogOut className="w-4 h-4" />
                          Cikis Yap
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* intiba logo */}
              <span className="font-commons text-lg font-bold text-[#171717] tracking-tight hidden sm:block">
                intiba
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
    </NotificationsProvider>
  );
};

export default AdminLayout;
