/**
 * Agent Memory Service — CRUD + injection for persistent agent memories
 *
 * Firestore collection: agent_memories
 * Scoped by tenantId.
 */

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { AgentMemory, MemoryCategory, ExtractedFact } from '../types/agentMemory';

const COLLECTION = 'agent_memories';

// ============================================
// CRUD
// ============================================

export async function addMemory(
  tenantId: string,
  memory: Omit<AgentMemory, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'isActive'>
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...memory,
    tenantId,
    createdAt: now,
    updatedAt: now,
    isActive: true,
  });
  return ref.id;
}

export async function updateMemory(
  memoryId: string,
  updates: Partial<Pick<AgentMemory, 'fact' | 'category' | 'confidence' | 'isActive'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, memoryId), {
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function deactivateMemory(memoryId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, memoryId), {
    isActive: false,
    updatedAt: Date.now(),
  });
}

// ============================================
// Queries
// ============================================

export async function getActiveMemories(
  tenantId: string,
  category?: MemoryCategory
): Promise<AgentMemory[]> {
  const constraints = [
    where('tenantId', '==', tenantId),
    where('isActive', '==', true),
    orderBy('updatedAt', 'desc'),
    limit(100),
  ];

  if (category) {
    constraints.splice(2, 0, where('category', '==', category));
  }

  const q = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AgentMemory));
}

export function subscribeToMemories(
  tenantId: string,
  callback: (memories: AgentMemory[]) => void
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where('tenantId', '==', tenantId),
    where('isActive', '==', true),
    orderBy('updatedAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snap) => {
    const memories = snap.docs.map(d => ({ id: d.id, ...d.data() } as AgentMemory));
    callback(memories);
  });
}

// ============================================
// Bulk add extracted facts
// ============================================

export async function addExtractedFacts(
  tenantId: string,
  sessionId: string,
  facts: ExtractedFact[]
): Promise<string[]> {
  const ids: string[] = [];

  for (const fact of facts) {
    // Skip low confidence extractions
    if (fact.confidence < 0.6) continue;

    // Check for duplicates — same category + similar content
    const existing = await getDocs(
      query(
        collection(db, COLLECTION),
        where('tenantId', '==', tenantId),
        where('category', '==', fact.category),
        where('isActive', '==', true),
        limit(50)
      )
    );

    // Simple duplicate check: skip if fact text is very similar
    const isDuplicate = existing.docs.some(d => {
      const existingFact = d.data().fact as string;
      return existingFact.toLowerCase().includes(fact.fact.toLowerCase().slice(0, 40));
    });

    if (isDuplicate) continue;

    const id = await addMemory(tenantId, {
      category: fact.category,
      fact: fact.fact,
      confidence: fact.confidence,
      source: 'extracted',
      sourceSessionId: sessionId,
    });
    ids.push(id);
  }

  return ids;
}

// ============================================
// Format memories for system prompt injection
// ============================================

export function formatMemoriesForPrompt(memories: AgentMemory[]): string {
  if (memories.length === 0) return '';

  const grouped = new Map<MemoryCategory, string[]>();

  for (const m of memories) {
    if (!grouped.has(m.category)) {
      grouped.set(m.category, []);
    }
    grouped.get(m.category)!.push(m.fact);
  }

  const categoryLabels: Record<string, string> = {
    brand: 'Marka Bilgileri',
    audience: 'Hedef Kitle',
    preference: 'Kullanici Tercihleri',
    campaign: 'Kampanya Notlari',
    budget: 'Butce Bilgileri',
    competitor: 'Rakip Bilgileri',
    platform: 'Platform Notlari',
    general: 'Genel Bilgiler',
  };

  let prompt = '\n\n## Hafiza — Onceki Konusmalardan Ogrenilenler\n';

  for (const [category, facts] of grouped) {
    prompt += `\n### ${categoryLabels[category] || category}\n`;
    for (const fact of facts) {
      prompt += `- ${fact}\n`;
    }
  }

  return prompt;
}
