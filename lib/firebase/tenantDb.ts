import {
  collection, query, where, addDoc, QueryConstraint, DocumentData,
} from 'firebase/firestore';
import { db } from './config';

/**
 * Returns a query with tenantId filter prepended.
 * Usage: tenantQuery('marketing_campaigns', tenantId, where('status', '==', 'active'))
 */
export function tenantQuery(
  collectionName: string,
  tenantId: string,
  ...constraints: QueryConstraint[]
) {
  if (!db) throw new Error('Firebase not initialized');
  if (!tenantId) throw new Error('tenantId is required for tenant-scoped queries');
  return query(
    collection(db, collectionName),
    where('tenantId', '==', tenantId),
    ...constraints
  );
}

/**
 * Adds tenantId field to a data object.
 */
export function withTenantId<T extends Record<string, any>>(
  data: T,
  tenantId: string
): T & { tenantId: string } {
  if (!tenantId) throw new Error('tenantId is required');
  return { ...data, tenantId };
}

/**
 * Creates a document with tenantId automatically added.
 */
export async function tenantAddDoc(
  collectionName: string,
  tenantId: string,
  data: DocumentData
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');
  if (!tenantId) throw new Error('tenantId is required');
  const docRef = await addDoc(collection(db, collectionName), { ...data, tenantId });
  return docRef.id;
}

/**
 * Collections that are exempt from tenant scoping.
 */
export const GLOBAL_COLLECTIONS = new Set(['tenants']);
