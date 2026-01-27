import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import AuthGuard from './auth/AuthGuard';
import DashboardPage from './dashboard/DashboardPage';

// Lazy load other pages
const LeadsPage = React.lazy(() => import('./leads/LeadsPage'));
const LeadDetailPage = React.lazy(() => import('./leads/LeadDetailPage'));
const ProjectsPage = React.lazy(() => import('./projects/ProjectListPage'));
const ApprovalsPage = React.lazy(() => import('./approvals/ApprovalsPage'));
const AssetsPage = React.lazy(() => import('./assets/AssetLibraryPage'));
const TrainingPage = React.lazy(() => import('./training/TrainingPage'));
const SettingsPage = React.lazy(() => import('./settings/SettingsPage'));
const CostEnginePage = React.lazy(() => import('./pricing/CostEngine'));
const QuoteWizardPage = React.lazy(() => import('./pricing/quotes/QuoteWizard'));

// Cost Management Pages
const CostsOverviewPage = React.lazy(() => import('./pricing/costs'));
const PersonnelCostsPage = React.lazy(() => import('./pricing/costs/PersonnelCostsPage'));
const OfficeCostsPage = React.lazy(() => import('./pricing/costs/OfficeCostsPage'));
const EquipmentCostsPage = React.lazy(() => import('./pricing/costs/EquipmentCostsPage'));
const SoftwareCostsPage = React.lazy(() => import('./pricing/costs/SoftwareCostsPage'));
const MarketingCostsPage = React.lazy(() => import('./pricing/costs/MarketingCostsPage'));

// Customer Management Pages
const CustomersPage = React.lazy(() => import('./pricing/customers'));
const CustomerDetailPage = React.lazy(() => import('./pricing/customers/CustomerDetailPage'));

// Service Catalog Pages
const CatalogPage = React.lazy(() => import('./pricing/catalog'));
const ServiceDetailPage = React.lazy(() => import('./pricing/catalog/ServiceDetailPage'));
const ServiceEditorPage = React.lazy(() => import('./pricing/catalog/ServiceEditorPage'));

// Projections Page
const ProjectionsPage = React.lazy(() => import('./pricing/projections/ProjectionsPage'));

// Feedback Pages
const FeedbackPage = React.lazy(() => import('./feedback/FeedbackPage'));
const FeedbackDetailPage = React.lazy(() => import('./feedback/FeedbackDetailPage'));

const AdminApp: React.FC = () => {
  return (
    <AuthGuard>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route
            path="leads"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <LeadsPage />
              </React.Suspense>
            }
          />
          <Route
            path="leads/:id"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <LeadDetailPage />
              </React.Suspense>
            }
          />
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
          <Route
            path="pricing"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CostEnginePage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/costs"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CostsOverviewPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/costs/personnel"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <PersonnelCostsPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/costs/office"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <OfficeCostsPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/costs/equipment"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <EquipmentCostsPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/costs/software"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <SoftwareCostsPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/costs/marketing"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <MarketingCostsPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/customers"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CustomersPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/customers/:id"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CustomerDetailPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/catalog"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CatalogPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/catalog/new"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ServiceEditorPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/catalog/:id/edit"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ServiceEditorPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/catalog/:id"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ServiceDetailPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/quotes/new"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <QuoteWizardPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/projections"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ProjectionsPage />
              </React.Suspense>
            }
          />
          <Route
            path="feedback"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <FeedbackPage />
              </React.Suspense>
            }
          />
          <Route
            path="feedback/:id"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <FeedbackDetailPage />
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
