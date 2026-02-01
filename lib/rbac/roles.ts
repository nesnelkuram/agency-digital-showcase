import { PERMISSIONS, Permission } from './permissions';

export interface RoleConfig {
  name: string;
  displayName: string;
  description: string;
  permissions: Permission[];
}

export const ROLES: Record<string, RoleConfig> = {
  admin: {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full access to all features and settings',
    permissions: Object.values(PERMISSIONS),
  },

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
    ],
  },
};

export type RoleName = keyof typeof ROLES;
