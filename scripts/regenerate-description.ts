/**
 * Son videonun AI açıklamasını yeniden oluşturur
 * Kullanım: DOTENV_CONFIG_PATH=.env.local npx tsx scripts/regenerate-description.ts [videoId]
 *
 * videoId belirtilmezse en son eklenen videoyu işler
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load env files - try vercel first, then local
config({ path: resolve(process.cwd(), '.env.vercel-pulled') });
config({ path: resolve(process.cwd(), '.env.local') });

import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';

// Firebase Admin SDK'yı başlat
function initFirebase() {
  if (getApps().length > 0) return;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccount) {
    const parsed = JSON.parse(serviceAccount) as ServiceAccount;
    initializeApp({ credential: cert(parsed) });
  } else {
    // Default credentials kullan
    initializeApp();
  }
}

async function getLatestVideo(db: FirebaseFirestore.Firestore) {
  const snapshot = await db
    .collection('feedback_videos')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new Error('Hiç video bulunamadı');
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function getVideoById(db: FirebaseFirestore.Firestore, videoId: string) {
  const doc = await db.collection('feedback_videos').doc(videoId).get();
  if (!doc.exists) {
    throw new Error(`Video bulunamadı: ${videoId}`);
  }
  return { id: doc.id, ...doc.data() };
}

function buildPrompt(duration?: number, recordingMode?: string): string {
  const modeHint =
    recordingMode === 'screen'
      ? 'Bu bir ekran kaydidir.'
      : recordingMode === 'camera'
        ? 'Bu bir kamera kaydidir.'
        : recordingMode === 'screen_camera'
          ? 'Bu bir ekran ve kamera kaydidir.'
          : '';

  return `Bu bir geribildirim/inceleme kaydidir. ${modeHint}
${duration ? `Kayit suresi: ${Math.round(duration)} saniye.` : ''}

Bu video kaydini analiz et ve asagidaki JSON formatinda cevap ver:

{
  "title": "Kisa ve aciklayici bir baslik (maksimum 60 karakter, Turkce)",
  "description": "Kaydin icerigini ozetleyen 1-3 cumle (Turkce)"
}

ONEMLI:
- Sadece JSON don, baska bir sey yazma
- Eger konusma varsa, konusmaya dayali baslik ve aciklama olustur
- Eger konusma yoksa veya anlasilamiyorsa, genel bir baslik ver (ornegin "Ekran Kaydi - Geribildirim")
- Baslik kisa ve anlasilir olmali
- Tum icerik Turkce olmali`;
}

async function generateDescription(
  videoUrl: string,
  duration: number,
  recordingMode?: string
): Promise<{ title: string; description: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY tanımlanmamış');
  }

  console.log('📥 Video indiriliyor...');
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Video indirilemedi: ${videoResponse.statusText}`);
  }
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
  const mimeType = videoResponse.headers.get('content-type') || 'video/mp4';
  console.log(`   İndirilen boyut: ${Math.round(videoBuffer.length / (1024 * 1024))}MB`);

  const client = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(duration, recordingMode);

  console.log('📤 Gemini File API\'ye yükleniyor...');
  const uploadedFile = await client.files.upload({
    file: new Blob([videoBuffer], { type: mimeType }),
    config: { mimeType },
  });

  let file = uploadedFile;
  while (file.state === 'PROCESSING') {
    process.stdout.write('.');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    file = await client.files.get({ name: file.name! });
  }
  console.log('');

  if (file.state === 'FAILED') {
    throw new Error('Gemini file processing failed');
  }

  console.log('🤖 AI analiz yapıyor...');
  const result = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { fileUri: file.uri!, mimeType: file.mimeType! } },
          { text: prompt },
        ],
      },
    ],
    config: {
      temperature: 0.3,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  // Cleanup uploaded file
  try {
    await client.files.delete({ name: file.name! });
  } catch {
    // Non-critical
  }

  const responseText = result.text ?? '';
  if (!responseText) {
    throw new Error('Gemini boş yanıt döndü');
  }

  return JSON.parse(responseText);
}

async function updateVideoDescription(
  db: FirebaseFirestore.Firestore,
  videoId: string,
  title: string,
  description: string
) {
  await db.collection('feedback_videos').doc(videoId).update({
    title,
    description,
    status: 'ready',
    updatedAt: Timestamp.now(),
  });
}

async function main() {
  initFirebase();
  const db = getFirestore();

  const videoId = process.argv[2];

  console.log('📹 Video bilgisi alınıyor...');

  const video = videoId ? await getVideoById(db, videoId) : await getLatestVideo(db);

  console.log(`📌 Video: ${video.id}`);
  console.log(`   Mevcut başlık: ${(video as any).title}`);
  console.log(`   URL: ${(video as any).videoUrl?.substring(0, 80)}...`);

  if (!(video as any).videoUrl) {
    console.error('❌ Video URL bulunamadı');
    process.exit(1);
  }

  console.log('\n🤖 AI açıklama oluşturuluyor...');

  try {
    const result = await generateDescription(
      (video as any).videoUrl,
      (video as any).duration || 0,
      (video as any).recordingMode
    );

    console.log(`\n✅ Yeni başlık: ${result.title}`);
    console.log(`   Yeni açıklama: ${result.description}`);

    console.log('\n💾 Firestore güncelleniyor...');
    await updateVideoDescription(db, video.id, result.title, result.description);

    console.log('✅ Tamamlandı!');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

main();
