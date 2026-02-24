import type { VercelResponse } from '@vercel/node';
import { getAdminDb, getFieldValue } from '../_lib/firebaseAdmin.js';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { generateJSON } from '../_lib/gemini-bundle.mjs';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';

export const config = {
  maxDuration: 60,
};

const SYSTEM_PROMPT = `Sen dijital ajans iş süreci tasarlama uzmanısın. Kullanıcı ile Türkçe konuşarak workflow şablonları oluşturuyorsun.

## Görev
Kullanıcının isteklerine göre iş süreci (workflow) tasarla ve gereken aksiyonları çalıştır.

## Node Tipleri
- start: Süreç başlangıcı (her workflow'da 1 tane)
- task: Manuel görev
- ai_task: AI tarafından otomatik yapılan görev
- review: İnceleme adımı
- approval: Onay adımı (müşteri veya yönetici)
- milestone: Kilometre taşı / faz sonu
- condition: Koşullu dallanma
- parallel_split: Paralel işler başlangıcı
- parallel_join: Paralel işler birleşimi
- notification: Bildirim gönderme
- subprocess: Başka bir workflow şablonunu temsil eden alt süreç (hiyerarşik)
- end: Süreç sonu (her workflow'da 1 tane)

## Edge Tipleri
- default: Normal akış
- conditional_true: Koşul doğru ise
- conditional_false: Koşul yanlış ise
- rejection: Red durumu
- escalation: Üst kademeye iletme

## Pozisyon Kuralları
- Dikey akış: ana hat x=300
- Paralel dallar: sol x=100, sağ x=500
- Y aralığı: 120px
- Başlangıç y=50

## assigneeRole Değerleri
creative_director, videographer, editor, designer, social_media_manager, project_manager, client, admin

## Faz Yapısı
Her workflow mantıksal fazlara bölünmeli. Her faz'ın bir rengi olsun: #3B82F6, #8B5CF6, #F59E0B, #10B981, #EF4444, #EC4899

## Aksiyon Tipleri
- save_template: Mevcut draft'ı workflow şablonu olarak kaydet (status: 'draft')
- publish_template: Mevcut draft'ı kaydet ve yayınla (status: 'published')
- update_template: Mevcut şablonu güncelle (templateId gerekli)
- create_instance: Şablondan proje instance'ı oluştur (projectId gerekli)
- none: Sadece yanıt ver, aksiyon yok

## Node JSON Yapısı (ZORUNLU ALAN ADLARI)
Her node aşağıdaki yapıda olmalı — alan adları birebir bu şekilde kullanılmalı:
{
  "id": "node_1",
  "type": "task",
  "label": "Lokasyon Keşfi",
  "description": "Çekim lokasyonları belirlenir ve onaylanır",
  "position": { "x": 300, "y": 50 },
  "assigneeRole": "project_manager",
  "estimatedDurationHours": 8,
  "sopResources": []
}

ÖNEMLİ: Düğüm adı mutlaka "label" alanında olmalı. "name", "title" veya başka alan adı kullanma.

## Edge JSON Yapısı
{ "id": "edge_1", "source": "node_1", "target": "node_2", "type": "default", "label": "" }

## Phase JSON Yapısı
{ "id": "phase_1", "name": "Ön Üretim", "nodeIds": ["node_1", "node_2"], "sortOrder": 0, "color": "#3B82F6" }

## Subprocess Kuralları
- subprocess node JSON örneği:
  { "id":"node_5", "type":"subprocess", "label":"İçerik Üretimi", "position":{"x":300,"y":360}, "sopResources":[] }
- subWorkflowDrafts dizisi ile alt workflow taslakları tanımla:
  [{ "parentNodeId":"node_5", "draft": { tam WorkflowDraft objesi } }]
- Alt draft'ın node id'leri: "sub_{parentNodeId}_node_1" formatında
- Depth limiti: maksimum 3 seviye (subprocess içinde subprocess olabilir, ama 3'ten fazla değil)
- subprocess node'u ana workflow'un edge'leriyle bağlanabilir

## Yanıt Formatı (subprocess dahil)
{
  "reply": "...",
  "actions": [...],
  "draft": {
    ...mevcut alanlar...,
    "subWorkflowDrafts": [
      {
        "parentNodeId": "node_5",
        "draft": { "name":"...", "nodes":[...], "edges":[...], "phases":[...], ... }
      }
    ]
  }
}

## Kurallar
- Tasarım tamamlanınca kullanıcıya "save_template" veya "publish_template" öner
- Kullanıcı "kaydet", "tamam", "güzel", "bitir" derse save_template çalıştır
- Kullanıcı "yayınla", "aktifleştir" derse publish_template çalıştır
- Her yanıtta TAM draft'ı dön (incremental değil)
- Node id'leri benzersiz olmalı (örnek: "node_1", "node_2", ...)
- Edge id'leri benzersiz olmalı (örnek: "edge_1", "edge_2", ...)
- Phase id'leri benzersiz olmalı (örnek: "phase_1", "phase_2", ...)
- sopResources her node'da boş dizi olabilir []
- estimatedDurationHours makul değerler ver
- defaultEstimatedDays tüm sürecin toplam tahmini gün sayısı`;

