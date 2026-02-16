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
  Bell,
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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/shared/hooks/usePermission';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import TenantSwitcher from './components/TenantSwitcher';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  permission?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/admin',
    icon: LayoutDashboard,
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
    label: 'Pazarlama',
    path: '/admin/marketing',
    icon: Megaphone,
    permission: PERMISSIONS.MARKETING_VIEW,
    children: [
      // Core
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
    label: 'Hizmet Katalogu',
    path: '/admin/pricing/catalog',
    icon: BookOpen,
  },
  {
    label: 'Teklif Dokumanlari',
    path: '/admin/pricing/proposals',
    icon: FileCheck,
  },
  {
    label: 'Finansal Yonetim',
    path: '/admin/pricing/costs',
    icon: Wallet,
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

  const filteredNavItems = navItems.filter(
    (item) => !item.permission || can(item.permission as any)
  );

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
    <div className="min-h-screen flex" style={{ backgroundColor: '#F5F3FF' }}>
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
        className={`fixed top-0 left-0 h-full z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 flex-shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Holographic Gradient Background */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              135deg,
              #d4c5f9 0%,
              #c9d4f9 15%,
              #b8d4f7 25%,
              #d4b8e8 35%,
              #e8c8f0 45%,
              #b8d8f8 55%,
              #a8e0d8 70%,
              #b8f0d8 85%,
              #c8f8e8 100%
            )`,
          }}
        />

        {/* Content */}
        <div className="relative h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-white/20">
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
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-[#171717]/70 hover:text-[#171717]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                          transition-all duration-200
                          ${isActive || isExpanded
                            ? 'bg-white/80 text-[#171717] shadow-sm'
                            : 'text-[#171717]/70 hover:bg-white/40 hover:text-[#171717]'
                          }
                        `}
                      >
                        <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-indigo-600' : ''}`} />
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
                            className="ml-4 mt-1 space-y-1 overflow-hidden"
                          >
                            {item.children?.map((child) => {
                              const ChildIcon = child.icon;
                              const isChildActive = location.pathname === child.path;

                              return (
                                <Link
                                  key={child.path}
                                  to={child.path}
                                  className={`
                                    flex items-center gap-3 px-3 py-2 rounded-lg
                                    transition-all duration-200
                                    ${isChildActive
                                      ? 'bg-white/70 text-[#171717]'
                                      : 'text-[#171717]/60 hover:bg-white/30 hover:text-[#171717]'
                                    }
                                  `}
                                >
                                  <ChildIcon className={`w-4 h-4 ${isChildActive ? 'text-indigo-600' : ''}`} />
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
                        flex items-center gap-3 px-3 py-2.5 rounded-xl
                        transition-all duration-200
                        ${isActive
                          ? 'bg-white/80 text-[#171717] shadow-sm'
                          : 'text-[#171717]/70 hover:bg-white/40 hover:text-[#171717]'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-indigo-600' : ''}`} />
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
          <div className="p-3 border-t border-white/20">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-[#171717]/70" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-commons text-[#171717] truncate">
                    {user?.displayName || 'User'}
                  </p>
                  <p className="text-xs font-commons text-[#171717]/50 capitalize">{user?.role}</p>
                </div>
              </div>
            )}

            {/* Collapse Toggle */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="
                w-full flex items-center justify-center gap-2 px-3 py-2.5 mt-2
                rounded-xl bg-white/50 hover:bg-white/70
                text-[#171717]/70 hover:text-[#171717]
                transition-all duration-200
              "
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <>
                  <ChevronLeft className="w-5 h-5" />
                  <span className="font-commons text-sm font-medium">Daralt</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-neutral-200/50 sticky top-0 z-30">
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
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                />
              </div>
            </div>

            {/* Right side - intiba logo */}
            <div className="flex items-center gap-4">
              {/* Tenant Switcher (super_admin only) */}
              <TenantSwitcher />

              {/* Notifications */}
              <button className="relative p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 hover:bg-neutral-100 rounded-lg transition-colors"
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
                        className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50"
                      >
                        <Link
                          to="/admin/settings/profile"
                          className="flex items-center gap-2 px-4 py-2 text-sm font-commons text-neutral-700 hover:bg-neutral-50"
                        >
                          <User className="w-4 h-4" />
                          Profil
                        </Link>
                        <Link
                          to="/admin/settings"
                          className="flex items-center gap-2 px-4 py-2 text-sm font-commons text-neutral-700 hover:bg-neutral-50"
                        >
                          <Settings className="w-4 h-4" />
                          Ayarlar
                        </Link>
                        <hr className="my-1 border-neutral-200" />
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm font-commons text-red-600 hover:bg-red-50"
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
  );
};

export default AdminLayout;
