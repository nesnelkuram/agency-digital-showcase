import React, { lazy, Suspense, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import StudioLayout from './StudioLayout';

const StudioHomePage = lazy(() => import('./pages/StudioHomePage'));
const StudioCalendarHome = lazy(() => import('./pages/StudioCalendarHome'));
const StudioPlansPage = lazy(() => import('./pages/StudioPlansPage'));
const StudioNewPlanPage = lazy(() => import('./pages/StudioNewPlanPage'));
const StudioPlanPage = lazy(() => import('./pages/StudioPlanPage'));
const StudioBrandKitPage = lazy(() => import('./pages/StudioBrandKitPage'));
const StudioLibraryPage = lazy(() => import('./pages/StudioLibraryPage'));
const StudioPlannerPage = lazy(() => import('./pages/StudioPlannerPage'));
const StudioNotificationsPage = lazy(() => import('./pages/StudioNotificationsPage'));
const StudioLandingPage = lazy(() => import('./landing/StudioLandingPage'));

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

/**
 * Oturum yoksa /studio tanıtım sayfasını gösterir; giriş o sayfadaki pencereden yapılır.
 * Giriş sırasında AuthContext loading=true olsa da tanıtım sayfası açık kalır (pencere kapanmasın).
 */
const StudioAuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const resolved = useRef(false);
  if (!loading) resolved.current = true;

  if (!resolved.current) return <div className="min-h-screen" style={{ backgroundColor: '#e9ecf3' }} />;
  if (!user) {
    return (
      <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: '#e9ecf3' }} />}>
        <StudioLandingPage />
      </Suspense>
    );
  }
  return <>{children}</>;
};

const StudioApp: React.FC = () => (
  <StudioAuthGate>
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
          <Route path=":projectId/kutuphane" element={page(<StudioLibraryPage />)} />
          <Route path=":projectId/planlayici" element={page(<StudioPlannerPage />)} />
          <Route path=":projectId/marka" element={page(<StudioBrandKitPage />)} />
          <Route path="*" element={<Navigate to="/studio" replace />} />
        </Route>
      </Routes>
    </StudioRoleGate>
  </StudioAuthGate>
);

export default StudioApp;
