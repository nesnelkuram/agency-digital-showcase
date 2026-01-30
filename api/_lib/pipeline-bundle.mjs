// src/pipeline/geminiClient.ts
import { GoogleGenAI } from "@google/genai";
var MODEL_IDS = {
  flash: "gemini-2.0-flash",
  pro: "gemini-3-pro-preview"
};
var _client = null;
function getClient() {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}
async function generateJSON(tier, prompt, agentName, config) {
  const client = getClient();
  const result = await client.models.generateContent({
    model: MODEL_IDS[tier],
    contents: prompt,
    config: {
      temperature: config?.temperature ?? 0.7,
      topP: 0.9,
      maxOutputTokens: config?.maxOutputTokens ?? 4096,
      responseMimeType: "application/json",
      // gemini-3-pro-preview requires thinking mode; flash models don't support it
      ...tier === "pro" ? {} : { thinkingConfig: { thinkingBudget: 0 } }
    }
  });
  const text = result.text ?? "";
  if (!text) {
    throw new Error(`Agent "${agentName}" returned empty response from Gemini API`);
  }
  return safeParseJSON(text, agentName);
}
async function generateGroundedText(prompt, agentName, config) {
  const client = getClient();
  const result = await client.models.generateContent({
    model: MODEL_IDS.flash,
    contents: prompt,
    config: {
      temperature: config?.temperature ?? 0.4,
      topP: 0.9,
      maxOutputTokens: config?.maxOutputTokens ?? 8192,
      thinkingConfig: { thinkingBudget: 0 },
      tools: [{ googleSearch: {} }]
    }
  });
  const text = result.text ?? "";
  if (!text) {
    throw new Error(`Agent "${agentName}" returned empty grounded response`);
  }
  const candidate = result.candidates?.[0];
  const gm = candidate?.groundingMetadata ?? null;
  return {
    text,
    groundingMetadata: gm ? {
      webSearchQueries: gm.webSearchQueries ?? [],
      groundingChunks: (gm.groundingChunks ?? []).map((chunk) => ({
        web: chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : void 0
      }))
    } : null
  };
}
var DEEP_RESEARCH_AGENT = "deep-research-pro-preview-12-2025";
var POLL_INTERVAL_MS = 1e4;
async function startDeepResearch(prompt) {
  const client = getClient();
  try {
    const interaction = await client.interactions.create({
      agent: DEEP_RESEARCH_AGENT,
      input: prompt,
      background: true
    });
    const id = interaction.id;
    if (!id) {
      console.log("DeepResearch: No interaction ID returned");
      return null;
    }
    console.log(`DeepResearch: Interaction created \u2014 ${id}`);
    return id;
  } catch (createError) {
    console.error(`DeepResearch: create() failed \u2014 ${createError.message}`);
    return null;
  }
}
async function pollDeepResearch(interactionId, timeoutMs = 24e4) {
  const client = getClient();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const waitMs = Math.min(POLL_INTERVAL_MS, deadline - Date.now());
    if (waitMs <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    if (Date.now() >= deadline) break;
    try {
      const result = await client.interactions.get(interactionId);
      const status = result.status;
      console.log(`DeepResearch: poll status=${status}`);
      if (status === "completed") {
        const outputs = result.outputs || [];
        const textParts = outputs.filter((o) => o.type === "text" && o.text).map((o) => o.text);
        const text = textParts.join("\n\n");
        console.log(`DeepResearch: completed \u2014 ${text.length} chars from ${textParts.length} outputs`);
        return { text, status: "completed" };
      }
      if (status === "failed" || status === "cancelled") {
        console.log(`DeepResearch: ended with status=${status}`);
        return { text: "", status: "failed" };
      }
    } catch (pollError) {
      console.error(`DeepResearch: poll error \u2014 ${pollError.message}`);
      return { text: "", status: "failed" };
    }
  }
  console.log(`DeepResearch: timeout after ${timeoutMs}ms`);
  try {
    await client.interactions.cancel(interactionId);
  } catch {
  }
  return { text: "", status: "timeout" };
}
async function runDeepResearch(prompt, timeoutMs = 12e4) {
  const interactionId = await startDeepResearch(prompt);
  if (!interactionId) {
    return { text: "", status: "failed" };
  }
  return pollDeepResearch(interactionId, timeoutMs);
}
function safeParseJSON(text, agentName) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```json?\s*([\s\S]*?)```/);
    if (match) {
      return JSON.parse(match[1].trim());
    }
    throw new Error(`Agent "${agentName}" returned invalid JSON: ${text.slice(0, 200)}`);
  }
}

