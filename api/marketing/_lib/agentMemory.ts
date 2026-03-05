/**
 * Server-side Agent Memory — for API routes (uses Admin SDK)
 *
 * 1. Load memories → inject into system prompt
 * 2. Extract facts from conversation → save to Firestore
 */

import type { ExtractedFact, MemoryCategory, AgentMemory } from '../../../shared/types/agentMemory.js';

const COLLECTION = 'agent_memories';

// ============================================
// Load memories for prompt injection
// ============================================

export async function loadMemoriesForPrompt(
  db: FirebaseFirestore.Firestore,
  tenantId: string
): Promise<string> {
  const snap = await db
    .collection(COLLECTION)
    .where('tenantId', '==', tenantId)
    .where('isActive', '==', true)
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .get();

  if (snap.empty) return '';

  const memories = snap.docs.map(d => d.data() as AgentMemory);

  // Group by category
  const grouped = new Map<MemoryCategory, string[]>();
  for (const m of memories) {
    if (!grouped.has(m.category)) grouped.set(m.category, []);
    grouped.get(m.category)!.push(m.fact);
  }

  const labels: Record<string, string> = {
    brand: 'Marka Bilgileri',
    audience: 'Hedef Kitle',
    preference: 'Kullanici Tercihleri',
    campaign: 'Kampanya Notlari',
    budget: 'Butce Bilgileri',
    competitor: 'Rakip Bilgileri',
    platform: 'Platform Notlari',
    general: 'Genel Bilgiler',
  };

  let section = '\n\n## Hafiza — Onceki Konusmalardan Ogrenilenler\n';
  section += 'Bu bilgileri konusmada goz onunde bulundur, ama kullaniciya direkt tekrarlama.\n';

  for (const [cat, facts] of grouped) {
    section += `\n### ${labels[cat] || cat}\n`;
    for (const fact of facts) {
      section += `- ${fact}\n`;
    }
  }

  return section;
}

// ============================================
// Extract facts from conversation
// ============================================

const EXTRACTION_PROMPT = `Asagidaki konusmadan kalici bilgileri cikar. Sadece gercek, tekrar kullanilabilir bilgileri al.
Kisa ve oz yaz. Zaten bilinen veya cok genel bilgileri ATLA.

Kategoriler: brand, audience, preference, campaign, budget, competitor, platform, general

JSON array olarak don:
[{"category": "brand", "fact": "Marka adi: XYZ", "confidence": 0.9}]

Eger cikarilacak bir sey yoksa bos array don: []

Konusma:
`;

export async function extractFactsFromConversation(
  aiGenerateJSON: (prompt: string) => Promise<any>,
  userMessage: string,
  assistantResponse: string
): Promise<ExtractedFact[]> {
  try {
    const conversation = `Kullanici: ${userMessage}\nAsistan: ${assistantResponse}`;
    const result = await aiGenerateJSON(EXTRACTION_PROMPT + conversation);

    if (!Array.isArray(result)) return [];

    return result
      .filter((f: any) => f.category && f.fact && f.confidence >= 0.6)
      .map((f: any) => ({
        category: f.category as MemoryCategory,
        fact: String(f.fact).slice(0, 500),
        confidence: Math.min(1, Math.max(0, Number(f.confidence))),
      }));
  } catch {
    // Extraction failure is non-critical — don't break the chat
    return [];
  }
}

// ============================================
// Save extracted facts (server-side)
// ============================================

export async function saveExtractedFacts(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  sessionId: string,
  facts: ExtractedFact[]
): Promise<number> {
  let saved = 0;

  for (const fact of facts) {
    if (fact.confidence < 0.6) continue;

    // Duplicate check
    const existing = await db
      .collection(COLLECTION)
      .where('tenantId', '==', tenantId)
      .where('category', '==', fact.category)
      .where('isActive', '==', true)
      .limit(30)
      .get();

    const isDuplicate = existing.docs.some(d => {
      const f = d.data().fact as string;
      return f.toLowerCase().includes(fact.fact.toLowerCase().slice(0, 40));
    });

    if (isDuplicate) continue;

    const now = Date.now();
    await db.collection(COLLECTION).add({
      tenantId,
      category: fact.category,
      fact: fact.fact,
      confidence: fact.confidence,
      source: 'extracted',
      sourceSessionId: sessionId,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });
    saved++;
  }

  return saved;
}
