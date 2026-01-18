import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/shared/hooks/usePermission';
import { PERMISSIONS } from '@/lib/rbac/permissions';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/admin',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Basvurular',
    path: '/admin/leads',
    icon: <Users className="w-5 h-5" />,
    permission: PERMISSIONS.LEADS_VIEW,
  },
  {
    label: 'Projeler',
    path: '/admin/projects',
    icon: <FolderKanban className="w-5 h-5" />,
    permission: PERMISSIONS.PROJECTS_VIEW,
  },
  {
    label: 'Onaylar',
    path: '/admin/approvals',
    icon: <CheckSquare className="w-5 h-5" />,
    permission: PERMISSIONS.APPROVALS_VIEW,
  },
  {
    label: 'Assets',
    path: '/admin/assets',
    icon: <ImageIcon className="w-5 h-5" />,
    permission: PERMISSIONS.ASSETS_VIEW,
  },
  {
    label: 'Egitim',
    path: '/admin/training',
    icon: <GraduationCap className="w-5 h-5" />,
    permission: PERMISSIONS.TRAINING_VIEW,
  },
  {
    label: 'Ayarlar',
    path: '/admin/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { can } = usePermission();

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
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-[#ebeef8] flex">
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
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-[#171717] z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 lg:flex-shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
          <span className="font-grotesk text-xl font-bold text-white tracking-tight">Intiba</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-6 space-y-1.5">
          {filteredNavItems.map((item) => {
            const isActive = isActiveRoute(item.path);
            return (
              <a
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-5 py-3.5 rounded-xl font-grotesk text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* User Info (Bottom) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-white/70" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-grotesk text-white truncate">
                {user?.displayName || 'User'}
              </p>
              <p className="text-xs font-grotesk text-white/50 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-0 ml-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-neutral-200 sticky top-0 z-30">
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
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors"
                />
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
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
                        <a
                          href="/admin/settings/profile"
                          className="flex items-center gap-2 px-4 py-2 text-sm font-grotesk text-neutral-700 hover:bg-neutral-50"
                        >
                          <User className="w-4 h-4" />
                          Profil
                        </a>
                        <a
                          href="/admin/settings"
                          className="flex items-center gap-2 px-4 py-2 text-sm font-grotesk text-neutral-700 hover:bg-neutral-50"
                        >
                          <Settings className="w-4 h-4" />
                          Ayarlar
                        </a>
                        <hr className="my-1 border-neutral-200" />
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm font-grotesk text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="w-4 h-4" />
                          Cikis Yap
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
