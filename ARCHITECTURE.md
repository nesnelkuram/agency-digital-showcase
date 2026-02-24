# HALAZO — Agentic Workflow & Hybrid Workforce Mimarisi

> **Platform:** React + TypeScript + Vite / Firebase Firestore (NoSQL) / Vercel Serverless API / Gemini AI  
> **Multi-tenant:** Her kayıt `tenantId` alanı taşır, tüm sorgular bu alanla scope'lanır.

---

## 1. Veritabanı Koleksiyonları ve Modeller

### 1.1 `users`

| Alan | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `uid` | `string` | ✓ | Firebase Auth UID (document key) |
| `email` | `string` | ✓ | |
| `displayName` | `string` | ✓ | |
| `photoURL` | `string` | — | |
| `role` | `UserRole` | ✓ | Rol enum (aşağıda) |
| `tenantId` | `string` | ✓ | Kiracı izolasyonu |
| `organizationId` | `string` | — | |
| `permissions` | `string[]` | ✓ | RBAC izin stringleri |
| `status` | `'active' \| 'invited' \| 'suspended'` | ✓ | |
| `metadata.createdAt` | `Timestamp` | ✓ | |
| `metadata.lastLoginAt` | `Timestamp` | — | |
| `metadata.invitedBy` | `string` | — | |
| `profile.phone/title/department/timezone` | `string` | — | |
| `settings.notifications` | `{ email, push, approvalReminders: boolean }` | ✓ | |

---

### 1.2 `projects`

| Alan | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `id` | `string` | ✓ | Auto-ID |
| `tenantId` | `string` | ✓ | |
| `name` | `string` | ✓ | |
| `description` | `string` | — | |
| `status` | `ProjectStatus` | ✓ | |
| `clientId` | `string` | — | Opsiyonel Firebase Auth UID (portal erişimi için) |
| `clientName` | `string` | ✓ | |
| `clientEmail/Phone/Company` | `string` | — | |
| `leadId` | `string` | — | `brand_leads` referansı |
| `quoteId` | `string` | — | `pricing_quotes` referansı |
| `services` | `ProjectService[]` | ✓ | Aktif hizmetler (embed) |
| `teamMembers` | `Array<{uid, name, role}>` | — | |
| `totalBudget / monthlyFee` | `number` | — | |
| `currency` | `'TRY' \| 'USD' \| 'EUR'` | — | |
| `startDate / endDate` | `Timestamp` | — | |
| `timeline` | `ProjectTimelineEvent[]` | ✓ | Audit log (embed) |
| `tags` | `string[]` | ✓ | |
| `createdAt / updatedAt` | `Timestamp` | ✓ | |

**`ProjectService` (embedded array):**

| Alan | Tip |
|---|---|
| `category` | `ServiceCategory` |
| `status` | `'active' \| 'paused' \| 'not_started' \| 'completed'` |
| `activatedAt` | `Timestamp?` |
| `notes / metadata` | opsiyonel |

**`ProjectTimelineEvent` (embedded array):**  
`type`: `created | status_change | service_activated | service_deactivated | note | quote_linked | client_assigned`

---

### 1.3 `workflow_templates`