// src/pipeline/prompts.ts
var QUESTION_MAP = {
  fmcg: {
    "3": { question: "Uretim Tutarliligi", options: { varies: "Her parti farkli", similar: "Benzer ama degisken", mostly_stable: "Buyuk olcude sabit", certified: "Sertifikali kalite kontrol", other: "Diger" } },
    "4": { question: "Yogun Donem Kapasitesi", options: { collapses: "Yetersiz kaliyor", struggling: "Zorlaniyor", mostly_holds: "Cogunlukla karsiliyor", planned: "Planli kapasite", other: "Diger" } },
    "5": { question: "Talep Artisi Kapasitesi", options: { cannot: "Karsilayamayiz", partially: "Kismen karsilariz", yes: "Evet, karsilariz", other: "Diger" } },
    "9": { question: "Kayip Duygusu", options: { trust: "Guven", nostalgia: "Nostalji", discovery: "Kesif", health: "Saglikli yasam", pride: "Gurur", other: "Diger" } },
    "10": { question: "Deneyim Seviyesi", options: { basic: "Temel ihtiyac", quality_story: "Kalite + Hikaye", lifestyle: "Yasam tarzi", other: "Diger" } },
    "11": { question: "Urun Felsefesi", options: { traditional: "Geleneksel", modern_craft: "Modern zanaat", innovative: "Yenilikci", clean_label: "Temiz etiket", other: "Diger" } },
    "15": { question: "Kriz Tepkisi", options: { compensate: "Hemen telafi eder", defend: "Kalite standardini savunur", explain: "Seffaf aciklama yapar", challenge: "Kanit ister", redesign: "Sureci yeniden tasarlar", other: "Diger" } },
    "16": { question: "Ikna Yontemi", options: { consistency: "Tutarlilik", origin: "Kaynak hikayesi", certification: "Sertifika ve test", community: "Topluluk gucu", other: "Diger" } },
    "17": { question: "Iletisim Tonu", options: { minimal: "Minimal", warm: "Samimi", expert: "Uzman", provocative: "Cesur", other: "Diger" } },
    "21": { question: "En Zararli Tuketici Tipi", options: { price_only: "Sadece fiyat odakli", disloyal: "Kampanya bagimlisi", trend_chaser: "Trend takipcisi", copycat_buyer: "Market markasi tercihcisi", misinformed: "Yanlis bilgilenmis", other: "Diger" } },
    "22": { question: "Sorun Tipi", options: { margin: "Kar marji", perception: "Marka algisi", instability: "Talep istikrarsizligi", other: "Diger" } },
    "23": { question: "Yaklasim Tavri", options: { positioning: "Konumlandirma ile filtreleme", channel: "Kanal stratejisi", product_line: "Urun hatti ayrimi", other: "Diger" } },
    "27": { question: "Birincil Hedef", options: { awareness: "Marka bilinirigi", shelf_share: "Raf payi", premium: "Premium algi", loyalty: "Tuketici sadakati", other: "Diger" } },
    "28": { question: "Buyume Hizi", options: { fast: "Hizli penetrasyon", balanced: "Dengeli buyume", niche: "Nis derinlesme", other: "Diger" } },
    "29": { question: "Basari Isareti", options: { distribution: "Dagitim genisligi", repeat_purchase: "Tekrar satin alma", price_premium: "Fiyat primi", category_leader: "Kategori liderligi", export: "Ihracat", other: "Diger" } }
  },
  gastronomi: {
    "3": { question: "Deneyim Tutarliligi", options: { varies: "Kisiye gore degisiyor", similar: "Benzer ama degisken", mostly_stable: "Buyuk olcude sabit", sop_defined: "SOP ile net", other: "Diger" } },
    "4": { question: "Pik Saat Dayanikliligi", options: { collapses: "Cokuyor", struggling: "Zorlaniyor", mostly_holds: "Cogunlukla korunuyor", measured: "Olcumlu sekilde korunuyor", other: "Diger" } },
    "5": { question: "Talep Artisi Kapasitesi", options: { cannot: "Karsilayamayiz", partially: "Kismen karsilariz", yes: "Evet, karsilariz", other: "Diger" } },
    "9": { question: "Kayip Duygusu", options: { trust: "Guven", curiosity: "Merak", prestige: "Prestij", warmth: "Sicaklik", courage: "Cesaret", other: "Diger" } },
    "10": { question: "Deneyim Seviyesi", options: { food_only: "Yemek", food_ritual: "Yemek + Ritual", full_journey: "Bastan sona sahnelenmis yolculuk", other: "Diger" } },
    "11": { question: "Yorum Seviyesi", options: { authentic: "Otantik", respectful: "Saygili yorum", radical: "Radikal", rewrite: "Yeniden yazim", other: "Diger" } },
    "15": { question: "Kriz Tepkisi", options: { compensate: "Telafi eder", defend: "Standardi savunur", explain: "Aciklar", challenge: "Meydan okur", redesign: "Yeniden tasarlar", other: "Diger" } },
    "16": { question: "Ikna Yontemi", options: { sop: "SOP (Standart)", reference: "Referans", knowledge: "Bilgi", influence: "Etki", other: "Diger" } },
    "17": { question: "Iletisim Tonu", options: { minimal: "Minimal", prestigious: "Prestijli", warm: "Samimi", provocative: "Provokatif", other: "Diger" } },
    "21": { question: "En Zararli Kitle", options: { price_focused: "Fiyat odakli", closed_innovation: "Yenilige kapali", show_off: "Gosterisci", operation_disruptor: "Operasyon bozucu", atmosphere_disruptor: "Atmosfer bozucu", other: "Diger" } },
    "22": { question: "Sorun Tipi", options: { profitability: "Karlilik", culture: "Kultur", flow: "Akis", other: "Diger" } },
    "23": { question: "Yaklasim Tavri", options: { soft: "Nazik eleme", barrier: "Bariyer", hard_no: "Net red", other: "Diger" } },
    "27": { question: "Birincil Hedef", options: { awareness: "Bilinirlik", prestige: "Prestij", authority: "Otorite", reservation: "Rezervasyon", other: "Diger" } },
    "28": { question: "Buyume Hizi", options: { fast: "Hizli", balanced: "Dengeli", exclusive: "Seckin", other: "Diger" } },
    "29": { question: "Basari Isareti", options: { occupancy: "Doluluk", price_acceptance: "Fiyat sorgusu azalmasi", quality_guest: "Nitelikli misafir", guide_media: "Rehber/Medya", loyalty: "Sadakat", other: "Diger" } }
  },
  retail: {
    "3": { question: "Kanal Tutarliligi", options: { inconsistent: "Tamamen farkli", somewhat: "Kismen benzer", mostly: "Buyuk olcude tutarli", unified: "Tam entegre (omnichannel)", other: "Diger" } },
    "4": { question: "Yogun Donem Dayanikliligi", options: { collapses: "Cokuyor", struggling: "Zorlaniyor", mostly_holds: "Cogunlukla dayaniyor", thrives: "Guclenerek cikiyor", other: "Diger" } },
    "5": { question: "Talep Artisi Kapasitesi", options: { cannot: "Karsilayamayiz", partially: "Kismen karsilariz", yes: "Evet, karsilariz", other: "Diger" } },
    "9": { question: "Kayip Duygusu", options: { discovery: "Kesif", quality: "Kalite guvencesi", status: "Statu", trust: "Guven", convenience: "Kolaylik", other: "Diger" } },
    "10": { question: "Deneyim Seviyesi", options: { product_only: "Urun", product_experience: "Urun + Deneyim", full_journey: "Bastan sona sahnelenmis yolculuk", other: "Diger" } },
    "11": { question: "Fiyat-Deger Konumlandirmasi", options: { affordable: "Uygun fiyat", value: "Kalite-fiyat dengesi", premium: "Premium", luxury: "Luks", other: "Diger" } },
    "15": { question: "Kriz Tepkisi", options: { compensate: "Hemen telafi eder", defend: "Politikayi uygular", explain: "Durumu aciklar", challenge: "Meydan okur", redesign: "Cozum uretir", other: "Diger" } },
    "16": { question: "Ikna Yontemi", options: { consistency: "Tutarlilik", social_proof: "Sosyal kanit", expertise: "Uzmanlik", emotion: "Duygusal bag", other: "Diger" } },
    "17": { question: "Iletisim Tonu", options: { minimal: "Minimal", prestigious: "Prestijli", warm: "Samimi", provocative: "Provokatif", other: "Diger" } },
    "21": { question: "En Zararli Musteri Tipi", options: { serial_returner: "Seri iade yapan", discount_only: "Sadece indirim avcisi", theft_risk: "Hirsizlik/dolandiricilik riski", time_waster: "Zaman harcayan", brand_damager: "Marka imajini bozan", other: "Diger" } },
    "22": { question: "Sorun Tipi", options: { profitability: "Karlilik", culture: "Marka kulturu", operations: "Operasyon", other: "Diger" } },
    "23": { question: "Yaklasim Tavri", options: { soft: "Nazik yonlendirme", barrier: "Sistem bariyeri", hard_no: "Net sinir", other: "Diger" } },
    "27": { question: "Birincil Hedef", options: { awareness: "Bilinirlik", revenue: "Ciro artisi", market_share: "Pazar payi", loyalty: "Musteri sadakati", other: "Diger" } },
    "28": { question: "Buyume Hizi", options: { fast: "Hizli", balanced: "Dengeli", slow_premium: "Yavas ama degerli", other: "Diger" } },
    "29": { question: "Basari Isareti", options: { revenue_growth: "Ciro artisi", basket_average: "Sepet ortalamasi yukselisi", repeat_visit: "Tekrar ziyaret", brand_recognition: "Marka bilinirigi", other: "Diger" } }
  },
  corporate: {
    "3": { question: "Hizmet Teslimat Tutarliligi", options: { varies: "Kisiye gore degisiyor", similar: "Benzer ama degisken", mostly_stable: "Buyuk olcude sabit", sop_defined: "SOP ile net", other: "Diger" } },
    "4": { question: "Proje Yogunlugu Yonetimi", options: { collapses: "Cokuyor", struggling: "Zorlaniyor", mostly_holds: "Cogunlukla korunuyor", measured: "Olcumlu sekilde korunuyor", other: "Diger" } },
    "5": { question: "Is Hacmi Artisi Kapasitesi", options: { cannot: "Karsilayamayiz", partially: "Kismen karsilariz", yes: "Evet, karsilariz", other: "Diger" } },
    "9": { question: "Kayip Duygusu", options: { trust: "Guvenilirlik", innovation: "Yenilikcilik", prestige: "Prestij", partnership: "Ortaklik", expertise: "Uzmanlik", other: "Diger" } },
    "10": { question: "Hizmet Deneyim Seviyesi", options: { technical_solution: "Teknik Cozum", solution_consulting: "Cozum + Danismanlik", strategic_partnership: "Stratejik Ortaklik", other: "Diger" } },
    "11": { question: "Yaklasim Stili", options: { traditional: "Geleneksel", modern_twist: "Modern yorumlu", radical: "Radikal donusum", pioneer: "Sektor oncusu", other: "Diger" } },
    "15": { question: "Kriz Tepkisi", options: { compensate: "Telafi eder", defend: "Sureci savunur", explain: "Analiz eder ve aciklar", challenge: "Beklentiyi sorgular", redesign: "Yeniden tasarlar", other: "Diger" } },
    "16": { question: "Ikna Yontemi", options: { process: "Surec ve metodoloji", reference: "Referans ve sonuclar", knowledge: "Bilgi ve uzmanlik", relationship: "Iliski ve guven", other: "Diger" } },
    "17": { question: "Iletisim Tonu", options: { authoritative: "Otoriter ve guvenli", consultative: "Danisman ve yonlendirici", warm_professional: "Samimi ama profesyonel", provocative: "Provokatif ve dusundurcu", other: "Diger" } },
    "21": { question: "En Zararli Paydas Tipi", options: { price_hunter: "Fiyat avcisi", scope_creep: "Scope creep yapan", indecisive: "Karar veremeyen", micromanager: "Mikro yonetici", blame_shifter: "Suc atan", other: "Diger" } },
    "22": { question: "Sorun Tipi", options: { profitability: "Karlilik", culture: "Sirket kulturu", quality: "Teslimat kalitesi", reputation: "Itibar", other: "Diger" } },
    "23": { question: "Yaklasim Tavri", options: { soft: "Nazik yonlendirme", barrier: "Bariyer sistemi", hard_no: "Net red", other: "Diger" } },
    "27": { question: "Birincil Hedef", options: { authority: "Sektor otoritesi", volume: "Is hacmi buyutme", premium: "Premium konumlanma", talent: "Yetenek cekimi", other: "Diger" } },
    "28": { question: "Buyume Hizi", options: { aggressive: "Agresif", balanced: "Dengeli", selective: "Secici", other: "Diger" } },
    "29": { question: "Basari Isareti", options: { contract_value: "Sozlesme degeri", referral_rate: "Referans orani", awards: "Sektor odulleri", executive_recognition: "Yonetim kadrosu tanirliligi", renewal_rate: "Sozlesme yenileme orani", other: "Diger" } }
  },
  tech: {
    "3": { question: "Deneyim Tutarliligi", options: { inconsistent: "Cihaza gore degisiyor", mostly_similar: "Benzer ama degisken", largely_stable: "Buyuk olcude sabit", design_system: "Design system ile kontrollu", other: "Diger" } },
    "4": { question: "Yogunluk/Olceklenme Dayanikliligi", options: { crashes: "Cokuyor", degrades: "Belirgin yavasama", mostly_holds: "Cogunlukla dayaniyor", resilient: "Olcumlu sekilde dayanikli", other: "Diger" } },
    "5": { question: "10x Buyume Kapasitesi", options: { cannot: "Karsilayamayiz", partially: "Kismen karsilariz", ready: "Evet, haziriz", other: "Diger" } },
    "9": { question: "Kayip Duygusu", options: { innovation: "Inovasyon", reliability: "Guvenilirlik", speed: "Hiz", simplicity: "Sadelik", empowerment: "Guclenme", other: "Diger" } },
    "10": { question: "Deneyim Seviyesi", options: { function_only: "Fonksiyon", function_ux: "Fonksiyon + UX", full_ecosystem: "Tam ekosistem", other: "Diger" } },
    "11": { question: "Teknoloji Yaklasimi", options: { proven: "Kanitlanmis", modern: "Modern", experimental: "Deneysel", pioneer: "Oncu", other: "Diger" } },
    "15": { question: "Kriz Tepkisi", options: { transparent: "Seffaf paylasum", compensate: "Telafi eder", defend: "Standardi savunur", innovate: "Cozumle gelir", challenge: "Meydan okur", other: "Diger" } },
    "16": { question: "Ikna Yontemi", options: { data: "Veriyle", social_proof: "Sosyal kanitla", product_led: "Urunle", vision: "Vizyonla", other: "Diger" } },
    "17": { question: "Iletisim Tonu", options: { technical: "Teknik", friendly: "Samimi", authoritative: "Otoriter", provocative: "Provokatif", other: "Diger" } },
    "21": { question: "En Zararli Kullanici Tipi", options: { freeloader: "Bedavaci", feature_requester: "Ozellik talep bombardimani", support_abuser: "Destek istismarcisi", churn_risk: "Churn riski yuksek", scope_creep: "Kapsam genisletici", other: "Diger" } },
    "22": { question: "Sorun Tipi", options: { unit_economics: "Birim ekonomi", product_focus: "Urun odagi kaybi", team_morale: "Ekip morali", brand_dilution: "Marka sulanmasi", other: "Diger" } },
    "23": { question: "Filtreleme Yaklasimi", options: { soft: "Nazik yonlendirme", pricing: "Fiyatlandirma bariyeri", qualification: "Kullanici kalifikasyonu", other: "Diger" } },
    "27": { question: "Birincil Hedef", options: { user_base: "Kullanici tabani buyutme", mrr_arr: "MRR/ARR artisi", market_leadership: "Pazar liderligi", pmf: "Urun-pazar uyumu (PMF)", other: "Diger" } },
    "28": { question: "Buyume Hizi", options: { blitzscale: "Blitzscaling", sustainable: "Surdurulebilir", bootstrapped: "Organik / Bootstrap", other: "Diger" } },
    "29": { question: "Basari Isareti", options: { dau_mau: "DAU/MAU orani", churn_reduction: "Churn dususu", nps: "NPS skoru", funding: "Yatirim turu", revenue_milestone: "Gelir esigi", other: "Diger" } }
  },
  health: {
    "3": { question: "Deneyim Tutarliligi", options: { varies: "Kisiye gore degisiyor", similar: "Benzer ama degisken", mostly_stable: "Buyuk olcude sabit", sop_defined: "Protokollerle net", other: "Diger" } },
    "4": { question: "Yogun Donem Dayanikliligi", options: { collapses: "Cokuyor", struggling: "Zorlaniyor", mostly_holds: "Cogunlukla korunuyor", measured: "Olcumlu sekilde korunuyor", other: "Diger" } },
    "5": { question: "Talep Artisi Kapasitesi", options: { cannot: "Karsilayamayiz", partially: "Kismen karsilariz", yes: "Evet, karsilariz", other: "Diger" } },
    "9": { question: "Kayip Duygusu", options: { safety: "Guvenlik", expertise: "Uzmanlik", compassion: "Sefkat", hope: "Umut", trust: "Guven", other: "Diger" } },
    "10": { question: "Deneyim Seviyesi", options: { treatment_only: "Tedavi", treatment_care: "Tedavi + Bakim", holistic_journey: "Butunsel saglik yolculugu", other: "Diger" } },
    "11": { question: "Yaklasim Stili", options: { traditional: "Geleneksel tip", integrative: "Entegratif yaklasim", innovative: "Yenilikci", pioneer: "Oncu", other: "Diger" } },
    "15": { question: "Kriz Tepkisi", options: { compensate: "Telafi eder", defend: "Protokolu savunur", explain: "Egitir", innovate: "Alternatif sunar", challenge: "Beklenti yonetimi yapar", other: "Diger" } },
    "16": { question: "Ikna Yontemi", options: { evidence: "Kanit", reference: "Referans", empathy: "Empati", technology: "Teknoloji", other: "Diger" } },
    "17": { question: "Iletisim Tonu", options: { clinical: "Klinik & profesyonel", warm: "Sicak & empatik", educational: "Egitici & bilgilendirici", motivational: "Motive edici & ilham verici", other: "Diger" } },
    "21": { question: "En Zararli Danisan Tipi", options: { dr_google: "Dr. Google", price_only: "Sadece fiyat arayan", non_compliant: "Tedaviye uymayan", chronic_complainer: "Surekli sikayetci", miracle_seeker: "Mucize bekleyen", other: "Diger" } },
    "22": { question: "Sorun Tipi", options: { reputation: "Itibar", team_morale: "Ekip morali", operational: "Operasyonel", other: "Diger" } },
    "23": { question: "Yaklasim Tavri", options: { education: "Egitim ile yonlendirme", filtering: "On filtreleme", referral: "Yonlendirme", other: "Diger" } },
    "27": { question: "Birincil Hedef", options: { trust: "Guvenilirlik", volume: "Hasta hacmi", authority: "Uzmanlik otoritesi", digital: "Dijital saglik", other: "Diger" } },
    "28": { question: "Buyume Hizi", options: { aggressive: "Agresif", balanced: "Dengeli", selective: "Secici", other: "Diger" } },
    "29": { question: "Basari Isareti", options: { satisfaction: "Hasta memnuniyeti", occupancy: "Randevu doluluk orani", referral: "Referans orani", accreditation: "Akreditasyon & oduller", retention: "Hasta sadakati", other: "Diger" } }
  },
  education: {
    "3": { question: "Egitim Deneyimi Tutarliligi", options: { varies: "Egitmene gore degisiyor", similar: "Benzer ama degisken", mostly_stable: "Buyuk olcude sabit", sop_defined: "Standartlarla net", other: "Diger" } },
    "4": { question: "Yogun Donem Dayanikliligi", options: { collapses: "Cokuyor", struggling: "Zorlaniyor", mostly_holds: "Cogunlukla korunuyor", measured: "Olcumlu sekilde korunuyor", other: "Diger" } },
    "5": { question: "Talep Artisi Kapasitesi", options: { cannot: "Karsilayamayiz", partially: "Kismen karsilariz", yes: "Evet, karsilariz", other: "Diger" } },
    "9": { question: "Kayip Duygusu", options: { growth: "Gelisim", trust: "Guven", belonging: "Aidiyet", mastery: "Ustalik", inspiration: "Ilham", other: "Diger" } },
    "10": { question: "Deneyim Seviyesi", options: { knowledge_transfer: "Bilgi Aktarimi", knowledge_mentoring: "Bilgi + Mentorluk", full_transformation: "Tam Donusum Yolculugu", other: "Diger" } },
    "11": { question: "Yaklasim Stili", options: { classic: "Klasik", modern: "Modern", experimental: "Deneysel", revolutionary: "Devrimci", other: "Diger" } },
    "15": { question: "Kriz Tepkisi", options: { compensate: "Telafi eder", defend: "Standardi savunur", explain: "Veriyle aciklar", challenge: "Meydan okur", redesign: "Yeniden tasarlar", other: "Diger" } },
    "16": { question: "Ikna Yontemi", options: { results: "Sonuclarla", reference: "Referansla", knowledge: "Bilgiyle", experience: "Deneyimle", other: "Diger" } },
    "17": { question: "Iletisim Tonu", options: { authoritative: "Otoriter", inspiring: "Ilham verici", warm: "Samimi", provocative: "Provokatif", other: "Diger" } },
    "21": { question: "En Zararli Katilimci Tipi", options: { certificate_hunter: "Sertifika avcisi", unmotivated: "Motivasyonsuz", chronic_complainer: "Surekli sikayetci", payment_issue: "Odeme sorunu olan", disruptive: "Sinif duzeni bozucu", other: "Diger" } },
    "22": { question: "Sorun Tipi", options: { quality: "Egitim kalitesi dususu", reputation: "Itibar kaybi", financial: "Finansal kayip", culture: "Kurum kulturu erozyonu", other: "Diger" } },
    "23": { question: "Yaklasim Tavri", options: { soft: "Nazik yonlendirme", barrier: "Bariyer sistemi", hard_no: "Net kural", other: "Diger" } },
    "27": { question: "Birincil Hedef", options: { student_count: "Ogrenci sayisi", education_quality: "Egitim kalitesi", sector_authority: "Sektor otoritesi", digital_transformation: "Dijital donusum", other: "Diger" } },
    "28": { question: "Buyume Hizi", options: { fast: "Hizli", balanced: "Dengeli", selective: "Seckin", other: "Diger" } },
    "29": { question: "Basari Isareti", options: { graduate_success: "Mezun basarisi", enrollment_rate: "Kayit doluluk orani", nps: "NPS (Tavsiye Skoru)", accreditation: "Akreditasyon ve sertifikasyon", other: "Diger" } }
  }
};
var STAGE_NAMES = [
  "Operasyonel Gerceklik",
  "Marka Ruhu",
  "Marka Karakteri",
  "Kim Degiliz",
  "Hedef ve Basari"
];
var STAGE_QUESTION_IDS = [
  [3, 4, 5],
  [9, 10, 11],
  [15, 16, 17],
  [21, 22, 23],
  [27, 28, 29]
];
function resolveAnswers(sector, answers, scores) {
  const sectorMap = QUESTION_MAP[sector];
  if (!sectorMap) return JSON.stringify(answers);
  return STAGE_QUESTION_IDS.map((qIds, stageIdx) => {
    const stageName = STAGE_NAMES[stageIdx];
    const qaPairs = qIds.map((qId) => {
      const qIdStr = String(qId);
      const rawAnswer = answers[qIdStr];
      if (!rawAnswer) return null;
      const qInfo = sectorMap[qIdStr];
      const questionText = qInfo?.question || `Soru ${qIdStr}`;
      const answerLabel = qInfo?.options?.[rawAnswer] || rawAnswer;
      const score = scores[qIdStr];
      const scorePart = score !== void 0 ? ` (Skor: ${score})` : "";
      return `  - ${questionText}: ${answerLabel}${scorePart}`;
    }).filter(Boolean);
    if (qaPairs.length === 0) return null;
    return `### ${stageIdx}. ${stageName}
${qaPairs.join("\n")}`;
  }).filter(Boolean).join("\n\n");
}

