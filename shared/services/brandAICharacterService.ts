import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { BrandLead } from '@/shared/types/brandLead';
import type { Project } from '@/shared/types/project';
import type { BrandAICharacter } from '@/shared/types/brandAICharacter';
import { buildBrandCharacterPure } from './brandAICharacterBuilder';

export function buildBrandCharacter(lead: BrandLead, projectId?: string): BrandAICharacter {
  return buildBrandCharacterPure(lead, lead.id, projectId);
}

export async function getBrandCharacterForProject(project: Project): Promise<BrandAICharacter | null> {
  if (!db || !project.leadId) return null;
  try {
    const leadDoc = await getDoc(doc(db, 'brand_leads', project.leadId));
    if (!leadDoc.exists()) return null;
    return buildBrandCharacterPure(leadDoc.data(), leadDoc.id, project.id);
  } catch (err) {
    console.warn('[brandAICharacterService] Failed to load brand lead:', err);
    return null;
  }
}

export { buildBrandCharacterPure };
