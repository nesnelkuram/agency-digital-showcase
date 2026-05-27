import { PERMISSIONS, Permission } from './permissions';

export interface RoleConfig {
  name: string;
  displayName: string;
  description: string;
  permissions: Permission[];
}

export const ROLES: Record<string, RoleConfig> = {
  super_admin: {
    name: 'super_admin',
    displayName: 'Super Administrator',
    description: 'Global administrator with access to all tenants and features',
    permissions: Object.values(PERMISSIONS),
  },

  admin: {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full access to all features and settings within a tenant',
    permissions: Object.values(PERMISSIONS).filter(
      (p) => !p.startsWith('tenants:')
    ),
  },

  // staff rolü artık deprecated — account_manager veya editor kullanılmalı
  // Geriye dönük uyumluluk için korunuyor

  staff: {
    name: 'staff',
    displayName: 'Staff Member',
    description: 'Agency employee with project management access',
    permissions: [
      // Leads
      PERMISSIONS.LEADS_VIEW,
      PERMISSIONS.LEADS_EDIT,
      PERMISSIONS.LEADS_ASSIGN,
      PERMISSIONS.LEADS_AI_ANALYZE,

      // Projects
      PERMISSIONS.PROJECTS_VIEW,
      PERMISSIONS.PROJECTS_CREATE,
      PERMISSIONS.PROJECTS_EDIT,

      // Tasks
      PERMISSIONS.TASKS_VIEW,
      PERMISSIONS.TASKS_CREATE,
      PERMISSIONS.TASKS_EDIT,
      PERMISSIONS.TASKS_ASSIGN,

      // Approvals
      PERMISSIONS.APPROVALS_VIEW,
      PERMISSIONS.APPROVALS_CREATE,
      PERMISSIONS.APPROVALS_SUBMIT,
      PERMISSIONS.APPROVALS_REVIEW,
      PERMISSIONS.APPROVALS_COMMENT,

      // Assets
      PERMISSIONS.ASSETS_VIEW,
      PERMISSIONS.ASSETS_UPLOAD,
      PERMISSIONS.ASSETS_EDIT,
      PERMISSIONS.ASSETS_DOWNLOAD,
      PERMISSIONS.BRAND_KIT_VIEW,
      PERMISSIONS.BRAND_KIT_EDIT,

      // Training
      PERMISSIONS.TRAINING_VIEW,
      PERMISSIONS.TRAINING_COMPLETE,

      // Users (limited)
      PERMISSIONS.USERS_VIEW,

      // Analytics
      PERMISSIONS.ANALYTICS_VIEW,

      // Feedback
      PERMISSIONS.FEEDBACK_VIEW,
      PERMISSIONS.FEEDBACK_CREATE,
      PERMISSIONS.FEEDBACK_COMMENT,
      PERMISSIONS.FEEDBACK_DELETE,

      // Marketing
      PERMISSIONS.MARKETING_VIEW,
      PERMISSIONS.MARKETING_CREATE,
      PERMISSIONS.MARKETING_APPROVE,
      PERMISSIONS.MARKETING_EXECUTE,
      PERMISSIONS.MARKETING_BUDGET,
      PERMISSIONS.PLATFORMS_MANAGE,

      // Social Media
      PERMISSIONS.SOCIAL_MEDIA_VIEW,
      PERMISSIONS.SOCIAL_MEDIA_CREATE,
      PERMISSIONS.SOCIAL_MEDIA_EDIT,
      PERMISSIONS.SOCIAL_MEDIA_APPROVE,

      // Workflows
      PERMISSIONS.WORKFLOWS_VIEW,
      PERMISSIONS.WORKFLOW_INSTANCES_VIEW,
      PERMISSIONS.WORKFLOW_INSTANCES_MANAGE,
      PERMISSIONS.WORKFLOW_INSTANCES_ASSIGN,
      PERMISSIONS.WORKFLOW_STEPS_COMPLETE,
      PERMISSIONS.WORKFLOW_STEPS_REVIEW,
      PERMISSIONS.SOP_VIEW,

      // Filing
      PERMISSIONS.FILING_VIEW,
      PERMISSIONS.FILING_CREATE,
      PERMISSIONS.FILING_EDIT,
    ],
  },

  account_manager: {
    name: 'account_manager',
    displayName: 'Account Manager',
    description: 'Müşteri ilişkileri yöneticisi — finansal detay görmez, sadece satış fiyatı',
    permissions: [
      // Leads
      PERMISSIONS.LEADS_VIEW,
      PERMISSIONS.LEADS_EDIT,
      PERMISSIONS.LEADS_ASSIGN,
      PERMISSIONS.LEADS_AI_ANALYZE,

      // Projects
      PERMISSIONS.PROJECTS_VIEW,
      PERMISSIONS.PROJECTS_CREATE,
      PERMISSIONS.PROJECTS_EDIT,
      PERMISSIONS.PROJECTS_ARCHIVE,

      // Tasks
      PERMISSIONS.TASKS_VIEW,
      PERMISSIONS.TASKS_CREATE,
      PERMISSIONS.TASKS_EDIT,
      PERMISSIONS.TASKS_ASSIGN,

      // Approvals
      PERMISSIONS.APPROVALS_VIEW,
      PERMISSIONS.APPROVALS_CREATE,
      PERMISSIONS.APPROVALS_SUBMIT,
      PERMISSIONS.APPROVALS_REVIEW,
      PERMISSIONS.APPROVALS_COMMENT,
      PERMISSIONS.APPROVALS_APPROVE,
      PERMISSIONS.APPROVALS_INTERNAL_REVIEW,
      PERMISSIONS.APPROVALS_VIEW_AUDIT,

      // Assets
      PERMISSIONS.ASSETS_VIEW,
      PERMISSIONS.ASSETS_UPLOAD,
      PERMISSIONS.ASSETS_EDIT,
      PERMISSIONS.ASSETS_DOWNLOAD,
      PERMISSIONS.BRAND_KIT_VIEW,
      PERMISSIONS.BRAND_KIT_EDIT,

      // Training
      PERMISSIONS.TRAINING_VIEW,
      PERMISSIONS.TRAINING_COMPLETE,

      // Users (view only)
      PERMISSIONS.USERS_VIEW,

      // Analytics
      PERMISSIONS.ANALYTICS_VIEW,

      // Feedback
      PERMISSIONS.FEEDBACK_VIEW,
      PERMISSIONS.FEEDBACK_CREATE,
      PERMISSIONS.FEEDBACK_COMMENT,
      PERMISSIONS.FEEDBACK_DELETE,
      PERMISSIONS.FEEDBACK_MANAGE,

      // Marketing
      PERMISSIONS.MARKETING_VIEW,
      PERMISSIONS.MARKETING_CREATE,
      PERMISSIONS.MARKETING_APPROVE,
      PERMISSIONS.PLATFORMS_MANAGE,

      // Social Media
      PERMISSIONS.SOCIAL_MEDIA_VIEW,
      PERMISSIONS.SOCIAL_MEDIA_CREATE,
      PERMISSIONS.SOCIAL_MEDIA_EDIT,
      PERMISSIONS.SOCIAL_MEDIA_APPROVE,
      PERMISSIONS.SOCIAL_MEDIA_DELETE,

      // Workflows
      PERMISSIONS.WORKFLOWS_VIEW,
      PERMISSIONS.WORKFLOW_INSTANCES_VIEW,
      PERMISSIONS.WORKFLOW_INSTANCES_MANAGE,
      PERMISSIONS.WORKFLOW_INSTANCES_ASSIGN,
      PERMISSIONS.WORKFLOW_STEPS_COMPLETE,
      PERMISSIONS.WORKFLOW_STEPS_REVIEW,
      PERMISSIONS.SOP_VIEW,

      // Filing
      PERMISSIONS.FILING_VIEW,
      PERMISSIONS.FILING_CREATE,
      PERMISSIONS.FILING_EDIT,

      // Pricing — sadece satış fiyatı görür, maliyet/marj görmez
      PERMISSIONS.PRICING_VIEW_PRICE,
    ],
  },

  editor: {
    name: 'editor',
    displayName: 'Editor',
    description: 'Kreatif ekip — fiyatlandırma modüllerini görmez',
    permissions: [
      // Projects (sadece atandıkları)
      PERMISSIONS.PROJECTS_VIEW_OWN,
      PERMISSIONS.PROJECTS_EDIT,

      // Tasks
      PERMISSIONS.TASKS_VIEW,
      PERMISSIONS.TASKS_CREATE,
      PERMISSIONS.TASKS_EDIT,

      // Approvals
      PERMISSIONS.APPROVALS_VIEW,
      PERMISSIONS.APPROVALS_CREATE,
      PERMISSIONS.APPROVALS_SUBMIT,
      PERMISSIONS.APPROVALS_COMMENT,

      // Assets
      PERMISSIONS.ASSETS_VIEW,
      PERMISSIONS.ASSETS_UPLOAD,
      PERMISSIONS.ASSETS_EDIT,
      PERMISSIONS.ASSETS_DOWNLOAD,
      PERMISSIONS.BRAND_KIT_VIEW,

      // Training
      PERMISSIONS.TRAINING_VIEW,
      PERMISSIONS.TRAINING_COMPLETE,

      // Feedback
      PERMISSIONS.FEEDBACK_VIEW,
      PERMISSIONS.FEEDBACK_CREATE,
      PERMISSIONS.FEEDBACK_COMMENT,

      // Social Media
      PERMISSIONS.SOCIAL_MEDIA_VIEW,
      PERMISSIONS.SOCIAL_MEDIA_CREATE,
      PERMISSIONS.SOCIAL_MEDIA_EDIT,

      // Workflows (sadece atandıkları adımlar)
      PERMISSIONS.WORKFLOW_INSTANCES_VIEW_OWN,
      PERMISSIONS.WORKFLOW_STEPS_COMPLETE,
      PERMISSIONS.SOP_VIEW,

      // Filing
      PERMISSIONS.FILING_VIEW,
      PERMISSIONS.FILING_CREATE,
    ],
  },

  client: {
    name: 'client',
    displayName: 'Client',
    description: 'External client with project viewing and approval rights',
    permissions: [
      // Projects (view own)
      PERMISSIONS.PROJECTS_VIEW_OWN,

      // Tasks (view only)
      PERMISSIONS.TASKS_VIEW,

      // Approvals
      PERMISSIONS.APPROVALS_VIEW,
      PERMISSIONS.APPROVALS_APPROVE,
      PERMISSIONS.APPROVALS_COMMENT,

      // Assets
      PERMISSIONS.ASSETS_VIEW,
      PERMISSIONS.ASSETS_DOWNLOAD,
      PERMISSIONS.BRAND_KIT_VIEW,

      // Training (if applicable)
      PERMISSIONS.TRAINING_VIEW,
      PERMISSIONS.TRAINING_COMPLETE,

      // Feedback
      PERMISSIONS.FEEDBACK_VIEW,
      PERMISSIONS.FEEDBACK_CREATE,
      PERMISSIONS.FEEDBACK_COMMENT,

      // Social Media — atanan projelerin planlarını görüp onay/revizyon verir
      PERMISSIONS.SOCIAL_MEDIA_VIEW,
      PERMISSIONS.SOCIAL_MEDIA_APPROVE,

      // Workflows (view own projects only)
      PERMISSIONS.WORKFLOW_INSTANCES_VIEW_OWN,
    ],
  },

  freelancer: {
    name: 'freelancer',
    displayName: 'Freelancer',
    description: 'External contractor with limited project access',
    permissions: [
      // Projects (only assigned)
      PERMISSIONS.PROJECTS_VIEW_OWN,

      // Tasks (assigned only)
      PERMISSIONS.TASKS_VIEW,
      PERMISSIONS.TASKS_EDIT,

      // Approvals (submit only)
      PERMISSIONS.APPROVALS_VIEW,
      PERMISSIONS.APPROVALS_SUBMIT,
      PERMISSIONS.APPROVALS_COMMENT,

      // Assets
      PERMISSIONS.ASSETS_VIEW,
      PERMISSIONS.ASSETS_UPLOAD,
      PERMISSIONS.ASSETS_DOWNLOAD,
      PERMISSIONS.BRAND_KIT_VIEW,

      // Training
      PERMISSIONS.TRAINING_VIEW,
      PERMISSIONS.TRAINING_COMPLETE,

      // Feedback
      PERMISSIONS.FEEDBACK_VIEW,
      PERMISSIONS.FEEDBACK_CREATE,
      PERMISSIONS.FEEDBACK_COMMENT,

      // Workflows
      PERMISSIONS.WORKFLOW_INSTANCES_VIEW_OWN,
      PERMISSIONS.WORKFLOW_STEPS_COMPLETE,
      PERMISSIONS.SOP_VIEW,
    ],
  },
};

export type RoleName = keyof typeof ROLES;