// src/pipeline/agents/dataNormalizer.ts
async function runDataNormalizer(input) {
  const { contact, sector, wizard, requestedServices } = input;
  const resolvedQA = resolveAnswers(sector, wizard.answers, wizard.scores);
  const stageResultsSummary = (wizard.stageResults || []).map((s) => `- ${s.title || "Asama"}: ${s.description || ""} (Skor: ${s.score ?? "N/A"})`).join("\n");
  const servicesList = (requestedServices || []).map((s) => s.title).join(", ");
  const prompt = `Sen bir veri normalizasyon uzmanisisin. Asagidaki ham marka degerlendirme wizard verisini yapilandirilmis ve normalize edilmis bir formata donustur.

## Isletme Bilgileri
- Isletme Adi: ${contact.businessName}
- Sektor: ${sector}
- Talep Edilen Hizmetler: ${servicesList || "Belirtilmedi"}

## Asama Sonuclari
${stageResultsSummary || "Asama sonucu bulunamadi"}

## Detayli Soru-Cevaplar
${resolvedQA || "Cevap bulunamadi"}

---

Yukaridaki ham verileri analiz ederek asagidaki JSON yapisinda bir cikti uret:

{
  "sector": "sektor adi",
  "businessName": "isletme adi",
  "structuredAnswers": [
    {
      "stage": 0,
      "stageName": "Asama adi",
      "questions": [
        {
          "id": "soru id",
          "question": "soru metni",
          "answer": "ham cevap degeri",
          "answerLabel": "insanlar icin okunabilir cevap etiketi",
          "score": 0
        }
      ]
    }
  ],
  "detectedPatterns": ["Cevaplar arasinda tespit edilen oruntu ve temalar (3-5 adet)"],
  "contradictions": ["Cevaplar arasinda tespit edilen celiskiler (varsa)"],
  "dataQualityScore": 0.85,
  "missingAreas": ["Eksik veya yetersiz kalan alanlar (varsa)"],
  "overallProfile": "Isletmenin genel marka profilini ozetleyen 2-3 cumlelik dogal dilde bir metin. Isletmenin sektorunu, yaklasimini, guclu yanlarini ve genel konumlandirmasini icermeli."
}

ONEMLI KURALLAR:
1. "structuredAnswers" dizisinde her asama icin (${STAGE_NAMES.join(", ")}) bir girdi olustur. Her asamadaki sorulari etiketleriyle birlikte yaz.
2. "detectedPatterns" alaninda cevaplar arasindaki tutarli temalar\u0131, tekrar eden degerleri ve ortak egilimleri belirt (3-5 adet).
3. "contradictions" alaninda birbirleriyle celisen cevaplari tespit et. Celisi yoksa bos dizi don.
4. "dataQualityScore" 0 ile 1 arasinda bir deger olmali. Tum sorular cevaplanmissa 1.0'a yakin, eksik cevaplar varsa daha dusuk.
5. "missingAreas" alaninda cevaplanmamis veya yetersiz kalan alanlari listele. Hepsi tamamsa bos dizi don.
6. "overallProfile" alaninda isletmenin genel marka profilini dogal bir dille ozetle. Bu metin sonraki asamalarda diger ajanlar tarafindan kullanilacak.
7. Tum metinler TURKCE olmali.
8. Sadece JSON don, baska bir sey yazma.`;
  const parsed = await generateJSON("flash", prompt, "DataNormalizer", {
    temperature: 0.3,
    maxOutputTokens: 2048
  });
  return {
    sector: parsed.sector || sector,
    businessName: parsed.businessName || contact.businessName,
    structuredAnswers: parsed.structuredAnswers || [],
    detectedPatterns: parsed.detectedPatterns || [],
    contradictions: parsed.contradictions || [],
    dataQualityScore: typeof parsed.dataQualityScore === "number" ? parsed.dataQualityScore : 0.5,
    missingAreas: parsed.missingAreas || [],
    overallProfile: parsed.overallProfile || `${contact.businessName} - ${sector} sektorunde faaliyet gostermektedir.`
  };
}

