import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { checkProjectAccess } from '../_lib/projectAccess.js';
import { PERMISSIONS } from '../../lib/rbac/permissions.js';
import { buildBrandCharacterPure } from '../../shared/services/brandAICharacterBuilder.js';

/**
 * Studio — Marka Kiti (salt okunur).
 * Marka yöneticisi başvuru (brand_leads) kaydını doğrudan okuyamaz; yalnızca atanmış projenin
 * marka sesi ve kimlik özetini buradan alır. İletişim, fiyat ve iç notlar dönmez.
 *
 * GET ?projectId=...
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const projectId = req.query.projectId;
    const access = await checkProjectAccess(req, projectId, PERMISSIONS.BRAND_KIT_VIEW);
    if (!access.ok) return res.status(access.httpStatus).json({ error: access.error });
    const project = access.project;

    let character: ReturnType<typeof buildBrandCharacterPure> | null = null;
    if (typeof project.leadId === 'string' && project.leadId) {
      const leadDoc = await getAdminDb().collection('brand_leads').doc(project.leadId).get();
      const lead = leadDoc.exists ? leadDoc.data() : null;
      if (lead && lead.tenantId === req.tenantId) character = buildBrandCharacterPure(lead, leadDoc.id, projectId as string);
    }

    return res.status(200).json({
      project: {
        id: projectId,
        name: project.name || '',
        description: project.description || '',
        clientName: project.clientName || '',
        clientEmail: project.clientEmail || '',
      },
      brand: character
        ? {
            brandName: character.brandName,
            voiceSummary: character.voiceSummary,
            hasAnalysis: character.hasAnalysis,
            sourceFields: character.sourceFields,
          }
        : null,
    });
  } catch (error: any) {
    console.error('studio/brand-kit error:', error);
    return res.status(500).json({ error: 'Marka kiti yüklenemedi' });
  }
});
