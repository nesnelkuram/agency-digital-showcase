import { describe, it, expect, beforeEach } from 'vitest';
import {
  listInviteTemplates,
  saveInviteTemplate,
  deleteInviteTemplate,
} from '@/shared/constants/inviteTemplates';

describe('inviteTemplates (localStorage)', () => {
  const USER_UID = 'user-test';

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns empty array for new user', () => {
    expect(listInviteTemplates(USER_UID)).toEqual([]);
  });

  it('saves and retrieves a template', () => {
    const saved = saveInviteTemplate(USER_UID, {
      name: 'Video Editörü',
      role: 'editor',
      extraFields: { skills: ['video', 'motion'], department: 'Kreatif' },
    });
    expect(saved.id).toBeTruthy();
    expect(saved.createdAt).toBeGreaterThan(0);

    const list = listInviteTemplates(USER_UID);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Video Editörü');
    expect(list[0].role).toBe('editor');
    expect(list[0].extraFields.skills).toEqual(['video', 'motion']);
  });

  it('sorts templates by createdAt desc (newest first)', async () => {
    saveInviteTemplate(USER_UID, { name: 'A', role: 'editor', extraFields: {} });
    await new Promise((r) => setTimeout(r, 5));
    saveInviteTemplate(USER_UID, { name: 'B', role: 'editor', extraFields: {} });
    await new Promise((r) => setTimeout(r, 5));
    saveInviteTemplate(USER_UID, { name: 'C', role: 'editor', extraFields: {} });

    const list = listInviteTemplates(USER_UID);
    expect(list.map((t) => t.name)).toEqual(['C', 'B', 'A']);
  });

  it('caps at 20 templates (keeps most recent)', async () => {
    for (let i = 0; i < 25; i++) {
      saveInviteTemplate(USER_UID, { name: `Tpl ${i}`, role: 'editor', extraFields: {} });
      await new Promise((r) => setTimeout(r, 1));
    }
    const list = listInviteTemplates(USER_UID);
    expect(list).toHaveLength(20);
    expect(list[0].name).toBe('Tpl 24'); // en yeni
  });

  it('isolates templates between users', () => {
    saveInviteTemplate('user-a', { name: 'A', role: 'editor', extraFields: {} });
    saveInviteTemplate('user-b', { name: 'B', role: 'client', extraFields: {} });

    const a = listInviteTemplates('user-a');
    const b = listInviteTemplates('user-b');
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].name).toBe('A');
    expect(b[0].name).toBe('B');
  });

  it('deletes a template by id', () => {
    const s1 = saveInviteTemplate(USER_UID, { name: 'X', role: 'editor', extraFields: {} });
    const s2 = saveInviteTemplate(USER_UID, { name: 'Y', role: 'editor', extraFields: {} });

    expect(listInviteTemplates(USER_UID)).toHaveLength(2);

    deleteInviteTemplate(USER_UID, s1.id);
    const list = listInviteTemplates(USER_UID);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(s2.id);
  });

  it('gracefully handles malformed localStorage data', () => {
    window.localStorage.setItem('intiba:invite-templates:' + USER_UID, 'not-json');
    expect(listInviteTemplates(USER_UID)).toEqual([]);
  });
});