// src/pipeline/agents/sectorResearch.ts
var EMPTY_RESEARCH = {
  competitors: [],
  marketData: {
    marketSize: "Veri bulunamadi",
    growthRate: "Veri bulunamadi",
    keyPlayers: [],
    consumerTrends: [],
    regulatoryFactors: []
  },
  targetAudienceInsights: {
    demographics: "Veri bulunamadi",
    psychographics: "Veri bulunamadi",
    painPoints: [],
    purchaseBehavior: "Veri bulunamadi"
  },
  opportunities: [],
  threats: [],
  sectorBenchmarks: [],
  searchQueries: [],
  sourcesUsed: 0,
  sourceUrls: [],
  rawSnippets: []
};
function buildDeepResearchPrompt(businessName, sector) {
  return `Sen bir sektor arastirmacisisin. Asagidaki marka hakkinda KAPSAMLI ve URUN BAZLI bir arastirma yap.

Marka: ${businessName}
Sektor: ${sector}

ARASTIRMA ADIMLARI (sirayla uygula):

ADIM 1 \u2014 MARKANIN KENDISI:
- "${businessName}" web sitesini bul ve ziyaret et.
- Hangi URUN ve HIZMETLERI sunuyor? Her birini listele.
- Fiyat araliklari nedir? (mumkunse gercek fiyatlar)
- Kendini nasil konumlandiriyor? (ucuz/orta/premium)
- Alt markalari varsa her birini ayri ayri incele.

ADIM 2 \u2014 URUN BAZLI RAKIP ANALIZI:
- Adim 1'de buldugun HER urun/hizmet kategorisi icin dogrudan rakipleri arastir.
- Ornek: Eger marka "findik kremasi" satiyorsa \u2192 "findik kremasi markalari Turkiye" ara.
- Her rakibin web sitesini ziyaret et.
- Rakip urun fiyatlarini karsilastir.
- Her rakibin guclu ve zayif yanlarini belirle (somut: urun cesitliligi, dagitim agi, fiyat, kalite algisi).
- EN AZ 4, EN FAZLA 8 rakip bul.

ADIM 3 \u2014 PAZAR VERILERI:
- Bu URUN KATEGORISININ (genel sektor degil, spesifik urun!) Turkiye'deki pazar buyuklugu.
- Yillik buyume orani veya trend yonu.
- Tuketici davranislari: Kim aliyor, nasil aliyor, ne siklikla aliyor.
- Fiyat hassasiyeti: Tuketiciler fiyat icin marka degistirir mi?

ADIM 4 \u2014 HEDEF KITLE PROFILI:
- Bu urunleri gercekte kimler satin aliyor?
- Yas araligi, gelir duzeyi, yasadiklari sehirler.
- Satin alma motivasyonlari (fiyat, kalite, marka, organik/dogal icerikleri vb.).
- Hangi kanallarda alisveris yapiyorlar (market, online, organik dukkan vb.).

SONUCLARI DETAYLI OLARAK TURKCE YAZ. Her bilginin kaynagini belirt.`;
}
async function runGroundingFallback(businessName, sector) {
  const today = (/* @__PURE__ */ new Date()).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const dateRule = `

ONEMLI: Bugun ${today} tarihidir. SADECE 2025-2026 yilina ait GUNCEL verileri ara. 2024 ve oncesi veriler YETERSIZDIR \u2014 daha guncel kaynak bul. Resmi kurum raporlari (TUIK, TMO, sanayi birlikleri, ihracatci birlikleri) ONCELIKLI kaynaktir.`;
  const competitorPrompt = `Sen bir sektor arastirmacisisin. ${sector} sektorunde Turkiye'de faaliyet gosteren ve "${businessName}" ile ayni segmentte rekabet eden markalari arastir. Her rakip icin gercek marka adi, web sitesi, konumlandirma, guclu/zayif yanlar, tahmini olcek bul. EN AZ 3, EN FAZLA 7 rakip. Turkce yaz.${dateRule}`;
  const marketPrompt = `Sen bir pazar arastirmacisisin. ${sector} sektoru icin Turkiye pazar buyuklugu, buyume hizi, tuketici profili, satin alma davranislari, dijital trendler arastir. Somut rakamlar ver. Turkce yaz.${dateRule}`;
  const trendPrompt = `${sector} sektoru ${businessName} icin firsatlar, tehditler, sektor standartlari, benchmark metrikler arastir. Turkce yaz.${dateRule}`;
  const [competitorRes, marketRes, trendRes] = await Promise.all([
    generateGroundedText(competitorPrompt, "SectorResearch-Competitors", { maxOutputTokens: 8192 }),
    generateGroundedText(marketPrompt, "SectorResearch-Market", { maxOutputTokens: 8192 }),
    generateGroundedText(trendPrompt, "SectorResearch-Trends", { maxOutputTokens: 8192 })
  ]);
  let allSourceUrls = [];
  let allSearchQueries = [];
  let sourcesUsed = 0;
  const allGroundedText = `## RAKIP ANALIZI
${competitorRes.text}

## PAZAR VE HEDEF KITLE
${marketRes.text}

## TRENDLER VE FIRSATLAR
${trendRes.text}`;
  for (const res of [competitorRes, marketRes, trendRes]) {
    if (res.groundingMetadata) {
      for (const chunk of res.groundingMetadata.groundingChunks) {
        if (chunk.web?.uri) {
          sourcesUsed++;
          allSourceUrls.push({ title: chunk.web.title || chunk.web.uri, url: chunk.web.uri });
        }
      }
      allSearchQueries.push(...res.groundingMetadata.webSearchQueries);
    }
  }
  const seen = /* @__PURE__ */ new Set();
  allSourceUrls = allSourceUrls.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
  return { allGroundedText, allSourceUrls, allSearchQueries, sourcesUsed };
}
async function runSectorResearch(input, options) {
  const { contact, sector } = input;
  const businessName = contact.businessName;
  const drTimeout = options?.drTimeout ?? 24e4;
  let researchText = "";
  let allSourceUrls = [];
  let allSearchQueries = [];
  let sourcesUsed = 0;
  let researchMethod = "none";
  try {
    if (options?.drInteractionId) {
      console.log(`SectorResearch: Polling pre-started DR (${options.drInteractionId}), timeout=${drTimeout}ms`);
      const drResult = await pollDeepResearch(options.drInteractionId, drTimeout);
      if (drResult.status === "completed" && drResult.text.length > 200) {
        researchText = drResult.text;
        researchMethod = "deep-research";
        console.log(`SectorResearch: Deep Research completed (${researchText.length} chars)`);
      } else {
        console.log(`SectorResearch: Deep Research ${drResult.status}, falling back to grounding...`);
      }
    } else {
      console.log("SectorResearch: Starting Deep Research...");
      const drResult = await runDeepResearch(
        buildDeepResearchPrompt(businessName, sector),
        drTimeout
      );
      if (drResult.status === "completed" && drResult.text.length > 200) {
        researchText = drResult.text;
        researchMethod = "deep-research";
        console.log(`SectorResearch: Deep Research completed (${researchText.length} chars)`);
      } else {
        console.log(`SectorResearch: Deep Research ${drResult.status}, falling back to grounding...`);
      }
    }
  } catch (error) {
    console.error("SectorResearch: Deep Research failed:", error);
  }
  if (!researchText) {
    const callerRemaining = options?.startTimeMs && options?.budgetMs ? options.budgetMs - (Date.now() - options.startTimeMs) : Infinity;
    if (callerRemaining < 7e4) {
      console.log(`SectorResearch: Skipping grounding fallback \u2014 only ${Math.round(callerRemaining / 1e3)}s remaining (need 70s)`);
      return { ...EMPTY_RESEARCH, searchQueries: [`${businessName} ${sector} Turkiye`], sourcesUsed: 0 };
    }
    try {
      console.log("SectorResearch: Running grounding fallback...");
      const fb = await runGroundingFallback(businessName, sector);
      researchText = fb.allGroundedText;
      allSourceUrls = fb.allSourceUrls;
      allSearchQueries = fb.allSearchQueries;
      sourcesUsed = fb.sourcesUsed;
      researchMethod = "grounding";
    } catch (error) {
      console.error("SectorResearch: Grounding fallback also failed:", error);
      return { ...EMPTY_RESEARCH, searchQueries: [`${businessName} ${sector} Turkiye`] };
    }
  }
  if (!researchText || researchText.length < 100) {
    console.log(`SectorResearch: Insufficient text (${researchText.length} chars), returning empty`);
    return { ...EMPTY_RESEARCH, searchQueries: allSearchQueries, sourcesUsed };
  }
  console.log(`SectorResearch: Using ${researchMethod} data (${researchText.length} chars, ${sourcesUsed} sources)`);
  const extractionPrompt = `Asagidaki arastirma metnini analiz ederek JSON yapisinda yapilandir.
ONEMLI: Metinde gecen TUM somut bilgileri koru. Bilgi UYDURMADAN sadece metinde olan bilgileri yapilandir.

## Arastirma Metni
${researchText.slice(0, 4e4)}

${allSourceUrls.length > 0 ? `## Kaynaklar
${allSourceUrls.map((s) => `- [${s.title}](${s.url})`).join("\n")}` : ""}

---
JSON yapisi:
{
  "competitors": [
    {
      "name": "Gercek marka adi",
      "website": "Web sitesi URL'si",
      "positioning": "Pazar konumlandirmasi ve fiyat segmenti",
      "strengths": ["Guclu yan 1", "Guclu yan 2"],
      "weaknesses": ["Zayif yan 1"],
      "estimatedScale": "Olcek bilgisi (sube, calisan, ciro)",
      "socialPresence": "Sosyal medya bilgisi",
      "sourceSnippet": "Bu bilginin kaynagi"
    }
  ],
  "marketData": {
    "marketSize": "Pazar buyuklugu (rakam)",
    "growthRate": "Buyume orani",
    "keyPlayers": ["Buyuk oyuncu 1"],
    "consumerTrends": ["Tuketici trendi 1"],
    "regulatoryFactors": ["Duzenleme 1"]
  },
  "targetAudienceInsights": {
    "demographics": "Yas, cinsiyet, gelir, lokasyon",
    "psychographics": "Degerler, yasam tarzi",
    "painPoints": ["Ihtiyac 1", "Ihtiyac 2"],
    "purchaseBehavior": "Satin alma davranisi"
  },
  "opportunities": ["Firsat 1", "Firsat 2"],
  "threats": ["Tehdit 1", "Tehdit 2"],
  "sectorBenchmarks": ["Benchmark 1"]
}

KURALLAR:
1. EN AZ 3 rakip. Metinde adi gecen TUM rakipleri dahil et.
2. Urun bazli rakip bilgileri oncelikli (sadece sektor degil, spesifik urun kategorisi).
3. Metinde olmayan bilgiyi UYDURMADAN "Veri bulunamadi" yaz.
4. Tum metinler TURKCE.
5. Sadece JSON don.`;
  try {
    const parsed = await generateJSON("pro", extractionPrompt, "SectorResearch-Extract", {
      temperature: 0.5,
      maxOutputTokens: 8192
    });
    return {
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors.map((c) => ({
        name: c.name || "Bilinmiyor",
        website: c.website || "",
        positioning: c.positioning || "",
        strengths: Array.isArray(c.strengths) ? c.strengths : [],
        weaknesses: Array.isArray(c.weaknesses) ? c.weaknesses : [],
        estimatedScale: c.estimatedScale || "",
        socialPresence: c.socialPresence || "",
        sourceSnippet: c.sourceSnippet || ""
      })) : [],
      marketData: {
        marketSize: parsed.marketData?.marketSize || "Veri bulunamadi",
        growthRate: parsed.marketData?.growthRate || "Veri bulunamadi",
        keyPlayers: Array.isArray(parsed.marketData?.keyPlayers) ? parsed.marketData.keyPlayers : [],
        consumerTrends: Array.isArray(parsed.marketData?.consumerTrends) ? parsed.marketData.consumerTrends : [],
        regulatoryFactors: Array.isArray(parsed.marketData?.regulatoryFactors) ? parsed.marketData.regulatoryFactors : []
      },
      targetAudienceInsights: {
        demographics: parsed.targetAudienceInsights?.demographics || "Veri bulunamadi",
        psychographics: parsed.targetAudienceInsights?.psychographics || "Veri bulunamadi",
        painPoints: Array.isArray(parsed.targetAudienceInsights?.painPoints) ? parsed.targetAudienceInsights.painPoints : [],
        purchaseBehavior: parsed.targetAudienceInsights?.purchaseBehavior || "Veri bulunamadi"
      },
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
      threats: Array.isArray(parsed.threats) ? parsed.threats : [],
      sectorBenchmarks: Array.isArray(parsed.sectorBenchmarks) ? parsed.sectorBenchmarks : [],
      searchQueries: allSearchQueries,
      sourcesUsed: researchMethod === "deep-research" ? -1 : sourcesUsed,
      // -1 = Deep Research (many)
      sourceUrls: allSourceUrls,
      rawSnippets: [researchText.slice(0, 1e4)]
    };
  } catch (error) {
    console.error("SectorResearch: JSON extraction failed:", error);
    return {
      ...EMPTY_RESEARCH,
      searchQueries: allSearchQueries,
      sourcesUsed: researchMethod === "deep-research" ? -1 : sourcesUsed,
      // preserve DR flag even on extraction failure
      sourceUrls: allSourceUrls,
      rawSnippets: [researchText.slice(0, 1e4)]
    };
  }
}