| Alan | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `id` | `string` | ✓ | Auto-ID |
| `tenantId` | `string` | ✓ | |
| `name / description` | `string` | ✓ | |
| `serviceCategory` | `ServiceCategory` | ✓ | Hangi hizmet türüne ait |
| `serviceSubType` | `string` | — | |
| `nodes` | `WorkflowNodeTemplate[]` | ✓ | Tüm adımlar |
| `edges` | `WorkflowEdgeTemplate[]` | ✓ | Bağlantılar / akış yönleri |
| `phases` | `WorkflowPhase[]` | ✓ | Mantıksal aşamalar (node grupları) |
| `defaultEstimatedDays` | `number` | ✓ | |
| `version` | `number` | ✓ | Versiyonlama (1'den başlar) |
| `isLatest` | `boolean` | ✓ | Sadece son versiyon sorgulanır |
| `status` | `'draft' \| 'published' \| 'archived'` | ✓ | |
| `depth` | `number` | ✓ | `0` = root template, `>0` = subprocess child |
| `parentTemplateId` | `string` | — | Hiyerarşi için üst template referansı |
| `parentNodeId` | `string` | — | Hangi `subprocess` node bunu referans alıyor |
| `createdAt / updatedAt` | `Timestamp` | ✓ | |

**`WorkflowNodeTemplate` (embedded array):**

| Alan | Tip | Açıklama |
|---|---|---|
| `id` | `string` | Node ID |
| `type` | `WorkflowNodeType` | Aşağıda |
| `label / description` | `string` | |
| `position` | `{x, y}` | Canvas koordinatı |
| `assigneeRole` | `string?` | Hangi kullanıcı rolü sorumlu |
| `estimatedDurationHours` | `number?` | |
| `agentId` | `string?` | **AI Registry referansı** — `ai_agents` collection ID |
| `agentName` | `string?` | Denormalized display |
| `aiAgentConfig` | `AIAgentConfig?` | AI çalıştırma config'i |
| `conditionConfig` | `{field, operator, value}?` | Koşullu dal için |
| `reviewConfig` | `{reviewerRole, rejectionTarget, maxRejections, escalationTarget}?` | İnceleme adımı için |
| `notificationConfig` | `{recipients, template, channel}?` | Bildirim adımı için |
| `formSchema` | `{fields[]}?` | İnsan adımı için form şeması |
| `subprocessConfig` | `{childTemplateId?, childTemplateName?}?` | Alt workflow referansı |
| `sopResources` | `SOPResource[]` | Video/döküman kaynakları |

**`AIAgentConfig` (WorkflowNodeTemplate içinde):**

| Alan | Tip |
|---|---|
| `agentType` | `string` |
| `model` | `'flash' \| 'pro'` |
| `promptTemplate` | `string` ({{placeholder}} sözdizimi) |
| `inputMapping` | `Record<contextKey, placeholderName>` |
| `outputMapping` | `Record<outputField, contextKey>` |
| `maxRetries` | `number` |
| `timeoutMs` | `number` |
| `requiresHumanReview` | `boolean` |
| `confidenceThreshold` | `number?` |

**`WorkflowEdgeTemplate`:**

| Alan | Tip |
|---|---|
| `id` | `string` |
| `source / target` | `string` (node ID'leri) |
| `type` | `WorkflowEdgeType` |
| `conditionValue` | `string?` |

---

### 1.4 `workflow_instances`

| Alan | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `id` | `string` | ✓ | Auto-ID |
| `tenantId` | `string` | ✓ | |
| `templateId / templateVersion / templateName` | `string / number / string` | ✓ | Hangi şablondan üretildi |
| `projectId` | `string` | ✓ | **Projeye bağlantı — ana FK** |
| `projectName / clientId / clientName` | `string` | ✓ | Denormalized |
| `serviceCategory` | `ServiceCategory` | ✓ | |
| `status` | `WorkflowInstanceStatus` | ✓ | |
| `progress` | `number` | ✓ | 0–100 |
| `steps` | `Record<nodeId, StepInstance>` | ✓ | **Tüm adım durumları — map olarak embed** |
| `activeNodeIds` | `string[]` | ✓ | Şu an aktif/bekleyen node ID'leri |
| `context` | `Record<string, any>` | ✓ | Workflow genelinde paylaşılan veri; AI output'ları buraya yazılır |
| `auditLog` | `Array<{id, action, description, userId, timestamp}>` | ✓ | |
| `startedAt / completedAt` | `Timestamp` | — | |
| `createdAt / updatedAt` | `Timestamp` | ✓ | |

**`StepInstance` (steps map'inin değeri):**

| Alan | Tip | Açıklama |
|---|---|---|
| `nodeId` | `string` | |
| `status` | `StepInstanceStatus` | |
| `isSubStep` | `boolean?` | Subprocess içindeki alt adım |
| `isSubProcess` | `boolean?` | Subprocess container adımı |
| `parentStepId` | `string?` | Hangi subprocess node'una ait |
| `assignment` | `{userId, userName, userRole, assignedAt}?` | **İnsan atama** |
| `aiExecutions` | `AIExecutionRecord[]?` | **AI çalıştırma geçmişi** |
| `formData` | `Record<string, any>?` | İnsan formu çıktısı |
| `deliverables` | `Array<{id, name, url, type, uploadedAt}>?` | |
| `revisions` | `Array<{revisionNumber, rejectedBy, reason, rejectedAt}>?` | |
| `currentRevision` | `number` | |
| `outputData` | `Record<string, any>?` | Bu adımın context'e yazdığı veri |
| `comments` | `Array<{id, userId, userName, text, createdAt}>?` | |

**`AIExecutionRecord`:**

| Alan | Tip |
|---|---|
| `executionId` | `string` |
| `agentType` | `string` |
| `status` | `'running' \| 'completed' \| 'failed' \| 'review_pending'` |
| `input / output` | `Record<string, any>` |
| `confidenceScore` | `number?` |
| `tokensUsed` | `{input, output: number}?` |
| `reviewedBy / reviewDecision` | `'approved' \| 'rejected' \| 'modified'?` |

---

### 1.5 `ai_agents`

| Alan | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `id` | `string` | ✓ | Auto-ID |
| `tenantId` | `string` | ✓ | |
| `name / description` | `string` | ✓ | |
| `agentType` | `AIAgentType` | ✓ | |
| `status` | `'active' \| 'draft'` | ✓ | |
| `systemPrompt` | `string?` | | Ajan karakteri/rolü |
| `promptTemplate` | `string?` | | `{{placeholder}}` sözdizimi |
| `model` | `'flash' \| 'pro'?` | | |
| `inputMapping` | `Record<string, string>?` | | placeholder → context key |
| `outputMapping` | `Record<string, string>?` | | output field → context key |
| `requiresHumanReview` | `boolean` | ✓ | |
| `confidenceThreshold / maxRetries / timeoutMs` | `number?` | | |
| `canvaConfig` | `CanvaConfig?` | | Sadece `canva_autofill` tipinde |
| `createdAt / updatedAt` | `number` | ✓ | `Date.now()` (ms) |

---

## 2. İlişkiler

```
tenants
  └── users              (tenantId FK, 1-to-many)
  └── projects           (tenantId FK, 1-to-many)
  └── workflow_templates (tenantId FK, 1-to-many)
  └── workflow_instances (tenantId FK, 1-to-many)
  └── ai_agents          (tenantId FK, 1-to-many)

projects ──────────────────── workflow_instances
  (projectId FK, 1-to-many)    Bir projenin birden çok
                                 instance'ı olabilir.

workflow_templates ─────────── workflow_instances
  (templateId FK, 1-to-many)   Her instance bir template'den türetilir.

workflow_templates ─────────── workflow_templates  [Hiyerarşi]
  depth=0 (root)                depth>0 (subprocess child)
  parentTemplateId FK →         parentTemplateId = root.id
  Bir node'un subprocessConfig.childTemplateId'si
  child template'i işaret eder.

ai_agents ─────────────────── workflow_templates.nodes
  (agentId FK, many-to-one)    Bir node, ai_agents kaydını referans alır.
                                 aiAgentConfig ayrıca inline config taşır.

users ──────────────────────── workflow_instances.steps[n].assignment
  (userId FK, many-to-one)     Bir adım bir kullanıcıya atanır.

projects.services[] ──────────  workflow_instances.serviceCategory
  (serviceCategory match)       Kategoriye göre gruplandırma;
                                 doğrudan FK değil, enum eşleşmesi.
```

> **Önemli:** Firestore NoSQL'de foreign key constraint yoktur. İlişkiler uygulama katmanında yönetilir. `steps` map'i ve `timeline` array'i **embedding** (denormalizasyon) ile ayrı collection yerine parent belgeye gömülüdür.

---

## 3. Enum'lar ve Sabit Değerler

### `UserRole`
```
super_admin | admin | account_manager | editor | staff | client | freelancer
```

### `WorkflowNodeType`
```
start | task | ai_task | review | approval | milestone |
condition | parallel_split | parallel_join | notification | subprocess | end
```

### `WorkflowEdgeType`
```
default | conditional_true | conditional_false | rejection | escalation
```

### `WorkflowInstanceStatus`
```
pending | active | paused | completed | cancelled
```

### `StepInstanceStatus`
```
pending         → Henüz sırası gelmedi
ready           → Bağımlılıklar tamam, başlanabilir
in_progress     → İnsan üzerinde çalışıyor
awaiting_review → Review adımına gönderildi
revision_needed → Geri çevrildi, revize gerekiyor
ai_processing   → AI agent çalışıyor
ai_review       → AI tamamladı, insan onayı bekliyor
completed       → Tamamlandı
skipped         → Atlandı (condition branch)
blocked         → Max revizyon aşıldı, tıkandı
```

### `AIAgentType`
```
gemini_task     → Metin/veri görevleri (Gemini API)
gemini_vision   → Görsel analizi (Gemini Vision API)
canva_autofill  → Canva şablon doldurma (Canva API — stub)
```

### `WorkflowTemplate.status`
```
draft | published | archived
```

### `WorkflowEdge` Condition Operatörleri
```
equals | not_equals | greater_than | less_than |
greater_than_or_equal | less_than_or_equal |
contains | not_contains | exists | not_exists | in | not_in
```

### `ServiceCategory` (Hizmet Kategorileri)
```
social_media | video_production | photography | digital_marketing |
event_coverage | content_creation | brand_identity |
e_commerce | pr_media | training
```

---

## 4. Mevcut İş Mantığı

### 4.1 İnsan ↔ AI Ayrımı — Nasıl Çalışıyor?

Ayrım `WorkflowNodeTemplate.type` alanıyla belirlenir:

```
type = 'task'    → İnsan adımı
type = 'ai_task' → AI agent adımı
type = 'review'  → İnsan inceleme adımı
```

**AI adımı tespit edildiğinde** (`execute-agent` API endpoint'i):
1. Node'un `agentId` alanı varsa → `ai_agents` collection'dan registry kaydı çekilir
2. Registry'deki `systemPrompt` + `promptTemplate` birleştirilir
3. `context` (workflow genelinde veri deposu) üzerinde `inputMapping` ile placeholder'lar doldurulur
4. `orchestrator.ts` → `runWorkflowAgent()` → Gemini API çağrısı
5. JSON çıktı `outputMapping` ile `context`'e geri yazılır
6. `requiresHumanReview: true` ise step `'ai_review'` statüsüne girer, `false` ise direkt `'completed'`

**İnsan adımında** (`startStep` / `completeStep` fonksiyonları):
1. `assignment` alanına `{userId, userName, userRole, assignedAt}` yazılır
2. `formData` ile form çıktısı kaydedilir
3. `deliverables` ile dosya URL'leri eklenir

---

### 4.2 Görev Bağımlılıkları — Dependency Sistemi

**Mekanizma:** `edges` (WorkflowEdgeTemplate) listesi yönlü grafı tanımlar. `advanceWorkflow()` fonksiyonu her tetiklendiğinde tüm node'ları kontrol eder.

**`advanceWorkflow` algoritması:**
```
for each node in template.nodes:
  incomingEdges = edges.filter(e => e.target == node.id)
  prerequisites = incomingEdges.map(e => steps[e.source])

  allDone = prerequisites.every(s => s.status in ['completed', 'skipped'])

  if allDone and step.status == 'pending':
    set step.status = 'ready'      ← "Task B bitmeden Task A başlamaz"
                                     bu satırda uygulanır

  // Özel node tipi kuralları:
  'parallel_join'  → Tüm gelen dallar tamamlanmalı
  'condition'      → evaluateCondition() ile context değerine göre
                     bir dal seçilir, diğeri 'skipped' yapılır
  'subprocess'     → Tüm child sub-step'ler tamamlanınca
                     otomatik 'completed' yapılır
```

**Tetikleyiciler:** `startStep()`, `completeStep()`, `rejectStep()`, `skipStep()` fonksiyonlarının her biri sona erdiğinde `advanceWorkflow()` çağırır. Bu sayede bağımlılık zinciri otomatik ilerler.

---

### 4.3 `context` — Workflow Genelinde Veri Akışı

`WorkflowInstance.context` bir `Record<string, any>` objesidir. Tüm AI agent'lar ve insan adımları bu ortak havuza veri yazar ve okur:

```
context = {
  clientName:      "Selen Mazaylacıoğlu",  ← Instantiate sırasında seed
  briefText:       "...",                   ← Adım 1 AI output
  captionDraft:    "...",                   ← Adım 2 AI output
  approvedCaption: "...",                   ← İnsan düzenlemesi
  ...
}

inputMapping:  { "brief": "briefText" }      → {{brief}} → context.briefText
outputMapping: { "caption": "captionDraft" } → output.caption → context.captionDraft
```

---

### 4.4 Subprocess / Hiyerarşi

- Template `depth=0` ise root (ana workflow)
- `subprocess` tipli node, `subprocessConfig.childTemplateId` ile başka bir `workflow_template` belgesini işaret eder
- `instantiateWorkflow` sırasında `flattenTemplateNodes()` child template'in node'larını `"subprocessNodeId::childNodeId"` key formatıyla `steps` map'ine düz olarak ekler
- `advanceWorkflow` subprocess container'ı, tüm child step'ler tamamlandığında otomatik kapatır

---

### 4.5 Revizyon / Rejection Döngüsü

`review` tipli node'larda:
- `rejectStep()` çağrıldığında → `rejectionTarget` node'u `revision_needed` statüsüne alınır
- `currentRevision` sayacı artırılır
- `maxRejections` (varsayılan 3) aşılırsa adım `blocked` olur ve eskalasyon başlar

---

### 4.6 Güvenlik Modeli (Firestore Rules)

- Tüm collection'lar `tenantId` ile izole edilir
- AI agent ve workflow collection'larına tenant üyeleri okuyabilir/yazabilir
- `pricing_*` collection'larına sadece `admin` ve `account_manager` erişebilir
- `client` rolü sadece kendi projesini görebilir (`clientId == request.auth.uid`)
- `notifications` sadece kendi `userId`'ne sahip belgeler okunabilir

---

**Özet:** ~9 Firestore collection, ~35 tip/interface, 12 node tipi, tam otomatik dependency engine, hybrid human+AI step execution.
