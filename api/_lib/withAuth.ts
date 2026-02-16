import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================
// Types
// ============================================

export interface AuthenticatedRequest extends VercelRequest {
  userId: string;
  tenantId: string;
  userRole: string;
}

export interface OptionalAuthRequest extends VercelRequest {
  userId?: string;
  tenantId?: string;
  userRole?: string;
}

type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: VercelResponse
) => Promise<VercelResponse | void>;

type OptionalAuthHandler = (
  req: OptionalAuthRequest,
  res: VercelResponse
) => Promise<VercelResponse | void>;

// ============================================
// Token extraction helper
// ============================================

function extractBearerToken(req: VercelRequest): string | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim() || null;
}

// ============================================
// User lookup helper (lazy-loads firebase-admin)
// ============================================

interface UserRecord {
  tenantId: string;
  role: string;
  status?: string;
}

async function verifyTokenAndGetUid(token: string): Promise<string> {
  const { getAdminDb } = await import('./firebaseAdmin');
  // Ensure firebase-admin app is initialized
  getAdminDb();
  const { getAuth } = await import('firebase-admin/auth');
  const decoded = await getAuth().verifyIdToken(token);
  return decoded.uid;
}

async function lookupUser(uid: string): Promise<UserRecord | null> {
  try {
    const { getAdminDb } = await import('./firebaseAdmin');
    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return null;
    }
    const data = userDoc.data()!;
    return {
      tenantId: data.tenantId || '',
      role: data.role || 'member',
      status: data.status || 'active',
    };
  } catch {
    return null;
  }
}

// ============================================
// withAuth — requires valid Firebase token
// ============================================

export function withAuth(handler: AuthenticatedHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    try {
      const uid = await verifyTokenAndGetUid(token);

      // Look up user document in Firestore
      const userRecord = await lookupUser(uid);
      if (!userRecord) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (userRecord.status === 'suspended') {
        return res.status(403).json({ error: 'User account is suspended' });
      }

      // Attach auth info to request
      const authReq = req as AuthenticatedRequest;
      authReq.userId = uid;
      authReq.tenantId = userRecord.tenantId;
      authReq.userRole = userRecord.role;

      return await handler(authReq, res);
    } catch (err: any) {
      console.error('[withAuth] Error:', err.message);
      if (res.headersSent) return;
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

// ============================================
// withAuthOptional — auth is optional
// ============================================

export function withAuthOptional(handler: OptionalAuthHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const token = extractBearerToken(req);
    const optReq = req as OptionalAuthRequest;

    if (token) {
      try {
        const uid = await verifyTokenAndGetUid(token);
        const userRecord = await lookupUser(uid);
        if (userRecord && userRecord.status !== 'suspended') {
          optReq.userId = uid;
          optReq.tenantId = userRecord.tenantId;
          optReq.userRole = userRecord.role;
        }
      } catch {
        // Token invalid — proceed as unauthenticated
      }
    }

    return handler(optReq, res);
  };
}
