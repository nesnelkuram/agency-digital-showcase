import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve('.env.local') });

const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
initializeApp({ projectId });
const db = getFirestore();

const TENANT_ID = 'intiba';
const CREATED_BY = 'system';
const CREATED_BY_NAME = 'intiba';

const tasks = [
  {
    title: 'Selen Mazgazioğlu YouTube — Eski videoların tespiti ve yüklenmesi',
    description: 'YouTube sayfasındaki eski videolardan eklenmeyenleri tespit et, hangileri yüklendi hangileri yüklenmedi kontrol et, eksikleri yükle.',
    priority: 'high',
    aiPriorityScore: 72,
    aiRiskLevel: 'low',
    tags: ['youtube', 'selen', 'video'],
    delegationScore: 75,
    delegationRationale: 'Rutin video yükleme işi, net süreç ile delege edilebilir.',
    source: 'telegram',
  },
  {
    title: 'Ramazan videoları — Shorts/Reels olarak yükleme',
    description: 'Ramazan videolarını YouTube Shorts ve Instagram Reels formatında yükle.',
    priority: 'high',
    aiPriorityScore: 70,
    aiRiskLevel: 'low',
    tags: ['reels', 'shorts', 'ramazan', 'selen'],
    delegationScore: 80,
    delegationRationale: 'Standart format dönüştürme ve yükleme işi, kolayca delege edilir.',
    source: 'telegram',
  },
  {
    title: 'Selen Mazgazioğlu — Bitmemiş Reels tamamlama',
    description: 'Selen Mazgazioğlu için bitmemiş reels içeriklerini tamamla ve yükle.',
    priority: 'high',
    aiPriorityScore: 68,
    aiRiskLevel: 'low',
    tags: ['reels', 'selen', 'kurgu'],
    delegationScore: 70,
    delegationRationale: 'Kurgu işi, editöre delege edilebilir.',
    source: 'telegram',
  },
  {
    title: 'YouTube Serileri — Şeflerle olan seriler başlangıç',
    description: 'YouTube şef serileri için çekimleri düzenle ve seriye başla.',
    priority: 'medium',
    aiPriorityScore: 60,
    aiRiskLevel: 'medium',
    tags: ['youtube', 'seri', 'sef'],
    delegationScore: 45,
    delegationRationale: 'Yaratıcı yönetim kararı gerektirir, başlangıç aşamasında kişisel takip önemli.',
    source: 'telegram',
  },
  {
    title: 'DH Reklam Filmi — Probe Lens kahvaltı çekimi araştırma',
    description: 'DH için güzel bir reklam filmi planlama. Kahvaltı probe lens çekimlerinin kurgusunu, hikaye yapısını ve etkili kancayı araştır. Referans reklam filmleri incele.',
    priority: 'high',
    aiPriorityScore: 75,
    aiRiskLevel: 'medium',
    tags: ['reklam', 'dh', 'probe-lens', 'kahvalti', 'arastirma'],
    delegationScore: 30,
    delegationRationale: 'Yaratıcı vizyon ve strateji gerektiren iş, kişisel yönetim şart.',
    source: 'telegram',
  },
  {
    title: 'Dekor Yapı / Aslan Yapı — Rapor ve sunum hazırlama',
    description: 'Dekor Yapı / Aslan Yapı için rapor oluştur ve güzel bir sunum formatında müşteriye gönder.',
    priority: 'high',
    aiPriorityScore: 78,
    aiRiskLevel: 'low',
    tags: ['rapor', 'sunum', 'dekor-yapi', 'musteri'],
    delegationScore: 55,
    delegationRationale: 'Rapor hazırlama delege edilebilir ama müşteri sunumu kişisel onay gerektirir.',
    source: 'telegram',
  },
  {
    title: 'Launcher — Customer Page tasarımı ve geliştirme',
    description: 'Launcher projesinin müşteri sayfasını (Customer Page) güzelce tasarla ve geliştir.',
    priority: 'medium',
    aiPriorityScore: 58,
    aiRiskLevel: 'low',
    tags: ['launcher', 'gelistirme', 'tasarim'],
    delegationScore: 40,
    delegationRationale: 'Teknik + tasarım kararı gerektiren iş, kısmen delege edilebilir.',
    source: 'telegram',
  },
  {
    title: 'Dom Prince — Kalan işlemleri tamamla',
    description: 'Dom Prince projesi için devam eden ve tamamlanmamış işlemleri bitir.',
    priority: 'medium',
    aiPriorityScore: 55,
    aiRiskLevel: 'low',
    tags: ['dom-prince', 'devam'],
    delegationScore: 60,
    delegationRationale: 'Tanımlı kalan işler, uygun kişiye delege edilebilir.',
    source: 'telegram',
  },
  {
    title: 'Firma Vergi Beyannamesi — Önümüzdeki hafta verilmeli',
    description: 'Firmanın vergi beyannamesini hazırla ve önümüzdeki hafta içinde ver.',
    priority: 'critical',
    aiPriorityScore: 90,
    aiRiskLevel: 'high',
    aiRiskFlags: ['yasal-deadline', 'mali-risk'],
    tags: ['vergi', 'muhasebe', 'beyanname'],
    dueDate: '2026-03-20',
    delegationScore: 25,
    delegationRationale: 'Mali sorumluluk ve yasal deadline — kişisel takip ve onay şart.',
    delegationBlockers: ['Yasal sorumluluk sahibi olarak kişisel imza gerekir'],
    source: 'telegram',
  },
  {
    title: 'Selen\'e fatura kesilecek mi sor',
    description: 'Selen Mazgazioğlu ile iletişime geç, fatura kesilip kesilmeyeceğini sor.',
    priority: 'medium',
    aiPriorityScore: 52,
    aiRiskLevel: 'low',
    tags: ['fatura', 'selen', 'muhasebe'],
    delegationScore: 20,
    delegationRationale: 'Müşteriyle doğrudan iletişim gerektiren karar — kişisel yapılmalı.',
    source: 'telegram',
  },
];

async function main() {
  const batch = db.batch();
  const now = new Date();

  for (const t of tasks) {
    const ref = db.collection('tasks').doc();
    const data = {
      id: ref.id,
      tenantId: TENANT_ID,
      title: t.title,
      description: t.description,
      status: 'open',
      priority: t.priority,
      aiPriorityScore: t.aiPriorityScore,
      aiRiskLevel: t.aiRiskLevel,
      createdBy: CREATED_BY,
      createdByName: CREATED_BY_NAME,
      createdAt: now,
      updatedAt: now,
      source: t.source,
      tags: t.tags || [],
      delegationScore: t.delegationScore,
      delegationRationale: t.delegationRationale,
    };
    if (t.aiRiskFlags) data.aiRiskFlags = t.aiRiskFlags;
    if (t.delegationBlockers) data.delegationBlockers = t.delegationBlockers;
    if (t.dueDate) data.dueDate = new Date(t.dueDate);

    batch.set(ref, data);
    console.log(`+ ${t.title} (delegasyon: ${t.delegationScore}/100)`);
  }

  await batch.commit();
  console.log(`\nToplam ${tasks.length} görev eklendi.`);
}

main().catch(console.error);