interface WorkflowDraft {
  name: string;
  description: string;
  serviceCategory: string;
  defaultEstimatedDays: number;
  nodes: any[];
  edges: any[];
  phases: any[];
  subWorkflowDrafts?: Array<{
    parentNodeId: string;
    draft: WorkflowDraft;
  }>;
}

interface AgentAction {
  type: 'save_template' | 'publish_template' | 'update_template' | 'create_instance' | 'none';
  // update_template
  templateId?: string;
  // create_instance
  projectId?: string;
  // override name/description on save
  name?: string;
  description?: string;
}

interface AgentResponse {
  reply: string;
  actions: AgentAction[];
  draft: WorkflowDraft | null;
}

interface ActionResult {
  type: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Recursively saves a workflow draft and its sub-workflow drafts to Firestore.
 * Returns the Firestore document ID of the saved template.
 */
async function saveTemplateRecursive(
  db: any,
  draft: WorkflowDraft,
  tenantId: string,
  userId: string,
  userDisplayName: string,
  status: 'draft' | 'published',
  parentTemplateId?: string,
  parentNodeId?: string,
  depth = 0
): Promise<string> {
  if (depth > 3) throw new Error('Max subprocess depth (3) exceeded');

  const templateRef = db.collection('workflow_templates').doc();
  const childIdMap: Record<string, string> = {};

  // 1. Recursively save child templates first
  for (const swd of (draft.subWorkflowDrafts || [])) {
    const childId = await saveTemplateRecursive(
      db, swd.draft, tenantId, userId, userDisplayName, status,
      templateRef.id, swd.parentNodeId, depth + 1
    );
    childIdMap[swd.parentNodeId] = childId;
  }

  // 2. Patch subprocess nodes with their child template IDs
  const finalNodes = (draft.nodes || []).map((n: any) => {
    if (n.type === 'subprocess' && childIdMap[n.id]) {
      return {
        ...n,
        subprocessConfig: {
          childTemplateId: childIdMap[n.id],
          childTemplateName: n.label || n.subprocessConfig?.childTemplateName || '',
        },
      };
    }
    return n;
  });

  // 3. Save this template to Firestore
  const templateData: Record<string, any> = {
    id: templateRef.id,
    tenantId,
    name: draft.name || 'AI Workflow',
    description: draft.description || '',
    serviceCategory: draft.serviceCategory || 'general',
    nodes: finalNodes,
    edges: draft.edges || [],
    phases: draft.phases || [],
    defaultEstimatedDays: draft.defaultEstimatedDays || 7,
    version: 1,
    isLatest: true,
    status,
    depth,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: userId,
    createdByName: userDisplayName,
    source: 'ai_agent',
  };

  if (parentTemplateId) {
    templateData.parentTemplateId = parentTemplateId;
    templateData.parentNodeId = parentNodeId;
  }

  await templateRef.set(templateData);
  return templateRef.id;
}

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(res, req.userUid, LIMITS.AI_WORKFLOW)) return;

  try {
    const { sessionId, message } = req.body || {};

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, message' });
    }

    const db = getAdminDb();

    // Load session from Firestore
    const sessionDoc = await db.collection('workflow_design_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionData = sessionDoc.data()!;
    if (sessionData.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const history = sessionData.messages || [];
    const currentDraft: WorkflowDraft | null = sessionData.currentDraft || null;
    const parentContext = sessionData.parentContext || null;
    // parentContext?: { parentSessionId, nodeId, nodeLabel, parentWorkflowName }

    // Build prompt
    const parts: string[] = [SYSTEM_PROMPT, ''];

    // Sub-session context injection
    if (parentContext) {
      parts.push('## Alt Süreç Bağlamı');
      parts.push(`Sen "${parentContext.parentWorkflowName}" adlı ana workflow'un "${parentContext.nodeLabel}" adlı subprocess node'unu tasarlıyorsun.`);
      parts.push('Bu alt süreç:');
      parts.push('- Ana workflow içindeki bir subprocess node\'u temsil eder');
      parts.push('- Kendi başına çalışabilir ama ana akışa entegre olur');
      parts.push('- start ve end node\'larıyla başlamalı ve bitmeli');
      parts.push('- subWorkflowDrafts kullanma — bu ZATen bir sub-workflow');
      parts.push('- Sadece bu alt sürece odaklan, ana workflow\'u değiştirme');
      parts.push('');
    }

    if (currentDraft) {
      parts.push('## Mevcut Draft');
      parts.push('```json');
      parts.push(JSON.stringify(currentDraft, null, 2));
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
  "actions": [{ "type": "save_template" }] veya [{ "type": "none" }],
  "draft": { ... tam WorkflowDraft objesi ... } veya null
}

ÖNEMLİ: Sadece geçerli JSON dön. Başka bir şey yazma.`);

    const prompt = parts.join('\n');

    // Call Gemini
    const result = await generateJSON<AgentResponse>(
      'flash',
      prompt,
      'workflow-designer',
      { maxOutputTokens: 8192, temperature: 0.7 }
    );

    const reply = result.reply || 'Anlayamadım, lütfen tekrar deneyin.';
    const draft: WorkflowDraft | null = result.draft || currentDraft;
    const actions: AgentAction[] = Array.isArray(result.actions) ? result.actions : [{ type: 'none' }];

    // Execute server-side actions
    const actionResults: ActionResult[] = [];

    for (const action of actions) {
      if (action.type === 'none') {
        actionResults.push({ type: 'none', success: true });
        continue;
      }

      try {
        if ((action.type === 'save_template' || action.type === 'publish_template') && draft) {
          const status = action.type === 'publish_template' ? 'published' : 'draft';

          // Use override name/description if provided
          const draftToSave: WorkflowDraft = {
            ...draft,
            name: action.name || draft.name || 'AI Workflow',
            description: action.description || draft.description || '',
          };

          const parentTemplateId = parentContext ? undefined : undefined; // root save
          const rootTemplateId = await saveTemplateRecursive(
            db, draftToSave, req.tenantId, req.userId,
            req.userDisplayName || '', status
          );

          // Save templateId back to session for future update_template calls
          await db.collection('workflow_design_sessions').doc(sessionId).update({
            savedTemplateId: rootTemplateId,
          });

          // If this is a sub-session, link the saved template back to the parent session's draft
          if (parentContext?.parentSessionId && parentContext?.nodeId) {
            try {
              const parentSessionRef = db.collection('workflow_design_sessions').doc(parentContext.parentSessionId);
              const parentSessionDoc = await parentSessionRef.get();
              if (parentSessionDoc.exists) {
                const parentDraft = parentSessionDoc.data()?.currentDraft;
                if (parentDraft?.nodes) {
                  const updatedNodes = parentDraft.nodes.map((n: any) =>
                    n.id === parentContext.nodeId
                      ? {
                          ...n,
                          subprocessConfig: {
                            childTemplateId: rootTemplateId,
                            childTemplateName: draftToSave.name,
                          },
                        }
                      : n
                  );
                  await parentSessionRef.update({
                    currentDraft: { ...parentDraft, nodes: updatedNodes },
                    updatedAt: Date.now(),
                  });
                }
              }
            } catch (linkErr: any) {
              console.warn('[design-chat] Parent session link failed:', linkErr?.message);
            }
          }

          actionResults.push({
            type: action.type,
            success: true,
            data: {
              templateId: rootTemplateId,
              name: draftToSave.name,
              status,
              // For sub-sessions: tell frontend which parent node was linked
              linkedParentNodeId: parentContext?.nodeId || null,
              linkedParentSessionId: parentContext?.parentSessionId || null,
            },
          });
        } else if (action.type === 'update_template' && action.templateId && draft) {
          await db.collection('workflow_templates').doc(action.templateId).update({
            name: draft.name,
            description: draft.description,
            serviceCategory: draft.serviceCategory,
            nodes: draft.nodes,
            edges: draft.edges,
            phases: draft.phases,
            defaultEstimatedDays: draft.defaultEstimatedDays,
            updatedAt: Date.now(),
          });
          actionResults.push({
            type: 'update_template',
            success: true,
            data: { templateId: action.templateId, name: draft.name },
          });
        } else if (action.type === 'create_instance' && action.projectId && draft) {
          const instanceRef = db.collection('workflow_instances').doc();
          const instanceData = {
            id: instanceRef.id,
            tenantId: req.tenantId,
            projectId: action.projectId,
            templateId: sessionData.savedTemplateId || null,
            name: draft.name,
            status: 'not_started',
            currentNodeId: null,
            nodes: (draft.nodes || []).map((n: any) => ({
              ...n,
              status: 'pending',
              completedAt: null,
              assignedTo: null,
              notes: null,
            })),
            edges: draft.edges || [],
            phases: draft.phases || [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: req.userId,
            source: 'ai_agent',
          };
          await instanceRef.set(instanceData);
          actionResults.push({
            type: 'create_instance',
            success: true,
            data: { instanceId: instanceRef.id, projectId: action.projectId, name: draft.name },
          });
        }
      } catch (actionErr: any) {
        console.error(`Action ${action.type} failed:`, actionErr?.message);
        actionResults.push({ type: action.type, success: false, error: actionErr?.message });
      }
    }

    // Save messages + updated draft to session
    const userMsg = { role: 'user' as const, content: message, timestamp: Date.now() };
    const assistantMsg = {
      role: 'assistant' as const,
      content: reply,
      actions,
      timestamp: Date.now(),
      hasDraft: !!draft,
    };

    const FieldValue = getFieldValue();
    const updateData: Record<string, any> = {
      messages: FieldValue.arrayUnion(userMsg, assistantMsg),
      updatedAt: Date.now(),
    };

    // Auto-set title from first user message or draft name
    if (!sessionData.title) {
      const autoTitle = draft?.name || String(message).slice(0, 60);
      updateData.title = autoTitle;
    }

    if (draft) {
      updateData.currentDraft = draft;
    }

    await db.collection('workflow_design_sessions').doc(sessionId).update(updateData);

    // Compute subprocess nodes that still need child template design
    const subprocessSuggestions = (draft?.nodes || [])
      .filter((n: any) => n.type === 'subprocess' && !n.subprocessConfig?.childTemplateId)
      .map((n: any) => ({ nodeId: n.id, nodeLabel: n.label || n.id }));

    // Find if any save action linked back to a parent node
    const linkedParentResult = actionResults.find(
      (r) => r.success && r.data?.linkedParentNodeId
    );
    const linkedParentNode = linkedParentResult
      ? {
          nodeId: linkedParentResult.data.linkedParentNodeId,
          childTemplateId: linkedParentResult.data.templateId,
          childTemplateName: linkedParentResult.data.name,
          parentSessionId: linkedParentResult.data.linkedParentSessionId,
        }
      : null;

    return res.status(200).json({
      reply,
      draft,
      actions,
      results: actionResults,
      subprocessSuggestions,
      linkedParentNode,
    });
  } catch (error: any) {
    console.error('workflow/design-chat error:', error);
    return res.status(500).json({
      error: String(error?.message || 'Design chat failed'),
    });
  }
});
