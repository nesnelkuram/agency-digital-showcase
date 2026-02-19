import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Share2,
  User,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Ana Sayfa', path: '/portal', icon: LayoutDashboard },
  { label: 'Projelerim', path: '/portal/projects', icon: FolderKanban },
  { label: 'Onaylar', path: '/portal/approvals', icon: CheckSquare },
  { label: 'İçerik Planları', path: '/portal/social-media', icon: Share2 },
];

const PortalLayout: React.FC = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const isActive = (path: string) =>
    path === '/portal'
      ? location.pathname === '/portal'
      : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top Nav */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/portal" className="flex items-center gap-2">
            <img src="/images/intibalogo.svg" alt="intiba" className="h-6 w-auto" />
            <span className="font-grotesk text-xs text-neutral-400 hidden sm:block">Müşteri Portalı</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-grotesk text-sm transition-colors ${
                    active
                      ? 'bg-[#171717] text-white'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right — User Menu */}
          <div className="flex items-center gap-2">
            {/* Mobile nav toggle */}
            <button
              className="md:hidden p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
            >
              {mobileNavOpen ? (
                <X className="w-5 h-5 text-neutral-600" />
              ) : (
                <Menu className="w-5 h-5 text-neutral-600" />
              )}
            </button>

            {/* User dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[#fffceb] border border-neutral-200 flex items-center justify-center">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="font-grotesk font-bold text-[#171717] text-xs">
                      {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'K'}
                    </span>
                  )}
                </div>
                <span className="font-grotesk text-sm text-neutral-700 hidden sm:block max-w-[120px] truncate">
                  {user?.displayName || user?.email}
                </span>
                <ChevronDown className="w-4 h-4 text-neutral-400" />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-neutral-200 shadow-lg py-1 z-50"
                  >
                    <div className="px-3 py-2 border-b border-neutral-100">
                      <p className="font-grotesk text-xs font-semibold text-[#171717] truncate">
                        {user?.displayName || user?.email}
                      </p>
                      <p className="font-grotesk text-xs text-neutral-400 truncate">{user?.email}</p>
                    </div>
                    <Link
                      to="/portal/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 font-grotesk text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      Profilim
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-3 py-2 font-grotesk text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Çıkış Yap
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-neutral-100 overflow-hidden"
            >
              <nav className="px-4 py-3 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileNavOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-grotesk text-sm transition-colors ${
                        active
                          ? 'bg-[#171717] text-white'
                          : 'text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Page Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default PortalLayout;
