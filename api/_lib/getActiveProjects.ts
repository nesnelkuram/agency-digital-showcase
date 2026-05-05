import { getAdminDb } from './firebaseAdmin.js';

export interface ActiveProjectRef {
  id: string;
  name: string;
  clientName?: string;
  clientCompany?: string;
}

/**
 * Returns all non-completed/non-cancelled projects for a tenant.
 * Used to feed the AI classifier so it can map a task to the right brand.
 *
 * Cached for 60s per tenant to avoid hammering Firestore on every task analysis.
 */
const cache = new Map<string, { data: ActiveProjectRef[]; expiresAt: number }>();
const TTL_MS = 60_000;

export async function getActiveProjects(tenantId: string): Promise<ActiveProjectRef[]> {
  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const db = getAdminDb();
  const snap = await db
    .collection('projects')
    .where('tenantId', '==', tenantId)
    .where('status', 'in', ['active', 'paused'])
    .get();

  const data: ActiveProjectRef[] = snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      name: v.name || 'İsimsiz Proje',
      clientName: v.clientName,
      clientCompany: v.clientCompany,
    };
  });

  cache.set(tenantId, { data, expiresAt: Date.now() + TTL_MS });
  return data;
}

/** Render a compact list AI can read (one line per project). */
export function formatProjectsForPrompt(projects: ActiveProjectRef[]): string {
  if (projects.length === 0) return '(Aktif proje yok)';
  return projects
    .map((p) => {
      const client = p.clientCompany || p.clientName;
      return `- id="${p.id}" · "${p.name}"${client ? ` (müşteri: ${client})` : ''}`;
    })
    .join('\n');
}
