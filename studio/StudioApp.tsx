import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AuthGuard from '@/admin/auth/AuthGuard';
import { useAuth } from '@/contexts/AuthContext';
import StudioLayout from './StudioLayout';

const StudioHomePage = lazy(() => import('./pages/StudioHomePage'));
const StudioCalendarHome = lazy(() => import('./pages/StudioCalendarHome'));
const StudioPlansPage = lazy(() => import('./pages/StudioPlansPage'));
const StudioNewPlanPage = lazy(() => import('./pages/StudioNewPlanPage'));
const StudioPlanPage = lazy(() => import('./pages/StudioPlanPage'));
const StudioBrandKitPage = lazy(() => import('./pages/StudioBrandKitPage'));
const StudioNotificationsPage = lazy(() => import('./pages/StudioNotificationsPage'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[300px]">
    <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
  </div>
);

/** Studio yalnızca marka yöneticisi ve (önizleme için) yöneticiler içindir */
const StudioRoleGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user?.role === 'client') return <Navigate to="/portal" replace />;
  if (user && !['brand_manager', 'admin', 'super_admin'].includes(user.role)) return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

const page = (el: React.ReactNode) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

const StudioApp: React.FC = () => (
  <AuthGuard>
    <StudioRoleGate>
      <Routes>
        <Route element={<StudioLayout />}>
          <Route index element={page(<StudioHomePage />)} />
          <Route path="bildirimler" element={page(<StudioNotificationsPage />)} />
          <Route path=":projectId" element={page(<StudioCalendarHome />)} />
          <Route path=":projectId/planlar" element={page(<StudioPlansPage />)} />
          <Route path=":projectId/planlar/yeni" element={page(<StudioNewPlanPage />)} />
          <Route path=":projectId/planlar/:planId" element={page(<StudioPlanPage />)} />
          <Route path=":projectId/takvim" element={<Navigate to=".." relative="path" replace />} />
          <Route path=":projectId/marka" element={page(<StudioBrandKitPage />)} />
          <Route path="*" element={<Navigate to="/studio" replace />} />
        </Route>
      </Routes>
    </StudioRoleGate>
  </AuthGuard>
);

export default StudioApp;