// src/pipeline/agents/brandStrategist.ts
async function runBrandStrategist(normalizedData, researchFindings) {
  const answersSummary = normalizedData.structuredAnswers.map((stage) => {
    const questions = stage.questions.map((q) => `  - ${q.question}: ${q.answerLabel}${q.score !== void 0 ? ` (Skor: ${q.score})` : ""}`).join("\n");
    return `### ${stage.stage}. ${stage.stageName}
${questions}`;
  }).join("\n\n");
  let researchContext = "";
  const hasResearch = researchFindings && researchFindings.sourcesUsed !== 0;
  if (hasResearch) {
    const competitorSummary = researchFindings.competitors.map((c) => `  - ${c.name}${c.website ? ` (${c.website})` : ""}: ${c.positioning}
    Olcek: ${c.estimatedScale || "Bilinmiyor"} | Sosyal: ${c.socialPresence || "Bilinmiyor"}
    Guclu: ${c.strengths.join(", ")} | Zayif: ${c.weaknesses.join(", ")}`).join("\n");
    const marketInfo = researchFindings.marketData;
    const audience = researchFindings.targetAudienceInsights;
    researchContext = `
## Sektor Arastirmasi Bulgulari (Gercek Web Verileri)

### Rakipler
${competitorSummary || "Rakip bilgisi bulunamadi"}

### Pazar Verileri
- Pazar Buyuklugu: ${marketInfo.marketSize}
- Buyume Hizi: ${marketInfo.growthRate}
- Anahtar Oyuncular: ${marketInfo.keyPlayers.join(", ") || "Bilinmiyor"}
- Tuketici Trendleri: ${marketInfo.consumerTrends.join("; ") || "Bilinmiyor"}

### Hedef Kitle Insight'lari (Arastirma Verisi)
- Demografi: ${audience.demographics}
- Psikografi: ${audience.psychographics}
- Acil Ihtiyaclar: ${audience.painPoints.join("; ") || "Bilinmiyor"}
- Satin Alma Davranisi: ${audience.purchaseBehavior}

### Firsatlar
${researchFindings.opportunities.map((o) => `- ${o}`).join("\n") || "Bilgi yok"}

### Tehditler
${researchFindings.threats.map((t) => `- ${t}`).join("\n") || "Bilgi yok"}
`;
  }
  const competitorNames = hasResearch ? researchFindings.competitors.map((c) => c.name) : [];
  const competitiveMapSchema = competitorNames.length > 0 ? competitorNames.map((name) => `    { "competitorName": "${name}", "theirPosition": "...", "ourAdvantage": "...", "ourWeakness": "..." }`).join(",\n") : `    { "competitorName": "Rakip Adi", "theirPosition": "...", "ourAdvantage": "...", "ourWeakness": "..." }`;
  const prompt = `Sen deneyimli bir marka stratejistisin. Asagidaki veriyi analiz ederek markanin konumlandirilmasi icin detayli ve KANIT TABANLI bir strateji olustur.

## Isletme Profili
- Isletme: ${normalizedData.businessName}
- Sektor: ${normalizedData.sector}
- Genel Profil: ${normalizedData.overallProfile}

## Yapilandirilmis Cevaplar
${answersSummary || "Cevap bilgisi mevcut degil"}

## Tespit Edilen Oruntular
${normalizedData.detectedPatterns.map((p) => `- ${p}`).join("\n") || "Oruntu tespit edilmedi"}

## Celiskiler
${normalizedData.contradictions.length > 0 ? normalizedData.contradictions.map((c) => `- ${c}`).join("\n") : "Celiski tespit edilmedi"}

## Veri Kalitesi: ${normalizedData.dataQualityScore}
${researchContext}
---

Yukaridaki tum verileri analiz ederek asagidaki JSON yapisinda bir marka stratejisi olustur:

{
  "archetype": "Jung arketiplerinden en uygun olan (Turkce: Bakim Veren, Yaratici, Bilge, Kahraman, Asi, Sihirbaz, Asik, Soytari, Masum, Kasif, Kral, Siradan Adam)",
  "archetypeRationale": "Bu arketype neden secildiginin KANITLARLA aciklamasi. Hangi wizard cevaplari, hangi sektor verileri, hangi rakip konumlandirmalari bu secimi destekliyor? (3-5 cumle, somut referanslarla)",
  "traits": ["Markanin 3-5 temel kisilik ozelligi. Her biri SEKTORE OZGU ve OLCULEBILIR olmali. 'Yenilikci' gibi genel sifatlar YASAK."],
  "tone": "Markanin iletisim tonu. ORNEK CUMLE ile goster: 'Sicak ve samimi \u2014 ornegin: Hosgeldiniz! Sizin icin en iyisini bulmaya haziriz.'",
  "voice": "Markanin sesi. ORNEK CUMLE ile goster: 'Bilgili ama ukala olmayan \u2014 ornegin: Bu konuda sunu bilmeniz faydali olur...'",
  "positioningStatement": "Markanin konumlandirma cumlesi. FORMAT: '[Hedef kitle] icin [fark yaratan ozellik] sunan [marka] dir.' \u2014 SOMUT ve OLCULEBILIR olacak. (1-2 cumle)",
  "valuePropositionReasoning": {
    "whatBusinessProduces": "Bu isletme ne uretiyor/sunuyor? SOMUT urun/hizmet listesi. Arastirma verisinde buldugun gercek urunleri yaz.",
    "coreBenefit": "Musteriye sagladigi TEMEL fayda nedir? Tek cumle.",
    "whoBenefits": "Bu faydadan KIM yararlanir? DAVRANISSAL tanimla (demografik degil).",
    "pricePositioning": "Fiyat konumlandirmasi: ucuz/orta/premium? RAKAMLARLA. Ornek: 'Orta-ust: findik kremasi 400g 89 TL \u2014 Nutella 59 TL, Nusret 129 TL'",
    "willingToPayProfile": "Bu fiyati ODEMEYE ISTEKLI kisi profili. Gelir seviyesi, harcama aliskanligiI."
  },
  "targetAudience": {
    "primarySegment": {
      "segmentLabel": "Birincil Segment",
      "demographics": "Yas ARALIGI, lokasyon tipi, meslek GRUBU, gelir ARALIGI. Ornek: '25-40 yas, buyuksehir, beyaz yakali, aylik 20-35K TL'",
      "behavioralProfile": "Tuketim davranislari \u2014 SOMUT. Ornek: 'Organik market musterisi, etiket okuyan, haftalik 2+ online alisveris'",
      "coreNeed": "Bu segmentin BU ISLETMEDEN beklentisi \u2014 tek cumle",
      "mediaHabits": "Hangi platformlar, ne siklikla. Ornek: 'Instagram, YouTube saglikli yasam kanallari, gunde 2+ saat'",
      "purchaseTriggers": ["Satin alma tetikleyicileri \u2014 3-5 adet. SPESIFIK: 'kalite' degil, 'icerik etiketi temizligi' gibi"],
      "estimatedSegmentSize": "Bu segmentin Turkiye'deki tahmini buyuklugu \u2014 kaynak belirt"
    },
    "secondarySegment": {
      "segmentLabel": "Ikincil Segment",
      "demographics": "Farkli yas araligi/gelir/meslek grubu",
      "behavioralProfile": "Farkli tuketim davranisi",
      "coreNeed": "...",
      "mediaHabits": "...",
      "purchaseTriggers": ["..."],
      "estimatedSegmentSize": "..."
    },
    "marketSizeEstimate": "Toplam adreslenebilir pazar (TAM) ve hizmet verilebilir pazar (SAM) tahmini"
  },
  "differentiator": "Markayi rakiplerinden ayiran temel fark. SOMUT ve OLCULEBILIR: 'X rakibinin sunmadigi Y hizmetini sunuyoruz' gibi. (1-2 cumle)",
  "competitiveAdvantage": "Markanin rekabet avantaji. Neden musteriler X, Y, Z yerine bu markayi secmeli? SOMUT kanit ile. (1-2 cumle)",
  "competitiveMap": [
${competitiveMapSchema}
  ]
}

KRITIK KURALLAR:
1. KANIT ZORUNLULUGU: Her iddia icin kaynak goster. "Premium" diyorsan wizard cevabi veya sektor verisinden NEDEN premium oldugunu acikla. Kanitlanmayan iddia = BASARISIZ rapor.
2. BOS LAF YASAK: "Yenilikci ve dinamik", "kaliteli ve guvenilir", "musteri odakli" gibi HER MARKAYA soylenebilecek sifatlar YASAK. "${normalizedData.businessName}'in [somut ozelliginden] kaynaklanan [somut avantaj]" gibi SPESIFIK ol.
3. SEGMENT KURALLARI: a) Kurgusal karakter KESINLIKLE YASAK \u2014 "Ayse, 32" gibi isim YAZMA. b) Oncelikle valuePropositionReasoning'i doldur \u2014 ne uretiliyor, kime fayda, fiyat ne? c) Segmentler DAVRANISSAL: tuketim sikligi, kanal tercihi, harcama aliskanligi. d) demographics = yas ARALIGI, gelir ARALIGI, meslek GRUBU. e) estimatedSegmentSize icin KAYNAK goster (TUIK, sektor raporu). f) purchaseTriggers SPESIFIK: "kalite" degil \u2192 "Instagram'da gordugun gorsel cazibe" gibi.
4. "competitiveMap" alaninda arastirmada bulunan HER rakip icin somut avantaj/dezavantaj belirt. Yoksa en az 2 rakip tanimla.
5. "archetypeRationale" alaninda hangi wizard cevaplari (soru ID veya icerik) ve hangi sektor verileri bu secimi destekledigini ACIKCA belirt.
6. "tone" ve "voice" alanlarinda ORNEK CUMLE ver \u2014 soyut tanimlama yerine gercek bir cumle yaz.
7. ${hasResearch ? "Sektor arastirmasi bulgularini TUM alanlarda referans olarak kullan. Rakip isimlerini DOGRUDAN kullan." : "Sektor arastirmasi mevcut degil, wizard verilerinden yola cikarak en somut stratejiyi olustur. Genel sifatlardan kacin."}
8. Tum metinler TURKCE olmali.
9. Sadece JSON don, baska bir sey yazma.`;
  const parsed = await generateJSON("pro", prompt, "BrandStrategist", {
    temperature: 0.7,
    maxOutputTokens: 8192
  });
  const defaultSegment = {
    segmentLabel: "Belirtilmedi",
    demographics: "Belirtilmedi",
    behavioralProfile: "Belirtilmedi",
    coreNeed: "Belirtilmedi",
    mediaHabits: "Belirtilmedi",
    purchaseTriggers: ["Belirtilmedi"],
    estimatedSegmentSize: "Belirtilmedi"
  };
  const defaultValuePropReasoning = {
    whatBusinessProduces: "Belirtilmedi",
    coreBenefit: "Belirtilmedi",
    whoBenefits: "Belirtilmedi",
    pricePositioning: "Belirtilmedi",
    willingToPayProfile: "Belirtilmedi"
  };
  return {
    archetype: parsed.archetype || "Yaratici",
    archetypeRationale: parsed.archetypeRationale || "Arketip secimi mevcut verilerle belirlenmistir.",
    traits: Array.isArray(parsed.traits) && parsed.traits.length > 0 ? parsed.traits : ["Sektore ozgu ozellik belirlenemedi"],
    tone: parsed.tone || "Profesyonel ve samimi",
    voice: parsed.voice || "Bilgili ve ulas\u0131labilir",
    positioningStatement: parsed.positioningStatement || `${normalizedData.businessName}, ${normalizedData.sector} sektorunde fark yaratan bir markadir.`,
    valuePropositionReasoning: parsed.valuePropositionReasoning ? { ...defaultValuePropReasoning, ...parsed.valuePropositionReasoning } : defaultValuePropReasoning,
    targetAudience: {
      primarySegment: parsed.targetAudience?.primarySegment ? { ...defaultSegment, ...parsed.targetAudience.primarySegment } : defaultSegment,
      secondarySegment: parsed.targetAudience?.secondarySegment ? { ...defaultSegment, ...parsed.targetAudience.secondarySegment } : defaultSegment,
      marketSizeEstimate: parsed.targetAudience?.marketSizeEstimate || "Tahmin mevcut degil"
    },
    differentiator: parsed.differentiator || "Farklilik bilgisi belirlenememistir.",
    competitiveAdvantage: parsed.competitiveAdvantage || "Rekabet avantaji bilgisi belirlenememistir.",
    competitiveMap: Array.isArray(parsed.competitiveMap) && parsed.competitiveMap.length > 0 ? parsed.competitiveMap : []
  };
}

