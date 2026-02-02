import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import AuthGuard from './auth/AuthGuard';
import DashboardPage from './dashboard/DashboardPage';

// Lazy load other pages
const LeadsPage = React.lazy(() => import('./leads/LeadsPage'));
const LeadDetailPage = React.lazy(() => import('./leads/LeadDetailPage'));
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

// Project Pages
const ProjectListPage = React.lazy(() => import('./projects/ProjectListPage'));
const ProjectDetailPage = React.lazy(() => import('./projects/ProjectDetailPage'));
const CreateProjectPage = React.lazy(() => import('./projects/CreateProjectPage'));

// Marketing Pages
const MarketingDashboard = React.lazy(() => import('./marketing/MarketingDashboard'));
const CampaignsPage = React.lazy(() => import('./marketing/CampaignsPage'));
const CampaignDetailPage = React.lazy(() => import('./marketing/CampaignDetailPage'));
const ProposalsPage = React.lazy(() => import('./marketing/ProposalsPage'));
const ProposalReviewPage = React.lazy(() => import('./marketing/ProposalReviewPage'));
const PlatformsPage = React.lazy(() => import('./marketing/PlatformsPage'));
const PerformancePage = React.lazy(() => import('./marketing/PerformancePage'));
const BudgetPage = React.lazy(() => import('./marketing/BudgetPage'));
const CampaignWizardPage = React.lazy(() => import('./marketing/CampaignWizardPage'));
const CampaignEditPage = React.lazy(() => import('./marketing/CampaignEditPage'));

// Social Media Pages
const SocialMediaDashboard = React.lazy(() => import('./social-media/SocialMediaDashboard'));
const SocialMediaCalendar = React.lazy(() => import('./social-media/SocialMediaCalendar'));
const CreatePostPage = React.lazy(() => import('./social-media/CreatePostPage'));

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
          {/* Project Routes */}
          <Route
            path="projects"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ProjectListPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/new"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CreateProjectPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:id"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ProjectDetailPage />
              </React.Suspense>
            }
          />
          {/* Project-scoped Marketing Routes */}
          <Route
            path="projects/:projectId/marketing"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <MarketingDashboard />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/campaigns"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CampaignsPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/campaigns/new"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CampaignWizardPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/campaigns/:id/edit"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CampaignEditPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/campaigns/:id"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CampaignDetailPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/proposals"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ProposalsPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/proposals/:id"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ProposalReviewPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/platforms"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <PlatformsPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/performance"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <PerformancePage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/budget"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <BudgetPage />
              </React.Suspense>
            }
          />
          {/* Project-scoped Social Media Routes */}
          <Route
            path="projects/:projectId/social-media"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <SocialMediaDashboard />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/social-media/calendar"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <SocialMediaCalendar />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/social-media/new"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CreatePostPage />
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
          {/* Marketing Routes */}
          <Route
            path="marketing"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <MarketingDashboard />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/campaigns"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CampaignsPage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/proposals"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ProposalsPage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/campaigns/new"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CampaignWizardPage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/campaigns/:id/edit"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CampaignEditPage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/campaigns/:id"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CampaignDetailPage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/proposals/:id"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ProposalReviewPage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/platforms"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <PlatformsPage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/performance"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <PerformancePage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/budget"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <BudgetPage />
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
