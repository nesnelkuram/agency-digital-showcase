/**
 * Firestore Composite Index Creator — Admin SDK
 *
 * Tum Firestore sorgularini tarayarak gerekli composite index'leri
 * Google Cloud Firestore Admin REST API uzerinden programatik olarak olusturur.
 *
 * Kullanim:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/create-firestore-indexes.ts
 *
 * Gerekli ortam degiskenleri (.env.local):
 *   FIREBASE_SERVICE_ACCOUNT  (JSON string — Vercel'de kullanilan)
 *   veya
 *   VITE_FIREBASE_PROJECT_ID  (sadece project ID, ADC ile auth)
 */

import 'dotenv/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { GoogleAuth } from 'google-auth-library';
import { execSync } from 'child_process';

// ============================================
// TYPES
// ============================================

interface IndexField {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
  arrayConfig?: 'CONTAINS';
}

interface IndexDef {
  collection: string;
  fields: IndexField[];
  queryScope?: 'COLLECTION' | 'COLLECTION_GROUP';
}

// ============================================
// TUM COMPOSITE INDEX TANIMLARI
// ============================================

const ALL_INDEXES: IndexDef[] = [
  // ──────────────────────────────────
  // marketing_campaigns
  // ──────────────────────────────────
  {
    collection: 'marketing_campaigns',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'marketing_campaigns',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'marketing_campaigns',
    fields: [
      { fieldPath: 'objective', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'marketing_campaigns',
    fields: [
      { fieldPath: 'leadId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'marketing_campaigns',
    fields: [
      { fieldPath: 'clientId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // platform_accounts
  // ──────────────────────────────────
  {
    collection: 'platform_accounts',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'platform_accounts',
    fields: [
      { fieldPath: 'platform', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
    ],
  },
  {
    collection: 'platform_accounts',
    fields: [
      { fieldPath: 'platform', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'projectId', order: 'ASCENDING' },
    ],
  },

  // ──────────────────────────────────
  // performance_snapshots
  // ──────────────────────────────────
  {
    collection: 'performance_snapshots',
    fields: [
      { fieldPath: 'campaignId', order: 'ASCENDING' },
      { fieldPath: 'date', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // optimization_suggestions
  // ──────────────────────────────────
  {
    collection: 'optimization_suggestions',
    fields: [
      { fieldPath: 'campaignId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // campaign_proposals
  // ──────────────────────────────────
  {
    collection: 'campaign_proposals',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'projectId', order: 'ASCENDING' },
    ],
  },
  {
    collection: 'campaign_proposals',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // campaign_breakdowns
  // ──────────────────────────────────
  {
    collection: 'campaign_breakdowns',
    fields: [
      { fieldPath: 'campaignId', order: 'ASCENDING' },
      { fieldPath: 'breakdownType', order: 'ASCENDING' },
      { fieldPath: 'fetchedAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // campaign_ai_analyses
  // ──────────────────────────────────
  {
    collection: 'campaign_ai_analyses',
    fields: [
      { fieldPath: 'campaignId', order: 'ASCENDING' },
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'generatedAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // competitors
  // ──────────────────────────────────
  {
    collection: 'competitors',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // competitor_analyses
  // ──────────────────────────────────
  {
    collection: 'competitor_analyses',
    fields: [
      { fieldPath: 'competitorId', order: 'ASCENDING' },
      { fieldPath: 'analyzedAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // marketing_reports
  // ──────────────────────────────────
  {
    collection: 'marketing_reports',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'marketing_reports',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'marketing_reports',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // marketing_alerts
  // ──────────────────────────────────
  {
    collection: 'marketing_alerts',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'marketing_alerts',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'marketing_alerts',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'severity', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'marketing_alerts',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'category', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'marketing_alerts',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'projectId', order: 'ASCENDING' },
    ],
  },

  // ──────────────────────────────────
  // budget_forecasts
  // ──────────────────────────────────
  {
    collection: 'budget_forecasts',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // automation_rules
  // ──────────────────────────────────
  {
    collection: 'automation_rules',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // rule_execution_logs
  // ──────────────────────────────────
  {
    collection: 'rule_execution_logs',
    fields: [
      { fieldPath: 'ruleId', order: 'ASCENDING' },
      { fieldPath: 'executedAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'rule_execution_logs',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'executedAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // ab_tests
  // ──────────────────────────────────
  {
    collection: 'ab_tests',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'ab_tests',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'campaignId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'ab_tests',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'ab_tests',
    fields: [
      { fieldPath: 'campaignId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'ab_tests',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // campaign_templates
  // ──────────────────────────────────
  {
    collection: 'campaign_templates',
    fields: [
      { fieldPath: 'category', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'campaign_templates',
    fields: [
      { fieldPath: 'category', order: 'ASCENDING' },
      { fieldPath: 'platforms', arrayConfig: 'CONTAINS' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'campaign_templates',
    fields: [
      { fieldPath: 'platforms', arrayConfig: 'CONTAINS' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // utm_links
  // ──────────────────────────────────
  {
    collection: 'utm_links',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // creatives
  // ──────────────────────────────────
  {
    collection: 'creatives',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'creatives',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'creatives',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'creatives',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'platforms', arrayConfig: 'CONTAINS' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // social_media_posts
  // ──────────────────────────────────
  {
    collection: 'social_media_posts',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'social_media_posts',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'social_media_posts',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'postType', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'social_media_posts',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'scheduledAt', order: 'ASCENDING' },
    ],
  },

  // ──────────────────────────────────
  // projects
  // ──────────────────────────────────
  {
    collection: 'projects',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'projects',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'assignedTo', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'projects',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'clientId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'projects',
    fields: [
      { fieldPath: 'clientId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // brand_leads
  // ──────────────────────────────────
  {
    collection: 'brand_leads',
    fields: [
      { fieldPath: 'sector', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'brand_leads',
    fields: [
      { fieldPath: 'sector', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'brand_leads',
    fields: [
      { fieldPath: 'sector', order: 'ASCENDING' },
      { fieldPath: 'priority', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'brand_leads',
    fields: [
      { fieldPath: 'sector', order: 'ASCENDING' },
      { fieldPath: 'assignedTo', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'brand_leads',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'brand_leads',
    fields: [
      { fieldPath: 'priority', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'brand_leads',
    fields: [
      { fieldPath: 'assignedTo', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // feedback_videos
  // ──────────────────────────────────
  {
    collection: 'feedback_videos',
    fields: [
      { fieldPath: 'recordingMode', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'feedback_videos',
    fields: [
      { fieldPath: 'recordingMode', order: 'ASCENDING' },
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'feedback_videos',
    fields: [
      { fieldPath: 'recordingMode', order: 'ASCENDING' },
      { fieldPath: 'createdBy', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'feedback_videos',
    fields: [
      { fieldPath: 'recordingMode', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'feedback_videos',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'feedback_videos',
    fields: [
      { fieldPath: 'createdBy', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },

  // ──────────────────────────────────
  // feedback_comments
  // ──────────────────────────────────
  {
    collection: 'feedback_comments',
    fields: [
      { fieldPath: 'videoId', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'ASCENDING' },
    ],
  },

  // ──────────────────────────────────
  // feedback_reactions
  // ──────────────────────────────────
  {
    collection: 'feedback_reactions',
    fields: [
      { fieldPath: 'videoId', order: 'ASCENDING' },
      { fieldPath: 'emoji', order: 'ASCENDING' },
      { fieldPath: 'createdBy', order: 'ASCENDING' },
    ],
  },
  {
    collection: 'feedback_reactions',
    fields: [
      { fieldPath: 'videoId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'ASCENDING' },
    ],
  },
];

// ============================================
// AUTH + API
// ============================================

function getProjectId(): string {
  // 1. FIREBASE_SERVICE_ACCOUNT icinden
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saJson) {
    try {
      const sa = JSON.parse(saJson);
      if (sa.project_id) return sa.project_id;
    } catch { /* ignore */ }
  }
  // 2. Direkt ortam degiskeni
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    ''
  );
}

type AuthMethod = { type: 'google-auth'; client: GoogleAuth } | { type: 'gcloud-token'; token: string };

function getGcloudToken(): string | null {
  try {
    const token = execSync('gcloud auth print-access-token 2>/dev/null', { encoding: 'utf-8' }).trim();
    return token || null;
  } catch {
    return null;
  }
}

async function getAuthMethod(): Promise<AuthMethod> {
  // 1. FIREBASE_SERVICE_ACCOUNT
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saJson) {
    const sa = JSON.parse(saJson);
    return {
      type: 'google-auth',
      client: new GoogleAuth({
        credentials: sa,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      }),
    };
  }

  // 2. Application Default Credentials
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    await auth.getClient(); // test if ADC works
    return { type: 'google-auth', client: auth };
  } catch { /* ADC yok, gcloud'a gec */ }

  // 3. gcloud CLI access token
  const token = getGcloudToken();
  if (token) {
    console.log('   Auth: gcloud CLI access token kullaniliyor\n');
    return { type: 'gcloud-token', token };
  }

  throw new Error(
    'Auth bulunamadi. Su yontemlerden birini kullanin:\n' +
    '  1) FIREBASE_SERVICE_ACCOUNT ortam degiskeni\n' +
    '  2) gcloud auth application-default login\n' +
    '  3) gcloud auth login (gcloud CLI)',
  );
}

// ============================================
// INDEX OLUSTURMA
// ============================================

async function createIndex(
  auth: AuthMethod,
  projectId: string,
  index: IndexDef,
): Promise<{ ok: boolean; status: string; detail: string }> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    `/databases/(default)/collectionGroups/${index.collection}/indexes`;

  const body = {
    queryScope: index.queryScope || 'COLLECTION',
    fields: index.fields.map((f) => {
      if (f.arrayConfig) return { fieldPath: f.fieldPath, arrayConfig: f.arrayConfig };
      return { fieldPath: f.fieldPath, order: f.order || 'ASCENDING' };
    }),
  };

  try {
    let res: any;

    if (auth.type === 'google-auth') {
      const client = await auth.client.getClient();
      res = await client.request({ url, method: 'POST', data: body });
      return { ok: true, status: 'CREATING', detail: res.data?.name || '' };
    } else {
      // gcloud token ile fetch
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (response.ok) {
        return { ok: true, status: 'CREATING', detail: data?.name || '' };
      }

      const code = response.status;
      const msg = data?.error?.message || '';
      if (code === 409 || msg.includes('already exists')) {
        return { ok: true, status: 'EXISTS', detail: 'Zaten mevcut' };
      }
      return { ok: false, status: 'ERROR', detail: `${code} ${msg}`.trim() };
    }
  } catch (err: any) {
    const code = err?.response?.status;
    const msg = err?.response?.data?.error?.message || err.message || '';

    if (code === 409 || msg.includes('already exists')) {
      return { ok: true, status: 'EXISTS', detail: 'Zaten mevcut' };
    }
    return { ok: false, status: 'ERROR', detail: `${code || ''} ${msg}`.trim() };
  }
}

function describeIndex(idx: IndexDef): string {
  const fields = idx.fields
    .map((f) => {
      if (f.arrayConfig) return `${f.fieldPath} [${f.arrayConfig}]`;
      return `${f.fieldPath} ${f.order === 'DESCENDING' ? 'DESC' : 'ASC'}`;
    })
    .join(', ');
  return `${idx.collection} (${fields})`;
}

// ============================================
// FIRESTORE.INDEXES.JSON OLUSTUR
// ============================================

function generateIndexesJson(indexes: IndexDef[]): object {
  return {
    indexes: indexes.map((idx) => ({
      collectionGroup: idx.collection,
      queryScope: idx.queryScope || 'COLLECTION',
      fields: idx.fields.map((f) => {
        if (f.arrayConfig) return { fieldPath: f.fieldPath, arrayConfig: f.arrayConfig };
        return { fieldPath: f.fieldPath, order: f.order || 'ASCENDING' };
      }),
    })),
    fieldOverrides: [],
  };
}

// ============================================
// MAIN
// ============================================

async function main() {
  const projectId = getProjectId();
  if (!projectId) {
    console.error(
      '❌ Project ID bulunamadi.\n' +
      '   FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID veya VITE_FIREBASE_PROJECT_ID ayarlayin.',
    );
    process.exit(1);
  }

  console.log(`\n🔥 Firestore Composite Index Creator`);
  console.log(`   Proje: ${projectId}`);
  console.log(`   Toplam index: ${ALL_INDEXES.length}\n`);

  // 1) firestore.indexes.json dosyasini da olustur
  const fs = await import('fs');
  const indexesJson = generateIndexesJson(ALL_INDEXES);
  fs.writeFileSync('firestore.indexes.json', JSON.stringify(indexesJson, null, 2) + '\n');
  console.log('📄 firestore.indexes.json olusturuldu (firebase deploy --only firestore:indexes ile de kullanilabilir)\n');

  // 2) Admin API ile index'leri olustur
  let auth: AuthMethod;
  try {
    auth = await getAuthMethod();
  } catch (err: any) {
    console.error('❌ Auth hatasi:', err.message);
    process.exit(1);
  }

  let created = 0;
  let exists = 0;
  let errors = 0;

  // Batch 5'erli gruplarla olustur (rate limit)
  const BATCH = 5;
  for (let i = 0; i < ALL_INDEXES.length; i += BATCH) {
    const batch = ALL_INDEXES.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((idx) => createIndex(auth, projectId, idx)),
    );

    results.forEach((res, j) => {
      const idx = ALL_INDEXES[i + j];
      const num = String(i + j + 1).padStart(2, ' ');
      const desc = describeIndex(idx);

      if (res.status === 'EXISTS') {
        console.log(`  ${num}. ✅ ${desc}  — zaten mevcut`);
        exists++;
      } else if (res.ok) {
        console.log(`  ${num}. 🔨 ${desc}  — olusturuluyor`);
        created++;
      } else {
        console.log(`  ${num}. ❌ ${desc}  — ${res.detail}`);
        errors++;
      }
    });

    // Rate limit koruması — batch'ler arasi 500ms bekle
    if (i + BATCH < ALL_INDEXES.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\n────────────────────────────────────`);
  console.log(`🔨 Olusturuluyor: ${created}`);
  console.log(`✅ Zaten mevcut:  ${exists}`);
  if (errors > 0) console.log(`❌ Hata:          ${errors}`);
  console.log(`   Toplam:        ${ALL_INDEXES.length}`);
  console.log(`────────────────────────────────────\n`);

  if (created > 0) {
    console.log('⏳ Index\'ler arka planda olusturuluyor. Firebase Console\'dan durumu takip edebilirsiniz:');
    console.log(`   https://console.firebase.google.com/project/${projectId}/firestore/indexes\n`);
  }

  process.exit(errors > 0 ? 1 : 0);
}

main();