// src/pipeline/agents/brandChallenger.ts
async function runBrandChallenger(normalizedData, researchFindings, strategistOutput) {
  let researchContext = "";
  const hasResearch = researchFindings && researchFindings.sourcesUsed !== 0;
  if (hasResearch) {
    const competitorSummary = researchFindings.competitors.map((c) => `- ${c.name}${c.website ? ` (${c.website})` : ""}: ${c.positioning}
    Olcek: ${c.estimatedScale || "Bilinmiyor"} | Sosyal: ${c.socialPresence || "Bilinmiyor"}
    Guclu: ${c.strengths.join(", ")} | Zayif: ${c.weaknesses.join(", ")}`).join("\n");
    const marketInfo = researchFindings.marketData;
    const audience = researchFindings.targetAudienceInsights;
    researchContext = `
## Sektor Arastirmasi Verileri

### Rakipler (Dogrulanmis)
${competitorSummary || "Bilgi yok"}

### Pazar Verileri
- Pazar Buyuklugu: ${marketInfo.marketSize}
- Buyume Hizi: ${marketInfo.growthRate}
- Tuketici Trendleri: ${marketInfo.consumerTrends.join("; ") || "Bilgi yok"}

### Hedef Kitle Verileri
- Demografi: ${audience.demographics}
- Acil Ihtiyaclar: ${audience.painPoints.join("; ") || "Bilgi yok"}
- Satin Alma: ${audience.purchaseBehavior}

### Firsatlar
${researchFindings.opportunities.map((o) => `- ${o}`).join("\n") || "Bilgi yok"}

### Tehditler
${researchFindings.threats.map((t) => `- ${t}`).join("\n") || "Bilgi yok"}

### Sektor Standartlari
${researchFindings.sectorBenchmarks.map((b) => `- ${b}`).join("\n") || "Bilgi yok"}
`;
  }
  const taSegments = strategistOutput.targetAudience;
  const targetAudienceSummary = typeof taSegments === "string" ? taSegments : `Birincil Segment: ${taSegments.primarySegment?.demographics || "Belirtilmedi"} \u2014 ${taSegments.primarySegment?.behavioralProfile || ""}
Ikincil Segment: ${taSegments.secondarySegment?.demographics || "Belirtilmedi"} \u2014 ${taSegments.secondarySegment?.behavioralProfile || ""}`;
  const vpReasoning = strategistOutput.valuePropositionReasoning;
  const vpSummary = vpReasoning ? `
- Urun/Hizmet: ${vpReasoning.whatBusinessProduces}
- Temel Fayda: ${vpReasoning.coreBenefit}
- Kimin Icin: ${vpReasoning.whoBenefits}
- Fiyat Konumlandirmasi: ${vpReasoning.pricePositioning}` : "";
  const prompt = `Sen deneyimli bir marka danismanisin ve SEYTAN AVUKATI olarak gorev yapiyorsun. Bir baska strateji uzmani asagidaki marka konumlandirmasini onerdi. Senin gorevin bu stratejiyi ELESTIREL ve KANIT TABANLI gozle incelemek.

## Isletme Bilgileri
- Isletme: ${normalizedData.businessName}
- Sektor: ${normalizedData.sector}
- Genel Profil: ${normalizedData.overallProfile}

## Onerilen Strateji (Strateji Uzmani Ciktisi)
- Arketip: ${strategistOutput.archetype}
- Arketip Gerekce: ${strategistOutput.archetypeRationale}
- Kisilik Ozellikleri: ${strategistOutput.traits.join(", ")}
- Iletisim Tonu: ${strategistOutput.tone}
- Marka Sesi: ${strategistOutput.voice}
- Konumlandirma: ${strategistOutput.positioningStatement}
- Hedef Kitle: ${targetAudienceSummary}${vpSummary}
- Farklilik: ${strategistOutput.differentiator}
- Rekabet Avantaji: ${strategistOutput.competitiveAdvantage}

## Normalize Edilmis Veri
### Tespit Edilen Oruntular
${normalizedData.detectedPatterns.map((p) => `- ${p}`).join("\n") || "Oruntu yok"}

### Celiskiler
${normalizedData.contradictions.length > 0 ? normalizedData.contradictions.map((c) => `- ${c}`).join("\n") : "Celiski yok"}

### Veri Kalitesi: ${normalizedData.dataQualityScore}
${researchContext}
---

Yukaridaki stratejiyi elestirel gozle inceleyerek asagidaki JSON yapisinda bir karsi-analiz olustur:

{
  "counterPosition": "Onerilen stratejiye SOMUT VE KANITLI karsi-pozisyon. Hangi SEKTOR VERISI veya RAKIP BILGISI stratejinin zayif noktasini gosteriyor? (2-3 cumle, referanslarla)",
  "alternativeArchetype": "Alternatif bir Jung arktipi onerisi (Turkce)",
  "alternativeArchetypeRationale": "Neden bu alternatif arktipin DAHA UYGUN olabileceginin KANITLI aciklamasi. Hangi wizard cevaplari veya pazar verileri bu alternatifi destekliyor? (2-3 cumle)",
  "challengePoints": [
    "ELESTIRI 1: Somut sorun + KANIT. Ornek: 'Stratejist premium konumlanma oneriyor, ancak sektor arastirmasina gore [rakip X] zaten premium segmentte %40 pazar payina sahip. Yeni giris icin bu segment riskli.'",
    "ELESTIRI 2: Farkli bir alana odaklanan somut sorun + kanit.",
    "ELESTIRI 3: Uygulama riskleri veya gozden kacirilan faktor + kanit."
  ],
  "alternativePositionings": [
    "ALTERNATIF 1: Hangi rakibin hangi acigini kullanarak ne tarz bir konumlandirma yapilabilir? Somut cumle. (1-2 cumle)",
    "ALTERNATIF 2: Farkli bir hedef kitleye veya segmente yonelik alternatif. (1-2 cumle)"
  ],
  "riskAssessment": "Onerilen stratejinin uygulanmasi halinde ortaya cikabilecek SOMUT riskler. Hangi pazar kosullar\u0131, hangi rakip hamleleri, hangi tuketici davranisi degisikligi bu stratejiyi tehlikeye atabilir? (2-3 cumle)",
  "blindSpots": [
    "KOR NOKTA 1: Arastirma verilerinde gozuken ama stratejistin GORMEZDEN GELDIGI trend veya tehdit. Ornek: 'Arastirma [trend X]'i gosteriyor, stratejist bunu hic ele almamis.'",
    "KOR NOKTA 2: Eksik birakilmis onemli bir faktor."
  ]
}

KRITIK KURALLAR:
1. Elestiriler YAPICI olmali \u2014 amac stratejiyi GELISTIRMEK, cokertmek degil.
2. HER elestiri KANIT icermeli: sektor verisi, rakip ornegi, tuketici trendi veya wizard cevabi referans gosterilmeli. KANIITSIZ elestiri = BASARISIZ rapor.
3. "challengePoints" 3-5 adet olmali. Her biri FARKLI bir alana odaklanmali: pazar, hedef kitle, rekabet, uygulama, iletisim.
4. "alternativePositionings" 2-3 adet olmali. Her biri SOMUT bir rakibin SOMUT bir acigini kullanmali.
5. "blindSpots" icin arastirma verisinde gordugun ama stratejistin kullanmadigi bilgileri isaret et.
6. BOS LAF YASAK: "Hedef kitle daha da daraltilabilir" gibi GENEL ifadeler YASAK. "Arastirmaya gore [segment X] %Y buyume gosteriyor, stratejist bunu dahil etmemis" gibi SPESIFIK ol.
7. ${hasResearch ? "Sektor arastirmasi bulgularini DOGRUDAN referans goster. Rakip isimlerini kullan." : "Sektor arastirmasi mevcut degil, genel sektor bilgini kullanarak somut elestiriler sun."}
8. Tum metinler TURKCE olmali.
9. Sadece JSON don, baska bir sey yazma.`;
  const parsed = await generateJSON("pro", prompt, "BrandChallenger", {
    temperature: 0.8,
    maxOutputTokens: 8192
  });
  return {
    counterPosition: parsed.counterPosition || "Strateji genel olarak tutarli, ancak alternatif bakis acilari dikkate alinmali.",
    alternativeArchetype: parsed.alternativeArchetype || "Bilge",
    alternativeArchetypeRationale: parsed.alternativeArchetypeRationale || "Alternatif arketip degerlendirmesi mevcut verilerle sinirlidir.",
    challengePoints: Array.isArray(parsed.challengePoints) && parsed.challengePoints.length > 0 ? parsed.challengePoints : ["Hedef kitle tanimi daha da daraltilabilir", "Rekabet avantaji daha somut hale getirilebilir", "Uygulama plani detaylandirilmali"],
    alternativePositionings: Array.isArray(parsed.alternativePositionings) && parsed.alternativePositionings.length > 0 ? parsed.alternativePositionings : ["Alternatif konumlandirma belirlenememistir"],
    riskAssessment: parsed.riskAssessment || "Risk degerlendirmesi icin daha fazla veri gerekmektedir.",
    blindSpots: Array.isArray(parsed.blindSpots) && parsed.blindSpots.length > 0 ? parsed.blindSpots : ["Dijital donusum sureci yeterince ele alinmamis olabilir", "Musteri deneyimi perspektifi guclendirilmeli"]
  };
}

