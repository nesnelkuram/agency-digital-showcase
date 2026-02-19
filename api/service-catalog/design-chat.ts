import type { VercelResponse } from '@vercel/node';
import { getAdminDb, getFieldValue } from '../_lib/firebaseAdmin.js';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { generateJSON } from '../_lib/gemini-bundle.mjs';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';

export const config = {
  maxDuration: 60,
};

// Build live rates string from Firestore data
async function buildLiveRatesContext(db: FirebaseFirestore.Firestore): Promise<string> {
  const [staffSnap, equipmentSnap] = await Promise.all([
    db.collection('pricing').doc('data').collection('staff').get(),
    db.collection('pricing').doc('data').collection('equipment').get(),
  ]);

  const parts: string[] = ['## Canli Maliyet Oranlari (Firestore\'dan)'];

  // Staff rates by role
  const roleRates: Record<string, { total: number; count: number; names: string[] }> = {};
  parts.push('\n### Personel Ucretleri');

  for (const doc of staffSnap.docs) {
    const s = doc.data();
    if (!s.isActive) continue;

    const role = s.role || 'junior';
    const hourly = s.hourlyRate || 0;
    const daily = s.dailyRate || 0;
    const freelancerHourly = s.freelancerHourlyRate || 0;

    if (role === 'freelancer' && freelancerHourly > 0) {
      parts.push(`- ${s.name} (freelancer): ${freelancerHourly} TL/saat`);
    } else if (hourly > 0 || daily > 0) {
      parts.push(`- ${s.name} (${role}): ${hourly.toFixed(0)} TL/saat, ${daily.toFixed(0)} TL/gun`);
    }

    if (!roleRates[role]) roleRates[role] = { total: 0, count: 0, names: [] };
    roleRates[role].total += hourly || freelancerHourly || 0;
    roleRates[role].count += 1;
    roleRates[role].names.push(s.name);
  }

  parts.push('\n### Rol Bazli Ortalama Ucretler');
  for (const [role, data] of Object.entries(roleRates)) {
    if (data.count > 0) {
      const avgHourly = data.total / data.count;
      parts.push(`- ${role}: ~${avgHourly.toFixed(0)} TL/saat (~${(avgHourly * 8).toFixed(0)} TL/gun) [${data.count} kisi]`);
    }
  }

  // Equipment rates by category
  const catRates: Record<string, { total: number; count: number }> = {};
  parts.push('\n### Ekipman Gunluk Ucretleri');

  for (const doc of equipmentSnap.docs) {
    const e = doc.data();
    if (!e.isActive) continue;

    const daily = e.dailyRate || 0;
    const cat = e.category || 'other';

    if (daily > 0) {
      parts.push(`- ${e.name} (${cat}): ${daily.toFixed(0)} TL/gun`);
    }

    if (!catRates[cat]) catRates[cat] = { total: 0, count: 0 };
    catRates[cat].total += daily;
    catRates[cat].count += 1;
  }

  parts.push('\n### Kategori Bazli Ortalama Ekipman Ucretleri');
  for (const [cat, data] of Object.entries(catRates)) {
    if (data.count > 0) {
      parts.push(`- ${cat}: ~${(data.total / data.count).toFixed(0)} TL/gun [${data.count} ekipman]`);
    }
  }

  // Overhead
  parts.push('\n### Genel Gider');
  parts.push('- Genel gider (overhead) maliyet referansi icin allocationType kullan: per_month, per_day, per_hour, fixed');
  parts.push('- Sistem otomatik olarak non-freelancer calisma saatlerine gore overhead ekler');

  return parts.join('\n');
}

const BASE_SYSTEM_PROMPT = `Sen dijital ajans hizmet sablonu tasarlama uzmanisin. Kullanici ile Turkce konusarak ServiceTemplate sablonlari olusturuyorsun.

## Gorev
Kullanicinin isteklerine gore hizmet (servis) sablonu tasarla. Her yanitinda:
1. Kisa ve net bir aciklama yaz (Turkce)
2. Guncellenmis tam draft'i JSON olarak don

## ServiceTemplate Yapisi
Bir ServiceTemplate su bilgileri icerir:
- name: Servis adi (ornek: "Reels Paketi")
- description: Detayli aciklama
- shortDescription: Katalog karti icin kisa aciklama
- category: Hizmet kategorisi (video_production, photography, social_media, digital_marketing, event_coverage, brand_strategy, graphic_design, drone_shooting, scriptwriting, ecommerce_content)
- subType: Alt tur (opsiyonel)
- tags: Arama etiketleri dizisi
- components: Servis bilesenleri (asagida aciklanir)
- minimumPrice: Minimum satis fiyati (TL)
- defaultMargin: Kar marji (0.30 = %30)
- complexityMultiplier: Karmasiklik carpani (1.0 = standart)
- allowQuickQuote: Hizli teklif butonu goster (true/false)
- quickQuoteDefaults: { quantity: 1 }
- icon: Lucide ikon adi (ornek: "Video", "Camera", "Instagram")
- isActive: true
- sortOrder: Siralama (1, 2, 3...)
- version: 1

## ServiceComponent (Servis Bileseni)
Her bilesen icin:
- id: Benzersiz id (ornek: "comp_1", "comp_2")
- name: Bilesen adi (ornek: "Cekim Gunu", "Reels Kurgu")
- description: Kisa aciklama
- type: "fixed" (sabit), "per_unit" (birim bazli), "tiered" (kademe bazli)
- costRefs: Maliyet kaynaklari dizisi (asagida aciklanir)
- unitLabel: Birim etiketi ("Reels", "Dakika", "Post", "Gun") - per_unit ve tiered icin
- baseQuantity: Varsayilan miktar - per_unit ve tiered icin
- isOptional: Opsiyonel mi? (true/false)
- isEditable: Miktar degistirilebilir mi? (true/false)
- sortOrder: Siralama

## CostRef Tipleri (Maliyet Kaynaklari)

### Staff (Personel)
{ source: "staff", roleType: "junior"|"senior"|"owner"|"freelancer", timeUnit: "hours"|"days"|"deliverable", timeAmount: sayi }

### Equipment (Ekipman)
{ source: "equipment", category: "camera"|"lens"|"lighting"|"audio"|"computer"|"drone"|"accessory"|"other", days: sayi }

### Overhead (Genel Gider)
{ source: "overhead", allocationType: "per_month"|"per_day"|"per_hour"|"fixed", amount: sayi (fixed icin) }

### Manual (Manuel Maliyet)
{ source: "manual", amount: sayi (TL), description: "aciklama", isDeductible: true|false }

## Kurallar
- Her yanitinda TAM draft'i don (incremental degil)
- Component id'leri benzersiz olmali
- CostRef'lerde yukaridaki canli maliyet oranlarini referans al
- Makul sure ve maliyet tahminleri yap
- minimumPrice'i toplam maliyetin uzerinde tut
- defaultMargin genellikle 0.30-0.50 arasi
- complexityMultiplier standart isler icin 1.0, karmasik isler icin 1.2-1.5
- tags ile aranabilirlik sagla
- Bilesenleri mantikli grupla (orn: cekim + kurgu + teslimat)`;

