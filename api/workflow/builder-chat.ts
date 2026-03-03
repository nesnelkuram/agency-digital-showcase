import type { VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { generateJSON, safeParseJSON } from '../_lib/gemini-bundle.mjs';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';

export const config = {
  maxDuration: 60,
};

const SYSTEM_PROMPT = `Sen workflow builder asistanısın. Kullanıcıyla Türkçe konuş.
Mevcut canvas durumunu alıyorsun. Kullanıcının isteklerine göre:
- Düğüm ekle/çıkar/düzenle
- Bağlantı (edge) ekle/çıkar
- Pozisyonları ayarla
- Renk/not/kilit ekle

## Node Tipleri
- start: Süreç başlangıcı (her workflow'da 1 tane)
- task: Manuel görev
- ai_task: AI tarafından otomatik yapılan görev
- review: İnceleme adımı
- approval: Onay adımı
- milestone: Kilometre taşı
- condition: Koşullu dallanma
- notification: Bildirim gönderme
- subprocess: Alt süreç
- end: Süreç sonu (her workflow'da 1 tane)

## Edge Tipleri
- default: Normal akış
- conditional_true: Koşul doğru ise
- conditional_false: Koşul yanlış ise
- rejection: Red durumu
- escalation: Üst kademeye iletme

## Yerleşim Kuralları — Yılan (Serpentine) Düzen
Süreçler YATAY ve DOĞRUSAL ilerler. Soldan sağa akan, her 3 düğümde bir alt satıra inen yılan düzeni kullan.

### Konum Hesaplama
- X aralığı: 280px (düğümler arası yatay mesafe)
- Y aralığı: 150px (satırlar arası dikey mesafe)
- Başlangıç: x=100, y=80
- Her satırda MAKS 3 düğüm
- Tek satırlar (0, 2, 4...): soldan sağa → x = 100, 380, 660
- Çift satırlar (1, 3, 5...): sağdan sola → x = 660, 380, 100

Örnek 7 düğümlük yerleşim:
  Satır 0: node_1(100,80) → node_2(380,80) → node_3(660,80)
  Satır 1: node_4(660,230) ← node_5(380,230) ← node_6(100,230)  [sağdan sola]
  Satır 2: node_7(100,380)

### Bağlantı (Handle) Kuralları
Her düğümün 4 bağlantı noktası: "top", "bottom", "left", "right".
Her düğüme TAM 1 giriş ve 1 çıkış bağlantısı olmalı (start hariç giriş yok, end hariç çıkış yok).

Aynı satırda soldan sağa ilerlerken:
- sourceHandle: "right", targetHandle: "left"

Aynı satırda sağdan sola ilerlerken (çift satırlar):
- sourceHandle: "left", targetHandle: "right"

Satır sonunda alt satıra inerken:
- Tek satır sonu (sağdaki düğüm → alt satır sağdaki düğüm): sourceHandle: "bottom", targetHandle: "top"
- Çift satır sonu (soldaki düğüm → alt satır soldaki düğüm): sourceHandle: "bottom", targetHandle: "top"

ÖNEMLİ: Her düğüme yalnızca BİR edge girer, BİR edge çıkar. Çoklu bağlantı YASAK.

## assigneeRole Değerleri
creative_director, videographer, editor, designer, social_media_manager, project_manager, client, admin

## Edge JSON Yapısı
{ "id": "edge_1", "source": "node_1", "target": "node_2", "type": "default", "sourceHandle": "right", "targetHandle": "left" }

## Kurallar
- Node ID format: node_1, node_2, ... (yeni eklenenler mevcut max'ın üstünde numaralanmalı)
- Edge ID format: edge_1, edge_2, ...
- Eğer canvas değişikliği gerekiyorsa canvasState'te TAM yeni durumu dön (tüm node ve edge'ler)
- Eğer sadece soru-cevap ise canvasState: null dön
- Her zaman changesSummary alanında yaptığın değişikliklerin kısa özetini ver (ör: "2 düğüm eklendi, 1 bağlantı kuruldu")
- Mevcut node'ları düzenlerken ID'lerini koru, sadece gerekli alanları değiştir
- Silme işleminde silinen node'a bağlı tüm edge'leri de kaldır
- Edge oluştururken sourceHandle ve targetHandle alanlarını MUTLAKA belirt`;

interface BuilderChatResponse {
  reply: string;
  canvasState: {
    nodes: Array<{
      id: string;
      type: string;
      label: string;
      description?: string;
      position: { x: number; y: number };
      assigneeRole?: string;
      estimatedDurationHours?: number;
      colorOverride?: string;
      notes?: string;
      locked?: boolean;
      subprocessConfig?: { childTemplateId?: string; childTemplateName?: string };
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      type?: string;
      label?: string;
      sourceHandle?: string;
      targetHandle?: string;
    }>;
  } | null;
  changesSummary?: string;
}

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(res, req.userUid, LIMITS.AI_BUILDER_CHAT)) return;

  try {
    const { sessionId, message, canvasSnapshot } = req.body || {};

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, message' });
    }

    const db = getAdminDb();

    // Load session
    const sessionDoc = await db.collection('workflow_builder_chat_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionData = sessionDoc.data()!;
    if (sessionData.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const history = sessionData.messages || [];

    // Build prompt
    const parts: string[] = [SYSTEM_PROMPT, ''];

    if (canvasSnapshot) {
      parts.push('## Mevcut Canvas Durumu');
      parts.push('```json');
      parts.push(JSON.stringify(canvasSnapshot, null, 2));
      parts.push('```');
      parts.push('');
    }

    const recentHistory = history.slice(-20);
    if (recentHistory.length > 0) {
      parts.push('## Konuşma Geçmişi');
      for (const msg of recentHistory) {
        parts.push(`${msg.role === 'user' ? 'Kullanıcı' : 'Asistan'}: ${msg.content}`);
      }
      parts.push('');
    }

    parts.push('## Kullanıcının Son Mesajı');
    parts.push(message);
    parts.push('');
    parts.push(`## Yanıt Formatı
Yanıtını aşağıdaki JSON formatında dön:
{
  "reply": "Kullanıcıya Türkçe açıklama",
  "canvasState": { "nodes": [...], "edges": [...] } veya null,
  "changesSummary": "Yapılan değişikliklerin kısa özeti" veya null
}

ÖNEMLİ:
- Sadece geçerli JSON dön. Başka bir şey yazma.
- "reply" alanını KISA tut (1-3 cümle). Detayları changesSummary'de ver.
- Token sınırı var, önceliğin canvasState'in TAM ve GECERLI JSON olması.`);

    const prompt = parts.join('\n');

    let reply: string;
    let canvasState: BuilderChatResponse['canvasState'] = null;
    let changesSummary: string | null = null;

    try {
      const result = await generateJSON<BuilderChatResponse>(
        'flash',
        prompt,
        'workflow-builder-chat',
        { maxOutputTokens: 32768, temperature: 0.7 }
      );
      reply = result.reply || 'Anlayamadım, lütfen tekrar deneyin.';
      canvasState = result.canvasState || null;
      changesSummary = result.changesSummary || null;
    } catch (parseErr: any) {
      // Truncated JSON recovery — try to extract at least the reply text
      const raw = String(parseErr?.message || '');
      const truncatedMatch = raw.match(/returned invalid JSON:\s*(.+)/s);
      if (truncatedMatch) {
        const partial = truncatedMatch[1];
        // Try to extract "reply" field from truncated JSON
        const replyMatch = partial.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (replyMatch) {
          reply = replyMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
          reply += '\n\n_(Yanit cok uzun oldugu icin canvas degisiklikleri uygulanamadi. Daha kucuk adimlarla deneyin.)_';
          changesSummary = null;
          canvasState = null;
        } else {
          reply = 'Yanit islenirken hata olustu. Lutfen daha kisa bir istek deneyin veya adim adim ilerleyin.';
        }
      } else {
        throw parseErr;
      }
    }

    // Save messages to session
    const userMsg = { role: 'user' as const, content: message, timestamp: Date.now() };
    const assistantMsg: Record<string, any> = {
      role: 'assistant',
      content: reply,
      timestamp: Date.now(),
      canvasApplied: !!canvasState,
    };
    if (changesSummary) {
      assistantMsg.changesSummary = changesSummary;
    }

    const updateData: Record<string, any> = {
      messages: [...history, userMsg, assistantMsg],
      updatedAt: Date.now(),
    };

    if (!sessionData.title) {
      updateData.title = String(message).slice(0, 60);
    }

    if (canvasState) {
      updateData.lastCanvasSnapshot = canvasState;
    }

    await db.collection('workflow_builder_chat_sessions').doc(sessionId).update(updateData);

    return res.status(200).json({
      reply,
      canvasState,
      changesSummary,
    });
  } catch (error: any) {
    console.error('workflow/builder-chat error:', error);
    return res.status(500).json({
      error: String(error?.message || 'Builder chat failed'),
    });
  }
});