// src/pipeline/agents/strategySynthesizer.ts
async function runStrategySynthesizer(normalizedData, researchFindings, strategistOutput, challengerOutput) {
  const taSegments = strategistOutput.targetAudience;
  const targetAudienceSummary = typeof taSegments === "string" ? taSegments : `Birincil Segment: ${taSegments.primarySegment?.demographics || "N/A"} \u2014 ${taSegments.primarySegment?.behavioralProfile || ""}
Ikincil Segment: ${taSegments.secondarySegment?.demographics || "N/A"} \u2014 ${taSegments.secondarySegment?.behavioralProfile || ""}`;
  const vpReasoning = strategistOutput.valuePropositionReasoning;
  const vpSummary = vpReasoning ? `
- Urun/Hizmet: ${vpReasoning.whatBusinessProduces}
- Temel Fayda: ${vpReasoning.coreBenefit}
- Kimin Icin: ${vpReasoning.whoBenefits}
- Fiyat Konumlandirmasi: ${vpReasoning.pricePositioning}
- Odemeye Istekli Profil: ${vpReasoning.willingToPayProfile}` : "";
  const strategistSummary = `
### Strateji Uzmani Onerisi
- Arketip: ${strategistOutput.archetype}
- Gerekce: ${strategistOutput.archetypeRationale}
- Kisilik Ozellikleri: ${strategistOutput.traits.join(", ")}
- Iletisim Tonu: ${strategistOutput.tone}
- Marka Sesi: ${strategistOutput.voice}
- Konumlandirma: ${strategistOutput.positioningStatement}${vpSummary}
- Hedef Kitle: ${targetAudienceSummary}
- Farklilik: ${strategistOutput.differentiator}
- Rekabet Avantaji: ${strategistOutput.competitiveAdvantage}`;
  let competitiveMapSummary = "";
  if (strategistOutput.competitiveMap && strategistOutput.competitiveMap.length > 0) {
    competitiveMapSummary = `

### Rekabet Haritasi
` + strategistOutput.competitiveMap.map(
      (cm) => `- vs ${cm.competitorName}: Avantajimiz: ${cm.ourAdvantage} | Dezavantajimiz: ${cm.ourWeakness}`
    ).join("\n");
  }
  let challengerSummary = "";
  if (challengerOutput) {
    challengerSummary = `

### Seytan Avukati Karsi-Analizi
- Karsi Pozisyon: ${challengerOutput.counterPosition}
- Alternatif Arketip: ${challengerOutput.alternativeArchetype}
- Alternatif Arketip Gerekce: ${challengerOutput.alternativeArchetypeRationale}
- Elestiri Noktalari:
${challengerOutput.challengePoints.map((p) => `  - ${p}`).join("\n")}
- Alternatif Konumlandirmalar:
${challengerOutput.alternativePositionings.map((p) => `  - ${p}`).join("\n")}
- Risk Degerlendirmesi: ${challengerOutput.riskAssessment}
- Kor Noktalar:
${challengerOutput.blindSpots.map((b) => `  - ${b}`).join("\n")}`;
  }
  let researchContext = "";
  let sourceUrlsList = "";
  const hasResearch = researchFindings && researchFindings.sourcesUsed !== 0;
  if (hasResearch) {
    const competitorNames = researchFindings.competitors.map((c) => `${c.name}${c.website ? ` (${c.website})` : ""}`).join(", ");
    const marketInfo = researchFindings.marketData;
    const audience = researchFindings.targetAudienceInsights;
    researchContext = `

## Sektor Arastirmasi Verileri (Gercek Web Kaynaklari)
- Rakipler: ${competitorNames || "Bilgi yok"}
- Pazar Buyuklugu: ${marketInfo.marketSize}
- Buyume Hizi: ${marketInfo.growthRate}
- Tuketici Trendleri: ${marketInfo.consumerTrends.join("; ") || "Bilgi yok"}
- Hedef Kitle Demografisi: ${audience.demographics}
- Hedef Kitle Ihtiyaclari: ${audience.painPoints.join("; ") || "Bilgi yok"}
- Firsatlar: ${researchFindings.opportunities.join("; ") || "Bilgi yok"}
- Tehditler: ${researchFindings.threats.join("; ") || "Bilgi yok"}
- Sektor Standartlari: ${researchFindings.sectorBenchmarks.join("; ") || "Bilgi yok"}
- Kullanilan Kaynak Sayisi: ${researchFindings.sourcesUsed}`;
    if (researchFindings.sourceUrls && researchFindings.sourceUrls.length > 0) {
      sourceUrlsList = researchFindings.sourceUrls.slice(0, 20).map((s) => `  - ${s.title}: ${s.url}`).join("\n");
    }
  }
  const debateInstruction = challengerOutput ? "Iki farkli uzmanin goruslerini inceleyip en iyi stratejiyi sentezlemen gerekiyor. Strateji uzmaninin onerisiyle seytan avukatinin elestirisini dengeleyerek, en guclu ve tutarli sonucu olustur." : "Strateji uzmaninin onerisini inceleyip, rafine ederek nihai stratejiyi olusturman gerekiyor. Karsi-analiz mevcut olmadigindan, kendi elestirel gozunle stratejiyi guclendirerek sentezle.";
  const sourceCount = researchFindings?.sourcesUsed || 0;
  const prompt = `Sen bir marka stratejisi basparlak direktorsun (CSO). ${debateInstruction}

## Isletme Profili
- Isletme: ${normalizedData.businessName}
- Sektor: ${normalizedData.sector}
- Genel Profil: ${normalizedData.overallProfile}
- Veri Kalitesi: ${normalizedData.dataQualityScore}
- Tespit Edilen Oruntular: ${normalizedData.detectedPatterns.join("; ") || "Yok"}

## Uzman Gorusleri
${strategistSummary}
${competitiveMapSummary}
${challengerSummary}
${researchContext}

${sourceUrlsList ? `## Arastirma Kaynaklari
${sourceUrlsList}` : ""}

---

Tum verileri sentezleyerek asagidaki JSON yapisinda NIHAI marka stratejisi raporunu olustur:

{
  "brandPersonality": {
    "archetype": "Nihai Jung arktipi secimi (Turkce).",
    "traits": ["Markanin 3-5 temel kisilik ozelligi. SEKTORE OZGU, somut ozellikler."],
    "tone": "Markanin nihai iletisim tonu \u2014 ORNEK CUMLE ile",
    "voice": "Markanin nihai sesi \u2014 ORNEK CUMLE ile"
  },
  "positioning": {
    "statement": "Nihai konumlandirma cumlesi. SOMUT, akilda kalici, OLCULEBILIR. (1-2 cumle)",
    "targetAudience": "Hedef kitle ozet tanimi. (2-3 cumle)",
    "valuePropositionReasoning": {
      "whatBusinessProduces": "Bu isletmenin SOMUT urun/hizmet listesi",
      "coreBenefit": "Musteriye saglanan TEMEL fayda \u2014 tek cumle",
      "whoBenefits": "Bu faydadan DAVRANISSAL olarak kim yararlanir",
      "pricePositioning": "Fiyat konumlandirmasi RAKAMLARLA ve rakip karsilastirmasiyla",
      "willingToPayProfile": "Bu fiyati odemeye istekli kisi profili \u2014 gelir ve harcama aliskanligi"
    },
    "targetSegments": [
      {
        "segmentLabel": "Birincil Segment",
        "demographics": "Yas ARALIGI, lokasyon tipi, meslek GRUBU, gelir ARALIGI",
        "behavioralProfile": "Tuketim davranislari \u2014 SOMUT",
        "coreNeed": "Bu segmentin BU ISLETMEDEN beklentisi",
        "mediaHabits": "Hangi platformlar, ne siklikla",
        "purchaseTriggers": ["Satin alma tetikleyicileri \u2014 SPESIFIK"],
        "estimatedSegmentSize": "Turkiye'deki tahmini buyukluk \u2014 kaynak belirt"
      },
      {
        "segmentLabel": "Ikincil Segment",
        "demographics": "...",
        "behavioralProfile": "...",
        "coreNeed": "...",
        "mediaHabits": "...",
        "purchaseTriggers": ["..."],
        "estimatedSegmentSize": "..."
      }
    ],
    "differentiator": "Temel fark. (1-2 cumle)",
    "competitiveAdvantage": "Rekabet avantaji. (1-2 cumle)",
    "competitiveLandscape": "Pazarin genel haritasi: Premium segmentte kimler var, orta segmentte kimler var, ${normalizedData.businessName} nereye konumlanmali ve NEDEN. (2-3 cumle)",
    "alternativePositions": ["2-3 alternatif konumlandirma \u2014 B ve C plani"]
  },
  "visualWorld": {
    "moodKeywords": ["5-7 gorsel dunya anahtar kelimesi"],
    "colorPalette": [
      { "hex": "#hexkod", "name": "Renk adi (Turkce)", "usage": "primary" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "secondary" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "accent" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "neutral" }
    ],
    "typographyStyle": "Tipografi stili onerisi. (1-2 cumle)",
    "imageryStyle": "Gorsel icerik stili. (1-2 cumle)"
  },
  "contentStrategy": {
    "pillars": ["4-6 icerik sutunu"],
    "toneGuidelines": ["3-4 ton rehberi kurali"],
    "keyMessages": ["3-5 anahtar mesaj"],
    "hashtags": ["5-8 hashtag onerisi"]
  },
  "analysis": {
    "strengths": ["3-4 guclu yan \u2014 SOMUT kanitlarla"],
    "opportunities": ["3-4 firsat \u2014 HANGI rakibin HANGI acigini kullanarak"],
    "challenges": ["2-3 zorluk \u2014 SOMUT pazar kosullari ile"],
    "recommendations": [
      "ONERI 1: UYGULANABILIR aksiyon. Ornek: 'Instagram'da haftada 4 post + 2 Reel yayinlanarak organik erisim %30 arttirilabilir. Rakip X bu stratejiyle 6 ayda 50K takipci kazanmis.'",
      "ONERI 2: ...",
      "ONERI 3: ...",
      "ONERI 4: ..."
    ]
  },
  "actionPlan": {
    "immediate": [
      {
        "action": "Ilk 30 gun icinde yapilacak SOMUT adim. Ornek: 'Instagram isletme hesabi acilmasi, profil optimizasyonu ve ilk 15 icerik planlama'",
        "owner": "Bu isi yapacak ekip/kisi. Ornek: 'Sosyal medya yoneticisi'",
        "metric": "Basari olcutu. Ornek: 'Hesap acildi, 15 icerik taslagi hazir, bio optimize edildi'",
        "estimatedImpact": "Beklenen etki. Ornek: 'Dijital varlik olusturma \u2014 temel adim'"
      },
      { "action": "...", "owner": "...", "metric": "...", "estimatedImpact": "..." }
    ],
    "shortTerm": [
      {
        "action": "30-60 gun arasi yapilacak adim",
        "owner": "...",
        "metric": "...",
        "estimatedImpact": "..."
      }
    ],
    "mediumTerm": [
      {
        "action": "60-90 gun arasi yapilacak adim",
        "owner": "...",
        "metric": "...",
        "estimatedImpact": "..."
      }
    ]
  },
  "evidenceSummary": {
    "sourcesConsulted": ${sourceCount},
    "keySourceUrls": [${researchFindings?.sourceUrls?.slice(0, 5).map((s) => `{"title": "${s.title.replace(/"/g, '\\"')}", "url": "${s.url}"}`).join(", ") || ""}],
    "dataFreshness": "Ocak 2025 web arama verileri",
    "confidenceLevel": "${sourceCount > 5 ? "Yuksek" : sourceCount > 0 ? "Orta" : "Dusuk"} \u2014 ${sourceCount} kaynak kullanildi"
  },
  "synthesisRationale": "Bu sentezin NEDEN bu sekilde yapildiginin aciklamasi. Hangi uzman gorusleri benimsendi, hangileri reddedildi ve NEDEN? SOMUT referanslarla. (3-5 cumle)"
}

KRITIK KURALLAR \u2014 BU KURALLARA UYMAYAN RAPOR BASARISIZ SAYILIR:

1. ANTI-JARGON: Asagidaki ifadeleri KULLANMA:
   - "Dijital varlik guclendirilmeli" \u2192 YERINE: "Instagram'da haftada 4 post + 2 Reel ile organik erisim %30 arttirilabilir"
   - "Sinerji olusturulmali" \u2192 YERINE: "[Rakip X]'in zayif kaldigi [alan]'da farklilasmak icin [somut adim]"
   - "Paradigma degisimi", "butunsel yaklasim", "dinamik strateji" \u2192 TAMAMEN YASAK
   - "Kaliteli ve guvenilir" \u2192 YERINE: "${normalizedData.businessName}'in [somut ozelligi] sayesinde musteriler [somut fayda] elde eder"

2. UYGULANABILIRLIK: "recommendations" ve "actionPlan" HER maddesi bir proje yoneticisinin HEMEN BASLAYABILECEGI kadar net olmali.
   - "Marka kimlik calismasi yapilmali" \u2192 YERINE: "Logo, renk paleti ve tipografi rehberi iceren marka kimlik kilavuzu hazirlanmali. Icermesi gerekenler: logo varyasyonlari, renk kodlari (CMYK/RGB/HEX), tipografi hiyerarsisi, kullanim kurallari."

3. KANIT ZORUNLULUGU: "analysis" bolumundeki HER madde icin destekleyici veri goster.
   - "strengths" \u2014 hangi wizard cevabi veya veri bunu destekliyor?
   - "opportunities" \u2014 hangi rakibin hangi acigi, hangi pazar trendi?
   - "challenges" \u2014 hangi pazar kosulu, hangi rakip tehdidi?

4. "positioning.competitiveLandscape" ISIMLI RAKIPLERLE pazar haritasi cikaracak.

5. "actionPlan" her fazda EN AZ 2, EN FAZLA 4 aksiyon icermeli. Her aksiyonun "metric" alani OLCULEBILIR olmali.

6. "brandPersonality.archetype" seciminde her iki uzmanin da goruslerini dikkate al.

7. "visualWorld.colorPalette" tam olarak 4 renk icermeli: primary, secondary, accent ve neutral.

8. ${challengerOutput ? "Her iki uzmanin goruslerini referans goster." : "Strateji uzmaninin onerisini nasil rafine ettigini acikla."}

