import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, Link, NavLink, useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, FileText, Palette, LogOut, ChevronDown, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import { NotificationsProvider } from '@/admin/contexts/NotificationsContext';
import NotificationDropdown from '@/admin/components/NotificationDropdown';
import { getStudioProjects, studioLinkFor, type StudioProject } from './studioData';

export interface StudioContext {
  projects: StudioProject[];
  project: StudioProject | null;
  tenantId: string;
  reloadProjects: () => Promise<void>;
}

export function useStudio(): StudioContext {
  return useOutletContext<StudioContext>();
}

const NAV = [
  { label: 'Takvim', to: '', icon: CalendarDays, end: true },
  { label: 'Planlar', to: 'planlar', icon: FileText, end: false },
  { label: 'Marka Kiti', to: 'marka', icon: Palette, end: false },
];

const StudioLayout: React.FC = () => {
  const { user, signOut } = useAuth();
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const reloadProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await getStudioProjects({
        tenantId,
        role: user.role,
        assignedProjectIds: ((user.profile as any)?.assignedProjectIds || []) as string[],
      });
      setProjects(list);
    } catch (err) {
      console.error('[Studio] Markalar yüklenemedi:', err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, tenantId]);

  useEffect(() => {
    reloadProjects();
  }, [reloadProjects]);

  const project = projects.find((p) => p.id === projectId) || null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <NotificationsProvider>
      <div className="studio-bg">
        <header className="sticky top-0 z-40 bg-white/25 backdrop-blur-xl border-b border-white/50">
          <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/studio" className="flex items-center gap-2 shrink-0">
                <img src="/images/intibalogo.svg" alt="intiba" className="h-6 w-auto" />
                <span className="font-grotesk text-xs text-neutral-400 hidden sm:block">Studio</span>
              </Link>
              {projects.length > 0 && (
                <select
                  aria-label="Marka seç"
                  value={project?.id || ''}
                  onChange={(e) => e.target.value && navigate(`/studio/${e.target.value}`)}
                  className={`glass-chip font-grotesk text-sm font-semibold px-3 py-1.5 max-w-[220px] truncate outline-none ${
                    projects.length === 1 && project ? 'hidden' : ''
                  }`}
                >
                  <option value="" disabled>
                    Marka seç…
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              {projects.length === 1 && project && (
                <span className="font-grotesk text-sm font-semibold text-[#171717] truncate">{project.name}</span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <NotificationDropdown viewAllPath="/studio/bildirimler" resolveLink={studioLinkFor} />
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-2 py-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[#fffceb] border border-neutral-200 flex items-center justify-center">
                    <span className="font-grotesk font-bold text-[#171717] text-xs">
                      {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'S'}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-1 w-52 bg-white/90 backdrop-blur-xl rounded-2xl border border-white shadow-lg py-1 z-50"
                    >
                      <div className="px-3 py-2 border-b border-neutral-100">
                        <p className="font-grotesk text-xs font-semibold text-[#171717] truncate">{user?.displayName || user?.email}</p>
                        <p className="font-grotesk text-xs text-neutral-400 truncate">{user?.email}</p>
                      </div>
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

          {project && (
            <nav className="max-w-[1600px] mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.label}
                    to={item.to ? `/studio/${project.id}/${item.to}` : `/studio/${project.id}`}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 px-4 py-2 rounded-full font-grotesk text-sm whitespace-nowrap transition-colors ${
                        isActive ? 'bg-[#111] text-white font-medium shadow-sm' : 'glass-chip text-neutral-600 hover:text-neutral-900'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          )}
        </header>

        <main className="max-w-[1600px] mx-auto px-4 py-6">
          {loading ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          ) : projectId && !project ? (
            <div className="max-w-md mx-auto text-center py-16">
              <p className="font-grotesk text-sm text-neutral-600">Bu markaya erişiminiz yok veya marka bulunamadı.</p>
              <Link to="/studio" className="inline-block mt-4 font-grotesk text-sm underline text-neutral-700">
                Markalarıma dön
              </Link>
            </div>
          ) : (
            <Outlet context={{ projects, project, tenantId, reloadProjects } satisfies StudioContext} />
          )}
        </main>
      </div>
    </NotificationsProvider>
  );
};

export default StudioLayout;
