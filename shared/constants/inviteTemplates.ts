import { UserRole, InvitationExtraFields } from '@/shared/types/user';

export interface InviteTemplate {
  id: string;
  name: string;
  role: UserRole;
  extraFields: InvitationExtraFields;
  createdAt: number;
}

const STORAGE_KEY_PREFIX = 'intiba:invite-templates:';

function storageKey(userUid: string): string {
  return `${STORAGE_KEY_PREFIX}${userUid}`;
}

function safeRead(userUid: string): InviteTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userUid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(userUid: string, templates: InviteTemplate[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userUid), JSON.stringify(templates));
  } catch {
    // Ignore quota exceeded
  }
}

export function listInviteTemplates(userUid: string): InviteTemplate[] {
  return safeRead(userUid).sort((a, b) => b.createdAt - a.createdAt);
}

export function saveInviteTemplate(
  userUid: string,
  template: Omit<InviteTemplate, 'id' | 'createdAt'>
): InviteTemplate {
  const existing = safeRead(userUid);
  const newTemplate: InviteTemplate = {
    ...template,
    id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  safeWrite(userUid, [newTemplate, ...existing].slice(0, 20));
  return newTemplate;
}

export function deleteInviteTemplate(userUid: string, templateId: string): void {
  const existing = safeRead(userUid);
  safeWrite(userUid, existing.filter((t) => t.id !== templateId));
}
