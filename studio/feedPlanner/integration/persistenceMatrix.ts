/**
 * Yerel planlayıcı kavramları ↔ canlı sistemdeki KARŞILIĞI. Her satır kaynak koddan kanıta bağlıdır; testler
 * (tests/feedPlanner/integration/persistenceMatrix.test.ts) kanıtları depo dosyalarında arar: "mevcut" iddiası
 * koddan kaybolursa veya "yok" iddiası bir gün yanlış çıkarsa test kırılır. Bu tablo çalışma iddiası değil, envanterdir.
 */
export type MatrixStatus = 'mevcut' | 'kısmi' | 'yok';

export interface Evidence {
  file: string;
  /** RegExp kaynağı (flag yok) */
  pattern: string;
  expect: 'present' | 'absent';
}

export interface MatrixRow {
  id: string;
  concept: string;
  status: MatrixStatus;
  existing: string;
  gap: string;
  evidence: Evidence[];
}

export const PERSISTENCE_MATRIX: MatrixRow[] = [
  {
    id: 'draft-post',
    concept: 'Taslak post oluşturma',
    status: 'mevcut',
    existing: 'İstemci createSocialPost; kural: yeni post yalnız status=draft (firestore.rules validNewPost). Öneri akışı addSuggestionsAsDrafts ile aynı alanlar.',
    gap: 'Yok (yazım bu turda yapılmadı).',
    evidence: [
      { file: 'studio/components/PlanSuggestPanel.tsx', pattern: 'export async function addSuggestionsAsDrafts', expect: 'present' },
      { file: 'firestore.rules', pattern: "request\\.resource\\.data\\.status == 'draft'", expect: 'present' },
    ],
  },
  {
    id: 'draft-plan',
    concept: 'Plan (content_plans) oluşturma ve post bağlama',
    status: 'mevcut',
    existing: 'createContentPlan: status=draft, shareToken üretir; post.contentPlanId bağı validPlanLink ile tenant/proje doğrulanır.',
    gap: 'createContentPlan paylaşım tokenı üretir (müşteriye gönderim yok, ama token oluşur).',
    evidence: [
      { file: 'shared/services/contentPlanService.ts', pattern: "status: 'draft' as ContentPlanStatus", expect: 'present' },
      { file: 'firestore.rules', pattern: 'function validPlanLink', expect: 'present' },
    ],
  },
  {
    id: 'reject-suggestion',
    concept: 'Gerekçeli ret (AI öneri kümesi)',
    status: 'mevcut',
    existing: '/api/studio/feedback → content_feedback; hedef yalnız saklanmış öneri kümesi (plan_suggestions) + index + içerik hash.',
    gap: 'Yalnız sunucuda saklanmış öneriler reddedilebilir; yerel şablon/elle atanmış slot için hedef yok.',
    evidence: [
      { file: 'api/_lib/feedback/contentFeedback.ts', pattern: "kind: z\\.literal\\('suggestion'\\)", expect: 'present' },
      { file: 'api/_lib/feedback/contentFeedback.ts', pattern: "SUGGESTION_SETS = 'plan_suggestions'", expect: 'present' },
    ],
  },
  {
    id: 'reject-post',
    concept: 'Gerekçeli ret (kayıtlı post)',
    status: 'kısmi',
    existing: 'Yalnız onay geçişiyle birlikte: internal_reject ve reopen.',
    gap: 'Onay akışı dışında bağımsız ret kaydı yok.',
    evidence: [{ file: 'api/_lib/feedback/contentFeedback.ts', pattern: "POST_FEEDBACK_ACTIONS = new Set\\(\\['internal_reject', 'reopen'\\]\\)", expect: 'present' }],
  },
  {
    id: 'feedback-to-planner',
    concept: 'Ret sebebinin sonraki planlara geri beslenmesi',
    status: 'mevcut',
    existing: 'loadPlannerFeedback → feedbackLine (kapsam: yalnız_bu_içerik / marka_bağlamı) modele veri olarak girer.',
    gap: 'Yerel Bellek-içi ret bu yola girmez.',
    evidence: [
      { file: 'api/_lib/planSuggest/planSuggest.ts', pattern: 'loadPlannerFeedback', expect: 'present' },
      { file: 'api/_lib/planSuggest/planSuggest.ts', pattern: 'kapsam:marka_bağlamı', expect: 'present' },
    ],
  },
  {
    id: 'lock',
    concept: 'Kalsın (kalıcı kilit)',
    status: 'yok',
    existing: 'Yok.',
    gap: 'Post/plan şemasında ve kurallarda kilit alanı yok. Öneri: content_plan_planner_state (docs/proposals/planner-state.rules).',
    evidence: [
      { file: 'firestore.rules', pattern: 'content_plan_planner_state', expect: 'absent' },
      { file: 'shared/types/socialMedia.ts', pattern: 'plannerLock|slotLocked|isLocked', expect: 'absent' },
    ],
  },
  {
    id: 'dismiss',
    concept: 'Ele ve yenisini getir (gerekçesiz eleme geçmişi)',
    status: 'yok',
    existing: 'Yok; en yakını gerekçeli ret.',
    gap: 'Gerekçesiz eleme ve eleme geçmişi için kayıt yok.',
    evidence: [{ file: 'api/_lib/feedback/contentFeedback.ts', pattern: 'dismiss', expect: 'absent' }],
  },
  {
    id: 'grid-order',
    concept: 'Feed ızgara sırası',
    status: 'kısmi',
    existing: 'Post.gridPosition alanı var ve onaydan sonra da değişebilir (firestore.rules).',
    gap: 'Öneri/planlayıcı gridPosition üretmez; 3x3 ızgara bütünü bir kavram olarak yok.',
    evidence: [
      { file: 'firestore.rules', pattern: "'gridPosition'", expect: 'present' },
      { file: 'api/_lib/planSuggest/planSuggest.ts', pattern: 'gridPosition', expect: 'absent' },
    ],
  },
  {
    id: 'story-series',
    concept: 'Story serisi (aynı ürünün 2–3 karesi, başlık yalnız ilkinde)',
    status: 'yok',
    existing: 'Yok; her story ayrı post (story_needs_one_media).',
    gap: 'Seri/sıra alanı yok. Bu tur seri, aynı gün ardışık postlardan çıkarılır (varsayım).',
    evidence: [
      { file: 'api/_lib/planSuggest/planSuggest.ts', pattern: 'story_needs_one_media', expect: 'present' },
      { file: 'shared/types/socialMedia.ts', pattern: 'seriesId|storySeries', expect: 'absent' },
    ],
  },
  {
    id: 'story-overlay',
    concept: 'Story görsel üstü başlık/gövde metni',
    status: 'yok',
    existing: 'Yalnız caption alanı.',
    gap: 'Yerleşim/overlay alanı yok; metin caption olarak saklanır.',
    evidence: [{ file: 'shared/types/socialMedia.ts', pattern: 'overlayText|headline', expect: 'absent' }],
  },
  {
    id: 'crop',
    concept: 'Kırpma ve odak',
    status: 'yok',
    existing: 'Yok; post özgün dosyayı kullanır.',
    gap: 'MediaItem\'da kırpma alanı yok; Instagram hazırlık denetimi özgün orana bakar.',
    evidence: [{ file: 'shared/types/socialMedia.ts', pattern: 'cropRect|focusPoint|objectPosition', expect: 'absent' }],
  },
  {
    id: 'undated',
    concept: 'Saatsiz (yalnız gün) plan',
    status: 'kısmi',
    existing: 'Post.scheduledAt şemada opsiyonel.',
    gap: 'Öneri motoru her post için HH:MM ister (invalid_time); takvim tarihsiz postu göstermez.',
    evidence: [
      { file: 'shared/types/socialMedia.ts', pattern: 'scheduledAt\\?: Timestamp', expect: 'present' },
      { file: 'api/_lib/planSuggest/planSuggest.ts', pattern: "reasons\\.push\\('invalid_time'\\)", expect: 'present' },
    ],
  },
  {
    id: 'language',
    concept: 'Türkçe metin zorunluluğu',
    status: 'kısmi',
    existing: 'Sistem prompt\'u "Metinler Türkçe" der.',
    gap: 'Sunucu doğrulaması dili denetlemez; İngilizce captionDraft kabul edilir.',
    evidence: [
      { file: 'api/_lib/planSuggest/planSuggest.ts', pattern: 'Metinler Türkçe', expect: 'present' },
      { file: 'api/_lib/planSuggest/planSuggest.ts', pattern: 'detectLang|isTurkish', expect: 'absent' },
    ],
  },
  {
    id: 'catalog-paging',
    concept: 'Katalog sayfalama (447 kayıt)',
    status: 'yok',
    existing: 'Envanter en yeni 200 medyayla sınırlı; kütüphane ekranı da 200.',
    gap: 'İmleç/sayfalama yok; daha eski medya plana ve kütüphane listesine girmez.',
    evidence: [
      { file: 'api/_lib/planSuggest/planSuggest.ts', pattern: 'INVENTORY_LIMIT = 200', expect: 'present' },
      { file: 'studio/brandMediaData.ts', pattern: 'LIBRARY_PAGE_SIZE = 200', expect: 'present' },
      { file: 'api/_lib/planSuggest/planSuggest.ts', pattern: 'startAfter', expect: 'absent' },
    ],
  },
  {
    id: 'canva-templates',
    concept: 'Dieci Canva şablon/tasarım kaynakları',
    status: 'yok',
    existing: 'Canva istemcisi yalnız klasör görselleri ve varlık yükleme/taşıma yapar.',
    gap: 'Tasarım/şablon okuma, autofill veya export kapsamı istenmiyor (folder/asset kapsamları).',
    evidence: [
      { file: 'api/_lib/canva/oauth.ts', pattern: "CANVA_SCOPES = \\['folder:read', 'folder:write', 'asset:read', 'asset:write'\\]", expect: 'present' },
      { file: 'api/_lib/canva/client.ts', pattern: 'design|template|autofill', expect: 'absent' },
    ],
  },
  {
    id: 'canva-only',
    concept: 'Canva-only medyanın plana girmesi',
    status: 'yok',
    existing: 'Bilinçli kısıt: Canva-only kayıtlar Studio orijinali değildir; posta eklenemez.',
    gap: 'Dieci\'nin 447 Canva görseli, Studio kütüphanesine orijinal olarak yüklenmeden planlanamaz.',
    evidence: [{ file: 'api/canva/folder.ts', pattern: 'Canva-only kayıtlar Studio orijinali DEĞİLDİR', expect: 'present' }],
  },
  {
    id: 'model-access',
    concept: 'Model erişimi (öneri üretimi)',
    status: 'kısmi',
    existing: 'Sonnet 5.5, resmi Anthropic SDK; varsayılan KAPALI.',
    gap: 'PLAN_AI_SUGGEST_ENABLED=true ve ANTHROPIC_API_KEY gerekir (API faturalandırması); abonelik varsayılamaz.',
    evidence: [
      { file: 'api/_lib/integrations/config.ts', pattern: "PLAN_SUGGEST_REQUIRED_ENV = \\['ANTHROPIC_API_KEY'\\]", expect: 'present' },
      { file: 'api/_lib/planSuggest/planSuggest.ts', pattern: "PLAN_MODEL = 'claude-sonnet-5-5'", expect: 'present' },
    ],
  },
];
