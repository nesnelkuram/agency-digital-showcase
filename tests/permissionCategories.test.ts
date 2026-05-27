import { describe, it, expect } from 'vitest';
import {
  categorizePermissions,
  CATEGORY_LABELS,
  ACTION_LABELS,
  PERMISSION_CATEGORY_ORDER,
} from '@/lib/rbac/permissionCategories';

describe('categorizePermissions', () => {
  it('groups permissions by category prefix', () => {
    const result = categorizePermissions([
      'leads:view',
      'leads:edit',
      'projects:view',
      'projects:create',
    ] as any);
    expect(result).toHaveLength(2);
    const leads = result.find((g) => g.category === 'leads');
    const projects = result.find((g) => g.category === 'projects');
    expect(leads?.permissions).toHaveLength(2);
    expect(projects?.permissions).toHaveLength(2);
  });

  it('returns labels for categories', () => {
    const result = categorizePermissions(['leads:view'] as any);
    expect(result[0].label).toBe('Başvurular');
  });

  it('returns action labels', () => {
    const result = categorizePermissions(['leads:view', 'leads:edit'] as any);
    const labels = result[0].permissions.map((p) => p.actionLabel);
    expect(labels).toContain('Görüntüle');
    expect(labels).toContain('Düzenle');
  });

  it('respects category order from PERMISSION_CATEGORY_ORDER', () => {
    const result = categorizePermissions([
      'settings:view',
      'leads:view',
      'projects:view',
    ] as any);
    // Sıra: leads, projects, settings
    expect(result[0].category).toBe('leads');
    expect(result[1].category).toBe('projects');
    expect(result[2].category).toBe('settings');
  });

  it('handles empty input', () => {
    expect(categorizePermissions([])).toEqual([]);
  });

  it('ignores malformed permissions (no colon)', () => {
    const result = categorizePermissions(['malformed', 'leads:view'] as any);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('leads');
  });

  it('uses category slug as label when not in CATEGORY_LABELS', () => {
    const result = categorizePermissions(['unknown_cat:view'] as any);
    expect(result[0].label).toBe('unknown_cat');
  });

  it('produces unique categories (no duplicates)', () => {
    const result = categorizePermissions([
      'leads:view',
      'leads:edit',
      'leads:delete',
    ] as any);
    expect(result).toHaveLength(1);
    expect(result[0].permissions).toHaveLength(3);
  });
});

describe('ACTION_LABELS', () => {
  it('has Turkish labels for common actions', () => {
    expect(ACTION_LABELS.view).toBe('Görüntüle');
    expect(ACTION_LABELS.create).toBe('Oluştur');
    expect(ACTION_LABELS.edit).toBe('Düzenle');
    expect(ACTION_LABELS.delete).toBe('Sil');
    expect(ACTION_LABELS.approve).toBe('Onayla');
  });
});

describe('CATEGORY_LABELS', () => {
  it('has Turkish labels for core categories', () => {
    expect(CATEGORY_LABELS.leads).toBe('Başvurular');
    expect(CATEGORY_LABELS.projects).toBe('Projeler');
    expect(CATEGORY_LABELS.social_media).toBe('Sosyal Medya');
    expect(CATEGORY_LABELS.users).toBe('Kullanıcılar');
  });
});

describe('PERMISSION_CATEGORY_ORDER', () => {
  it('starts with leads and projects', () => {
    expect(PERMISSION_CATEGORY_ORDER[0]).toBe('leads');
    expect(PERMISSION_CATEGORY_ORDER[1]).toBe('projects');
  });

  it('has no duplicates', () => {
    const set = new Set(PERMISSION_CATEGORY_ORDER);
    expect(set.size).toBe(PERMISSION_CATEGORY_ORDER.length);
  });
});
