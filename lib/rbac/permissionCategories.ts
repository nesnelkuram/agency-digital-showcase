import { Permission } from './permissions';

export const PERMISSION_CATEGORY_ORDER = [
  'leads',
  'projects',
  'tasks',
  'approvals',
  'assets',
  'brand_kit',
  'workflows',
  'workflow_instances',
  'workflow_steps',
  'sop',
  'social_media',
  'marketing',
  'platforms',
  'filing',
  'feedback',
  'training',
  'analytics',
  'activity',
  'pricing',
  'users',
  'settings',
  'integrations',
  'tenants',
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  leads: 'Başvurular',
  projects: 'Projeler',
  tasks: 'Görevler',
  approvals: 'Onaylar',
  assets: 'Varlıklar',
  brand_kit: 'Marka Kiti',
  workflows: 'İş Akışları',
  workflow_instances: 'İş Akışı Örnekleri',
  workflow_steps: 'İş Akışı Adımları',
  sop: 'SOP Kaynakları',
  social_media: 'Sosyal Medya',
  marketing: 'Pazarlama',
  platforms: 'Platformlar',
  filing: 'Dosyalama',
  feedback: 'Geri Bildirim',
  training: 'Eğitim',
  analytics: 'Analitik',
  activity: 'Aktivite',
  pricing: 'Fiyatlandırma',
  users: 'Kullanıcılar',
  settings: 'Ayarlar',
  integrations: 'Entegrasyonlar',
  tenants: 'Tenant Yönetimi',
};

export const ACTION_LABELS: Record<string, string> = {
  view: 'Görüntüle',
  view_own: 'Kendini Görüntüle',
  view_price: 'Satış Fiyatı',
  view_cost: 'Maliyet',
  view_margin: 'Kar Marjı',
  view_staff: 'Personel Ücreti',
  view_fixed: 'Sabit Gider',
  view_audit: 'Denetim Geçmişi',
  create: 'Oluştur',
  edit: 'Düzenle',
  delete: 'Sil',
  archive: 'Arşivle',
  assign: 'Ata',
  submit: 'Gönder',
  review: 'İncele',
  approve: 'Onayla',
  comment: 'Yorum',
  manage: 'Yönet',
  upload: 'Yükle',
  download: 'İndir',
  invite: 'Davet Et',
  manage_roles: 'Rol Yönet',
  convert: 'Dönüştür',
  ai_analyze: 'AI Analiz',
  complete: 'Tamamla',
  publish: 'Yayınla',
  export: 'Dışa Aktar',
  execute: 'Çalıştır',
  ai_execute: 'AI Çalıştır',
  budget: 'Bütçe',
  full: 'Tam Erişim',
  skip_internal: 'İç İnceleme Atla',
  internal_review: 'İç İnceleme',
  templates_manage: 'Şablon Yönet',
  progress_view: 'İlerleme Görüntüle',
  switch: 'Değiştir',
};

export interface CategorizedPermissions {
  category: string;
  label: string;
  permissions: Array<{ key: Permission; actionLabel: string }>;
}

export function categorizePermissions(permissions: Permission[]): CategorizedPermissions[] {
  const groups = new Map<string, Array<{ key: Permission; actionLabel: string }>>();

  for (const perm of permissions) {
    const [category, action] = perm.split(':');
    if (!category || !action) continue;
    const actionLabel = ACTION_LABELS[action] || action.replace(/_/g, ' ');
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push({ key: perm, actionLabel });
  }

  const ordered: CategorizedPermissions[] = [];
  for (const cat of PERMISSION_CATEGORY_ORDER) {
    const items = groups.get(cat);
    if (items && items.length > 0) {
      ordered.push({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        permissions: items,
      });
      groups.delete(cat);
    }
  }

  // Sirada olmayan kategoriler alfabetik
  const leftoverKeys = Array.from(groups.keys()).sort();
  for (const cat of leftoverKeys) {
    ordered.push({
      category: cat,
      label: CATEGORY_LABELS[cat] || cat,
      permissions: groups.get(cat)!,
    });
  }

  return ordered;
}
