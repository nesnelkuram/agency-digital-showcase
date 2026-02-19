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

  // Marketing (Digital Marketing AI Agent Team)
  MARKETING_VIEW: 'marketing:view',
  MARKETING_CREATE: 'marketing:create',
  MARKETING_APPROVE: 'marketing:approve',
  MARKETING_EXECUTE: 'marketing:execute',
  MARKETING_BUDGET: 'marketing:budget',
  MARKETING_DELETE: 'marketing:delete',
  PLATFORMS_MANAGE: 'platforms:manage',

  // Social Media (Sosyal Medya Yonetimi)
  SOCIAL_MEDIA_VIEW: 'social_media:view',
  SOCIAL_MEDIA_CREATE: 'social_media:create',
  SOCIAL_MEDIA_EDIT: 'social_media:edit',
  SOCIAL_MEDIA_APPROVE: 'social_media:approve',
  SOCIAL_MEDIA_DELETE: 'social_media:delete',

  // Tenant Management (super_admin only)
  TENANTS_VIEW: 'tenants:view',
  TENANTS_CREATE: 'tenants:create',
  TENANTS_EDIT: 'tenants:edit',
  TENANTS_DELETE: 'tenants:delete',
  TENANTS_SWITCH: 'tenants:switch',

  // Workflows
  WORKFLOWS_VIEW: 'workflows:view',
  WORKFLOWS_CREATE: 'workflows:create',
  WORKFLOWS_EDIT: 'workflows:edit',
  WORKFLOWS_DELETE: 'workflows:delete',
  WORKFLOWS_PUBLISH: 'workflows:publish',

  // Workflow Instances
  WORKFLOW_INSTANCES_VIEW: 'workflow_instances:view',
  WORKFLOW_INSTANCES_VIEW_OWN: 'workflow_instances:view_own',
  WORKFLOW_INSTANCES_MANAGE: 'workflow_instances:manage',
  WORKFLOW_INSTANCES_ASSIGN: 'workflow_instances:assign',

  // Workflow Steps
  WORKFLOW_STEPS_COMPLETE: 'workflow_steps:complete',
  WORKFLOW_STEPS_REVIEW: 'workflow_steps:review',
  WORKFLOW_STEPS_AI_EXECUTE: 'workflow_steps:ai_execute',

  // SOP Resources
  SOP_VIEW: 'sop:view',
  SOP_CREATE: 'sop:create',
  SOP_EDIT: 'sop:edit',
  SOP_DELETE: 'sop:delete',

  // Filing (Proje Dosyalama Sistemi)
  FILING_VIEW: 'filing:view',
  FILING_CREATE: 'filing:create',
  FILING_EDIT: 'filing:edit',
  FILING_DELETE: 'filing:delete',
  FILING_TEMPLATES_MANAGE: 'filing:templates_manage',

  // Pricing Erişim Seviyeleri (ayrıştırılmış)
  PRICING_VIEW_PRICE: 'pricing:view_price',     // sadece satış fiyatı
  PRICING_VIEW_COST: 'pricing:view_cost',       // maliyet detayı
  PRICING_VIEW_MARGIN: 'pricing:view_margin',   // kar marjı
  PRICING_VIEW_STAFF: 'pricing:view_staff',     // personel ücretleri
  PRICING_VIEW_FIXED: 'pricing:view_fixed',     // sabit giderler
  PRICING_FULL: 'pricing:full',                 // tam erişim (admin)
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