9. Tum metinler TURKCE olmali.
10. Sadece JSON don, baska bir sey yazma.`;
  const parsed = await generateJSON("pro", prompt, "StrategySynthesizer", {
    temperature: 0.6,
    maxOutputTokens: 8192
  });
  const emptyActionItem = { action: "", owner: "", metric: "", estimatedImpact: "" };
  return {
    brandPersonality: {
      archetype: parsed.brandPersonality?.archetype || strategistOutput.archetype,
      traits: Array.isArray(parsed.brandPersonality?.traits) && parsed.brandPersonality.traits.length > 0 ? parsed.brandPersonality.traits : strategistOutput.traits,
      tone: parsed.brandPersonality?.tone || strategistOutput.tone,
      voice: parsed.brandPersonality?.voice || strategistOutput.voice
    },
    positioning: {
      statement: parsed.positioning?.statement || strategistOutput.positioningStatement,
      targetAudience: parsed.positioning?.targetAudience || (typeof strategistOutput.targetAudience === "string" ? strategistOutput.targetAudience : `${strategistOutput.targetAudience.primarySegment?.demographics || ""} davranissal segment`),
      valuePropositionReasoning: parsed.positioning?.valuePropositionReasoning || strategistOutput.valuePropositionReasoning || { whatBusinessProduces: "", coreBenefit: "", whoBenefits: "", pricePositioning: "", willingToPayProfile: "" },
      targetSegments: Array.isArray(parsed.positioning?.targetSegments) && parsed.positioning.targetSegments.length > 0 ? parsed.positioning.targetSegments : [strategistOutput.targetAudience.primarySegment, strategistOutput.targetAudience.secondarySegment].filter(Boolean),
      differentiator: parsed.positioning?.differentiator || strategistOutput.differentiator,
      competitiveAdvantage: parsed.positioning?.competitiveAdvantage || strategistOutput.competitiveAdvantage,
      competitiveLandscape: parsed.positioning?.competitiveLandscape || "",
      alternativePositions: Array.isArray(parsed.positioning?.alternativePositions) && parsed.positioning.alternativePositions.length > 0 ? parsed.positioning.alternativePositions : challengerOutput?.alternativePositionings || ["Alternatif konumlandirma belirtilmemistir"]
    },
    visualWorld: {
      moodKeywords: Array.isArray(parsed.visualWorld?.moodKeywords) && parsed.visualWorld.moodKeywords.length >= 5 ? parsed.visualWorld.moodKeywords : ["Modern", "Temiz", "Guvenilir", "Profesyonel", "Samimi"],
      colorPalette: Array.isArray(parsed.visualWorld?.colorPalette) && parsed.visualWorld.colorPalette.length === 4 ? parsed.visualWorld.colorPalette : [
        { hex: "#2563EB", name: "Ana Mavi", usage: "primary" },
        { hex: "#10B981", name: "Taze Yesil", usage: "secondary" },
        { hex: "#F59E0B", name: "Sicak Sari", usage: "accent" },
        { hex: "#6B7280", name: "Notr Gri", usage: "neutral" }
      ],
      typographyStyle: parsed.visualWorld?.typographyStyle || "Modern sans-serif tipografi, okunakli ve profesyonel.",
      imageryStyle: parsed.visualWorld?.imageryStyle || "Dogal isikli, samimi ve profesyonel fotograflar."
    },
    contentStrategy: {
      pillars: Array.isArray(parsed.contentStrategy?.pillars) && parsed.contentStrategy.pillars.length >= 4 ? parsed.contentStrategy.pillars : ["Marka Hikayesi", "Sektor Uzmanligi", "Musteri Deneyimleri", "Yenilik ve Trendler"],
      toneGuidelines: Array.isArray(parsed.contentStrategy?.toneGuidelines) && parsed.contentStrategy.toneGuidelines.length >= 3 ? parsed.contentStrategy.toneGuidelines : ["Samimi ama profesyonel ol", "Uzman bilgisini anlasilir sekilde paylas", "Musteri odakli mesajlar kullan"],
      keyMessages: Array.isArray(parsed.contentStrategy?.keyMessages) && parsed.contentStrategy.keyMessages.length >= 3 ? parsed.contentStrategy.keyMessages : ["Kalite ve guven odakli mesajlar", "Fark yaratan ozellikler", "Musteri basari hikayeleri"],
      hashtags: Array.isArray(parsed.contentStrategy?.hashtags) && parsed.contentStrategy.hashtags.length >= 5 ? parsed.contentStrategy.hashtags : [`#${normalizedData.businessName.replace(/\s+/g, "")}`, `#${normalizedData.sector}`, "#MarkaStratejisi", "#DijitalDonusum", "#Turkiye"]
    },
    analysis: {
      strengths: Array.isArray(parsed.analysis?.strengths) && parsed.analysis.strengths.length >= 3 ? parsed.analysis.strengths : ["Marka vizyonu net", "Sektore uygun konumlandirma", "Guclu deger onerisi"],
      opportunities: Array.isArray(parsed.analysis?.opportunities) && parsed.analysis.opportunities.length >= 3 ? parsed.analysis.opportunities : ["Dijital kanallar ile buyume", "Yeni pazar segmentleri", "Icerik pazarlama firsatlari"],
      challenges: Array.isArray(parsed.analysis?.challenges) && parsed.analysis.challenges.length >= 2 ? parsed.analysis.challenges : ["Rekabet yogunlugu", "Marka bilinirligini artirma ihtiyaci"],
      recommendations: Array.isArray(parsed.analysis?.recommendations) && parsed.analysis.recommendations.length >= 4 ? parsed.analysis.recommendations : ["Dijital varlik guclendirilmeli", "Icerik stratejisi uygulanmali", "Marka kimlik rehberi olusturulmali", "Hedef kitle arastirmasi derinlestirilmeli"]
    },
    actionPlan: {
      immediate: Array.isArray(parsed.actionPlan?.immediate) && parsed.actionPlan.immediate.length > 0 ? parsed.actionPlan.immediate.map((item) => ({ ...emptyActionItem, ...item })) : [],
      shortTerm: Array.isArray(parsed.actionPlan?.shortTerm) && parsed.actionPlan.shortTerm.length > 0 ? parsed.actionPlan.shortTerm.map((item) => ({ ...emptyActionItem, ...item })) : [],
      mediumTerm: Array.isArray(parsed.actionPlan?.mediumTerm) && parsed.actionPlan.mediumTerm.length > 0 ? parsed.actionPlan.mediumTerm.map((item) => ({ ...emptyActionItem, ...item })) : []
    },
    evidenceSummary: {
      sourcesConsulted: parsed.evidenceSummary?.sourcesConsulted ?? sourceCount,
      keySourceUrls: Array.isArray(parsed.evidenceSummary?.keySourceUrls) ? parsed.evidenceSummary.keySourceUrls : researchFindings?.sourceUrls?.slice(0, 5) || [],
      dataFreshness: parsed.evidenceSummary?.dataFreshness || "Veri guncellik bilgisi mevcut degil",
      confidenceLevel: parsed.evidenceSummary?.confidenceLevel || `${sourceCount > 0 ? "Orta" : "Dusuk"} \u2014 ${sourceCount} kaynak`
    },
    synthesisRationale: parsed.synthesisRationale || (challengerOutput ? `Strateji uzmaninin ${strategistOutput.archetype} arketip onerisi ile seytan avukatinin ${challengerOutput.alternativeArchetype} alternatifi degerlendirilmistir.` : `Strateji uzmaninin ${strategistOutput.archetype} arketip onerisi rafine edilerek nihai strateji olusturulmustur.`)
  };
}

// src/pipeline/pipeline.ts
var TIMEOUT_BUDGET = 29e4;
async function runAgent(name, fn, state, required) {
  const start = Date.now();
  try {
    const result = await fn();
    state.timings[name] = Date.now() - start;
    return result;
  } catch (error) {
    state.timings[name] = Date.now() - start;
    state.errors.push({
      agent: name,
      error: error.message || "Unknown error",
      timestamp: Date.now()
    });
    console.error(`Agent "${name}" failed:`, error.message);
    if (required) {
      throw new Error(`Required agent "${name}" failed: ${error.message}`);
    }
    return null;
  }
}
function remainingTime(startTime) {
  return TIMEOUT_BUDGET - (Date.now() - startTime);
}
async function runPipeline(input) {
  const startTime = Date.now();
  const isLite = input.mode === "lite";
  const state = {
    input,
    errors: [],
    timings: {}
  };
  const parallelTasks = [
    runAgent("dataNormalizer", () => runDataNormalizer(input), state, true),
    isLite ? Promise.resolve(null) : runAgent("sectorResearch", () => runSectorResearch(input), state, false)
  ];
  const [normalizedData, researchFindings] = await Promise.all(parallelTasks);
  if (!normalizedData) {
    throw new Error("Data normalization failed \u2014 pipeline cannot continue");
  }
  state.normalizedData = normalizedData;
  state.researchFindings = researchFindings ?? void 0;
  if (remainingTime(startTime) < 1e4) {
    throw new Error("Timeout: not enough time for strategist agent");
  }
  const strategistOutput = await runAgent(
    "brandStrategist",
    () => runBrandStrategist(normalizedData, researchFindings),
    state,
    true
  );
  if (!strategistOutput) {
    throw new Error("Brand strategist failed \u2014 pipeline cannot continue");
  }
  state.strategistOutput = strategistOutput;
  let challengerOutput = null;
  if (!isLite && remainingTime(startTime) > 22e3) {
    challengerOutput = await runAgent(
      "brandChallenger",
      () => runBrandChallenger(normalizedData, researchFindings, strategistOutput),
      state,
      false
    );
  } else if (!isLite) {
    console.log("Skipping challenger: not enough time remaining");
    state.errors.push({
      agent: "brandChallenger",
      error: "Skipped due to timeout budget",
      timestamp: Date.now()
    });
  }
  state.challengerOutput = challengerOutput ?? void 0;
  let synthesizedAnalysis = null;
  if (remainingTime(startTime) > 8e3) {
    synthesizedAnalysis = await runAgent(
      "strategySynthesizer",
      () => runStrategySynthesizer(normalizedData, researchFindings, strategistOutput, challengerOutput),
      state,
      false
    );
  }
  if (synthesizedAnalysis) {
    state.synthesizedAnalysis = synthesizedAnalysis;
  } else {
    console.log("Using strategist output as fallback (synthesizer skipped or failed)");
    const taObj = strategistOutput.targetAudience;
    const taSummary = typeof taObj === "string" ? taObj : `${taObj.primarySegment?.demographics || ""} davranissal segment`;
    state.synthesizedAnalysis = {
      brandPersonality: {
        archetype: strategistOutput.archetype,
        traits: strategistOutput.traits,
        tone: strategistOutput.tone,
        voice: strategistOutput.voice
      },
      positioning: {
        statement: strategistOutput.positioningStatement,
        targetAudience: taSummary,
        valuePropositionReasoning: strategistOutput.valuePropositionReasoning || {
          whatBusinessProduces: "",
          coreBenefit: "",
          whoBenefits: "",
          pricePositioning: "",
          willingToPayProfile: ""
        },
        targetSegments: [taObj.primarySegment, taObj.secondarySegment].filter(Boolean),
        differentiator: strategistOutput.differentiator,
        competitiveAdvantage: strategistOutput.competitiveAdvantage,
        competitiveLandscape: "",
        alternativePositions: []
      },
      visualWorld: {
        moodKeywords: [],
        colorPalette: [],
        typographyStyle: "",
        imageryStyle: ""
      },
      contentStrategy: {
        pillars: [],
        toneGuidelines: [],
        keyMessages: [],
        hashtags: []
      },
      analysis: {
        strengths: [],
        opportunities: [],
        challenges: [],
        recommendations: []
      },
      actionPlan: {
        immediate: [],
        shortTerm: [],
        mediumTerm: []
      },
      evidenceSummary: {
        sourcesConsulted: 0,
        keySourceUrls: [],
        dataFreshness: "Veri mevcut degil",
        confidenceLevel: "Dusuk \u2014 Sentez asamasi atlanmistir"
      },
      synthesisRationale: "Sentez asamasi atlanmistir, stratejist ciktisi dogrudan kullanilmistir."
    };
    state.errors.push({
      agent: "strategySynthesizer",
      error: "Fallback used \u2014 strategist output mapped directly",
      timestamp: Date.now()
    });
  }
  state.timings.total = Date.now() - startTime;
  return state;
}
export {
  buildDeepResearchPrompt,
  runBrandChallenger,
  runBrandStrategist,
  runDataNormalizer,
  runPipeline,
  runSectorResearch,
  runStrategySynthesizer,
  startDeepResearch
};
