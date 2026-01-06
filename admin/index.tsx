import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import AuthGuard from './auth/AuthGuard';
import DashboardPage from './dashboard/DashboardPage';

// Lazy load other pages (will be implemented later)
const ProjectsPage = React.lazy(() => import('./projects/ProjectListPage'));
const ApprovalsPage = React.lazy(() => import('./approvals/ApprovalsPage'));
const AssetsPage = React.lazy(() => import('./assets/AssetLibraryPage'));
const TrainingPage = React.lazy(() => import('./training/TrainingPage'));
const SettingsPage = React.lazy(() => import('./settings/SettingsPage'));

const AdminApp: React.FC = () => {
  return (
    <AuthGuard>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route
            path="projects/*"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ProjectsPage />
              </React.Suspense>
            }
          />
          <Route
            path="approvals/*"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ApprovalsPage />
              </React.Suspense>
            }
          />
          <Route
            path="assets/*"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <AssetsPage />
              </React.Suspense>
            }
          />
          <Route
            path="training/*"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <TrainingPage />
              </React.Suspense>
            }
          />
          <Route
            path="settings/*"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <SettingsPage />
              </React.Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </AuthGuard>
  );
};

const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
  </div>
);

export default AdminApp;
