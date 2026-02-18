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

// Proposal Pages
const ProposalListPage = React.lazy(() => import('./pricing/proposals/ProposalListPage'));
const ProposalViewPage = React.lazy(() => import('./pricing/proposals/ProposalViewPage'));

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

// Phase 2: Content & Creative Pages
const CreativeLibraryPage = React.lazy(() => import('./marketing/CreativeLibraryPage'));
const AICopyGeneratorPage = React.lazy(() => import('./marketing/AICopyGeneratorPage'));
const TemplatesPage = React.lazy(() => import('./marketing/TemplatesPage'));
const ABTestsPage = React.lazy(() => import('./marketing/ABTestsPage'));
const UTMBuilderPage = React.lazy(() => import('./marketing/UTMBuilderPage'));

// Phase 3: Automation & Intelligence Pages
const AutomatedRulesPage = React.lazy(() => import('./marketing/AutomatedRulesPage'));
const CampaignCalendarPage = React.lazy(() => import('./marketing/CampaignCalendarPage'));

// Phase 4: Reporting, Multi-Client & Competitor Pages
const ReportsPage = React.lazy(() => import('./marketing/ReportsPage'));
const MultiClientDashboard = React.lazy(() => import('./marketing/MultiClientDashboard'));
const CompetitorMonitorPage = React.lazy(() => import('./marketing/CompetitorMonitorPage'));

// Social Media Pages
const SocialMediaDashboard = React.lazy(() => import('./social-media/SocialMediaDashboard'));
const SocialMediaCalendar = React.lazy(() => import('./social-media/SocialMediaCalendar'));
const CreatePostPage = React.lazy(() => import('./social-media/CreatePostPage'));
const ContentPlanListPage = React.lazy(() => import('./social-media/ContentPlanListPage'));
const CreateContentPlanPage = React.lazy(() => import('./social-media/CreateContentPlanPage'));
const ContentPlanView = React.lazy(() => import('./social-media/ContentPlanView'));

// Persona AI Pages
const PersonaChatPage = React.lazy(() => import('./persona/PersonaChatPage'));

// Tenant Management (super_admin only)
const TenantManagementPage = React.lazy(() => import('./settings/TenantManagementPage'));

// Workflow Pages
const WorkflowListPage = React.lazy(() => import('./workflows/WorkflowListPage'));
const WorkflowBuilderPage = React.lazy(() => import('./workflows/WorkflowBuilderPage'));
const WorkflowInstancePage = React.lazy(() => import('./workflows/WorkflowInstancePage'));
const WorkflowStepDetailPage = React.lazy(() => import('./workflows/WorkflowStepDetailPage'));
const AIWorkflowDesigner = React.lazy(() => import('./workflows/AIWorkflowDesigner'));
const AIServiceDesigner = React.lazy(() => import('./pricing/catalog/AIServiceDesigner'));

// Filing Pages
const FilingDashboardPage = React.lazy(() => import('./filing/FilingDashboardPage'));
const CreateFilingPage = React.lazy(() => import('./filing/CreateFilingPage'));
const FilingTemplatesPage = React.lazy(() => import('./filing/FilingTemplatesPage'));
const FilingDetailPage = React.lazy(() => import('./filing/FilingDetailPage'));

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
          <Route
            path="projects/:projectId/marketing/creatives"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CreativeLibraryPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/ai-copy"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <AICopyGeneratorPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/templates"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <TemplatesPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/ab-tests"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ABTestsPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/utm"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <UTMBuilderPage />
              </React.Suspense>
            }
          />
          {/* Project-scoped Phase 3: Automation & Intelligence */}
          <Route
            path="projects/:projectId/marketing/rules"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <AutomatedRulesPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/calendar"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CampaignCalendarPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/reports"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ReportsPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/clients"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <MultiClientDashboard />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/marketing/competitors"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CompetitorMonitorPage />
              </React.Suspense>
            }
          />
          {/* Standalone Social Media Routes */}
          <Route
            path="social-media"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <SocialMediaCalendar />
              </React.Suspense>
            }
          />
          <Route
            path="social-media/dashboard"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <SocialMediaDashboard />
              </React.Suspense>
            }
          />
          <Route
            path="social-media/new"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CreatePostPage />
              </React.Suspense>
            }
          />
          <Route
            path="social-media/plans"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ContentPlanListPage />
              </React.Suspense>
            }
          />
          <Route
            path="social-media/plans/new"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CreateContentPlanPage />
              </React.Suspense>
            }
          />
          <Route
            path="social-media/plans/:planId"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ContentPlanView />
              </React.Suspense>
            }
          />
          {/* Project-scoped Social Media Routes */}
          <Route
            path="projects/:projectId/social-media"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <SocialMediaCalendar />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/social-media/dashboard"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <SocialMediaDashboard />
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
            path="projects/:projectId/social-media/plans"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ContentPlanListPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/social-media/plans/new"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CreateContentPlanPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/social-media/plans/:planId"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ContentPlanView />
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
            path="pricing/catalog/ai-designer"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <AIServiceDesigner />
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
            path="pricing/proposals"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ProposalListPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/proposals/new"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ProposalViewPage />
              </React.Suspense>
            }
          />
          <Route
            path="pricing/proposals/:id"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ProposalViewPage />
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
          <Route
            path="marketing/creatives"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CreativeLibraryPage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/ai-copy"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <AICopyGeneratorPage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/templates"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <TemplatesPage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/ab-tests"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ABTestsPage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/utm"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <UTMBuilderPage />
              </React.Suspense>
            }
          />
          {/* Phase 3: Automation & Intelligence */}
          <Route
            path="marketing/rules"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <AutomatedRulesPage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/calendar"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CampaignCalendarPage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/reports"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <ReportsPage />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/clients"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <MultiClientDashboard />
              </React.Suspense>
            }
          />
          <Route
            path="marketing/competitors"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CompetitorMonitorPage />
              </React.Suspense>
            }
          />
          {/* Persona AI Chat */}
          <Route
            path="persona-chat"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <PersonaChatPage />
              </React.Suspense>
            }
          />
          {/* Workflow Routes */}
          <Route
            path="workflows"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <WorkflowListPage />
              </React.Suspense>
            }
          />
          <Route
            path="workflows/ai-designer"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <AIWorkflowDesigner />
              </React.Suspense>
            }
          />
          <Route
            path="workflows/builder"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <WorkflowBuilderPage />
              </React.Suspense>
            }
          />
          <Route
            path="workflows/builder/:id"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <WorkflowBuilderPage />
              </React.Suspense>
            }
          />
          <Route
            path="workflows/instance/:id"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <WorkflowInstancePage />
              </React.Suspense>
            }
          />
          <Route
            path="workflows/instance/:id/step/:stepId"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <WorkflowStepDetailPage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/workflow/:instanceId"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <WorkflowInstancePage />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:projectId/workflow/:instanceId/step/:stepId"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <WorkflowStepDetailPage />
              </React.Suspense>
            }
          />
          {/* Filing Routes */}
          <Route
            path="filing"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <FilingDashboardPage />
              </React.Suspense>
            }
          />
          <Route
            path="filing/new"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <CreateFilingPage />
              </React.Suspense>
            }
          />
          <Route
            path="filing/templates"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <FilingTemplatesPage />
              </React.Suspense>
            }
          />
          <Route
            path="filing/:id"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <FilingDetailPage />
              </React.Suspense>
            }
          />
          {/* Tenant Management (super_admin) */}
          <Route
            path="settings/tenants"
            element={
              <React.Suspense fallback={<PageLoader />}>
                <TenantManagementPage />
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
