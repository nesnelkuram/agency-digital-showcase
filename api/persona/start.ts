import type { VercelResponse } from '@vercel/node';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { startChat } from '../_lib/persona-bundle.mjs';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { randomUUID } from 'crypto';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth';

export const config = {
  maxDuration: 10,
};

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { leadId, businessContext } = req.body || {};

    // If leadId provided, load business context from Firestore
    let resolvedContext = businessContext;
    if (leadId && !businessContext) {
      try {
        const db = getAdminDb();
        const leadDoc = await db.collection('brand_leads').doc(leadId).get();
        if (leadDoc.exists) {
          const data = leadDoc.data();
          resolvedContext = {
            businessName: data?.contact?.businessName || '',
            sector: data?.sector || '',
            description: data?.wizard?.businessContext?.businessDescription || '',
          };
        }
      } catch (err) {
        console.warn('persona/start: Could not load lead context:', err);
      }
    }

    const result = startChat(resolvedContext);

    // Create session in Firestore
    const sessionId = randomUUID();
    try {
      const db = getAdminDb();
      await db.collection('persona_sessions').doc(sessionId).set({
        id: sessionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        leadId: leadId || null,
        businessContext: resolvedContext || null,
        messages: [],
        articleRefsUsed: [],
      });
    } catch (err) {
      console.warn('persona/start: Could not create session in Firestore:', err);
    }

    return res.status(200).json({
      sessionId,
      suggestedQuestions: result.suggestedQuestions,
    });
  } catch (error: any) {
    console.error('persona/start error:', error);
    return res.status(500).json({
      error: String(error?.message || 'Failed to start persona chat'),
    });
  }
});
