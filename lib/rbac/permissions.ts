export const PERMISSIONS = {
  // Leads (Brand Strategy Form Submissions)
  LEADS_VIEW: 'leads:view',
  LEADS_EDIT: 'leads:edit',
  LEADS_DELETE: 'leads:delete',
  LEADS_ASSIGN: 'leads:assign',
  LEADS_CONVERT: 'leads:convert',
  LEADS_AI_ANALYZE: 'leads:ai_analyze',

  // Project Management
  PROJECTS_VIEW: 'projects:view',
  PROJECTS_VIEW_OWN: 'projects:view_own',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_EDIT: 'projects:edit',
  PROJECTS_DELETE: 'projects:delete',
  PROJECTS_ARCHIVE: 'projects:archive',

  // Tasks
  TASKS_VIEW: 'tasks:view',
  TASKS_CREATE: 'tasks:create',
  TASKS_EDIT: 'tasks:edit',
  TASKS_ASSIGN: 'tasks:assign',
  TASKS_DELETE: 'tasks:delete',

  // Approvals
  APPROVALS_VIEW: 'approvals:view',
  APPROVALS_CREATE: 'approvals:create',
  APPROVALS_SUBMIT: 'approvals:submit',
  APPROVALS_REVIEW: 'approvals:review',
  APPROVALS_APPROVE: 'approvals:approve',
  APPROVALS_COMMENT: 'approvals:comment',

  // Assets
  ASSETS_VIEW: 'assets:view',
  ASSETS_UPLOAD: 'assets:upload',
  ASSETS_EDIT: 'assets:edit',
  ASSETS_DELETE: 'assets:delete',
  ASSETS_DOWNLOAD: 'assets:download',
  BRAND_KIT_VIEW: 'brand_kit:view',
  BRAND_KIT_EDIT: 'brand_kit:edit',

  // Training
  TRAINING_VIEW: 'training:view',
  TRAINING_COMPLETE: 'training:complete',
  TRAINING_CREATE: 'training:create',
  TRAINING_EDIT: 'training:edit',
  TRAINING_PROGRESS_VIEW: 'training:progress_view',

  // Users
  USERS_VIEW: 'users:view',
  USERS_INVITE: 'users:invite',
  USERS_EDIT: 'users:edit',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE_ROLES: 'users:manage_roles',

  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
  INTEGRATIONS_MANAGE: 'integrations:manage',

  // Analytics
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',

  // Activity Log
  ACTIVITY_VIEW: 'activity:view',

  // Feedback (Loom-style video feedback)
  FEEDBACK_VIEW: 'feedback:view',
  FEEDBACK_CREATE: 'feedback:create',
  FEEDBACK_COMMENT: 'feedback:comment',
  FEEDBACK_DELETE: 'feedback:delete',
  FEEDBACK_MANAGE: 'feedback:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
