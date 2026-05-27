import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AuthGuard from '@/admin/auth/AuthGuard';
import PortalLayout from './PortalLayout';
import { useAuth } from '@/contexts/AuthContext';

const PortalDashboardPage = lazy(() => import('./PortalDashboardPage'));
const PortalProjectsPage = lazy(() => import('./PortalProjectsPage'));
const PortalApprovalsPage = lazy(() => import('./PortalApprovalsPage'));
const PortalSocialMediaPage = lazy(() => import('./PortalSocialMediaPage'));
const PortalContentPlanReviewPage = lazy(() => import('./PortalContentPlanReviewPage'));
const PortalClientCalendarPage = lazy(() => import('./PortalClientCalendarPage'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[300px]">
    <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
  </div>
);

const PortalApp: React.FC = () => {
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  // Müşteri rolü: sadece takvim — diğer her şey takvime yönlenir
  if (isClient) {
    return (
      <AuthGuard>
        <Routes>
          <Route element={<PortalLayout />}>
            <Route
              index
              element={
                <Suspense fallback={<PageLoader />}>
                  <PortalClientCalendarPage />
                </Suspense>
              }
            />
            <Route
              path="social-media/:planId/review"
              element={
                <Suspense fallback={<PageLoader />}>
                  <PortalContentPlanReviewPage />
                </Suspense>
              }
            />
            {/* Diğer tüm yollar takvime yönlenir */}
            <Route path="*" element={<Navigate to="/portal" replace />} />
          </Route>
        </Routes>
      </AuthGuard>
    );
  }

  // Diğer roller için tam portal
  return (
    <AuthGuard>
      <Routes>
        <Route element={<PortalLayout />}>
          <Route
            index
            element={
              <Suspense fallback={<PageLoader />}>
                <PortalDashboardPage />
              </Suspense>
            }
          />
          <Route
            path="projects"
            element={
              <Suspense fallback={<PageLoader />}>
                <PortalProjectsPage />
              </Suspense>
            }
          />
          <Route
            path="approvals"
            element={
              <Suspense fallback={<PageLoader />}>
                <PortalApprovalsPage />
              </Suspense>
            }
          />
          <Route
            path="social-media"
            element={
              <Suspense fallback={<PageLoader />}>
                <PortalSocialMediaPage />
              </Suspense>
            }
          />
          <Route
            path="social-media/:planId/review"
            element={
              <Suspense fallback={<PageLoader />}>
                <PortalContentPlanReviewPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Route>
      </Routes>
    </AuthGuard>
  );
};

export default PortalApp;