interface DesignResponse {
  reply: string;
  draft: {
    name: string;
    description: string;
    shortDescription?: string;
    category: string;
    subType?: string;
    tags?: string[];
    components: any[];
    minimumPrice?: number;
    defaultMargin: number;
    complexityMultiplier: number;
    allowQuickQuote: boolean;
    quickQuoteDefaults?: { quantity: number };
    icon?: string;
    isActive: boolean;
    sortOrder: number;
    version: number;
  } | null;
  suggestedActions?: string[];
}

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, message } = req.body || {};

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, message' });
    }

    // Load session from Firestore
    const db = getAdminDb();
    const sessionDoc = await db.collection('service_design_sessions').doc(sessionId).get();

    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionData = sessionDoc.data()!;

    // Verify tenant
    if (sessionData.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const history = sessionData.messages || [];
    const currentDraft = sessionData.currentDraft || null;

    // Build live rates context from Firestore
    const liveRatesContext = await buildLiveRatesContext(db);

    // Build conversation for Gemini
    const conversationParts: string[] = [BASE_SYSTEM_PROMPT, '', liveRatesContext, ''];

    if (currentDraft) {
      conversationParts.push('## Mevcut Draft');
      conversationParts.push('```json');
      conversationParts.push(JSON.stringify(currentDraft, null, 2));
      conversationParts.push('```');
      conversationParts.push('');
    }

    // Add conversation history (last 20 messages)
    const recentHistory = history.slice(-20);
    if (recentHistory.length > 0) {
      conversationParts.push('## Konusma Gecmisi');
      for (const msg of recentHistory) {
        conversationParts.push(`${msg.role === 'user' ? 'Kullanici' : 'Asistan'}: ${msg.content}`);
      }
      conversationParts.push('');
    }

    conversationParts.push(`## Kullanicinin Son Mesaji`);
    conversationParts.push(message);
    conversationParts.push('');
    conversationParts.push(`## Yanit Formati
Yanitini asagidaki JSON formatinda don:
{
  "reply": "Kullaniciya Turkce aciklama mesaji",
  "draft": { ... tam ServiceTemplate objesi ... } veya null (eger henuz draft olusturulmadiysa),
  "suggestedActions": ["Oneri 1", "Oneri 2"] (opsiyonel, kullaniciya sonraki adimlar icin oneriler)
}

ONEMLI: Sadece gecerli JSON don. Baska bir sey yazma.`);

    const prompt = conversationParts.join('\n');

    // Call Gemini via pre-bundled client
    const result = await generateJSON<DesignResponse>(
      'flash',
      prompt,
      'service-designer',
      { maxOutputTokens: 8192, temperature: 0.7 }
    );

    const reply = result.reply || 'Anlayamadim, lutfen tekrar deneyin.';
    const draft = result.draft || null;
    const suggestedActions = result.suggestedActions || null;

    // Save messages + updated draft to Firestore
    const userMsg = { role: 'user' as const, content: message, timestamp: Date.now() };
    const assistantMsg = {
      role: 'assistant' as const,
      content: reply,
      timestamp: Date.now(),
      hasDraft: !!draft,
    };

    const FieldValue = getFieldValue();
    const updateData: Record<string, any> = {
      messages: FieldValue.arrayUnion(userMsg, assistantMsg),
      updatedAt: Date.now(),
    };

    if (draft) {
      updateData.currentDraft = draft;
    }

    await db.collection('service_design_sessions').doc(sessionId).update(updateData);

    return res.status(200).json({ reply, draft, suggestedActions });
  } catch (error: any) {
    console.error('service-catalog/design-chat error:', error);
    return res.status(500).json({
      error: String(error?.message || 'Design chat failed'),
    });
  }
});
