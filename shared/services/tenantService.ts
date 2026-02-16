import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Tenant, TenantStatus, CreateTenantData } from '@/shared/types/tenant';

const COLLECTION_NAME = 'tenants';

function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Timestamp) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        result[key] = stripUndefined(val);
      }
    }
    return result;
  }
  return obj;
}

// ============================================
// BASIC CRUD OPERATIONS
// ============================================

/**
 * Get a single tenant by ID
 */
export async function getTenant(tenantId: string): Promise<Tenant | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, tenantId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as Tenant;
}

/**
 * Get all tenants (super_admin only)
 */
export async function getAllTenants(): Promise<Tenant[]> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(collection(db, COLLECTION_NAME), orderBy('metadata.createdAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Tenant[];
}

/**
 * Create a new tenant
 */
export async function createTenant(
  data: CreateTenantData,
  createdBy: string = 'system'
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const now = Timestamp.now();

  // Generate a unique tenant ID from slug
  const tenantId = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // Check if tenant with this slug already exists
  const existing = await getTenant(tenantId);
  if (existing) {
    throw new Error(`Tenant with slug "${data.slug}" already exists`);
  }

  // Build default settings
  const defaultSettings = {
    maxUsers: 10,
    allowedFeatures: ['projects', 'campaigns'],
    timezone: 'Europe/Istanbul',
    currency: 'TRY',
    ...data.settings,
  };

  const tenantData: Omit<Tenant, 'id'> = {
    name: data.name,
    slug: data.slug,
    status: 'trial',
    settings: defaultSettings,
    metadata: {
      createdAt: now,
      updatedAt: now,
      createdBy,
    },
  };

  const docRef = doc(db, COLLECTION_NAME, tenantId);
  await setDoc(docRef, stripUndefined(tenantData));

  return tenantId;
}

/**
 * Update tenant data
 */
export async function updateTenant(
  tenantId: string,
  data: Partial<Tenant>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, tenantId);

  // Verify tenant exists
  const existing = await getTenant(tenantId);
  if (!existing) {
    throw new Error('Tenant not found');
  }

  // Don't allow updating id, metadata.createdAt, or metadata.createdBy
  const { id, metadata, ...updateData } = data;

  await updateDoc(docRef, {
    ...stripUndefined(updateData),
    'metadata.updatedAt': serverTimestamp(),
  });
}

/**
 * Update tenant status
 */
export async function updateTenantStatus(
  tenantId: string,
  status: TenantStatus
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, tenantId);

  // Verify tenant exists
  const existing = await getTenant(tenantId);
  if (!existing) {
    throw new Error('Tenant not found');
  }

  await updateDoc(docRef, {
    status,
    'metadata.updatedAt': serverTimestamp(),
  });
}

/**
 * Delete a tenant (soft delete by setting status to suspended, or hard delete)
 */
export async function deleteTenant(tenantId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  // Verify tenant exists
  const existing = await getTenant(tenantId);
  if (!existing) {
    throw new Error('Tenant not found');
  }

  // Hard delete - remove the document
  await deleteDoc(doc(db, COLLECTION_NAME, tenantId));
}

// ============================================
// TENANT STATISTICS
// ============================================

/**
 * Get basic stats for a tenant (user count, project count)
 */
export async function getTenantStats(
  tenantId: string
): Promise<{ users: number; projects: number }> {
  if (!db) throw new Error('Firebase not initialized');

  // Verify tenant exists
  const existing = await getTenant(tenantId);
  if (!existing) {
    throw new Error('Tenant not found');
  }

  // Count users for this tenant
  const usersQuery = query(
    collection(db, 'users'),
    where('tenantId', '==', tenantId)
  );
  const usersSnapshot = await getDocs(usersQuery);
  const userCount = usersSnapshot.size;

  // Count projects for this tenant
  const projectsQuery = query(
    collection(db, 'projects'),
    where('tenantId', '==', tenantId)
  );
  const projectsSnapshot = await getDocs(projectsQuery);
  const projectCount = projectsSnapshot.size;

  return {
    users: userCount,
    projects: projectCount,
  };
}
