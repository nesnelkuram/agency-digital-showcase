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
  console.log(`DeepResearch: poll timeout after ${timeoutMs}ms \u2014 interaction still alive on Gemini`);
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
  const adminNotesSection = input.adminNotes?.trim() ? `
## Admin Notlari (Uzman Degerlendirmesi)
Bu isletme hakkinda uzman tarafindan eklenen ek bilgiler:
${input.adminNotes.trim()}

Bu notlari analiz sirasinda dikkate al ve genel profili buna gore sekillendir.
` : "";
  const bc = input.businessContext;
  const businessContextSection = bc ? `
## Isletme Baglam Bilgileri (Dogrudan Musteri Beyan\u0131)
- Isletme Tanimi: ${bc.businessDescription || "Belirtilmedi"}
- Bilinen Rakipler: ${bc.competitors || "Belirtilmedi"}
- Cografi Kapsam: ${bc.geoScope || "Belirtilmedi"}
- Dijital Platformlar: ${bc.digitalPresence?.join(", ") || "Belirtilmedi"}
- Instagram Takipci: ${bc.instagramFollowers || "Belirtilmedi"}
- Aylik Butce: ${bc.monthlyBudget || "Belirtilmedi"}
- Isletme Asamasi: ${bc.businessStage || "Belirtilmedi"}
- Basvuru Nedeni: ${bc.triggerReason || "Belirtilmedi"}
` : "";
  const prompt = `Sen bir veri normalizasyon uzmanisisin. Asagidaki ham marka degerlendirme wizard verisini yapilandirilmis ve normalize edilmis bir formata donustur.

## Isletme Bilgileri
- Isletme Adi: ${contact.businessName}
- Sektor: ${sector}
- Talep Edilen Hizmetler: ${servicesList || "Belirtilmedi"}

## Asama Sonuclari
${stageResultsSummary || "Asama sonucu bulunamadi"}

## Detayli Soru-Cevaplar
${resolvedQA || "Cevap bulunamadi"}
${businessContextSection}${adminNotesSection}
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
6. "overallProfile" alaninda isletmenin genel marka profilini dogal bir dille ozetle. Isletme baglam bilgileri (isletme tanimi, cografi kapsam, isletme asamasi, dijital varlik durumu) varsa bunlari profilde kullan. Bu metin sonraki asamalarda diger ajanlar tarafindan kullanilacak.
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
function buildDeepResearchPrompt(businessName, sector, businessContext) {
  const descLine = businessContext?.businessDescription ? `
Isletme Tanimi (Musteri Beyani): ${businessContext.businessDescription}` : "";
  const competitorLine = businessContext?.competitors ? `
Musterinin Bildirdigi Rakipler: ${businessContext.competitors}` : "";
  const geoLine = businessContext?.geoScope ? `
Hedef Pazar: ${businessContext.geoScope}` : "";
  return `Sen bir sektor arastirmacisisin. Asagidaki marka hakkinda KAPSAMLI ve URUN BAZLI bir arastirma yap.

Marka: ${businessName}
Sektor: ${sector}${descLine}${competitorLine}${geoLine}

ARASTIRMA ADIMLARI (sirayla uygula):

ADIM 1 \u2014 MARKANIN KENDISI:
- "${businessName}" web sitesini bul ve ziyaret et.${businessContext?.businessDescription ? `
- Musterinin kendi tanimi: "${businessContext.businessDescription}" \u2014 bu bilgiyi arastirmani yonlendirmek icin kullan.` : ""}
- Hangi URUN ve HIZMETLERI sunuyor? Her birini listele.
- Fiyat araliklari nedir? (mumkunse gercek fiyatlar)
- Kendini nasil konumlandiriyor? (ucuz/orta/premium)
- Alt markalari varsa her birini ayri ayri incele.

ADIM 2 \u2014 URUN BAZLI RAKIP ANALIZI:${businessContext?.competitors ? `
- Musterinin bildirdigi rakipler: ${businessContext.competitors} \u2014 BUNLARI ONCELIKLI olarak arastir.` : ""}
- Adim 1'de buldugun HER urun/hizmet kategorisi icin dogrudan rakipleri arastir.
- Ornek: Eger marka "findik kremasi" satiyorsa \u2192 "findik kremasi markalari Turkiye" ara.
- Her rakibin web sitesini ziyaret et.
- Rakip urun fiyatlarini karsilastir.
- Her rakibin guclu ve zayif yanlarini belirle (somut: urun cesitliligi, dagitim agi, fiyat, kalite algisi).
- EN AZ 4, EN FAZLA 8 rakip bul.

ADIM 3 \u2014 PAZAR VERILERI:
- Bu URUN KATEGORISININ (genel sektor degil, spesifik urun!) Turkiye'deki pazar buyuklugu.${businessContext?.geoScope ? `
- Musteri hedef pazari: ${businessContext.geoScope} \u2014 pazar verilerini BU COGRAFYAYA odakla.` : ""}
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
  return extractResearchJSON(
    researchText,
    allSourceUrls,
    allSearchQueries,
    researchMethod === "deep-research" ? -1 : sourcesUsed
  );
}
async function extractResearchJSON(researchText, sourceUrls = [], searchQueries = [], sourcesUsedCount = 0) {
  if (!researchText || researchText.length < 100) {
    console.log(`extractResearchJSON: Insufficient text (${researchText?.length || 0} chars), returning empty`);
    return { ...EMPTY_RESEARCH, searchQueries, sourcesUsed: sourcesUsedCount, sourceUrls, rawSnippets: [researchText?.slice(0, 1e4) || ""] };
  }
  const extractionPrompt = `Asagidaki arastirma metnini analiz ederek JSON yapisinda yapilandir.
ONEMLI: Metinde gecen TUM somut bilgileri koru. Bilgi UYDURMADAN sadece metinde olan bilgileri yapilandir.

## Arastirma Metni
${researchText.slice(0, 4e4)}

${sourceUrls.length > 0 ? `## Kaynaklar
${sourceUrls.map((s) => `- [${s.title}](${s.url})`).join("\n")}` : ""}

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
      searchQueries,
      sourcesUsed: sourcesUsedCount,
      sourceUrls,
      rawSnippets: [researchText.slice(0, 1e4)]
    };
  } catch (error) {
    console.error("extractResearchJSON: JSON extraction failed:", error);
    return {
      ...EMPTY_RESEARCH,
      searchQueries,
      sourcesUsed: sourcesUsedCount,
      sourceUrls,
      rawSnippets: [researchText.slice(0, 1e4)]
    };
  }
}

// src/pipeline/agents/brandStrategist.ts
async function runBrandStrategist(normalizedData, researchFindings, businessContext) {
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
  const bc = businessContext;
  const businessContextSection = bc ? `
## Isletme Baglam Bilgileri (Dogrudan Musteri Beyani)
- Isletme Tanimi: ${bc.businessDescription || "Belirtilmedi"}
- Bilinen Rakipler: ${bc.competitors || "Belirtilmedi"}
- Cografi Kapsam: ${bc.geoScope || "Belirtilmedi"}
- Dijital Platformlar: ${bc.digitalPresence?.join(", ") || "Belirtilmedi"}
- Instagram Takipci: ${bc.instagramFollowers || "Belirtilmedi"}
- Aylik Butce: ${bc.monthlyBudget || "Belirtilmedi"}
- Isletme Asamasi: ${bc.businessStage || "Belirtilmedi"}
- Basvuru Nedeni: ${bc.triggerReason || "Belirtilmedi"}
` : "";
  const budgetInstruction = bc?.monthlyBudget ? `
12. BUTCE UYUMU: Musterinin aylik butcesi "${bc.monthlyBudget}" olarak belirtilmis. valuePropositionReasoning.pricePositioning alaninda bu butceyi dikkate al. Isletmenin olcegine uygun fiyat konumlandirmasi yap.` : "";
  const stageInstruction = bc?.businessStage ? `
13. ISLETME ASAMASI: Isletme "${bc.businessStage}" asamasinda. Buna gore strateji onerileri kalibre et \u2014 yeni isletme icin marka bilinirligine, yerlesik isletme icin pazar payi buyutmeye odaklan.` : "";
  const prompt = `Sen deneyimli bir marka stratejistisin. Asagidaki veriyi analiz ederek markanin konumlandirilmasi icin detayli ve KANIT TABANLI bir strateji olustur.

## Isletme Profili
- Isletme: ${normalizedData.businessName}
- Sektor: ${normalizedData.sector}
- Genel Profil: ${normalizedData.overallProfile}
${businessContextSection}
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
9. Sadece JSON don, baska bir sey yazma.${budgetInstruction}${stageInstruction}`;
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

// src/pipeline/data/blogKnowledgeBase.ts
var BLOG_AUTHOR_META = {
  name: "Stratejik Danismanin",
  site: "engintezcan.com",
  totalArticles: 432,
  mainThemes: ["\xD6zel makaleler", "Gayrinizami Markalama", "Gayrinizami Notlar", "\u0130lham kayna\u011F\u0131", "LimitedPost", "K\u0131l\xE7\u0131ks\u0131z Markalama", "Gayrinizami Pazarlama", "Marka hikayeleri", "Pazar yaz\u0131lar\u0131", "Yeni marka yaratmak", "12ilke", "Marka konumland\u0131rma", "Yasak Elmalar", "\xD6zel makale"]
};
var BLOG_PRINCIPLES = [
  { slug: "dugumu-cozmek-5-5-final", title: "\u{1F9F6} D\xFC\u011F\xFCm\xFC \xC7\xF6zmek (5/5) Final", tags: ["Gayrinizami Pazarlama"], excerpt: "Eylem ihtiyac\u0131 ve GEP", coreContent: 'Be\u015F g\xFCnd\xFCr "D\xFC\u011F\xFCm\xFC \xC7\xF6zmek\u201Dten bahsediyorum.\n\u0130lk g\xFCn, markalar\u0131 kilitleyen "D\xFC\u011F\xFCm Noktas\u0131"n\u0131\xA0 bulman\u0131n \xF6nemini konu\u015Ftuk. \xC7\xF6z\xFCl\xFCnce di\u011Fer bir\xE7ok d\xFC\u011F\xFCm\xFC \xE7\xF6zen as\u0131l d\xFC\u011F\xFCm\xFC\u2026\nSonra bu d\xFC\u011F\xFCm\xFC bulmak i\xE7in do\u011Fru \u201CTe\u015Fhis\u201Din nas\u0131l konulaca\u011F\u0131n\u0131 g\xF6rd\xFCk.\nArd\u0131ndan, te\u015Fhise uygun \u201CPusula\u201Dy\u0131, yani stratejik yakla\u015F\u0131m\u0131 belirlemenin ne kadar kritik oldu\u011Fundan bahsettik.\nVe d\xFCn, eyleme ge\xE7menin \xF6nemini ve en parlak stratejinin bile eyleme d\xF6n\xFC\u015Fmedi\u011Fi takdirde, bir temenninden \xF6teye gidemedi\u011Fi g\xF6rd\xFCk.\n\u0130ster tek ki\u015Filik bir i\u015Fletme olsun ister dev bir marka, bir strateji tasarlaman\u0131n \xF6z\xFC bu.\nEngelin do\u011Fas\u0131n\u0131 anla.\nTe\u015Fhisi koy.\nBir pusula belirle.\nPusuladan \u015Fa\u015Fmadan, birbiriyle tutarl\u0131, birbiriyle \xE7eli\u015Fmeyen eylemlere ba\u015Fla.\nBu kadar basit g\xF6r\xFCnse de, uygulamaya ge\xE7ince, maalesef olmuyor, olam\u0131yor.\n20 y\u0131l\n20...' },
  { slug: "canavarin-cesareti", title: "Canavar\u0131n cesareti", tags: ["Gayrinizami Markalama"], excerpt: "Yeni markalar\u0131n dertleri ve gayrinizami \xE7\xF6z\xFCmleri", coreContent: "Yeni bir markayla bir kategoriye girip h\u0131zla yukar\u0131 t\u0131rmanamazs\u0131n\u0131z. Yukar\u0131dakiler izin vermez. Yapanlar mutlaka vard\u0131r ama istisnad\u0131r. E\u015Fyan\u0131n tabiat\u0131na ayk\u0131r\u0131.\n\xC7\xFCnk\xFC her kategoride o kategoriye yerle\u015Fmi\u015F markalar var.\nPotansiyel m\xFC\u015Fteriler i\u015Flerini o markalarla g\xF6r\xFCyor ve kimse\nyeni bir marka gelsin\ndiye hevesle beklemiyor. Herkes halinden memnun.\nH\xE2lihaz\u0131rda tercih etti\u011Fi markalardan \xE7ok da memnun olmayanlar bile, tan\u0131mad\u0131\u011F\u0131 yeni bir markayla riske girmeye \xE7ekiniyor.\nYani bug\xFCn kulland\u0131\u011F\u0131m\u0131z deterjan, otomobil, bilgisayar, ka\u015Far peyniri ya da takvim uygulamas\u0131 i\xE7in\nyeni bir marka \xE7\u0131ksa\ndiye beklemiyoruz. Kulland\u0131klar\u0131m\u0131z\u0131 de\u011Fi\u015Ftirmemiz i\xE7in bir sebep yok. Bir motivasyonumuz yok. Kar\u015F\u0131m\u0131za yenisi \xE7\u0131k\u0131nca da \xE7o\u011Fu zaman g\xF6rmezden geliyoruz.\n\xDCstelik yeni markalar\u0131n somut fiziksel..." },
  { slug: "malibudaki-ev", title: "Malibu'daki ev", tags: ["Gayrinizami Markalama"], excerpt: "Gizlemek istedikleriniz ve duyurmak istedikleriniz", coreContent: "Barbra Streisand 2 Oscar, 10 Grammy, 5 de Emmy kazanan bir isim. Oyuncu, \u015Fark\u0131c\u0131, y\xF6netmen ve yap\u0131mc\u0131. \u015Eu an 83 ya\u015F\u0131nda.\nStreisand\u2019\u0131n Kaliforniya sahil \u015Feridinde, Malibu\u2019da bir evi var. Ve bu evin, pazarlamayla ve ileti\u015Fimle bir \u015Fekilde ilgilenen herkes i\xE7in, \xF6zel bir anlam\u0131 var.\n2000\u2019li y\u0131llar\u0131n ba\u015F\u0131nda bir grup foto\u011Fraf\xE7\u0131, Kaliforniya sahil hatt\u0131n\u0131 belgelemek amac\u0131yla,\nKaliforniya Sahil Kay\u0131t Projesi\nisminde bir proje \xFCzerinde \xE7al\u0131\u015Fmaya ba\u015Flad\u0131. (Daha ortada Google Maps gibi dijital haritalar yoktu.)\nFoto\u011Fraf\xE7\u0131lar, Kaliforniya sahil hatt\u0131n\u0131 g\xFCneyden kuzeye helikopterle tarad\u0131. Her bir bu\xE7uk kilometre i\xE7in 10 foto\u011Fraf olmak \xFCzere, 12 binden fazla foto\u011Fraf \xE7ektiler.\nProje bir web sitesinde yay\u0131nland\u0131 ve birka\xE7 \xF6d\xFCl ald\u0131. Ama sonu\xE7ta, belgesel tad\u0131nda ar\u015Fiv ama\xE7l\u0131 bir projeydi ve s\u0131radan..." },
  { slug: "bugun-neden-onemli-bir-gun", title: "Bug\xFCn neden \xF6nemli bir g\xFCn?", tags: ["Marka hikayeleri"], excerpt: "60 y\u0131l i\xE7indeki en \xF6nemli g\xFCn.", coreContent: "1.\n\xDCniversite \xF6\u011Frencisi gen\xE7, elleri titreyerek klavyedeki L harfine bast\u0131. Di\u011Fer elinde telefon vard\u0131 ve telefondaki arkada\u015F\u0131na sordu:\n\u201CL\u201Dyi ald\u0131n m\u0131?\nK\u0131sa s\xFCre sonra kar\u015F\u0131daki cevap verdi:\n\u201CL\u201D geldi.\nTarih 29 Ekim 1969\u2019du. Saat ak\u015Fam 22:30\u2019u biraz ge\xE7iyordu.\nBirka\xE7 g\xFCn \xF6nce, buzdolab\u0131na benzeyen gri bir metal kutu, California \xDCniversitesi\u2019nin Los Angeles kamp\xFCs\xFCnde, profes\xF6r Leonard Kleinrock\u2019a teslim edilmi\u015Fti.\nAyn\u0131 metal kutudan bir tane de, birka\xE7 y\xFCz kilometre \xF6tedeki Stanford \xDCniversitesi kamp\xFCs\xFCnde vard\u0131.\nProfes\xF6r Kleinrock ve birka\xE7 \xF6\u011Frencisi o gece, o an fark\u0131nda olmasalar da d\xFCnyan\u0131n kaderini de\u011Fi\u015Ftirecek \xF6nemli bir deneme yapmak i\xE7in, o metal kutunun ba\u015F\u0131na ge\xE7mi\u015Flerdi.\n\xD6nlerindeki o kocaman kutu bir bilgisayard\u0131 ve o bilgisayarla, bulunduklar\u0131 Los Angeles\u2019tan, Stanford\u2019daki..." },
  { slug: "sinsi-veri", title: "\u{1F4EE}Sinsi veri", tags: ["Gayrinizami Notlar"], excerpt: "", coreContent: "1995 y\u0131l\u0131nda \u0130ngiltere\u2019deki baz\u0131 gazeteler, yapt\u0131klar\u0131 haberle kad\u0131nlar\u0131 uyarm\u0131\u015F. Yap\u0131lan bir ara\u015Ft\u0131rmaya dayanarak, do\u011Fum kontrol hap\u0131 kullanan kad\u0131nlarda, p\u0131ht\u0131 atma vakalar\u0131n\u0131n ikiye katland\u0131\u011F\u0131n\u0131 yazm\u0131\u015Flar.\nKay\u0131tlara g\xF6re, sonraki y\u0131l fazladan 13.000 istenmeyen gebelik vakas\u0131 ya\u015Fanm\u0131\u015F. \xC7\xFCnk\xFC p\u0131ht\u0131 tehlikesinden korkan baz\u0131 kad\u0131nlar, hap kullanmay\u0131 b\u0131rakm\u0131\u015F.\nBritish Medical Journal isimli kurum olay\u0131n \xFCzerine gitmi\u015F. Habere kaynak olan rapora ula\u015F\u0131p incelemi\u015Fler.\nRaporu haz\u0131rlayan ciddi bir kurummu\u015F.\nP\u0131ht\u0131 atma vakalar\u0131 da evet, ikiye katlanm\u0131\u015F.\nAma nas\u0131l?\nOran 7000 ki\u015Fide 1 iken, 7000 ki\u015Fide 2\u2019ye \xE7\u0131km\u0131\u015F.\n0,014\u2019ten 0,028\u2019e\u2026\nYani asl\u0131nda, endi\u015Felenmeye hi\xE7 de gerek olmayan bir oran ve art\u0131\u015F...\nGazeteler sadece sansasyon i\xE7in, o veriyi \xF6yle vermeyi tercih etmi\u015Fler.\nVeri mi? Evet,..." },
  { slug: "dataizm-zincirinden-kurtulun-2", title: "Dataizm zincirinden kurtulun", tags: ["Gayrinizami Markalama"], excerpt: "Dataizm pazarlaman\u0131n dostu, markalaman\u0131n d\xFC\u015Fman\u0131d\u0131r.", coreContent: "Bug\xFCn g\xFC\xE7l\xFC bir marka yaratman\u0131n \xF6n\xFCndeki en b\xFCy\xFCk engel, dataizm.\nDataizm ne?\nDataizm, i\xE7inde ya\u015Fad\u0131\u011F\u0131m\u0131z \xE7a\u011F\u0131n belki de en pop\xFCler ideolojisi, en h\u0131zl\u0131 b\xFCy\xFCyen dini. Verinin ve algoritman\u0131n d\xFCnyay\u0131 ve insanlar\u0131 anlamak i\xE7in en do\u011Fru ara\xE7 oldu\u011Funa inanan bir d\xFC\u015F\xFCnce.\nHer sorunu veriye dayanarak ve algoritmaya b\u0131rakarak \xE7\xF6zebilece\u011Finize inan\u0131yorsan\u0131z, bug\xFCn\xFCn en de\u011Ferli madeninin veri oldu\u011Funu d\xFC\u015F\xFCn\xFCyorsan\u0131z, siz de bir dataistsiniz.\nTarih\xE7i Yuval Noah Harari\u2019nin derleyip toparlay\u0131p yazd\u0131\u011F\u0131 ve insanl\u0131\u011F\u0131n gelece\u011Fini \xF6ng\xF6rmek i\xE7in kulland\u0131\u011F\u0131 bir kavram olan Dataizm\u2019e Silikon Vadisi \xF6nc\xFCl\xFC\u011F\xFCnde bilim ve siyaset d\xF6rt elle sar\u0131ld\u0131. \u0130\u015F d\xFCnyas\u0131 zaten haz\u0131rd\u0131.\nBug\xFCn i\u015F d\xFCnyas\u0131n\u0131n neredeyse tamam\u0131 dataist.\nY\xF6neticilerin \xE7o\u011Fu ellerinde dayanak olarak kullanabilecekleri veri yoksa herhangi bir karar..." },
  { slug: "ilk-dugme", title: "\u{1F4EE}\u0130lk d\xFC\u011Fme", tags: ["Gayrinizami Notlar"], excerpt: "", coreContent: "\xC7o\u011Fu \u015Firketin, hatta \xE7o\u011Fu ki\u015Finin,\n\xE7ok iyi yapt\u0131\u011F\u0131 \u015Fey\nile\nheves etti\u011Fi \u015Fey\nayn\u0131 de\u011Fil.\nMesela asl\u0131nda pazarlama kaslar\u0131 \xE7ok iyi olan bir \u015Firket, inovasyon canavar\u0131 olmaya hevesleniyor, iyi bir yazar YouTube fenomeni olmak istiyor, gibi.\nBu dengesizlik g\xFC\xE7l\xFC bir marka yaratman\u0131n \xF6n\xFCndeki en b\xFCy\xFCk engellerden biri.\n\xC7\xFCnk\xFC, yaln\u0131zca\n\xE7ok iyi\noldu\u011Funuz alanda ger\xE7ekten derinle\u015Febilir, uzmanla\u015Fabilir, m\xFCkemmele yakla\u015Fabilirsiniz.\nHeves etti\u011Finiz\nalanda ise, \xF6yle ya da b\xF6yle ortalamada kal\u0131rs\u0131n\u0131z.\nBu y\xFCzden \xFCr\xFCn, hizmet, isim, logo, taktik, strateji, sat\u0131\u015F, pazarlama\u2026 Hepsinden \xF6nce ilk \u015Fart, kendini tan\u0131mak. \u0130lk d\xFC\u011Fme gibi\u2026\n\u0130lk d\xFC\u011Fmeyi yanl\u0131\u015F iliklerseniz, di\u011Fer hepsi yanl\u0131\u015F olur." },
  { slug: "kagittan-kaplan", title: "\u{1F4EE}Ka\u011F\u0131ttan kaplan", tags: ["Gayrinizami Notlar"], excerpt: "", coreContent: "\xC7in Halk Cumhuriyeti\u2019nin kurucusu Mao, i\xE7 ve d\u0131\u015F d\xFC\u015Fmanlar\u0131n\u0131 tarif ederken \u201Cka\u011F\u0131ttan kaplan\u201D ifadesini kullan\u0131rd\u0131.\nD\u0131\u015Far\u0131dan heybetli ve g\xFC\xE7l\xFC g\xF6r\xFCnen ama i\xE7i bo\u015F, hafif, ilk r\xFCzgarda y\u0131k\u0131lacak kadar zay\u0131f\u2026\nB\xF6yle markalar da var. Ka\u011F\u0131ttan kaplanlar\u2026\nG\xFC\xE7l\xFC g\xF6r\xFCn\xFCyorlar, dev g\xF6r\xFCn\xFCyorlar ama i\xE7leri f\u0131s. Hava.\nNas\u0131l tan\u0131r\u0131z bunlar\u0131? Ortak \xF6zellikleri var m\u0131?\nVar gibi.\nKa\u011F\u0131ttan kaplanlar, bas\u0131n tetik\xE7ileri ve sosyal medya tetik\xE7ileri vas\u0131tas\u0131yla fazlas\u0131yla \xF6v\xFCl\xFCrler. S\xFCrekli dev yat\u0131r\u0131mlar ald\u0131klar\u0131n\u0131 duyar\u0131z. S\xFCrekli h\u0131zla b\xFCy\xFCmeye devam ederler.\nAma ger\xE7ek bir krizle s\u0131nanmam\u0131\u015Flard\u0131r. Zamanla bile s\u0131nanmam\u0131\u015Flard\u0131r. Daha yenidirler.\n\xC7o\u011Fu zaman da ilk r\xFCzgarda da\u011F\u0131l\u0131rlar.\nAkl\u0131n\u0131za mutlaka gelmi\u015Ftir b\xF6yle markalar.\nKa\u011F\u0131ttan kaplanlar\u0131 ideal kabul etmemek gerek. Onlara bakarak moralinizi..." },
  { slug: "mutfak-sirlari", title: "\u{1F4EE}Mutfak s\u0131rlar\u0131", tags: ["Gayrinizami Notlar"], excerpt: "", coreContent: "Stratejiyi yemek tarifi gibi d\xFC\u015F\xFCnenler var. De\u011Fil.\nStrateji, yemek tarifi gibi, oranlar\u0131n sabit oldu\u011Fu, arka arkaya uygulanacak belirli bir hareketler dizisi de\u011Fil.\nBir tutam soruna yar\u0131m \xE7ay barda\u011F\u0131 \xE7\xF6z\xFCm ekleyip markala\u015Fana kadar kavurun. \xDCzerine 1 su barda\u011F\u0131 reklam ve alabildi\u011Fi kadar yat\u0131r\u0131m ekleyip kulak memesi k\u0131vam\u0131na gelene kadar kar\u0131\u015Ft\u0131r\u0131n\u2026\nHay\u0131r, strateji bu de\u011Fil.\nStrateji kaynaklar\u0131n, y\xF6ntemlerin ve amac\u0131n birbiriyle ili\u015Fkisidir. Bir \xFC\xE7gen gibi d\xFC\u015F\xFCn\xFCn.\nDurumun, \u015Fartlar\u0131n, engellerin ve hatta f\u0131rsatlar\u0131n \xE7ald\u0131\u011F\u0131 m\xFCzikle kaynaklar, y\xF6ntemler ve ama\xE7lar dans eder. Strateji, \xFC\xE7genin bu 3 noktas\u0131n\u0131 belirli bir do\u011Frultuda tutabilme i\u015Fidir.\nKurallar b\xFCt\xFCn\xFCnden \xE7ok, de\u011Fi\u015Fen ko\u015Fullara h\u0131zl\u0131 ve do\u011Fru tepki verebilmekle ilgilidir.\nBu y\xFCzden kurallar b\xFCt\xFCn\xFCne de\u011Fil, ilkeler b\xFCt\xFCn\xFCne..." },
  { slug: "angora-tavsani-seven-soforler", title: "\u{1F4EE}Angora Tav\u015Fan\u0131 Seven \u015Eof\xF6rler", tags: ["Gayrinizami Notlar", "Gayrinizami Markalama"], excerpt: "", coreContent: "Angora Tav\u015Fan\u0131 Seven \u015Eof\xF6rler Derne\u011Fi gibi derneklerle y\u0131llarca dalga ge\xE7tik.\nBilemem, belki ger\xE7ekten Angora tav\u015Fan\u0131 seven \u015Fof\xF6rler var ve dernekle\u015Ftiler. Belki de kumar oynayacak mekan a\xE7mak i\xE7in b\xF6yle bir \xE7\xF6z\xFCm buldular. Bizim i\xE7in \xF6nemli olan tav\u015Fan ya da dernek de\u011Fil, \xF6nemli olan \u015Fu: Angora tav\u015Fan\u0131 seven birileri var.\n40, hatta 20 sene \xF6nce, Angora tav\u015Fan\u0131 seven birilerini aramaya kalksak, \xE7evremizde belki 15-20 ki\u015Fi bulurduk. O kadar. Dernek kurard\u0131k en fazla.\nBug\xFCn, d\xFCnyan\u0131n d\xF6rt bir yan\u0131ndan Angora tav\u015Fan\u0131 seven binlerce ki\u015Fiye kolayl\u0131kla ula\u015Fabiliriz.\nBu g\xFCc\xFC g\xF6rmezden geliyoruz.\nHerhangi bir \xFCr\xFCn ya da marka hakk\u0131nda kafa yorarken, hedef kitle ya da ni\u015F pazar ararken, 40 sene \xF6ncede ya\u015F\u0131yor gibi davranmamak gerek.\nD\xFCnya \xE7ap\u0131nda d\xFC\u015F\xFCnd\xFC\u011F\xFCm\xFCz zaman,\nAngora tav\u015Fan\u0131 seven..." },
  { slug: "tembellestiler", title: "\u{1F4EE}Tembelle\u015Ftiler", tags: ["Gayrinizami Markalama"], excerpt: "", coreContent: "Reklam bir grup pazarlamac\u0131y\u0131 tembelle\u015Ftirdi.\nGe\xE7ti\u011Fimiz y\xFCzy\u0131lda yeterli paran\u0131z varsa televizyona reklam veriyordunuz ve bir gecede markan\u0131z\u0131 me\u015Fhur edebiliyordunuz.\nAk\u0131ll\u0131 pazarlamac\u0131lar y\u0131llarca bu sistemin ekme\u011Fini yedi. Ama kolaya al\u0131\u015Ft\u0131lar, tembelle\u015Ftiler.\nSonra bu y\xFCzy\u0131lda, dijital pazarlama ortaya \xE7\u0131kt\u0131.\nOrada da benzer bir s\xFCre\xE7 ya\u015Fand\u0131.\nPara bu sefer de Google\u2019a ya da Facebook\u2019a akmaya ba\u015Flad\u0131 ve algoritmalar daha d\xFC\u015F\xFCk b\xFCt\xE7elerle daha minik markalara m\xFC\u015Fteri getirmeye ba\u015Flad\u0131.\nAk\u0131ll\u0131 dijital pazarlamac\u0131lar da bu sistemin ekme\u011Fini yedi.\nAma sonra onlar da kolaya al\u0131\u015Ft\u0131, tembelle\u015Fti.\nT\xFCm y\xFCk\xFC reklama y\u0131kmaya \xE7al\u0131\u015Ft\u0131lar.\nAma deniz bitti.\nTelevizyon reklamlar\u0131na ne kadar ba\u011F\u0131\u015F\u0131kl\u0131k kazand\u0131ysak, dijital d\xFCnyadaki numaralara da o kadar ba\u011F\u0131\u015F\u0131kl\u0131k kazand\u0131k.\nBiz ba\u011F\u0131\u015F\u0131kl\u0131k kazand\u0131k..." },
  { slug: "limited-post-26", title: "\u{1F4F0}Limited Post #26", tags: ["LimitedPost"], excerpt: "", coreContent: "Bu seride \xE7o\u011Funlukla\ndev olmayan ama b\xFCy\xFCme yolunda olan\nmarkalardan bahsediyorum. Ve o markalardan, ilham veren k\u0131sa haberler payla\u015F\u0131yorum.\nApple, Google, Amazon ya da ChatGPT gibi devlerin analizleri zaten her yerden f\u0131\u015Fk\u0131r\u0131yor. Ama bu \xE7aptaki hikayeler k\u0131y\u0131da k\xF6\u015Fede kal\u0131yor. Ben bu hikayeleri de seviyorum, sizin de sevece\u011Finizi umuyorum.\n\xD6nceki y\u0131l 25 say\u0131 yazm\u0131\u015F, sonra 1 y\u0131l ara vermi\u015Ftim. \u015Eimdi tekrar ba\u015Fl\u0131yorum.\n\u0130yi okumalar.\nAyakkab\u0131da inovasyon\nMike Pratt isimli beyefendi mucit bir giri\u015Fimci. 15 y\u0131l kadar \xF6nce, ayakkab\u0131 giymenin \xE7ok daha kolay olmas\u0131 gerekti\u011Fine kafay\u0131 takm\u0131\u015F.\nE\u011Fil, aya\u011F\u0131n\u0131 ge\xE7ir, topu\u011Fu sok, ba\u011Fc\u0131klar\u0131 ba\u011Fla, ger\xE7ekten de uzun i\u015F. Bir de \xE7ocuklar\u0131, ya\u015Fl\u0131lar\u0131 ve engellileri d\xFC\u015F\xFCn\xFCn, daha da zor.\nBir g\xFCn evin alt kat\u0131na inip \xE7al\u0131\u015Fmaya ba\u015Flad\u0131m,\ndiye anlat\u0131yor..." },
  { slug: "pizzayi-tum-dunya-tanirken-lahmacun-neden-yerel-kaldi", title: "Pizzay\u0131 t\xFCm d\xFCnya tan\u0131rken lahmacun neden yerel kald\u0131?", tags: ["Marka hikayeleri"], excerpt: "Tan\u0131t\u0131mla ya da lezzetle mi ilgili? De\u011Fil.", coreContent: "1.\nD\xFCnyan\u0131n her yerinde, men\xFCs\xFCnde pizza olan onlarca restoran bulabilir, herhangi bir zincir otelde oda servisinden rahatl\u0131kla pizza isteyebilirsiniz.\nPizza Hut ve Domino\u2019s\u2019un 100\u2019den fazla \xFClkede toplam 40 bine yak\u0131n restoran\u0131 var.\nSadece ABD\u2019de, saniyede 350 dilim pizza yeniyor.\nPizza -tart\u0131\u015Fmas\u0131z- d\xFCnyan\u0131n en pop\xFCler yiyeceklerinden biri. Peki neden?\nD\xFCnyada onlarca mutfak, hamur \xFCzerine \xE7e\u015Fitli malzemeler d\xF6\u015Feyip f\u0131r\u0131na atarken, lahmacun gibi, neden onlardan sadece biri, pizza me\u015Fhur oldu?\n\xC7ok mu lezzetli? \xC7ok mu pratik?\nYa da \u0130talyanlar mutfaklar\u0131n\u0131 pazarlamakta \xE7ok mu ba\u015Far\u0131l\u0131?\nYoksa Ninja Kaplumba\u011Falar\u2019\u0131n pizza a\u015Fk\u0131yla ba\u015Flayan bir b\xFCy\xFCk oyunun pen\xE7esinde miyiz?\nHi\xE7biri de\u011Fil.\n2.\nABD Kongre K\xFCt\xFCphanesi verilerine g\xF6re, 1870 ile 1900 y\u0131llar\u0131 aras\u0131nda Amerika Birle\u015Fik Devletleri\u2019ne,..." },
  { slug: "gorunmeyen-cozumler", title: "\u{1F5DD}\uFE0FG\xF6r\xFCnmeyen \xE7\xF6z\xFCmler", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "Zihinsel frekans aral\u0131\u011F\u0131n\u0131z\u0131 geni\u015Fletin", coreContent: "Yolunuzu t\u0131kayan 5 engelle\nba\u015Flay\u0131p\ndevam eden isimsiz serinin yeni par\xE7as\u0131 a\u015Fa\u011F\u0131da. Serinin ismini de sonunda buldum galiba, demlensin diye bekliyorum, haftaya belli olur:)\nG\xF6r\xFCnmeyen \xE7\xF6z\xFCmler, a\u015Fa\u011F\u0131da.\n\u0130yi okumalar\nBir \xE7\xF6z\xFCm\xFCn olmad\u0131\u011F\u0131na karar verip kendinizi b\u0131rakt\u0131\u011F\u0131n\u0131z anlar mutlaka olmu\u015Ftur.\nHer yolu denemi\u015F, yap\u0131labilecek her \u015Feyi yapm\u0131\u015Fs\u0131n\u0131zd\u0131r. Ama yok, olmuyor. Bitti. Yok bir \xE7\xF6z\xFCm!\n\xD6yle mi ger\xE7ekten? Bir \xE7\xF6z\xFCm yok mu? Emin misiniz?\nBelki de bir \xE7\xF6z\xFCm vard\u0131r. Hatta muhtemelen bir\xE7ok \xE7\xF6z\xFCm vard\u0131r.\nAma siz g\xF6remiyorsunuzdur? Olamaz m\u0131?\n\xC7\xF6z\xFCm\xFC g\xF6remiyor olman\u0131z, \xE7\xF6z\xFCm\xFCn olmad\u0131\u011F\u0131 anlam\u0131na gelmez.\n\xC7\xF6z\xFCm var. Sadece siz g\xF6remiyorsunuz.\nMesela g\xF6zlerimize de \xE7ok g\xFCveniyoruz. D\xFCnyay\u0131 t\xFCm ayr\u0131nt\u0131lar\u0131yla g\xF6rd\xFC\u011F\xFCm\xFCz\xFC d\xFC\u015F\xFCn\xFCyoruz. \xD6yle mi ger\xE7ekten? Hay\u0131r.\nBizim i\xE7in g\xF6r\xFCn\xFCr \u0131\u015F\u0131\u011F\u0131n dalga..." },
  { slug: "markalamanin-organik-yolu", title: "Markalaman\u0131n organik yolu", tags: ["Gayrinizami Markalama"], excerpt: "Hormonlu y\xF6ntemden ka\xE7\u0131\u015F", coreContent: "Markan\u0131z\u0131 ve fikrinizi yayman\u0131n organik bir yolunu biliyorum.\nOrganik olmayan yolu malum: Reklam.\nReklam hormonlu y\xF6ntem.\nEtkisi h\u0131zl\u0131 m\u0131, h\u0131zl\u0131. Ama s\u0131k\u0131nt\u0131l\u0131.\nBirincisi, kimse reklamlar\u0131 sevmez.\nReklamlar\u0131 sevmedi\u011Fimiz i\xE7in reklamla gelen mesaja da mesafeli yakla\u015F\u0131r\u0131z.\n\u0130kincisi, reklam pahal\u0131.\nHep pahal\u0131yd\u0131, bug\xFCn de pahal\u0131.\nVe hi\xE7bir zaman ucuzlamaz, ucuzlamayacak.\n\xDC\xE7\xFCnc\xFCs\xFC ve asl\u0131nda en tehlikelisi, ba\u011F\u0131ml\u0131l\u0131k meselesi.\nReklam ba\u011F\u0131ml\u0131l\u0131k yapar.\nAl\u0131\u015F\u0131rsan\u0131z, azaltamazs\u0131n\u0131z. Sat\u0131\u015F, ciro, hacim, izin vermez.\nS\xFCrekli doz art\u0131rman\u0131z gerekir.\nVe d\xF6rd\xFCnc\xFCs\xFC, sadece reklamla, tek y\xF6nl\xFC beslenme sa\u011Fl\u0131\u011Fa zararl\u0131.\nSadece etle, sadece otla ya da sadece meyveyle beslenemeyiz.\xA0Markam\u0131z da beslenemez.\nV\xFCcudumuz bug\xFCn olmasa da bir g\xFCn bir yerde ar\u0131za verir.\nYani sonu\xE7ta, markalama i\xE7in, tek ba\u015F\u0131na..." },
  { slug: "pazarlama-tarihinin-en-buyuk-skandallarindan-biri-new-coke", title: "Pazarlama tarihinin en b\xFCy\xFCk skandallar\u0131ndan biri: New Coke", tags: ["Pazar yaz\u0131lar\u0131", "\xD6zel makaleler"], excerpt: "23 Nisan 1985'te, Coca-Cola sevenler tats\u0131z bir s\xFCrprizle kar\u015F\u0131la\u015Ft\u0131", coreContent: "Herkes Coca-Cola\u2019n\u0131n gizli bir form\xFCl\xFC oldu\u011Funu duymu\u015Ftur. Ama \xE7ok daha az ki\u015Fi, Coca-Cola\u2019n\u0131n o form\xFCl\xFC de\u011Fi\u015Ftirmeye kalk\u0131p rezil oldu\u011Funu ve 77 g\xFCn sonra eski form\xFCl\xFCne d\xF6nd\xFC\u011F\xFCn\xFC bilir.\nPazarlama tarihinin en b\xFCy\xFCk skandallar\u0131ndan birinin hikayesi: New Coke.\nNew Coke\n23 Nisan 1985 g\xFCn\xFC sinemaya gitmek i\xE7in evden \xE7\u0131kan herhangi bir Amerikal\u0131, hangi filmi tercih edece\u011Fi konusunda zorlanabilirdi. Mad Max, Gelece\u011Fe D\xF6n\xFC\u015F ve Rocky 4, ayn\u0131 anda g\xF6sterimdeydi.\nBu filmlerden birini se\xE7tikten sonra, e\u011Fer m\u0131s\u0131r ve kola almak isterse, \xF6n\xFCnde iki zor se\xE7enek daha olacakt\u0131: Coca-Cola m\u0131, Pepsi mi?\n\xC7\xFCnk\xFC Pepsi\u2019nin efsane zamanlar\u0131yd\u0131. Marka bug\xFCnk\xFC gibi p\u0131s\u0131r\u0131k de\u011Fildi. Yeni neslin se\xE7imi kampanyas\u0131 tam gaz gidiyordu. Pepsi\u2019nin reklam y\xFCz\xFC Michael Jackson\u2019d\u0131 ve Coca-Cola - Pepsi rekabetindeki o..." },
  { slug: "dogru-karar-vermenin-yolu", title: "Do\u011Fru karar vermenin yolu", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "Bizde olup makinelerde olmayan g\xFC\xE7", coreContent: "B\xFCy\xFCk bir \xE7eli\u015Fkinin i\xE7inde ya\u015F\u0131yoruz:\nBilim d\xFCnyas\u0131 yapay zeka pe\u015Finde ko\u015Fuyor. Makinelerin zekas\u0131n\u0131 insan zekas\u0131na yakla\u015Ft\u0131rmaya \xE7al\u0131\u015F\u0131yorlar.\nAyn\u0131 anda biz insanlar, kendi zekam\u0131z\u0131n g\xFCc\xFCn\xFC bir kenara at\u0131p makinelere \xF6zeniyor, kararlar\u0131m\u0131z\u0131 makineler gibi vermeye \xE7al\u0131\u015F\u0131yoruz.\nTuhaf de\u011Fil mi?\n\u0130nsanlara, \xF6zellikle i\u015F d\xFCnyas\u0131ndaki insanlara s\xFCrekli, verilerle karar vermeleri \xF6\u011F\xFCtleniyor.\nVeri toplamaya, verileri de\u011Ferlendirip art\u0131lar\u0131 ve eksileri teraziye koyarak karar vermeye \xE7al\u0131\u015F\u0131yoruz.\n\u0130\u015F d\xFCnyas\u0131nda a\xE7\u0131k se\xE7ik veri olmadan karar veremez hale geldik. Makine gibi olmam\u0131z\u0131 \xF6\u011F\xFCtl\xFCyorlar. Ve bu gayet normal kar\u015F\u0131lan\u0131yor. Ama normal de\u011Fil.\n\xC7\xFCnk\xFC bu asl\u0131nda biz insanlar\u0131n tek y\xF6ntemi de\u011Fil. Bu makinelerin -\u015Fimdilik- tek y\xF6ntemi.\nBizim makinelerde olmayan bir art\u0131m\u0131z var: \u0130\xE7g\xFCd\xFClerimiz. Ya da..." },
  { slug: "yeterince-net-misiniz", title: "Yeterince net misiniz?", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "Odakland\u0131\u011F\u0131n\u0131z \u015Feyi netle\u015Ftirdi\u011Finiz zaman ne olur?", coreContent: "Kendi ad\u0131n\u0131za ya da markan\u0131z ad\u0131na, fark etmez, ne yapmak ve ne olmak istedi\u011Finiz hakk\u0131nda ger\xE7ekten net misiniz?\nNetlik kritik \xE7\xFCnk\xFC net olursan\u0131z, tuhaf bir \u015Fekilde, etraftaki her \u015Fey amac\u0131n\u0131za hizmet etmeye ba\u015Fl\u0131yor.\nYeterince net de\u011Filseniz, tam aksine, her \u015Fey yolunuza ta\u015F koyuyor. Ya da \xF6yle gibi geliyor.\nMetafizik gibi g\xF6r\xFCnd\xFC\u011F\xFCn\xFCn fark\u0131nday\u0131m ama de\u011Fil. Beynin \xE7al\u0131\u015Fma sistemi b\xF6yle.\nBilimsel bir a\xE7\u0131klamas\u0131 da var ama o kadar derine inmemize gerek yok. Basit\xE7e, beynin filtreleme sistemiyle ilgili.\nBeynimiz, etraftaki milyarlarca uyaran i\xE7erisinden hangilerini se\xE7ip dikkatimize sunmas\u0131 gerekti\u011Fine dair filtreler kullan\u0131yor.\nBu filtreleri yaratan da biziz.\nMesela?\nSokaklardaki elektrikli scooter\u2019lardan nefret ediyorsan\u0131z, s\xFCrekli onlar\u0131 g\xF6r\xFCrs\xFCn\xFCz. Ama scooter\u2019lar\u0131 umursamayan birine..." },
  { slug: "karar-vermenin-maliyeti", title: "Karar vermenin maliyeti", tags: ["Pazar yaz\u0131lar\u0131"], excerpt: "\u0130srail askeri istihbarat\u0131ndan Apple ve Nokia'ya, karar vermenin maliyeti", coreContent: "1.\nBundan tam 50 sene \xF6nce, 1973\u2019te, 6 Ekim g\xFCn\xFC sabaha kar\u015F\u0131 saat d\xF6rtte, \u0130srail askeri istihbarat direkt\xF6r\xFC, g\xFCvenilir kaynaklar\u0131ndan birinden bir telefon ald\u0131. Kaynak, o g\xFCn \xF6\u011Fleden sonra M\u0131s\u0131r ve Suriye\u2019nin \u0130srail\u2019e sald\u0131raca\u011F\u0131n\u0131 s\xF6yledi.\n\u0130srail\u2019in askeri istihbarat te\u015Fkilat\u0131 Aman\u2019\u0131n ba\u015F\u0131ndaki T\xFCmgeneral Eli Zeira\u2019n\u0131n elinde, ba\u015Fka bilgiler de vard\u0131.\n\u0130ki g\xFCn \xF6nce 4 Ekim\u2019de, hava ke\u015Ffi yapan \u0130srailli bir pilot, M\u0131s\u0131rl\u0131lar\u0131n sald\u0131r\u0131 pozisyonuna ge\xE7ti\u011Fini rapor etmi\u015Fti.\nAman kaynaklar\u0131 ayr\u0131ca, Sovyet h\xFCk\xFCmetinin Kahire ve \u015Eam\u2019daki Rus dan\u0131\u015Fmanlar\u0131 aileleriyle birlikte havayoluyla M\u0131s\u0131r ve Suriye\u2019den \xE7\u0131kar\u0131p Sovyet Rusya\u2019ya ta\u015F\u0131d\u0131\u011F\u0131n\u0131 bildirmi\u015Flerdi.\nT\xFCmgeneral Zeira, 6 Ekim sabaha kar\u015F\u0131 d\xF6rtte o telefonu ald\u0131\u011F\u0131nda, akl\u0131nda bu bilgiler de vard\u0131.\nAma sald\u0131r\u0131 beklenmedi\u011Fine karar..." },
  { slug: "peter-pan", title: "Peter Pan", tags: ["Gayrinizami Markalama"], excerpt: "Gayrinizami olmak i\xE7in b\xFCy\xFCmeyi reddetmek", coreContent: "Peter Pan b\xFCy\xFCmeyi reddeden bir karakter. Neverland\u2019de ya\u015Far ve hayal g\xFCc\xFC s\u0131n\u0131rs\u0131zd\u0131r. K\xF6t\xFC korsan Kaptan Hook\u2019la sava\u015F\u0131r.\nGayrinizami olmak ve gayrinizami kalmak isteyen markalar Kaptan Hook'u de\u011Fil, Peter Pan\u2019i \xF6rnek almal\u0131.\nPeter Pan olmak\n\xC7o\u011Fu marka bir an \xF6nce \xE7ocuklu\u011Fu atlat\u0131p b\xFCy\xFCmek istiyor.\n\xC7\xFCnk\xFC b\xFCy\xFCkler haval\u0131 g\xF6r\xFCn\xFCyor ve medya b\xFCy\xFCme hikayeleri anlat\u0131yor. B\xFCy\xFCme kutsal k\xE2se muamelesi g\xF6r\xFCyor: Growth hacking, growth marketing, growth manager, growth analytics\u2026\n\xC7o\u011Fu marka bu b\xFCy\xFCme r\xFCzg\xE2r\u0131na kap\u0131l\u0131yor ve \xE7ocuklu\u011Funu doyas\u0131ya ya\u015Fayamadan ergenli\u011Fe atl\u0131yor. Ama b\xFCnye haz\u0131r olmad\u0131\u011F\u0131 i\xE7in b\xFCy\xFCyemiyor, arada kal\u0131yor, ergen kal\u0131yor.\nNe b\xFCy\xFCk ne k\xFC\xE7\xFCk\u2026\n\xC7ocuklu\u011Fun heyecan\u0131 ve hayal g\xFCc\xFCn\xFC yitirmi\u015F\u2026\nAma yeti\u015Fkinli\u011Fin olgunlu\u011Funa, \xF6zg\xFCrl\xFC\u011F\xFCne ve gelirine de sahip olamam\u0131\u015F, arada kalm\u0131\u015F..." },
  { slug: "yolunuzu-tikayan-5-engel-4", title: "Yolunuzu t\u0131kayan 5 engel #4", tags: ["\u0130lham kayna\u011F\u0131", "Limited Post"], excerpt: "Hangi noktada t\u0131kan\u0131yorsunuz? B\xF6l\xFCm 4/5", coreContent: "\xDCr\xFCnle ya da hizmetle ilgili her \u015Feyi do\u011Fru yapt\u0131\u011F\u0131n\u0131z\u0131 ama hak etti\u011Finiz sonuca bir t\xFCrl\xFC ula\u015Famad\u0131\u011F\u0131n\u0131z\u0131 d\xFC\u015F\xFCn\xFCyor olabilirsiniz. B\xF6yle d\xFC\u015F\xFCnen bir\xE7ok giri\u015Fimciyle kar\u015F\u0131la\u015Ft\u0131m, \xE7al\u0131\u015Ft\u0131m.\nSorunu ve \xE7\xF6z\xFCm\xFC \xFCr\xFCnde, hizmette, fiyatta, da\u011F\u0131t\u0131mda, teknolojide, ambalajda, k\u0131sacas\u0131, d\u0131\u015Far\u0131da ar\u0131yorlard\u0131.\nAma \xE7o\u011Funda sorun d\u0131\u015Far\u0131da de\u011Fil, i\xE7erideydi. Kendi i\xE7lerinde\u2026\nOnlar\u0131n neye tak\u0131ld\u0131klar\u0131n\u0131 derledim.\xA05 olas\u0131 engel...\nSiz de bunlar\u0131 inceleyip hangi noktada tak\u0131ld\u0131\u011F\u0131n\u0131z\u0131 ke\u015Ffedebilirsiniz.\n\xD6zel bir s\u0131ralamayla yazmad\u0131m.\n\u0130lk \xFC\xE7\xFCn\xFC ge\xE7en hafta g\xF6nderdim. A\u015Fa\u011F\u0131daki d\xF6rd\xFCnc\xFC.\n4 - Harekete ge\xE7mekte a\u011F\u0131r kal\u0131yor olabilirsiniz\nHer \u015Fey d\xF6rt d\xF6rtl\xFCk olana kadar harekete ge\xE7miyor olabilirsiniz.\nT\xFCm olas\u0131l\u0131klar\u0131 hesap etmeye \xE7al\u0131\u015F\u0131yor, yolu a\xE7\u0131k se\xE7ik g\xF6rmek istiyor, kendinizi garantide hissedene kadar..." },
  { slug: "yolunuzu-tikayan-5-engel-3", title: "Yolunuzu t\u0131kayan 5 engel #3", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "Hangi noktada t\u0131kan\u0131yorsunuz? B\xF6l\xFCm 3/5", coreContent: "\xDCr\xFCnle ya da hizmetle ilgili her \u015Feyi do\u011Fru yapt\u0131\u011F\u0131n\u0131z\u0131 ama hak etti\u011Finiz sonuca bir t\xFCrl\xFC ula\u015Famad\u0131\u011F\u0131n\u0131z\u0131 d\xFC\u015F\xFCn\xFCyor olabilirsiniz. B\xF6yle d\xFC\u015F\xFCnen bir\xE7ok giri\u015Fimciyle kar\u015F\u0131la\u015Ft\u0131m, \xE7al\u0131\u015Ft\u0131m.\nSorunu ve \xE7\xF6z\xFCm\xFC \xFCr\xFCnde, hizmette, fiyatta, da\u011F\u0131t\u0131mda, teknolojide, ambalajda, k\u0131sacas\u0131, d\u0131\u015Far\u0131da ar\u0131yorlard\u0131.\nAma \xE7o\u011Funda sorun d\u0131\u015Far\u0131da de\u011Fil, i\xE7erideydi. Kendi i\xE7lerinde\u2026\nOnlar\u0131n neye tak\u0131ld\u0131klar\u0131n\u0131 derledim.\xA05 olas\u0131 engel...\nSiz de bunlar\u0131 inceleyip hangi noktada tak\u0131ld\u0131\u011F\u0131n\u0131z\u0131 ke\u015Ffedebilirsiniz.\n\xD6zel bir s\u0131ralamayla yazmad\u0131m.\n\u0130lk ikisini g\xF6nderdim. A\u015Fa\u011F\u0131daki \xFC\xE7\xFCnc\xFC.\n3 - Pop\xFCler olan baya\u011F\u0131d\u0131r, vasatt\u0131r, de\u011Fersizdir, diye d\xFC\u015F\xFCn\xFCyor olabilirsiniz\nToplumun b\xFCy\xFCk bir b\xF6l\xFCm\xFCnde g\xF6r\xFClen tuhaf bir k\xFClt\xFCrel inan\u0131\u015F daha var. \u0130nsanlar, herhangi bir \u015Fekilde pop\xFCler olan bir \u015Feyin, baya\u011F\u0131, s\u0131radan, vasat,..." },
  { slug: "yolunuzu-tikayan-5-engel-2", title: "Yolunuzu t\u0131kayan 5 engel #2", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "Hangi noktada t\u0131kan\u0131yorsunuz? B\xF6l\xFCm 2", coreContent: "\xDCr\xFCnle ya da hizmetle ilgili her \u015Feyi do\u011Fru yapt\u0131\u011F\u0131n\u0131z\u0131 ama hak etti\u011Finiz sonuca bir t\xFCrl\xFC ula\u015Famad\u0131\u011F\u0131n\u0131z\u0131 d\xFC\u015F\xFCn\xFCyor olabilirsiniz. B\xF6yle d\xFC\u015F\xFCnen bir\xE7ok giri\u015Fimciyle kar\u015F\u0131la\u015Ft\u0131m, \xE7al\u0131\u015Ft\u0131m.\nSorunu ve \xE7\xF6z\xFCm\xFC \xFCr\xFCnde, hizmette, fiyatta, da\u011F\u0131t\u0131mda, teknolojide, ambalajda, k\u0131sacas\u0131, d\u0131\u015Far\u0131da ar\u0131yorlard\u0131.\nAma \xE7o\u011Funda sorun d\u0131\u015Far\u0131da de\u011Fil, i\xE7erideydi. Kendi i\xE7lerinde\u2026\nOnlar\u0131n neye tak\u0131ld\u0131klar\u0131n\u0131 derledim.\xA05 olas\u0131 engel...\nSiz de bunlar\u0131 inceleyip hangi noktada tak\u0131ld\u0131\u011F\u0131n\u0131z\u0131 ke\u015Ffedebilirsiniz.\n\xD6zel bir s\u0131ralamayla yazmad\u0131m.\n\u0130lkini 2 g\xFCn \xF6nce g\xF6ndermi\u015Ftim. Bug\xFCn de ikincisi...\n2 - Hedefiniz ve hayaliniz yeterince b\xFCy\xFCk olmayabilir\nHedefiniz ya da hayaliniz sizi biraz olsun korkutmuyorsa, birazc\u0131k da olsa karn\u0131n\u0131z\u0131 a\u011Fr\u0131tm\u0131yorsa, az da olsa heyecanland\u0131rm\u0131yorsa, yeterli co\u015Fkuyu yakalayamazs\u0131n\u0131z...." },
  { slug: "yolunuzu-tikayan-5-olasi-engel-1", title: "Yolunuzu t\u0131kayan 5 engel #1", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "Hangi noktada t\u0131kan\u0131yorsunuz?", coreContent: "\xDCr\xFCnle ya da hizmetle ilgili her \u015Feyi do\u011Fru yapt\u0131\u011F\u0131n\u0131z\u0131 ama hak etti\u011Finiz sonuca bir t\xFCrl\xFC ula\u015Famad\u0131\u011F\u0131n\u0131z\u0131 d\xFC\u015F\xFCn\xFCyor olabilirsiniz. B\xF6yle d\xFC\u015F\xFCnen bir\xE7ok giri\u015Fimciyle kar\u015F\u0131la\u015Ft\u0131m, \xE7al\u0131\u015Ft\u0131m.\nSorunu ve \xE7\xF6z\xFCm\xFC \xFCr\xFCnde, hizmette, fiyatta, da\u011F\u0131t\u0131mda, teknolojide, ambalajda, k\u0131sacas\u0131, d\u0131\u015Far\u0131da ar\u0131yorlard\u0131.\nAma \xE7o\u011Funda sorun d\u0131\u015Far\u0131da de\u011Fil, i\xE7erideydi. Kendi i\xE7lerinde\u2026\nOnlar\u0131n neye tak\u0131ld\u0131klar\u0131n\u0131 derledim.\nBu ve devam\u0131ndaki 4 k\u0131sa makalede, o engelleri anlataca\u011F\u0131m.\nSiz de bunlar\u0131 inceleyip hangi noktada tak\u0131ld\u0131\u011F\u0131n\u0131z\u0131 ke\u015Ffedebilirsiniz.\n\xD6zel bir s\u0131ralama yok. \u0130lk engel a\u015Fa\u011F\u0131da.\n1 - \u0130\u015Finizi pazarlamay\u0131 k\xFC\xE7\xFCk d\xFC\u015F\xFCr\xFCc\xFC bir eylem olarak g\xF6r\xFCyor olabilirsiniz. Az da olsa...\nK\xFClt\xFCrel olarak tuhaf bir \u015Fekilde kodlanm\u0131\u015F\u0131z. Pazarlaman\u0131n k\xFC\xE7\xFCk d\xFC\u015F\xFCr\xFCc\xFC bir eylem oldu\u011Funu d\xFC\u015F\xFCn\xFCyoruz.\nSiz de arada b\xF6yle..." },
  { slug: "vermeden-almak", title: "Vermeden almak?", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "Verece\u011Finiz as\u0131l karar", coreContent: "Hangi hedef kitleye, hangi ihtiya\xE7lar\u0131 i\xE7in, hangi \xFCr\xFCnle hitap edece\u011Finize karar vermek \xF6nemli.\nAma daha da \xF6nemlisi var.\nBelki de daha faydal\u0131s\u0131...\nHangi hedef kitleye, hangi ihtiya\xE7lar\u0131 i\xE7in, hangi \xFCr\xFCnle ve hangi \xF6zelliklerinizle, kesin olarak hitap etmeyeceksiniz?\n\u0130lkine karar vermek kolay, ikincisi zor.\n\xC7\xFCnk\xFC ilkinde geni\u015F geni\u015F at\u0131p tutabilirsiniz.\nAma ikincide bir \u015Feylerden vazge\xE7meniz, baz\u0131 \u015Feyleri g\xF6zden \xE7\u0131karman\u0131z gerekir. Neyi ve kimleri g\xF6zden \xE7\u0131karabilirsiniz?\nAlmak kolay, vermek zor.\nVermeden almak da, bize mahsus de\u011Fil.\nVermek zorunday\u0131z.\nAlmak i\xE7in \xF6nce vermemiz gerekiyor.\nHayatta da stratejide de, yap\u0131lmayacaklar hakk\u0131ndaki tercihler, yap\u0131lacaklar hakk\u0131ndaki tercihler kadar \xF6nemli. Hatta daha da \xF6nemli.\nNeyi ve kimleri vermeye raz\u0131s\u0131n\u0131z? Samimi misiniz ve emin..." },
  { slug: "yolunuzu-tikayan-5-engel-5", title: "Yolunuzu t\u0131kayan 5 engel #5", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "Hangi noktada t\u0131kan\u0131yorsunuz? B\xF6l\xFCm 5/5", coreContent: "\xDCr\xFCnle ya da hizmetle ilgili her \u015Feyi do\u011Fru yapt\u0131\u011F\u0131n\u0131z\u0131 ama hak etti\u011Finiz sonuca bir t\xFCrl\xFC ula\u015Famad\u0131\u011F\u0131n\u0131z\u0131 d\xFC\u015F\xFCn\xFCyor olabilirsiniz. B\xF6yle d\xFC\u015F\xFCnen bir\xE7ok giri\u015Fimciyle kar\u015F\u0131la\u015Ft\u0131m, \xE7al\u0131\u015Ft\u0131m.\nSorunu ve \xE7\xF6z\xFCm\xFC \xFCr\xFCnde, hizmette, fiyatta, da\u011F\u0131t\u0131mda, teknolojide, ambalajda, k\u0131sacas\u0131, d\u0131\u015Far\u0131da ar\u0131yorlard\u0131.\nAma \xE7o\u011Funda sorun d\u0131\u015Far\u0131da de\u011Fil, i\xE7erideydi. Kendi i\xE7lerinde\u2026\nOnlar\u0131n neye tak\u0131ld\u0131klar\u0131n\u0131 derledim.\xA05 olas\u0131 engel...\nSiz de bunlar\u0131 inceleyip hangi noktada tak\u0131ld\u0131\u011F\u0131n\u0131z\u0131 ke\u015Ffedebilirsiniz.\n\xD6zel bir s\u0131ralamayla yazmad\u0131m.\n\u0130lk d\xF6rd\xFC ge\xE7en hafta g\xF6nderdim. A\u015Fa\u011F\u0131daki be\u015Finci.\nEn altta da size bir notum var.\n5 - Kendi k\u0131ymetinizin fark\u0131nda olmayabilirsiniz\n\u0130\u015F arkada\u015Flar\u0131m\u0131z, e\u015Fimiz dostumuz sosyal \xE7evremiz pek s\u0131k de\u011Fi\u015Fmedi\u011Fi i\xE7in, i\u015Fimizi ve kendimizi d\u0131\u015Far\u0131dan g\xF6remez hale geliriz. Bu durumun feci..." },
  { slug: "ahududu", title: "Ahududu", tags: ["Pazar yaz\u0131lar\u0131"], excerpt: "Sava\u015F\u0131n seyrini de\u011Fi\u015Ftiren taktik", coreContent: "1.\nHitler, Birle\u015Fik Krall\u0131k\u2019a giden t\xFCm gemilerin bat\u0131r\u0131lmas\u0131n\u0131 emretti. Emir yaln\u0131zca sava\u015F gemilerini kapsam\u0131yordu.\nHerhangi bir Alman kaptan herhangi bir geminin \u0130ngiltere\u2019ye do\u011Fru gitti\u011Fine karar verirse, geminin sava\u015F ya da ticaret gemisi oldu\u011Funa bakmadan, geminin insan, yiyecek, yak\u0131t ya da m\xFChimmat, ne ta\u015F\u0131d\u0131\u011F\u0131yla ilgilenmeden, gemiyi bat\u0131rabilirdi.\nAlman amiral Erich Raeder a\xE7\u0131k a\xE7\u0131k,\nd\xFC\u015Fman olarak g\xF6rd\xFC\u011F\xFCm\xFCz t\xFCm gemileri, ticaret ya da sava\u015F gemisi olarak ay\u0131rmadan, uyar\u0131 yapmadan torpidoyla vuraca\u011F\u0131z,\na\xE7\u0131klamas\u0131 yapt\u0131.\nHitler\u2019in amac\u0131 \u0130ngiltere\u2019yi a\xE7 b\u0131rakarak teslim olmaya zorlamakt\u0131.\n\u0130kinci D\xFCnya Sava\u015F\u0131 s\u0131ras\u0131nda Almanya, Fransa\u2019y\u0131 da i\u015Fgal edip g\xF6z\xFCn\xFC \u0130ngiltere\u2019ye dikti. Hitler, \u0130ngiltere\u2019yi sava\u015Fmadan teslim alabilece\u011Fini biliyordu. \xC7\xFCnk\xFC \u0130ngiltere bir ada \xFClkesiydi ve..." },
  { slug: "rekabetin-otesine-gecmek-icin", title: "Rekabetin \xF6tesine ge\xE7mek i\xE7in", tags: [], excerpt: "", coreContent: "\xD6n\xFCm\xFCzdeki d\xF6nemde, markan\u0131za do\u011Fru bir strateji tasarlayabilmeniz ve rekabetin \xF6tesine ge\xE7ebilmeniz i\xE7in, 2 online seminerim var, biri de yeni.\nYeni olandan ba\u015Fl\u0131yorum: Rekabet \xD6tesi\u{1F43A}\nRekabet \xF6tesi, markan\u0131z\u0131 bir \xFCst seviyeye ta\u015F\u0131yacak rekabet avantaj\u0131 i\xE7in 3 ad\u0131mda stratejik konumland\u0131rmay\u0131 anlat\u0131yor.\nRekabet \xD6tesi'nden biraz bahsedece\u011Fim.\nHerkes mobilya, motosiklet ya da cep telefonu \xFCretebiliyor. Peki IKEA, Harley Davidson ya da Apple neden rekabetin \xF6tesinde?\nPizza yapmak \xE7ok da zor de\u011Fil. 30 dakikada sipari\u015Fi teslim etmek de\u2026\nPeki nas\u0131l oluyor da Domino\u2019s rekabetin \xF6tesine ge\xE7iyor?\nG\xFCn\xFCm\xFCzde her \u015Fey an\u0131nda kopyalanabilirken, baz\u0131 markalar neden taklit edilemiyor, neden kimse onlar\u0131n rahat\u0131n\u0131 ka\xE7\u0131ram\u0131yor, taht\u0131n\u0131 sallayam\u0131yor?\nBu sadece,\nmarka olmak\nile a\xE7\u0131klanabilecek kadar basit..." },
  { slug: "uzmanlasmanin-getirdigi-zenginlik-3", title: "Uzmanla\u015Fman\u0131n getirdi\u011Fi zenginlik #3", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "Markan\u0131z\u0131n odaklanmas\u0131 i\xE7in 3 stratejik neden", coreContent: "3 makalelik mini serinin son makalesi a\u015Fa\u011F\u0131da\n3 - Markan\u0131z uzmanla\u015Fmal\u0131. \xC7\xFCnk\xFC odaklan\u0131p uzmanla\u015F\u0131nca, daha pahal\u0131ya satabilirsiniz.\nNapoli usul\xFC pizzadan devam edelim.\nBir sokakta kar\u015F\u0131l\u0131kl\u0131 iki restoran hayal edin. Birinin tabelas\u0131nda \u015Fu yaz\u0131yor:\nBaggio Pizza. Napoli usul\xFC pizza.\nKar\u015F\u0131dakinin tabelas\u0131nda da \u015Fu yaz\u0131yor.\nDel Piero Restaurant. Izgara \xE7e\u015Fitleri, deniz \xFCr\xFCnleri, d\xF6ner, k\xF6fte, makarna, pizza, hamur i\u015Fleri, s\u0131cak-so\u011Fuk mezeler ve kahvalt\u0131...\nPizza yemek istiyorsan\u0131z ve her iki restoranda da pizza 100 lira ise, hangi mekanda pizza yemeyi tercih edersiniz. Baggio'da m\u0131 Del Piero'da m\u0131?\nTabii ki Baggio'da.\nPeki pizza Baggio'da 125, Del Piero'da 100 lira ise?\n\xC7o\u011Fu ki\u015Fi yine Baggio'yu se\xE7er \xE7\xFCnk\xFC Baggio sadece pizza yap\u0131yor ve belli ki Baggio pizza i\u015Fini biliyor.\nFiyat 150'ye 100..." },
  { slug: "uzmanlasmanin-getirdigi-zenginlik-2", title: "Uzmanla\u015Fman\u0131n getirdi\u011Fi zenginlik #2", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "Markan\u0131z\u0131n odaklanmas\u0131 i\xE7in 3 stratejik neden", coreContent: "3 makalelik mini bir seri haz\u0131rlad\u0131m.\nUzmanla\u015Fman\u0131n getirdi\u011Fi zenginli\u011Fi a\xE7\u0131klayan ve markan\u0131z\u0131n odaklan\u0131p uzmanla\u015Fmas\u0131 i\xE7in 3 stratejik nedeni anlatan 3 mini makale...\n\u0130lkini Per\u015Fembe g\xF6ndermi\u015Ftim. \u0130kincisi a\u015Fa\u011F\u0131da. \xDC\xE7\xFCnc\xFC de Pazartesi posta kutunuzda olur.\n2 - Markan\u0131z uzmanla\u015Fmal\u0131. \xC7\xFCnk\xFC odaklan\u0131p uzmanla\u015Fmak verimlili\u011Finizi art\u0131r\u0131r.\nModern ekonominin temel ta\u015Flar\u0131ndan biri bu: \u0130\u015F b\xF6l\xFCm\xFC uzmanla\u015Fmay\u0131 getirir ve uzmanla\u015Fma verimlili\u011Fi art\u0131r\u0131r.\nMesela restoran mutfa\u011F\u0131ndaki bir usta, Napoli usul\xFC pizza konusunda uzmanla\u015Ft\u0131k\xE7a, hem becerisi geli\u015Fir hem h\u0131z\u0131 artar. \xC7\xFCnk\xFC insan, ayn\u0131 i\u015Fi tekrar ettik\xE7e \xF6\u011Frenir, ustala\u015F\u0131r.\nS\xFCrekli ayn\u0131 pizzay\u0131 yapa yapa, bir s\xFCre sonra minimum malzeme sarfiyat\u0131yla nefis bir pizzay\u0131 \xE7ok daha h\u0131zl\u0131 servis edebilecek hale gelir.\nBu bir verimlilik art\u0131\u015F\u0131.\nUsta..." },
  { slug: "uzmanlasmanin-getirdigi-zenginlik-1", title: "Uzmanla\u015Fman\u0131n getirdi\u011Fi zenginlik #1", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "Markan\u0131z\u0131n odaklanmas\u0131 i\xE7in 3 stratejik neden", coreContent: "3 makalelik mini bir seri haz\u0131rlad\u0131m.\nUzmanla\u015Fman\u0131n getirdi\u011Fi zenginli\u011Fi a\xE7\u0131klayan ve markan\u0131z\u0131n odaklan\u0131p uzmanla\u015Fmas\u0131 i\xE7in 3 stratejik nedeni anlatan 3 mini makale...\nBirincisi a\u015Fa\u011F\u0131da. Di\u011Fer ikisi de birer g\xFCn arayla gelecek.\n1 - Markan\u0131z uzmanla\u015Fmal\u0131. \xC7\xFCnk\xFC piyasa art\u0131k kasaba de\u011Fil.\nBir kasabada beyin cerrah\u0131ysan\u0131z, a\xE7 kal\u0131rs\u0131n\u0131z. Bir metropolde beyin cerrah\u0131ysan\u0131z, zengin olursunuz.\nYa da bir kasabada sadece Napoli usul\xFC pizza satan bir restoran a\xE7arsan\u0131z, batars\u0131n\u0131z. Bir metropolde sadece Napoli usul\xFC pizza satan bir restoran a\xE7arsan\u0131z, b\xFCy\xFCk ihtimalle zengin olursunuz.\nKasaba uzmanl\u0131k istemez. Metropol ister.\nKasabada d\xFCkkan a\xE7arsan\u0131z, her i\u015Ften anlay\u0131p olabildi\u011Fi kadar farkl\u0131 m\xFC\u015Fteriye hizmet vermeniz gerekir. Kazanc\u0131n\u0131z\u0131 ancak b\xF6yle art\u0131rabilirsiniz.\nYani kasabada muayenehane..." },
  { slug: "hokus-fokus-agustos", title: "\u{1F407} Hokus Fokus - A\u011Fustos", tags: [], excerpt: "Markan\u0131za odak noktas\u0131 bulma at\xF6lyesi - Online Seminer", coreContent: "Markan\u0131za odak noktas\u0131 ya da ni\u015F pazar ar\u0131yorsan\u0131z, size g\xFCzel bir haberim var: Hokus Fokus.\nHokus Fokus online bir seminer. Bir markan\u0131n odak noktas\u0131n\u0131 se\xE7menin yollar\u0131n\u0131 anlat\u0131yor. Ben anlat\u0131yorum:)\n16 Temmuz'da ger\xE7ekle\u015Fen ilk seminerde kontenjan 30 ki\u015Fiydi ve biletlerin tamam\u0131 sat\u0131ld\u0131. Kapal\u0131 gi\u015Fe...\n\u0130kincisi ise, 7 A\u011Fustos'ta. Kontenjan yine 30 ki\u015Fi.\nAbonelere \xF6zel\nE\u011Fer kat\u0131lmak isterseniz, bu seminer i\xE7in siz abonelere \xF6zel %20 indirim tan\u0131mlad\u0131m.\nVe normal kat\u0131l\u0131mc\u0131lar\u0131n 3.750\u20BA \xF6deyece\u011Fi bu at\xF6lye...\nSizin i\xE7in %20 indirimle 3.750\u20BA yerine, 3.000\u20BA.\nSize \xF6zel %20 indirim kodu a\u015Fa\u011F\u0131da:\n\u0130ndirim kodu: FOKUSABONE20\n\u015Eimdi kay\u0131t olabilirsiniz\n\u0130ndirim kodunuzu kullanmay\u0131 unutmay\u0131n\u{1F447}\n\xD6DEME YAP VE KAYIT OL\nAyr\u0131nt\u0131l\u0131 bilgi\nHokus Fokus hakk\u0131nda daha fazla bilgi i\xE7in detaylar \u015Furada\u{1F447}\nHOKUS..." },
  { slug: "hokus-fokus-genel01", title: "HOKUS FOKUS", tags: [], excerpt: "Markan\u0131za odak noktas\u0131 ve ni\u015F pazar bulma at\xF6lyesi", coreContent: `Markan\u0131za odak noktas\u0131 ve ni\u015F pazar bulma at\xF6lyesi
Odaklanan markalar \xE7ok daha g\xFC\xE7l\xFCd\xFCr. Ama nereye odaklanan? Hangi ni\u015Fe?
Odaklanaca\u011F\u0131n\u0131z noktaya ve ni\u015Finize karar vermek i\xE7in ilham gelmesini bekliyorsan\u0131z, zor. \u015Eansa kal\u0131r. Ama bunun bir metodu var.
\u0130ki saatlik bu at\xF6lyede, size bu metodu anlataca\u011F\u0131m.
\u0130ki saat sonunda, bir markan\u0131n oda\u011F\u0131n\u0131 se\xE7mek i\xE7in kullanabilece\u011Fi 3 net y\xF6ntem \xF6\u011Freneceksiniz. \xD6rneklerle birlikte, uygulanabilir, 3 basit y\xF6ntem...
\u{1F4A1}
"\u0130yi odaklanm\u0131\u015F bir \u015Firket, genele hitap edenden \xE7ok daha sa\u011Flam bir konumdad\u0131r." Al Ries,
Focus
Teorik \xE7er\xE7eve
Al Ries ve Jack Trout, 60'l\u0131 y\u0131llar\u0131n sonunda "Marka Konumland\u0131rma" kavram\u0131n\u0131 ortaya atan iki reklamc\u0131. Kavram neredeyse 60 y\u0131ld\u0131r pazarlama d\xFCnyas\u0131n\u0131 me\u015Fgul ediyor ve ikilinin yazd\u0131\u011F\u0131 baz\u0131 kitaplar, gelmi\u015F ge\xE7mi\u015F en iyi...` },
  { slug: "buyuk-fikir-nasil-bulunur", title: "B\xFCy\xFCk fikre giden yol", tags: ["\u0130lham kayna\u011F\u0131", "\xD6zel makaleler"], excerpt: "B\xFCy\xFCk fikri bulmak i\xE7in i\xE7eriden d\u0131\u015Far\u0131ya d\xFC\u015F\xFCnmek.", coreContent: "1.\n1950\u2019li y\u0131llar\u0131n ba\u015F\u0131nda \u0130zmirli bir \xF6\u011Fretmenin Ankara\u2019ya tayini \xE7\u0131kt\u0131. 20\u2019li ya\u015Flar\u0131n\u0131n ba\u015F\u0131ndaki Tacettin \xF6\u011Fretmen, \u0130zmir\u2019den Ankara\u2019ya gitmek istemedi ve istifa etti. Babas\u0131n\u0131n evinin alt kat\u0131n\u0131 at\xF6lyeye \xE7evirdi ve ufak tefek tamir i\u015Fleri yapmaya ba\u015Flad\u0131.\nBir g\xFCn kap\u0131dan bir arkada\u015F\u0131 elinde tuhaf bir \u201C\u015Feyle\u201D girdi. Tahtadan yap\u0131lm\u0131\u015F, i\xE7inde f\u0131r\xE7a olan tuhaf \u015Feyi Tacettin\u2019e g\xF6sterdi ve dedi ki:\n\u201CBen bunu geli\u015Ftirmeye \xE7al\u0131\u015F\u0131yorum ama bir t\xFCrl\xFC beceremiyorum\u201D\nO tuhaf \u201C\u015Fey\u201D \xFCzerinde \xE7al\u0131\u015Fmaya ba\u015Flad\u0131lar. Tacettin neredeyse 1 y\u0131l boyunca at\xF6lyesinden \xE7\u0131kmad\u0131. Sonunda \xE7al\u0131\u015Fan bir prototip geli\u015Ftirdi. Ama \xFCr\xFCn \xE7ok g\xFCr\xFClt\xFCl\xFCyd\xFC. Kimse bu kadar g\xFCr\xFClt\xFCl\xFC bir \xFCr\xFCn\xFC kullanamazd\u0131.\nDenemeye devam etti ve yeni bir prototip haz\u0131rlad\u0131. Sesi azaltmak i\xE7in tekerleri b\xFCy\xFCtt\xFC. Ses azalm\u0131\u015F, hareket..." },
  { slug: "bilyeli-rulman", title: "Bilyeli rulman \u2615\uFE0F", tags: ["Pazar yaz\u0131lar\u0131"], excerpt: "Strateji, a\u011F\u0131rl\u0131k merkezi ve darbo\u011Faz hedefi", coreContent: "1.\nGeneral Williams\u2019\u0131n komuta etti\u011Fi birlik, haber geldikten tam 9 dakika sonra havalanacakt\u0131.\nO 9 dakika \xF6nemliydi. \xC7\xFCnk\xFC, iki k\xFC\xE7\xFCk Alman kasabas\u0131 Schweinfurt ve Regensburg aras\u0131nda 200 km'ye yak\u0131n mesafe vard\u0131.\nBu y\xFCzden \xF6nce, General LeMay\u2019in komuta etti\u011Fi 230 bombard\u0131man u\xE7a\u011F\u0131 havalanacak, tam 9 dakika sonra da, General Williams\u2019\u0131n komuta etti\u011Fi 146 bombard\u0131man u\xE7a\u011F\u0131 hareket edecekti.\nB\xF6ylece iki ayr\u0131 birlik ve toplam 376 B-17 bombard\u0131man u\xE7a\u011F\u0131, Schweinfurt ve Regensburg\u2019a ayn\u0131 anda ula\u015Fm\u0131\u015F olacak ve ayn\u0131 anda bombard\u0131mana ba\u015Flayacaklard\u0131.\nII. D\xFCnya Sava\u015F\u0131\u2019n\u0131n ortalar\u0131yd\u0131. \u0130ngiliz ve Amerikal\u0131 strateji uzmanlar\u0131 uzun zamand\u0131r bu iki kasabadaki baz\u0131 fabrikalar\u0131n bombalanmas\u0131 gerekti\u011Fini s\xF6yl\xFCyorlard\u0131. Ama \u0130ngiliz Mare\u015Fal Arthur Harris, bu plana kar\u015F\u0131 \xE7\u0131k\u0131yordu.\n\xC7\xFCnk\xFC bu iki k\xFC\xE7\xFCk..." },
  { slug: "gayrinizami-markalama", title: "Gayrinizami markalama", tags: ["Gayrinizami Markalama"], excerpt: "Gayrinizami markalama nedir, ne de\u011Fildir, ismi nereden geliyor ve kimlere hitap ediyor?", coreContent: "Sizden g\xFC\xE7l\xFC bir rakiple, onun kurallar\u0131na uyarak m\xFCcadele edemezsiniz. G\xFC\xE7l\xFC bir marka yaratma amac\u0131nda olan g\xFCn\xFCm\xFCz giri\u015Fimcisinin en b\xFCy\xFCk problemlerinden biri bu. Pazarlaman\u0131n kitab\u0131n\u0131 yazan markalarla, o kitaba uyarak rekabet etmeye \xE7al\u0131\u015F\u0131yorlar. Gayrinizami markalaman\u0131n amac\u0131, bu probleme bir \xE7\xF6z\xFCm \xFCretmek.\nModern pazarlaman\u0131n ve markalaman\u0131n kanunlar\u0131n\u0131, \xE7o\u011Fu ge\xE7ti\u011Fimiz y\xFCzy\u0131lda do\u011Fan dev \u015Firketler yazd\u0131. Unilever, P&G, The Coca-Cola Company, PepsiCo, GE, IBM ve benzerleri, pazar ara\u015Ft\u0131rmalar\u0131 ve pazarlama \xE7al\u0131\u015Fmalar\u0131 i\xE7in milyarlarca dolar harcad\u0131lar.\nBu dev \u015Firketlerin \xF6nc\xFCl\xFC\u011F\xFCnde bilim ve sanat, ticaretin zengin ve g\xFCvenli \xE7at\u0131s\u0131 alt\u0131nda, tecr\xFCbe birikimi ve deneme yan\u0131lma yoluyla, bir pazarlama literat\xFCr\xFC olu\u015Fturdu. Pazarlama bir bilim olarak da kabul ediliyor. \xDCstelik \xE7ok..." },
  { slug: "markalasma-nihai-hedef-mi", title: "Ger\xE7ekten markala\u015Fabilir miyiz?", tags: ["Pazar yaz\u0131lar\u0131"], excerpt: "Markala\u015Fma nihai hedef mi? L\xFCks m\xFC? Herkes i\xE7in m\xFCmk\xFCn m\xFC?", coreContent: "Markala\u015Fma hep mecburiyet olarak, nihai hedef olarak anlat\u0131l\u0131yor. Belki de \xF6yle de\u011Fildir.\nBelki baz\u0131lar\u0131 i\xE7in bu m\xFCmk\xFCn de\u011Fildir.\nBelki de markala\u015Fma ince bir l\xFCkst\xFCr.\nParas\u0131n\u0131 \xF6deyen herkesin ula\u015Fabilece\u011Fi ve tad\u0131n\u0131 \xE7\u0131karabilece\u011Fi bir mertebe de\u011Fildir.\nYa da belki de, Bilimsel Devrim\u2019i ve Sanayi Devrimi\u2019ni pas ge\xE7mi\u015F k\xFClt\xFCrlerin, Bat\u0131l\u0131 anlamda pazarlama ve markalamay\u0131 sindirebilmelerinin olana\u011F\u0131 yoktur.\niPhone\u2019u ya da Tesla\u2019y\u0131 sat\u0131n al\u0131p direkt kullanabilirsiniz.\nAma onlar\u0131 yaratan zihniyeti ve k\xFClt\xFCr\xFC direkt kopyalayamazs\u0131n\u0131z. Sat\u0131n da alamazs\u0131n\u0131z.\n\u0130lk d\xFC\u011Fmeyi yanl\u0131\u015F ilikliyor olabiliriz." },
  { slug: "2023un-en-cok-okunanlari", title: "Y\u0131l\u0131n en \xE7ok okunanlar\u0131 - 2023", tags: ["News", "12ilke", "LimitedPost", "K\u0131l\xE7\u0131ks\u0131z Markalama", "Yasak Elmalar"], excerpt: "2023'de yazd\u0131klar\u0131m\u0131n genel bir \xF6zeti ve en \xE7ok okunanlar", coreContent: "Herkese selam.\n2023'de yazd\u0131klar\u0131m\u0131n genel bir \xF6zeti ve en \xE7ok okunanlar a\u015Fa\u011F\u0131da.\nBug\xFCn Limited Post ve yar\u0131n K\u0131l\xE7\u0131ks\u0131z Markalama yok. Ufak bir yeni y\u0131l tatili...\nSa\u011Fl\u0131kl\u0131 ve mutlu bir y\u0131l diliyorum.\nSeneye g\xF6r\xFC\u015F\xFCr\xFCz\u{1F601}\nPazar yaz\u0131lar\u0131\n2023 Se\xE7meler\nPizzay\u0131 t\xFCm d\xFCnya tan\u0131rken lahmacun neden yerel kald\u0131? Tan\u0131t\u0131mla ya da lezzetle mi ilgili? De\u011Fil.\nPizzay\u0131 t\xFCm d\xFCnya tan\u0131rken lahmacun neden yerel kald\u0131?\nTan\u0131t\u0131mla ya da lezzetle mi ilgili? De\u011Fil.\nEngin Tezcan\nEngin Tezcan\nAmazon\u2019un ald\u0131\u011F\u0131 patent, Karun'un hazineleri ve 21 y\u0131l \xF6nce yapay zeka dersinin s\u0131nav\u0131nda sorulan tek soru. Amazon ve Delfi kahini.\nAmazon ve Delfi K\xE2hini\nAmazon\u2019un ald\u0131\u011F\u0131 patent, Karun\u2019un hazineleri ve 21 y\u0131l \xF6nce yapay zeka dersinin s\u0131nav\u0131nda sorulan tek soru\nEngin Tezcan\nEngin Tezcan\n2 dev markan\u0131n derslerle dolu hikayesi...." },
  { slug: "limited-post-19", title: "\u{1F4F0}Limited Post #19", tags: ["LimitedPost"], excerpt: "Reklam boyac\u0131lar\u0131, \u015Fekersizle\u015Ftirme, hem\u015Fire aran\u0131yor, kahve gibi olmayan kahve", coreContent: "Reklam boyac\u0131lar\u0131\n\u0130stanbul'da birinci k\xF6pr\xFCden \xE7\u0131k\u0131p Mecidiyek\xF6y'e do\u011Fru ilerledi\u011Finizi hayal edin. Sa\u011Fl\u0131 sollu baz\u0131 binalar\u0131n duvarlar\u0131n\u0131 boydan boya kaplam\u0131\u015F devasa reklamlar g\xF6r\xFCrs\xFCn\xFCz. \xC7o\u011Fu bir foto\u011Fraf \xFCzerine birka\xE7 c\xFCmle ve logodan ibarettir. Ajansta \xFCretilir, m\xFC\u015Fteri onaylar, bas\u0131l\u0131r.\n\u015Eimdi t\xFCm o bina cephesinin, bir reklam i\xE7in, elle boyand\u0131\u011F\u0131n\u0131 d\xFC\u015F\xFCn\xFCn. Colossal Media'n\u0131n i\u015Fi bu. Kendilerini,\nelle boyanm\u0131\u015F outdoor reklamc\u0131l\u0131\u011F\u0131n\u0131n d\xFCnya lideri\nolarak tan\u0131ml\u0131yorlar.\nYani bir bina giydirecekseniz, stok g\xF6rselin \xFCzerine logoyu \xE7ak\u0131p ge\xE7mek yerine, marka, ajans ve Colossal ekibi bir araya gelip \xE7al\u0131\u015F\u0131yor. Ve duvar elle boyan\u0131yor.\nColossal, h\u0131zl\u0131 ve kolay\u0131n her zaman yeterince iyi olmad\u0131\u011F\u0131na, birinci s\u0131n\u0131f bir \xFCr\xFCn yaratman\u0131n yetenek, ba\u011Fl\u0131l\u0131k ve sebat gerektirdi\u011Fine inand\u0131\u011F\u0131n\u0131..." },
  { slug: "limited-post-18", title: "\u{1F4F0}Limited Post #18", tags: ["LimitedPost"], excerpt: "Polis kutusu, sa\u011Fl\u0131kl\u0131 bir ajans, duru\u015F meselesi ve a\u011Fa\xE7lar ormana d\xF6nmeli yurdumda", coreContent: "Polis kutusu\nT\xFCrkiye'de 500 bine yak\u0131n polis var. ABD'de 1 milyona yak\u0131n...\nNew York'taki Shieldbox isimli marka, bu 1 milyon polisi g\xF6z\xFCne kestirmi\u015F.\nShielbox, polis memurlar\u0131 i\xE7in ekipman i\u015Finde. Ama satm\u0131yor.\nAbonelik modeliyle \xE7al\u0131\u015F\u0131yor.\n\xC7e\u015Fitli paketler, yani kutular tasarlam\u0131\u015Flar. Kutularda kelep\xE7e, el feneri, biber gaz\u0131, b\u0131\xE7ak gibi, polislerin s\xFCrekli kulland\u0131\u011F\u0131 ve eskitip kaybedip geri almak zorunda kald\u0131\u011F\u0131 malzemeler var. \u0130htiyac\u0131n\u0131za g\xF6re paket se\xE7iyorsunuz.\nMesela sat\u0131n alsan\u0131z 90 dolara gelecek bir seti, ayda 59 dolara veriyorlar.\nB\xFCy\xFCk ihtimalle bizdeki sistem farkl\u0131d\u0131r, polisin sarf malzemesini devlet kar\u015F\u0131l\u0131yordur. Ama zaten ben de direkt i\u015F modelini kopyalay\u0131n diye anlatm\u0131yorum. Maksat zihni g\u0131d\u0131klamak. Bu arada, T\xFCrkiye'de 200 bine yak\u0131n doktor var mesela, akl\u0131n\u0131zda..." },
  { slug: "konumlandirmanin-masturbasyondan-farki", title: "Konumland\u0131rman\u0131n mast\xFCrbasyondan fark\u0131", tags: ["Marka konumland\u0131rma"], excerpt: "Size sunulan konumland\u0131rma ger\xE7ekten konumland\u0131rma m\u0131?", coreContent: "Ge\xE7enlerde konumland\u0131rma diye sunulan a\u015Fa\u011F\u0131dakine benzer bir c\xFCmle g\xF6rd\xFCm:\nX markas\u0131 \xF6zenli, butik, i\u015Fine \xF6nem veren, profesyonel, m\xFC\u015Fterilerinin her t\xFCrl\xFC ihtiyac\u0131n\u0131 en do\u011Fru \u015Fekilde tasarlayan bir bilmem ne hizmetleri kurumudur.\nB\xF6yle konumland\u0131rma olmaz. B\xF6yle c\xFCmlelerin mast\xFCrbasyondan fark\u0131 yoktur. \xC7\xFCnk\xFC konumland\u0131rma kendi kendine yapt\u0131\u011F\u0131n bir i\u015F de\u011Fildir.\nT\xFCketicinin zihnine yapt\u0131\u011F\u0131n bir operasyondur.\nCahillikten ya da tembellikten, konumland\u0131rma edeb\xEE bir mast\xFCrbasyon arac\u0131 olarak kullan\u0131l\u0131yor. Markay\u0131 y\xF6netenlerin g\xF6r\xFCnce ho\u015Funa gidece\u011Fi kavramlar, s\xFCsl\xFC kelimeler, arka arkaya sat\u0131r sat\u0131r yaz\u0131l\u0131yor, i\u015Fte konumland\u0131rmam\u0131z bu, deniyor.\nOysa ki konumland\u0131rma marka y\xF6neticilerini tatmin etmeye yarayan s\xFCsl\xFC c\xFCmleler demek de\u011Fildir. Konumland\u0131rma, bir strateji..." },
  { slug: "en-cok-sorulan-soru-applein-marka-konumlandirmasi-ne", title: "En \xE7ok sorulan soru: Apple\u2019\u0131n marka konumland\u0131rmas\u0131 ne?", tags: ["Marka konumland\u0131rma"], excerpt: "En s\u0131k kar\u015F\u0131la\u015Ft\u0131\u011F\u0131m sorulardan biri bu: Apple\u2019\u0131n konumland\u0131rmas\u0131 ne?  Cevab\u0131 bu yaz\u0131da.", coreContent: "D\xFCnyadaki herkesin cebinde tu\u015Flu Nokia\u2019lar, Motorola\u2019lar ve BlackBerry\u2019ler varken iPhone\u2019u \xFCretebilen bir markaysan\u0131z, sizin de\u011Fil, rakiplerinizin konumland\u0131rmaya ihtiyac\u0131 olur.\nWindows y\xFCkl\xFC \xE7irkin ve hantal PC\u2019lerin kar\u015F\u0131s\u0131nda daha 90\u2019l\u0131 y\u0131llarda iMac\u2019leri \xFCreten bir markaysan\u0131z, sizin de\u011Fil, rakiplerinizin konumland\u0131rmaya ihtiyac\u0131 olur.\nApple\u2019\u0131n, girdi\u011Fi end\xFCstriyi k\xF6k\xFCnden de\u011Fi\u015Ftiren t\xFCm \xFCr\xFCnlerini yazmaya gerek yok.\nYa da \xE7ok uza\u011Fa da gitmeyelim\u2026\nBir \xFClkede herkes yemek sipari\u015Fini telefon a\xE7arak verirken, siz internetten yemek sipari\u015Fi verilen ilk marka olursan\u0131z, sizin de\u011Fil, rakiplerinizin konumland\u0131rmaya ihtiyac\u0131 olur.\nBir \xFClkedeki t\xFCm zincir marketler raflar\u0131yla, dekorlar\u0131yla, \u0131\u015F\u0131kland\u0131rmalar\u0131yla, \xE7e\u015Fit \xE7e\u015Fit me\u015Fhur markalarla p\u0131r\u0131l p\u0131r\u0131lken\u2026\nSiz ad\u0131 san\u0131 duyulmam\u0131\u015F markalar\u0131,..." },
  { slug: "kilciksiz-markalama", title: "K\u0131l\xE7\u0131ks\u0131z Markalama", tags: ["K\u0131l\xE7\u0131ks\u0131z Markalama"], excerpt: "Markan\u0131z\u0131 y\xF6netirken do\u011Fru ad\u0131mlar atman\u0131z i\xE7in, 24 temel kavram\u0131n k\u0131l\xE7\u0131ks\u0131z a\xE7\u0131klamas\u0131", coreContent: "Markan\u0131z\u0131 y\xF6netirken do\u011Fru ad\u0131mlar atman\u0131z i\xE7in, 24 temel kavram\u0131n k\u0131l\xE7\u0131ks\u0131z a\xE7\u0131klamas\u0131, pek yak\u0131nda.\nKonumland\u0131rma, de\u011Fer, misyon, vizyon, strateji, imaj, kalite, yarat\u0131c\u0131l\u0131k, tasar\u0131m, veri, ara\u015Ft\u0131rma, pazarlama plan\u0131, pazarlama karmas\u0131, logo, kurumsal kimlik ve daha fazlas\u0131...\n24 hafta boyunca 24 kavram\u0131 e-postayla almak i\xE7in abone olun." },
  { slug: "osmanli-sarayina-ilk-zeytinyagini-gonderen-marka-neden-bebek-bezi-satmaya-calisir", title: "Osmanl\u0131 saray\u0131na ilk zeytinya\u011F\u0131n\u0131 g\xF6nderen marka, neden bebek bezi satmaya \xE7al\u0131\u015F\u0131r?", tags: ["Marka hikayeleri"], excerpt: "1800\u2019l\xFC y\u0131llar\u0131n sonlar\u0131nda, Midilli adas\u0131nda bir k\xF6yde tatl\u0131 tatl\u0131 ya\u015Fayan Hasan isimli bir adam, bir anda kendini d\xFCnya \xE7ap\u0131nda bir kaosun i\xE7inde buldu.", coreContent: "1800\u2019l\xFC y\u0131llar\u0131n sonlar\u0131nda, Midilli adas\u0131nda bir k\xF6yde tatl\u0131 tatl\u0131 ya\u015Fay\u0131p sabun ve zeytinya\u011F\u0131 satan Hasan isimli bir adam, bir anda kendini d\xFCnya \xE7ap\u0131nda bir kaosun i\xE7inde buldu.\nAyval\u0131k\u2019\u0131n tam kar\u015F\u0131s\u0131ndaki ve o zamanlar Osmanl\u0131 topra\u011F\u0131 olan bu aday\u0131, 1913\u2019te Yunanl\u0131lar i\u015Fgal etti. Bir y\u0131l sonra 1. D\xFCnya Sava\u015F\u0131 patlad\u0131. \xDCzerine Osmanl\u0131 da\u011F\u0131ld\u0131 ve Anadolu\u2019da milli m\xFCcadele ba\u015Flad\u0131.\n1922\u2019de de, m\xFCbadele karar\u0131 verildi. Adadaki T\xFCrk n\xFCfus, Anadolu\u2019daki Rum n\xFCfusla yer de\u011Fi\u015Ftirmek zorunda kald\u0131. Hasan ve ailesi, Midilli\u2019deki k\xF6ylerinden ayr\u0131l\u0131p Ayval\u0131k\u2019a yerle\u015Fti. Ama Hasan\u2019\u0131 herkes hala, Midilli\u2019deki k\xF6y\xFCn\xFCn ismiyle tan\u0131yordu. K\xF6y\xFCn ad\u0131 Komi\u2019ydi. Hasan\u2019a da Komili Hasan diyorlard\u0131. Komili markas\u0131 b\xF6yle do\u011Fdu.\nMarkan\u0131n yetkililerinin s\xF6yledi\u011Fine g\xF6re, Osmanl\u0131 saray\u0131na ilk zeytinya\u011F\u0131n\u0131..." },
  { slug: "marka-konumlandirma-nedir", title: "Marka konumland\u0131rma nedir?", tags: ["Marka konumland\u0131rma"], excerpt: "Bu zamana kadar marka konumland\u0131rma hakk\u0131nda uzun ve karma\u015F\u0131k tan\u0131mlamalar g\xF6rd\xFCyseniz, bo\u015Fverin, unutun gitsin.", coreContent: "Marka konumland\u0131rma, bir markay\u0131 t\xFCketicinin zihninde benzersiz bir konuma yerle\u015Ftirmek demektir.\nBu zamana kadar marka konumland\u0131rma hakk\u0131nda uzun ve karma\u015F\u0131k tan\u0131mlamalar g\xF6rd\xFCyseniz, bo\u015Fverin, unutun gitsin. \xC7\xFCnk\xFC marka konumland\u0131rma bu kadar basit.\nBu arada konumland\u0131rman\u0131n bu basit tan\u0131m\u0131 da bana ait de\u011Fil. Konumland\u0131rman\u0131n mucitleri Al Ries ve Jack Trout b\xF6yle tan\u0131ml\u0131yorlar. Mucitleri bu kadar basit\xE7e tan\u0131mlarken, ba\u015Fkalar\u0131 neden konumland\u0131rmay\u0131 karma\u015F\u0131kla\u015Ft\u0131r\u0131yor, onlar da anlam veremiyor.\nAma basit olmas\u0131, kolay olmas\u0131 anlam\u0131na gelmiyor\n\xC7\xFCnk\xFC konumland\u0131rman\u0131n yap\u0131ld\u0131\u011F\u0131 yer, t\xFCketicinin zihni. T\xFCketicinin zihnine m\xFCdahalede bulunmak da haliyle pek kolay de\u011Fil.\nKendinizi d\xFC\u015F\xFCn\xFCn\u2026\nS\xFCrekli sat\u0131n ald\u0131\u011F\u0131n\u0131z ve y\u0131llard\u0131r kulland\u0131\u011F\u0131n\u0131z bir markay\u0131 kolay kolay de\u011Fi\u015Ftirir misiniz?\nNeler..." },
  { slug: "ilke-10-karmasikligin-degil-basitligin-pesinden-kos", title: "\u0130lke #10: Karma\u015F\u0131kl\u0131\u011F\u0131n de\u011Fil basitli\u011Fin pe\u015Finden ko\u015F", tags: ["12ilke"], excerpt: "B\xFCy\xFCk fikirleri tan\u0131man\u0131n basit yolu", coreContent: "\u0130\u015F d\xFCnyas\u0131n\u0131n b\xFCy\xFCk k\u0131sm\u0131, \xF6zellikle pazarlama ve reklam camias\u0131, zeki g\xF6r\xFCnmeye tak\u0131nt\u0131l\u0131. Herkes birbirine ne kadar zeki oldu\u011Funu kan\u0131tlamaya \xE7al\u0131\u015F\u0131yor. Ama do\u011Fal olarak herkes o kadar zeki de\u011Fil, olamaz.\nBu durumda zeki g\xF6r\xFCnmenin tek yolu kal\u0131yor: Karma\u015F\u0131kl\u0131k.\nKarma\u015F\u0131kl\u0131ktan kast\u0131m da \u015Fu: \xC7ok zeki, derin ve bilgiliymi\u015F izlenimi vermek i\xE7in laf kalabal\u0131\u011F\u0131 yapmak.\nYani jargona bo\u011Fulmu\u015F uzun ve s\xFCsl\xFC c\xFCmleler, bolca \u0130ngilizce kelime, birka\xE7 moda kavram... Tan\u0131d\u0131k geldi de\u011Fil mi?\n\xC7o\u011Fu meslekta\u015F\u0131m, ne kadar karma\u015F\u0131k ve anla\u015F\u0131lmaz olursa o kadar zeki g\xF6r\xFCnece\u011Fini ve k\u0131ymetli olaca\u011F\u0131n\u0131 d\xFC\u015F\xFCn\xFCyor. \u015Eirketlerdeki \xE7o\u011Fu y\xF6netici de ayn\u0131 motivasyona sahip oldu\u011Fu i\xE7in, bunlar birbirlerini \xE7ekiyor, bulu\u015Fuyorlar.\nHaval\u0131 g\xF6r\xFCnen ama hi\xE7bir anlam\u0131 olmayan s\xFCsl\xFC c\xFCmleleri arka arkaya dizip markalar\u0131..." },
  { slug: "beyin-firtinasindan-fikir-cikmaz", title: "Beyin f\u0131rt\u0131nas\u0131ndan fikir \xE7\u0131kmaz", tags: ["\u0130lham kayna\u011F\u0131", "\xD6zel makaleler"], excerpt: "Beyin f\u0131rt\u0131nas\u0131 fikri, bir beyin f\u0131rt\u0131nas\u0131 seans\u0131nda m\u0131 bulundu?", coreContent: "Beyin f\u0131rt\u0131nas\u0131 yapma amac\u0131yla bir toplant\u0131 odas\u0131na t\u0131k\u0131lan insanlar ikiye ayr\u0131l\u0131r: Fikri olanlar ve fikri olmayanlar.\nVe s\xFCrekli beyin f\u0131rt\u0131nas\u0131 yapmak isteyenler hi\xE7 de\u011Fi\u015Fmez: Onlar hep, fikri olmayanlard\u0131r.\nBu iki grup aras\u0131nda ge\xE7irgenlik de yoktur. Yani bug\xFCn \u201Cfikri olmayanlar\u201D grubunda olanlar, yar\u0131n \u201Cfikri olanlar\u201D grubunda olmaz. Tersi de olmaz.\n\xC7\xFCnk\xFC fikri olanlar\u0131n her zaman fikri vard\u0131r. Olmad\u0131\u011F\u0131 zamanlarda da hemen yeni fikir \xFCretebilirler. Ama fikri olmayanlar\u0131n hi\xE7bir zaman fikri yoktur. \xDCretemezler de. Bu y\xFCzden s\xFCrekli beyin f\u0131rt\u0131nas\u0131 yapmak isterler. Beyin f\u0131rt\u0131nas\u0131 yap\u0131ls\u0131n ki, fikri olmayanlar fikri olanlar\u0131n fikirlerini dinleyip o fikirlerin \xFCzerinde tepinebilsinler.\nYani beyin f\u0131rt\u0131nas\u0131, bir grup fikirsizin s\xFCrekli fikir \xFCreten k\xFC\xE7\xFCk bir gruba eziyet etmek i\xE7in..." },
  { slug: "influencerlari-rahat-birakiniz", title: "Influencer\u2019lar\u0131 rahat b\u0131rak\u0131n\u0131z!", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "Influencer\u2019lar\u0131 kullanma k\u0131lavuzu", coreContent: "Neredeyse t\xFCm markalar influencer pe\u015Finde ko\u015Fuyor, b\xFCt\xE7elerin \xF6nemli bir k\u0131sm\u0131 influencer marketing i\xE7in harcan\u0131yor.\nTeoride \xE7ok etkili olan bu tan\u0131t\u0131m y\xF6ntemi, yine bizim muhte\u015Fem pazarlamac\u0131lar\u0131m\u0131z\u0131n ak\u0131l dolu y\xF6nlendirmeleriyle, pratikte etkisiz bir y\xF6ntem olmaya do\u011Fru ilerliyor.\n\u0130nsanlar reklamdan ka\xE7ar, reklam sevmez, reklama g\xFCvenmez. En ince i\u015F\xE7ilikle yap\u0131lm\u0131\u015F olan\u0131 bile, \xF6yle ya da b\xF6yle, reklamd\u0131r. Reklamlar\u0131n reklam oldu\u011Funu bildi\u011Fimiz i\xE7in etkisi s\u0131n\u0131rl\u0131d\u0131r. Bir marka paras\u0131n\u0131 \xF6deyerek kar\u015F\u0131m\u0131za \xE7\u0131k\u0131yor ve kendi kendini \xF6v\xFCyor. Reklam budur. Ve hi\xE7 kimse kendi kendini \xF6venleri sevmez. Reklamc\u0131lar\u0131n bile \xE7o\u011Fu reklam\u0131 sevmez. (Ben reklam\u0131 severim ama reklamc\u0131y\u0131 sevmem.)\nBu y\xFCzden tan\u0131t\u0131m, reklam de\u011Fil tan\u0131t\u0131m, \xE7ok ama \xE7ok daha \xF6nemli ve etkilidir. Reklamda marka kendi kendini..." },
  { slug: "limited-1", title: "\u{1F4F0}Limited Post #1", tags: ["LimitedPost"], excerpt: "Yeni seri: Dev olmayan ama b\xFCy\xFCme yolunda olan markalardan ilham veren haberler.", coreContent: "Selam, a\u015Fa\u011F\u0131da okuyaca\u011F\u0131n\u0131z sat\u0131rlar sizin i\xE7in haz\u0131rlad\u0131\u011F\u0131m yeni bir serinin ilk say\u0131s\u0131.\nBu seriye\nLimited Post\nismini koydum. \xC7\xFCnk\xFC burada \xE7o\u011Funlukla,\nlimited\n\u015Firket k\u0131vam\u0131ndaki,\ndev olmayan ama b\xFCy\xFCme yolunda olan\nmarkalardan bahsedece\u011Fim. Ve o markalardan, ilham veren k\u0131sa haberler payla\u015Faca\u011F\u0131m.\nApple, Google, Amazon ya da ChatGPT gibi devlerin analizleri zaten her yerden f\u0131\u015Fk\u0131r\u0131yor. Ama bu \xE7aptaki hikayeler k\u0131y\u0131da k\xF6\u015Fede kal\u0131yor. Ben bu hikayeleri de seviyorum, sizin de sevece\u011Finizi umuyorum.\nBa\u015Fl\u0131yoruz, iyi okumalar.\nTicareti olabiliyorsa e-ticareti de olur\nABD'li iki karde\u015F, 40 y\u0131ll\u0131k aile i\u015Fletmelerinde satt\u0131klar\u0131 \xFCr\xFCnleri e-ticaret yoluyla satmak istemi\u015F. Babalar\u0131 \xFCr\xFCnlerinin buna uygun olmad\u0131\u011F\u0131n\u0131 s\xF6yleyerek kar\u015F\u0131 \xE7\u0131km\u0131\u015F ama iki karde\u015F pes etmemi\u015F.\nPerfect Plants Nursery, art\u0131k..." },
  { slug: "tuketiciye-soru-sorulur-mu", title: "T\xFCketiciye soru sorulur mu?", tags: ["Yeni marka yaratmak"], excerpt: "Pazarlamada demokrasinin zararlar\u0131", coreContent: "Bir marka hakk\u0131ndaki her \u015Feyi vatanda\u015Fa sormak ve ona g\xF6re karar vermek, iyi bir fikir de\u011Fildir.\nBirincisi, t\xFCketici ne istedi\u011Fini bilmez.\n\u0130kincisi, t\xFCketicinin s\xF6yledi\u011Fiyle yapt\u0131\u011F\u0131 genelde birbirini tutmaz.\nSony, Walkman i\xE7in yapt\u0131rd\u0131\u011F\u0131 ara\u015Ft\u0131rmalara g\xF6re karar verse, Walkman\u2019i piyasaya s\xFCrmezdi. \xC7o\u011Fu insan, y\xFCr\xFCrken m\xFCzik dinlemeyi anlams\u0131z bulmu\u015Ftu. Sony, t\xFCketicileri dinlemedi. Walkman, m\xFCzik tarihini de\u011Fi\u015Ftirdi.\n\xDClker, Cola Turka\u2019y\u0131 piyasaya s\xFCrmeden \xF6nce muhtemelen onlarca ara\u015Ft\u0131rmaya soktu. Farkl\u0131 isimleri, logolar\u0131 ve lezzet alternatiflerini test etti. Ara\u015Ft\u0131rmaya kat\u0131lan t\xFCketiciler de, bildi\u011Fimiz haliyle Cola Turka\u2019ya karar verdi. Cola Turka\u2019y\u0131, Coca-Cola\u2019ya tercih edeceklerini s\xF6ylediler. \xDClker t\xFCketicileri dinledi. Cola Turka \xE7ak\u0131ld\u0131.\nBir marka hakk\u0131nda verece\u011Finiz kritik..." },
  { slug: "2022nin-en-cok-okunanlari", title: "Y\u0131l\u0131n en \xE7ok okunanlar\u0131", tags: ["News"], excerpt: "2022'de en \xE7ok okunan 10 hikaye, 10 ipucu, 5 \xF6zel makale", coreContent: "En \xE7ok okunan 10 hikaye\n1. Markan\u0131z\u0131n kaderini de\u011Fi\u015Ftirme potansiyeli olan 1000 ki\u015Fi\nYeni markan\u0131z\u0131n 1000 ki\u015Fiye ihtiyac\u0131 var\nMarkan\u0131z\u0131n kaderini de\u011Fi\u015Ftirme potansiyeli olan 1000 ki\u015Fi\nEngin Tezcan\nEngin Tezcan\n2. Shein, yeni Amazon olur mu?\nShein, yeni Amazon olur mu?\nCEO\u2019su r\xF6portaj vermiyor. \u015Eirket finansal verileri payla\u015Fm\u0131yor. De\u011Feri 100 milyar $\u2019\u0131 buldu.\nEngin Tezcan\nEngin Tezcan\n3. 78 milyon dolar ceza \xF6demeye de\u011Fecek bir strateji\n78 milyon dolarl\u0131k bir pizzan\u0131n hikayesi\n78 milyon dolar ceza \xF6demeye de\u011Fecek bir strateji\nEngin Tezcan\nEngin Tezcan\n4. Bir markay\u0131 do\u011Furan, ya\u015Fatan ve \xF6ld\xFCren 3 farkl\u0131 \u015Fey\nBir markay\u0131 do\u011Furan, ya\u015Fatan ve \xF6ld\xFCren 3 farkl\u0131 \u015Fey\nBir ayakkab\u0131 modeli, birka\xE7 d\xFCnya rekoru ve yasaklarla biten bir skandaldan, markan\u0131z i\xE7in \xE7\u0131karabilece\u011Finiz dersler\nEngin..." },
  { slug: "bankalarla-neden-bayramlasiyoruz", title: "Bankalarla neden bayramla\u015F\u0131yoruz?", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "\xD6zel g\xFCn postlar\u0131n\u0131n maliyeti", coreContent: "Ke\u015Fke \u015Funu \xF6l\xE7menin bir yolu olsa:\nAcaba \xFClkedeki ajanslar\u0131n ve pazarlama ekiplerinin vakitlerinin ka\xE7ta ka\xE7\u0131, \xF6zel g\xFCnler i\xE7in samimiyetsiz sosyal medya postlar\u0131 haz\u0131rlamakla ge\xE7iyor? Ve harcanan bu zaman\u0131n para birimi olarak toplam maliyeti ne?\nPazarlama ekiplerinin ve ajanslar\u0131n rutin g\xF6revlerinden biri, \xF6zel g\xFCn postlar\u0131 haz\u0131rlamak ve payla\u015Fmak oldu. Bunun i\xE7in ciddi zaman harcan\u0131yor ve kimse de\nbunu neden yap\u0131yoruz\ndiye d\xFC\u015F\xFCnm\xFCyor. Herkes yapt\u0131\u011F\u0131 i\xE7in herkes yapmaya devam ediyor.\nBir markan\u0131n, D\xFCnya Sa\u011Fl\u0131k G\xFCn\xFC ya da D\xFCnya \xC7evre G\xFCn\xFC kutlamas\u0131n\u0131n ne \xF6nemi var? Dostlar al\u0131\u015Fveri\u015Fte g\xF6rs\xFCn.\nB\xF6yle t\u0131r\u0131v\u0131r\u0131 g\xFCnleri ge\xE7tim, markalar\u0131n resm\xEE ya da din\xEE bayramlar\u0131 kutlamas\u0131n\u0131n bizim i\xE7in ne \xF6nemi var? Hi\xE7bir \xF6nemi yok. Markan\u0131n ne i\u015Fine yar\u0131yor? Hi\xE7.\nO zaman mesela bir banka niye benim..." },
  { slug: "gerilla-pazarlama", title: "Wall Street'ten Levent'e: Bir gerilla pazarlama dersi", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "T\xFCrkiye'de gerilla pazarlama nas\u0131l yap\u0131l\u0131r?", coreContent: "Ge\xE7ti\u011Fimiz Eyl\xFCl ay\u0131n\u0131n ortalar\u0131nda bir sabah, Wall Street\u2019te enteresan bir haber yay\u0131lmaya ba\u015Flad\u0131. Yat\u0131r\u0131m bankac\u0131l\u0131\u011F\u0131 devi Goldman Sachs, merkez binas\u0131nda \xE7al\u0131\u015Fanlar\u0131n bedava kahve alabildi\u011Fi kahve otomatlar\u0131n\u0131 kald\u0131rm\u0131\u015Ft\u0131.\nKulaktan kula\u011Fa h\u0131zla yay\u0131lan dedikodu, o s\u0131ralarda yeni do\u011Fan heyecanl\u0131 kahve markas\u0131 Cometeer\u2019a da ula\u015Ft\u0131.\nCometeer yetkilileri hemen ertesi sabah, Wall Street'te Goldman Sachs binas\u0131n\u0131n \xF6n\xFCnde bir kahve stand\u0131 kurdu. Stand\u0131n \xFCzerindeki afi\u015Fte \u015Fu yaz\u0131yordu: Goldman analistleri i\xE7in \xFCcretsiz kahve!\nKahve markas\u0131 Cometeer ertesi g\xFCn man\u015Fetlerdeydi. Onlarca habere konu oldu.\nBasit, komik ve etkili. \u0130\u015Fte size gerilla pazarlama.\nHadi gelin \u015Fimdi, ayn\u0131 hikayeyi T\xFCrkiye\u2019ye uyarlayal\u0131m.\nDedikodu Levent\u2019ten yay\u0131lmaya ba\u015Flas\u0131n. Dev bankalar\u0131m\u0131zdan birinin Levent\u2019teki merkez..." },
  { slug: "eltiler-yarisiyor", title: "Eltiler yar\u0131\u015F\u0131yor", tags: ["\u0130lham kayna\u011F\u0131", "\xD6zel makaleler"], excerpt: "Pazarlama m\xFCd\xFCrlerimiz neden birbiriyle yar\u0131\u015Fan eltiler gibi davran\u0131yor?", coreContent: "K\xFClt\xFCrel, sosyolojik ya da psikolojik k\xF6kenleri vard\u0131r belki. O kadar derine inmek benim i\u015Fim de\u011Fil. Ama pazarlama camias\u0131ndaki \u015Fu ger\xE7e\u011Fin hepimiz fark\u0131nday\u0131z herhalde:\nPazarlama m\xFCd\xFCrlerimizin \xE7o\u011Fu, en yenisini en iyisi zannediyor.\nBirbiriyle yar\u0131\u015Fan eltiler gibi, biri yeni bir kavram\u0131, mecray\u0131 ya da teknolojiyi kullanmaya ba\u015Flay\u0131nca, di\u011Ferleri de ayn\u0131s\u0131ndan istiyor.\nOysa ki en yenisi her zaman en iyisi anlam\u0131na gelmez.\nAma yeni \xE7\u0131kan ne varsa bal\u0131klama atlamaya bay\u0131l\u0131yorlar. \u0130\u015Fe yarar m\u0131 yaramaz m\u0131, do\u011Fru mu yanl\u0131\u015F m\u0131, gerekli mi gereksiz mi, d\xFC\u015F\xFCnm\xFCyorlar bile.\nMetaverse diye bir\u015Fey \xE7\u0131km\u0131\u015F, hop ordalar, s\xFCrd\xFCr\xFClebilirlik pop\xFCler olmu\u015F, hop buradalar. Tiktok diye bir\u015Fey varm\u0131\u015F, hop oradalar, yapay zeka pop\xFCler olmu\u015F, hop buradalar.\nMarkam\u0131n buna ger\xE7ekten ihtiyac\u0131 var m\u0131, diye hi\xE7..." },
  { slug: "ders-gibi-2-reklam-filmi", title: "Ders gibi 2 reklam filmi", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "Ayn\u0131 \xFCr\xFCn, 2 farkl\u0131 marka, 2 farkl\u0131 zihniyet. Peki kazanan hangisi?", coreContent: "Ge\xE7en hafta televizyonda 2 bebek bezi markas\u0131n\u0131n 2 reklam filmi d\xF6n\xFCyordu. Kimilerinin neden lider oldu\u011Funu, kimilerinin neden nal toplad\u0131\u011F\u0131n\u0131 anlatan, ders gibi 2 reklam filmi\u2026\nSadece bu 2 reklam filmine ve markalar\u0131n pazardaki durumuna bakarak bile, bir marka ne yapmas\u0131 ve ne yapamamas\u0131 gerekti\u011Fini a\xE7\u0131k se\xE7ik kavrayabilir.\n\u0130lk film\nFilmlerden ilki, kalemi k\u0131vrak bir reklam yazar\u0131n\u0131n elinden \xE7\u0131km\u0131\u015F. Filmin \xFCzerine kuruldu\u011Fu c\xFCmleye bak\u0131n:\nBebe\u011Fimle Her An Ne G\xFCzel, Bebe\u011Fiyle Her Anne G\xFCzel.\nKelime oyununu ka\xE7\u0131rmad\u0131n\u0131z de\u011Fil mi? Ka\xE7\u0131rm\u0131\u015F olamazs\u0131n\u0131z. Her [an-ne] g\xFCzel, her [anne] g\xFCzel...\nHarika de\u011Fil mi? Ajans b\xFCy\xFCk ihtimalle s\u0131rf bu c\xFCmleyle filmi satm\u0131\u015Ft\u0131r.\nFilmin senaryosu da prod\xFCksiyonu da harika. \xC7ok tatl\u0131 sahnelerde annelerle bebeklerin ev hallerini g\xF6r\xFCyoruz. Arkada yumu\u015Fak bir..." },
  { slug: "konumlandirma-ve-asiri-sadelestirme", title: "Konumland\u0131rma ve a\u015F\u0131r\u0131 sadele\u015Ftirme", tags: ["Marka konumland\u0131rma", "\xD6zel makaleler"], excerpt: "Normal insanlar markalar hakk\u0131nda pazarlamac\u0131lar kadar \xE7ok d\xFC\u015F\xFCnmez.", coreContent: "Marka, sadece pazarlamac\u0131lar i\xE7in karma\u015F\u0131k bir enstr\xFCman.\nT\xFCketiciler i\xE7in de\u011Fil.\nNormal insanlar markalar hakk\u0131nda pazarlamac\u0131lar kadar \xE7ok d\xFC\u015F\xFCnmez.\nPazarlamac\u0131lar markalar\u0131 hakk\u0131nda saatlerce toplant\u0131lar yapar, ara\u015Ft\u0131rmalar yapt\u0131r\u0131r, y\xFCzlerce sayfal\u0131k raporlar haz\u0131rlar.\nMarka dan\u0131\u015Fmanlar\u0131 markay\u0131 analiz etmek i\xE7in aylarca s\xFCre ister.\nMarka \xF6z\xFC, marka DNA\u2019s\u0131, marka ki\u015Fili\u011Fi, ses tonu, duygusal fayda, rasyonel fayda gibi ayr\u0131nt\u0131lar belirlenir. Falan filan.\nBunlar vatanda\u015F\u0131n umrunda de\u011Fildir. Vatanda\u015F polemi\u011Fe girmez. Akl\u0131nda her kategori i\xE7in bir repertuar, bir marka listesi vard\u0131r. \xC7o\u011Funlukla en \xFCsttekini, yani kategori liderini al\u0131r ge\xE7er. B\xFCy\xFCk ihtimalle siz de \xF6yle yap\u0131yorsunuz.\n\xC7\xFCnk\xFC vatanda\u015F\u0131n i\u015Fi g\xFCc\xFC var. Zaten g\xFCnde bin reklamla kar\u015F\u0131la\u015Fmas\u0131n\u0131 bir kenara b\u0131rak\u0131n, normal..." },
  { slug: "78-milyon-dolarlik-bir-pizzanin-hikayesi", title: "78 milyon dolarl\u0131k bir pizzan\u0131n hikayesi", tags: ["Pazar yaz\u0131lar\u0131", "\xD6zel makaleler"], excerpt: "78 milyon dolar ceza \xF6demeye de\u011Fecek bir strateji", coreContent: "1989\u2019da ABD\u2019nin St. Louis kentinde, m\xFC\u015Fteriye pizza sipari\u015Fi yeti\u015Ftirmeye ta\u015F\u0131yan bir motorsiklet s\xFCr\xFCc\xFCs\xFC, bir kad\u0131na \xE7arpt\u0131.\nKad\u0131n, restorana tazminat davas\u0131 a\xE7t\u0131. Dava 1993\u2019te sonu\xE7land\u0131 ve mahkeme kad\u0131na 78 milyon dolar tazminat \xF6denmesine karar verdi.\n78 milyon dolar tazminat\u0131 \xF6deyen, Domino\u2019s\u2019tu.\n\xC7\xFCnk\xFC mahkeme, s\xFCr\xFCc\xFCn\xFCn 30 dakika i\xE7inde pizza yeti\u015Ftirme zorunlulu\u011Fu sebebiyle dikkatsiz davrand\u0131\u011F\u0131na, yani bu kazaya, Domino\u2019s\u2019un 30 dakika kural\u0131n\u0131n sebep oldu\u011Funa karar verdi.\nO g\xFCnden sonra Domino\u2019s, 30 dakika garantisinden vazge\xE7ti\u011Fini duyurdu. Fakat vazge\xE7medi. Baz\u0131 esnemeler yaparak ve \xE7e\u015Fitli \u015Fartlar koyarak, pizzay\u0131 30 dakikada teslim edece\u011Fini, edemezse \xFCcret almayaca\u011F\u0131n\u0131 \u201Cbir \u015Fekilde\u201D s\xF6ylemeye devam etti.\n\xC7\xFCnk\xFC sadece 900 dolar yat\u0131r\u0131mla kurulan Domino\u2019s\u2019un, milyarlarca..." },
  { slug: "korsan-caginin-baslangici", title: "\u{1F3F4}\u200D\u2620\uFE0FKorsan \xE7a\u011F\u0131n\u0131n ba\u015Flang\u0131c\u0131", tags: ["News"], excerpt: "Dev teknoloji \u015Firketlerindeki i\u015Ften \xE7\u0131karmalar, bir korsan \xE7a\u011F\u0131n\u0131n ba\u015Flang\u0131c\u0131 olabilir.", coreContent: "1.\nDev teknoloji \u015Firketlerinin ba\u015F\u0131 \xE7ekti\u011Fi b\xFCy\xFCk bir i\u015Ften \xE7\u0131karma dalgas\u0131n\u0131n ortas\u0131nday\u0131z. Meta 11 bin ki\u015Fiyi, Twitter 2500 ki\u015Fiyi, Intel personelin %20\u2019sini, Stripe %14\u2019\xFCn\xFC, Lyft %13\u2019\xFCn\xFC i\u015Ften \xE7\u0131kard\u0131. Apple i\u015Fe al\u0131mlar\u0131 durdurdu, Amazon 10 bin ki\u015Fiyi \xE7\u0131karmaya haz\u0131rlan\u0131yor.\n\xC7o\u011Fu analist do\u011Fal olarak bu b\xFCy\xFCk daralmay\u0131 olumsuz yorumluyor ama ka\xE7\u0131rd\u0131klar\u0131 \xF6nemli bir nokta var: Bu i\u015Ften \xE7\u0131karmalar, bir korsan \xE7a\u011F\u0131n\u0131n ba\u015Flang\u0131c\u0131 olabilir.\n2.\nBat\u0131 d\xFCnyas\u0131 1650 ile 1725 y\u0131llar\u0131 aras\u0131n\u0131 Korsanlar\u0131n Alt\u0131n \xC7a\u011F\u0131 olarak kabul ediyor. Kaptan Bartholomew Roberts da, bu alt\u0131n \xE7a\u011F\u0131n en ba\u015Far\u0131l\u0131 korsan\u0131.\nKaptan Roberts, bug\xFCn Johnny Depp\u2019in canland\u0131rd\u0131\u011F\u0131 Jack Sparrow karakteri gibi, pop\xFCler k\xFClt\xFCr\xFCn \xE7izdi\u011Fi korsan profilinin ilham kayna\u011F\u0131. 400\u2019den fazla \xF6d\xFCl\xFC var.\n\u015Eaka yapm\u0131yorum. Korsan camias\u0131nda..." },
  { slug: "en-az-marka-ismi-kadar-onemli-olan-baska-bir-isim", title: "En az marka ismi kadar \xF6nemli olan ba\u015Fka bir isim", tags: ["Yeni marka yaratmak"], excerpt: "Zihnin markalarla ilgili \xE7al\u0131\u015Fma mekanizmas\u0131", coreContent: "Yeni bir marka yarat\u0131yorsan\u0131z, en az marka ismi kadar \xF6nemli bir \u015Fey daha var: Markan\u0131n bulundu\u011Fu kategorinin ismi.\nHerhangi bir \u015Fey sat\u0131n almaya niyetlendi\u011Finizde, kendi kendinize nas\u0131l konu\u015Ftu\u011Funuzu d\xFC\u015F\xFCn\xFCn.\nEvde buzdolab\u0131n\u0131 a\xE7t\u0131n\u0131z diyelim. \u0130\xE7inizden,\ns\xFCt almam laz\u0131m,\ndiye ge\xE7irirsiniz.\nP\u0131nar almam gerekiyor,\ndemezsiniz.\nYa da,\nkredi \xE7ekmem gerekiyor,\ndiye d\xFC\u015F\xFCn\xFCrs\xFCn\xFCz.\nGaranti\u2019den Bayram Kredisi almam gerek,\ndemezsiniz.\nStarbucks\u2019a gidelim\nya da\nAirpods almal\u0131y\u0131m\ngibi baz\u0131 \xF6zel durumlar ve markalar haricinde, e\u011Fer psikopat de\u011Filsek, ihtiya\xE7lar\u0131m\u0131z\u0131 marka isimleriyle tan\u0131mlamay\u0131z. (P\u0131nar, Komili, Uno, Mehmet Efendi, Solo, \u0130pana\u2026 diye bir al\u0131\u015Fveri\u015F listesi yapmay\u0131z.)\nZihnimiz ihtiyac\u0131n\u0131 kategori isimleriyle d\xFC\u015F\xFCn\xFCr, sonra da o kategorideki markalardan birini sat\u0131n al\u0131r\u0131z.\nS\xFCt..." },
  { slug: "yeni-markalar-icin-2-temel-strateji-prensibi", title: "Yeni markalar i\xE7in 2 temel strateji prensibi", tags: ["Yeni marka yaratmak", "\xD6zel makaleler"], excerpt: "Yeni bir marka yaratma a\u015Famas\u0131nda olanlar\u0131n mutlaka bilmesi gereken 2 temel strateji prensibi", coreContent: "Yeni bir marka yarat\u0131rken, temel strateji prensiplerini unutmamak gerekir.\nA\u015Fa\u011F\u0131da, yeni bir marka yaratma a\u015Famas\u0131nda olanlar\u0131n mutlaka bilmesi gereken 2 temel strateji prensibi var.\nBunlar\u0131 ben uydurmad\u0131m. Sun Tzu 2500 y\u0131l \xF6nce anlatm\u0131\u015F. Ama bi' marka konferans\u0131nda anlatma f\u0131rsat\u0131 bulamad\u0131\u011F\u0131 i\xE7in pazarlama camias\u0131nda pek bilinmiyor.\nPazarlamac\u0131lar\u0131n \xF6nemli bir k\u0131sm\u0131 logo, renk, marka ki\u015Fili\u011Fi, marka \xF6z\xFC, marka DNA\u2019s\u0131, marka deneyimi ve benzerlerini konu\u015Fuyor. Bunlar iyi ho\u015F da, temel stratejide \xE7uvallarsan\u0131z, bunlar sizi kurtarmaz.\n\u0130\u015Fte, yeni bir marka yaratma a\u015Famas\u0131nda olanlar\u0131n mutlaka bilmesi gereken 2 temel strateji prensibi:\n1. Sava\u015F meydan\u0131na yerle\u015Fip d\xFC\u015Fman\u0131 bekleyen avantajl\u0131d\u0131r. Sonradan gelen yorulur.\nYani diyor ki, lideri olan yerle\u015Fik bir pazara sonradan giriyorsan\u0131z, i\u015Finiz..." },
  { slug: "karmasik-bir-urunu-anlatmanin-2-basit-yolu", title: "Karma\u015F\u0131k bir \xFCr\xFCn\xFC anlatman\u0131n 2 basit yolu", tags: ["\u0130lham kayna\u011F\u0131", "\xD6zel makale"], excerpt: "Elinizde yepyeni ve biraz da karma\u015F\u0131k bir \xFCr\xFCn varsa...", coreContent: "Bu yaz\u0131 k\u0131sac\u0131k bir yaz\u0131 olacak ama i\u015Finize yarayaca\u011F\u0131na eminim.\nElinizde yepyeni ve biraz da karma\u015F\u0131k bir \xFCr\xFCn varsa...\nVe o \xFCr\xFCn\xFCn ne oldu\u011Funu ve neler yapt\u0131\u011F\u0131n\u0131 anlatmakta zorlan\u0131yorsan\u0131z, size iki y\xF6ntem \xF6nerece\u011Fim:\nBirincisi\n\xDCr\xFCn\xFCn ne oldu\u011Funu ve neler yapt\u0131\u011F\u0131n\u0131 anlatmak yerine, ne olmad\u0131\u011F\u0131n\u0131 ve neler yapmad\u0131\u011F\u0131n\u0131 anlatabilirsiniz.\nMesela otomobil, ilk denemelerin ve \xFCretimlerin yap\u0131ld\u0131\u011F\u0131 1800\u2019l\xFC y\u0131llarda, insanlara \u201Cats\u0131z araba\u201D olarak tan\u0131t\u0131ld\u0131.\n\u0130kincisi\nYeni \xFCr\xFCn\xFC \xE7ok iyi bildi\u011Fimiz ba\u015Fka bir \xFCr\xFCnle ba\u011Flant\u0131 kurarak anlatabilirsiniz.\nVizontele\u2019de televizyon g\xF6rmemi\u015F ahaliye televizyonu anlatmaya \xE7al\u0131\u015Fan belediye reisinin yapt\u0131\u011F\u0131 gibi: Televizyon nedir? Radyonun resimlisidir\u2026\n\u0130nsanlara bilmedi\u011Fi yeni teknolojileri anlatman\u0131n en k\u0131sa yolu, bildi\u011Fi \u015Feyler \xFCzerinden anlatmakt\u0131r...." },
  { slug: "reklam-yazmanin-ilk-adimi", title: "Reklam yazman\u0131n ilk ad\u0131m\u0131", tags: ["\u0130lham kayna\u011F\u0131", "\xD6zel makaleler"], excerpt: '"Biggest pain point", "call to action" ya da  "social proof"tan \xF6nce d\xFC\u015F\xFCnmeniz gereken', coreContent: 'Nas\u0131l reklam metni yaz\u0131laca\u011F\u0131na dair \xE7ok fazla kaynak ve \xF6neri var.\nOysa bir reklam metni yazarken ilk d\xFC\u015F\xFCnmeniz gereken \u201Cnas\u0131l\u201D s\xF6yleyece\u011Finiz de\u011Fil. \u0130lk ve as\u0131l d\xFC\u015F\xFCnmeniz gereken, \u201Cne\u201D s\xF6yleyece\u011Finiz.\nHafta sonu evinde ailesiyle vakit ge\xE7iren bir adama, fabrikas\u0131nda yang\u0131n \xE7\u0131kt\u0131\u011F\u0131n\u0131 s\xF6yleyecekseniz, bunu nas\u0131l s\xF6ylemeliyim, diye d\xFC\u015F\xFCnmeniz gerekmez.\n"Biggest pain point" ne, "call to action" nas\u0131l olmal\u0131, "social proof" eklemeli miyim, "headline" yeterince "clear" m\u0131, falan diye t\u0131rmalaman\u0131za gerek yok.\nAbi senin fabrikada yang\u0131n \xE7\u0131kt\u0131,\ndeseniz, yeter. Form\xFCle de gerek yok, s\xFCse de. Haber yeterince g\xFC\xE7l\xFC ve dikkat \xE7ekici.\nBir \xFCr\xFCn ya da marka i\xE7in reklam yazmak da \xE7ok farkl\u0131 de\u011Fil.\nS\xF6yleyece\u011Finiz \u015Fey yeterince g\xFC\xE7l\xFC ve dikkat \xE7ekici olursa, d\xFCmd\xFCz s\xF6yleyebilirsiniz. Form\xFCllere...' },
  { slug: "2-adim-kurali", title: "Giri\u015Fimciler i\xE7in 2 ad\u0131m kural\u0131", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "\xDCr\xFCn\xFC tasarlarken 2 ad\u0131m \xF6nde olun. \n\xDCr\xFCn\xFC anlat\u0131rken 2 ad\u0131m geride...", coreContent: "Pazarlamadan anlayan bir giri\u015Fimci olarak an\u0131lmak istiyorsan\u0131z, binlerce dataya ya da detaya hakim olman\u0131za gerek yok. \xDCr\xFCn, pazar, fiyat, sat\u0131\u015F kanal\u0131, medya, mecra, hepsini tek tek yalay\u0131p yutmu\u015F olman\u0131za da gerek yok. \u015Eu denklemi uygulaman\u0131z yeter: \xDCr\xFCn\xFC tasarlarken 2 ad\u0131m \xF6nde olun, \xFCr\xFCn\xFC anlat\u0131rken 2 ad\u0131m geride\u2026\n2 ad\u0131m \xF6nde olmak\n\xDCr\xFCn\xFC tasarlarken 2 ad\u0131m \xF6nde olmak muhtemelen zaten yapt\u0131\u011F\u0131n\u0131z bir \u015Fey: \u015Eu an giri\u015Fimci olarak, belki bizim fark\u0131nda bile olmad\u0131\u011F\u0131m\u0131z bir soruna, yepyeni bir \xE7\xF6z\xFCm tasarlad\u0131n\u0131z.\nBir derdimize belki daha ucuz, belki daha h\u0131zl\u0131, belki daha konforlu, belki de daha \u015F\u0131k bir \xE7\xF6z\xFCm buldunuz. Bunun i\xE7in de en yeni teknolojileri en haval\u0131 bi\xE7imde kulland\u0131n\u0131z. Yani bizim 2 ad\u0131m \xF6n\xFCm\xFCzdesiniz. Sorunlar\u0131m\u0131z\u0131 yar\u0131n nas\u0131l \xE7\xF6zece\u011Fimizi tasarl\u0131yorsunuz.\n2 ad\u0131m geride..." },
  { slug: "markalarin-eklediklerine-degil-cikardiklarina-bakin", title: "Markalar\u0131n eklediklerine de\u011Fil, \xE7\u0131kard\u0131klar\u0131na bak\u0131n", tags: ["\u0130lham kayna\u011F\u0131", "\xD6zel makaleler"], excerpt: "Yeni markan\u0131z i\xE7in dev markalardan ilham al\u0131rken, bakabilece\u011Finiz farkl\u0131 bir a\xE7\u0131", coreContent: "Yeni bir marka yaratma a\u015Famas\u0131ndaki \xE7o\u011Fu giri\u015Fimci, ilham almak i\xE7in dev markalara bak\u0131yor. O markan\u0131n neleri nas\u0131l sundu\u011Funa bak\u0131p ders almaya \xE7al\u0131\u015F\u0131yor.\nBurada farkl\u0131 bir bak\u0131\u015F a\xE7\u0131s\u0131 \xF6neriyorum: Markalar\u0131n sadece eklediklerine de\u011Fil, \xE7\u0131kard\u0131klar\u0131na da bak\u0131n.\nBooking-com gibi bir platformdan ilham ald\u0131\u011F\u0131n\u0131z\u0131 d\xFC\u015F\xFCnelim. Booking bu i\u015Fi ilk yapanlardan biri ve lider.\nOnun kadar b\xFCy\xFCmek ya da en az\u0131ndan onunla rekabet edebilmek i\xE7in yeni platformunuza ne ekleyebilirsiniz?\nBirileri, ne ekleyebilirim diye de\u011Fil, ne \xE7\u0131karabilirim diye d\xFC\u015F\xFCnd\xFC ve konaklama rezervasyonu i\u015Findeki en \xF6nemli par\xE7ay\u0131 i\u015Fin i\xE7inden \xE7\u0131kard\u0131: Otelleri. Yerine, evlerimizi koydu ve Airbnb do\u011Fdu.\nYa da Photoshop ve Illustrator benzeri bir platforma ne ekleyip tasar\u0131mc\u0131lar\u0131 etkileyebilir ve Adobe ile rekabet..." },
  { slug: "platon-ve-magaradaki-pazarlamacilar", title: "Platon ve ma\u011Faradaki pazarlamac\u0131lar", tags: [], excerpt: "Platon\u2019un taaa antik \xE7a\u011Fda bug\xFCnk\xFC toplant\u0131 odalar\u0131n\u0131 anlatm\u0131\u015F.", coreContent: "Platon\u2019un taaa antik \xE7a\u011Fda bug\xFCnk\xFC toplant\u0131 odalar\u0131n\u0131 anlatt\u0131\u011F\u0131n\u0131 biliyor musunuz?\nFelsefeyle \xE7ok i\xE7li d\u0131\u015Fl\u0131 olmasan\u0131z bile, Platon\u2019un me\u015Fhur ma\u011Fara benzetmesini duymu\u015Fsunuzdur. Literat\xFCrde \u201CPlaton\u2019un ma\u011Fara alegorisi\u201D diye ge\xE7er.\nPlaton bu benzetmesinde, baz\u0131 insanlar\u0131n do\u011Fduklar\u0131ndan itibaren bir ma\u011Farada olduklar\u0131n\u0131 ve d\u0131\u015Far\u0131 \xE7\u0131kamad\u0131klar\u0131n\u0131 d\xFC\u015F\xFCnmemizi ister. Bu insanlar, d\u0131\u015Fardaki nesnelerin ma\u011Faran\u0131n giri\u015Finden duvara yans\u0131yan g\xF6lgelerini izler ve o g\xF6lgeleri \u201Cger\xE7ek\u201D zannederler.\nG\xFCnlerden bir g\xFCn, bu insanlardan biri ma\u011Faran\u0131n d\u0131\u015F\u0131na \xE7\u0131kar. D\u0131\u015Farda, as\u0131l ger\xE7eklikle tan\u0131\u015F\u0131r. Ma\u011Farada g\xF6lgelerini g\xF6rd\xFCkleri nesnelerin \u201Cger\xE7ek\u201D hallerini g\xF6r\xFCr. \u0130\xE7erdekilere haber vermek i\xE7in ma\u011Faraya d\xF6ner ve ger\xE7ek sand\u0131klar\u0131 \u015Feylerin asl\u0131nda ger\xE7ek olmad\u0131\u011F\u0131n\u0131 ve d\u0131\u015Farda bamba\u015Fka bir ger\xE7eklik..." },
  { slug: "buyumek-icin-hedefi-daraltin", title: "B\xFCy\xFCmek i\xE7in hedefi daralt\u0131n", tags: ["Yeni marka yaratmak"], excerpt: "Yeni bir marka i\xE7in hedefi ne kadar daralt\u0131rsan\u0131z, i\u015Fler o kadar iyi gider.", coreContent: "Bir Rolex sat\u0131n alarak zengin olamayaca\u011F\u0131n\u0131z gibi, dev markalar\u0131n bug\xFCn yapt\u0131klar\u0131n\u0131 yaparak g\xFC\xE7l\xFC bir marka yaratamazs\u0131n\u0131z. Zengin olanlar\u0131n, zengin olmadan \xF6nce neler yapt\u0131klar\u0131na bakman\u0131z gerekiyor. Yani o dev markalar\u0131n, ba\u015Flang\u0131\xE7ta neler yapt\u0131klar\u0131na.\nMesela Getir bug\xFCn taksiden damacanaya, d\xF6nerden tesisat\xE7\u0131ya her \u015Feyi getiriyor. Ama Getir\u2019in bug\xFCn bunlar\u0131 yapabiliyor olmas\u0131, yeni bir markan\u0131n da bunlar\u0131 yaparak Getir kadar b\xFCy\xFCyebilece\u011Fi anlam\u0131na gelmiyor.\nGetir yeni bir markayken, bug\xFCnk\xFC haline g\xF6re olduk\xE7a dar bir hedefle, sadece market al\u0131\u015Fveri\u015Fiyle i\u015Fe ba\u015Flad\u0131.\nYa da Domino\u2019s\u2026\nDomino\u2019s bug\xFCn neredeyse lahmacun bile satacak k\u0131vama geldi. (Utanmasa satacak, eminim, kesin d\xFC\u015F\xFCnm\xFC\u015Flerdir:) Fakat Domino\u2019s i\u015Fe, \xE7ok daha dar bir \xE7er\xE7eveyle ba\u015Flad\u0131. Sadece pizza bile de\u011Fil, pizzada..." },
  { slug: "tek-bir-kelimenin-ya-da-kavramin-gucu", title: "Tek bir kelimenin ya da kavram\u0131n g\xFCc\xFC", tags: ["Pazar yaz\u0131lar\u0131", "\xD6zel makaleler"], excerpt: "Markan\u0131z\u0131 bir kelime ya da kavramla \xF6zde\u015Fle\u015Ftirmek", coreContent: "Frank ve Phoebe Lazarus, 1920\u2019lerin ba\u015F\u0131nda Washington DC\u2019de bir bisiklet d\xFCkkan\u0131 i\u015Fletiyordu. 1923\u2019te do\u011Fan o\u011Fullar\u0131na Charles Philip ad\u0131n\u0131 verdiler. \xC7ocuklar\u0131n\u0131n, d\xFCnyadaki milyonlarca \xE7ocu\u011Fun hayallerini s\xFCsleyecek bir marka yarataca\u011F\u0131ndan haberleri yoktu.\nCharles Philip Lazarus, 2. D\xFCnya Sava\u015F\u0131 s\u0131ras\u0131nda askerli\u011Fini yap\u0131p evine d\xF6nd\xFC\u011F\xFCnde 22 ya\u015F\u0131ndayd\u0131. Sava\u015F s\u0131ras\u0131nda ABD n\xFCfusunun d\xFC\u015Fmesi sebebiyle, \xFClkede \xE7ocuk yapmak te\u015Fvik ediliyordu. Askerden d\xF6nenlerle birlikte n\xFCfusta ciddi bir patlama ger\xE7ekle\u015Fti ve baby boom - bebek patlamas\u0131 olarak adland\u0131r\u0131lan d\xF6nem ba\u015Flad\u0131.\nCharles Philip de bu f\u0131rsattan yararlanmak i\xE7in babas\u0131n\u0131n bisiklet d\xFCkkan\u0131nda be\u015Fik satmaya ba\u015Flad\u0131. \u0130\u015Fler iyi gidince de, kendi ma\u011Fazas\u0131n\u0131 a\xE7t\u0131. Children\u2019s Bargain Town isimli ma\u011Fazas\u0131nda bebek arabalar\u0131 ve bebek..." },
  { slug: "her-seyi-degistiren-sihirli-degisken", title: "Her \u015Feyi de\u011Fi\u015Ftiren sihirli de\u011Fi\u015Fken", tags: ["Marka hikayeleri"], excerpt: "Lidere kafa tutmak istiyorsan\u0131z, \xFCzerine d\xFC\u015F\xFCnmeniz gereken yeg\xE2ne konu", coreContent: "1980\u2019de Teksas\u2019ta, 15 ya\u015F\u0131ndaki Michael, Steve Jobs ve Steve Wozniak\u2019\u0131n tasarlay\u0131p \xFCretti\u011Fi bir bilgisayarla kar\u015F\u0131la\u015Ft\u0131.\nApple II, bug\xFCn kulland\u0131\u011F\u0131m\u0131z bilgisayarlara benzeyen ilk bilgisayard\u0131. Michael bilgisayar\u0131 ald\u0131, biraz kurcalad\u0131 ve kasas\u0131n\u0131 a\xE7\u0131p par\xE7alara ay\u0131rd\u0131. Nas\u0131l \xE7al\u0131\u015Ft\u0131\u011F\u0131n\u0131 merak etmi\u015Fti.\nAilesi doktor olmas\u0131n\u0131 istedi\u011Fi i\xE7in, Michael birka\xE7 y\u0131l sonra t\u0131p fak\xFCltesine girdi. Ama doktorluk pek umrunda de\u011Fildi. Yurt odas\u0131nda bilgisayar par\xE7alar\u0131 satmaya ba\u015Flad\u0131. Ki\u015Fisel bilgisayarlar\u0131n do\u011Fdu\u011Fu \xE7a\u011F\u0131n ba\u015F\u0131yd\u0131 ve i\u015Fler iyi gidiyordu. Daha b\xFCy\xFCk oynamaya karar verdi.\nLisans al\u0131p Teksas Eyaleti\u2019nin resmi ihalelerine kat\u0131ld\u0131. \u0130\u015Fin komik taraf\u0131, ihaleleri kazan\u0131yordu.\n\xC7\xFCnk\xFC b\xFCt\xFCn i\u015Fi yurt odas\u0131ndan y\xFCr\xFCt\xFCyordu. T\xFCrkiye\u2019deki ad\u0131yla, bilgisayar topluyordu. Yani par\xE7alar\u0131 bir araya..." },
  { slug: "aptal-gibi-gorunmekten-korkmayin-2", title: "Pazarlama d\xFCnyas\u0131ndaki legal doland\u0131r\u0131c\u0131l\u0131k y\xF6ntemi", tags: [], excerpt: "Tufaya gelmemek i\xE7in dikkat etmeniz gerekenler", coreContent: "Pazarlama d\xFCnyas\u0131nda legal bir doland\u0131r\u0131c\u0131l\u0131k y\xF6ntemi var: Karma\u015F\u0131kl\u0131k ve jargon. Bu ikisini g\xF6rd\xFC\u011F\xFCn\xFCz an \xE7ok dikkatli olun.\nMarkan\u0131zla ilgili size bir sunum yap\u0131l\u0131yorsa ve s\xF6yleneni anlamad\u0131ysan\u0131z, sunumu durdurun ve sorun. S\xF6ylenen akl\u0131n\u0131za yatmad\u0131ysa, yine sunumu durdurun ve sorun. \u0130kna edici bir yan\u0131t alamad\u0131ysan\u0131z, tekrar sorun, tekrar sorun, tekrar sorun.\nAnlayana kadar sorun. Sak\u0131n ama sak\u0131n, kar\u015F\u0131n\u0131zdakiler uzman oldu\u011Fu i\xE7in sizin konuyu tam anlayamad\u0131\u011F\u0131n\u0131z\u0131 d\xFC\u015F\xFCnmeyin.\nMarkan\u0131zla ilgili size, yani markan\u0131n sahibine, basit\xE7e anlat\u0131lamayacak hi\xE7bir \u015Fey yoktur. Sonu\xE7ta pazarlama ve markalama, atom fizi\u011Fi de\u011Fil. Kar\u015F\u0131n\u0131zdaki, anlamad\u0131\u011F\u0131n\u0131z noktay\u0131 size basit\xE7e anlatam\u0131yorsa, o da uzman falan de\u011Fil, \u015Farlatand\u0131r.\nKimse aptal g\xF6r\xFCnmek istemedi\u011Fi ve kimse kral \xE7\u0131plak demedi\u011Fi i\xE7in, ne..." },
  { slug: "husnukuruntu", title: "H\xFCsn\xFCkuruntu", tags: ["\u0130lham kayna\u011F\u0131", "\xD6zel makaleler"], excerpt: "Alg\u0131lar de\u011Fi\u015Fir mi?", coreContent: "Baz\u0131 pazarlamac\u0131lar \u201Calg\u0131lar\u0131 de\u011Fi\u015Ftirmek\u201D i\xE7in yola \xE7\u0131k\u0131yor. Reklamla ya da ba\u015Fka pazarlama faaliyetleriyle, alg\u0131lar\u0131 de\u011Fi\u015Ftirebileceklerini d\xFC\u015F\xFCn\xFCyorlar.\nDilimizde bu \xE7abay\u0131 ifade eden g\xFCzel bir kelime var: H\xFCsn\xFCkuruntu. Herhangi bir durumu saf saf kendinden yana iyiye yorma demek. Alg\u0131lar\u0131 de\u011Fi\u015Ftiremezsiniz. Bo\u015Funa u\u011Fra\u015Fmay\u0131n.\nNeden diye soruyorsan\u0131z, yan\u0131t\u0131 basit: Bildi\u011Finiz herhangi bir \u015Feyi unutmay\u0131 deneyin bakal\u0131m, yapabiliyor musunuz? K\xF6t\xFC bir an\u0131n\u0131z\u0131 unutmay\u0131 deneyin ya da TC kimlik numaran\u0131z\u0131? Unutabiliyor musunuz? Unutamazs\u0131n\u0131z.\n\u0130\u015Fte bu y\xFCzden, mesela Hyundai ger\xE7ekten Mercedes\u2019le yar\u0131\u015Facak bir otomobil \xFCretse bile, bir Hyundai otomobilin l\xFCks alg\u0131lanmas\u0131n\u0131 sa\u011Flayamazs\u0131n\u0131z. Hyundai hakk\u0131nda bildiklerimiz var, unutamay\u0131z. Hyundai l\xFCks de\u011Fildir.\nYa da sepet ortalamas\u0131nda Migros..." },
  { slug: "plaza-turkcesinin-milyonlarca-dolarlik-maliyeti", title: "Plaza T\xFCrk\xE7esinin milyonlarca dolarl\u0131k maliyeti", tags: ["News", "\xD6zel makaleler"], excerpt: "Amazon\u2019daki Piraha kabilesinden Maslak'taki plazalara", coreContent: "Dalga ge\xE7mek i\xE7in \u201CPlaza T\xFCrk\xE7esi\u201D diye adland\u0131rd\u0131\u011F\u0131m\u0131z o dil, dilsel determinizm hipotezine g\xF6re, milyonlarca dolar\u0131n \xE7\xF6pe gitmesine sebep oluyor olabilir. Eric Safir ve Benjamin Lee Whorf\u2019un bu hipotezini anlamak i\xE7in, \xF6nce plazalardan \xE7ok uza\u011Fa gidip, hayat\u0131nda hi\xE7 plaza g\xF6rmemi\u015F bir kabileyi ziyaret etmemiz gerekiyor.\nAmazon\u2019daki Piraha kabilesinde, say\u0131lar\u0131 tan\u0131mlamak i\xE7in sadece 3 kelime var. 1,2 ve 3 i\xE7in, 3 farkl\u0131 kelime kullan\u0131yorlar. 3\u2019ten fazlas\u0131n\u0131 ise, \u201C\xE7ok\u201D olarak tan\u0131ml\u0131yorlar.\nAsl\u0131nda tatl\u0131 bir hayat gibi g\xF6r\xFCnse de, Ko\xE7 \xDCniversitesi\u2019nden Do\xE7. Tilbe Co\u015Fkun, Zihnin Temelleri: Dil ve D\xFC\u015F\xFCnce \u0130li\u015Fkisi adl\u0131 makalesinde, kabile \xFCyelerinin baz\u0131 hesaplamalar\u0131 yapmakta -do\u011Fal olarak- zorluklar ya\u015Fad\u0131klar\u0131n\u0131 anlat\u0131yor.\nDilde say\u0131lar\u0131 ifade eden kelimelerin yoklu\u011Fu, basit hesaplama..." },
  { slug: "nallari-dikmeye-yakin-markalarin-yoneticilerindeki-marka-kimligi-sevdasi", title: "Nallar\u0131 dikmeye yak\u0131n markalar\u0131n y\xF6neticilerindeki marka kimli\u011Fi sevdas\u0131", tags: ["\u0130lham kayna\u011F\u0131", "\xD6zel makaleler"], excerpt: "Madem marka kimli\u011Finiz bu kadar faydal\u0131 ve \xF6nemli, marka niye nallar\u0131 dikmek \xFCzere?", coreContent: "Ne zaman zor durumdaki bir marka i\xE7in g\xF6r\xFC\u015Fmeye \xE7a\u011Fr\u0131lsam, o markan\u0131n y\xF6neticileri marka kimliklerine tak\u0131nt\u0131l\u0131 derecede ba\u011Fl\u0131yd\u0131.\nTesad\xFCf olmasa gerek\u2026\nBana uzun uzun markan\u0131n DNA\u2019s\u0131n\u0131, \xF6z\xFCn\xFC, duygusal faydalar\u0131n\u0131 falan anlatt\u0131lar. Bu toplant\u0131lar genellikle, karakolda bitmese de, tats\u0131z bitti.\nMadem marka kimli\u011Finiz bu kadar faydal\u0131 ve \xF6nemli, marka niye nallar\u0131 dikmek \xFCzere,\ndiye sordu\u011Fumda, ortam hep gerildi.\nBir marka hakk\u0131nda kafa yorarken, vatanda\u015F\u0131n zihni yerine marka kimli\u011Fi tablosundaki 3\u20135 kutucu\u011Fu \xF6nemsemenin sonucu bu.\nMarka kimli\u011Fi modeli \u2014 Temsili\nMarka kimli\u011Fi modelindeki kutucuklar\u0131 nas\u0131l doldurursan\u0131z doldurun. Sokaktaki vatanda\u015F\u0131n umrunda olmaz.\nSokaktaki vatanda\u015F, markan\u0131z\u0131 kendi zihninde 2\u20133 kelimeyle tan\u0131mlar. (O da ancak markan\u0131z\u0131 zihnine sokacak kadar..." },
  { slug: "karmasadan-kaciniz", title: "Karma\u015Fadan ka\xE7\u0131n\u0131z", tags: ["\u0130lham kayna\u011F\u0131", "\xD6zel makaleler"], excerpt: "Markan\u0131z\u0131 h\u0131zla push etme ve dijital i\xE7g\xF6r\xFCler kazan\u0131p deneyim a\u015Famas\u0131nda m\xFC\u015Fteriye dokunma", coreContent: "\u015Eirketler karma\u015Fay\u0131 sever, sadeli\u011Fe para \xF6demezler.\nHatta 20 y\u0131ld\u0131r g\xF6rd\xFC\u011F\xFCm kadar\u0131yla, kendilerine sunulan \u015Fey ne kadar karma\u015F\u0131ksa, o kadar fazla para \xF6derler.\nBu y\xFCzden y\xF6netim dan\u0131\u015Fmanlar\u0131, pazarlama dan\u0131\u015Fmanlar\u0131, reklamc\u0131lar, tasar\u0131mc\u0131lar ve benzerlerinin baz\u0131lar\u0131, anlatacaklar\u0131 ne varsa olabildi\u011Fince karma\u015F\u0131k anlatmaya \xE7al\u0131\u015F\u0131rlar. Sadeli\u011Fin pe\u015Finde ko\u015Fan azd\u0131r.\nApple\u2019\u0131n reklamlar\u0131na ya da Amazon\u2019un logosuna bay\u0131ld\u0131\u011F\u0131n\u0131 iddia eden baz\u0131 y\xF6neticilerin, kendi markalar\u0131n\u0131n reklamlar\u0131n\u0131n ve logolar\u0131n\u0131n \xC7ar\u015Famba Pazar\u0131 gibi olmas\u0131n\u0131n sebebi de budur.\nSadeli\u011Fi sevdiklerini iddia ederler ama kendilerine sunulunca sat\u0131n almaz, para \xF6demezler. (O ne \xF6yle, d\xFCmd\xFCz bir fontla yaz\u0131p bir de ok koymu\u015Fsunuz, logo bu mu yani?) Sat\u0131c\u0131lar da keriz de\u011Fil, zorlamazlar. Karma\u015F\u0131kla\u015Ft\u0131r\u0131p tekrar sunarlar.\nBir..." },
  { slug: "marka-konumlandirma-hakkinda-soylenen-en-buyuk-yalan", title: "Marka konumland\u0131rma hakk\u0131nda s\xF6ylenen en b\xFCy\xFCk yalan", tags: ["Marka konumland\u0131rma", "\xD6zel makale"], excerpt: "Konumland\u0131rma ger\xE7ekte neyle ilgili?", coreContent: "\xC7o\u011Fu ki\u015Fi marka konumland\u0131rman\u0131n \xFCr\xFCnle, hizmetle, \xFCr\xFCn \xF6zelli\u011Fiyle ya da pazarla ilgili oldu\u011Funu zanneder. Baz\u0131lar\u0131 da \u015Fahs\xEE istek ve arzular\u0131yla markas\u0131n\u0131 konumland\u0131rabilece\u011Fini d\xFC\u015F\xFCn\xFCr.\nMarkam\u0131z\u0131 \u015Furaya-buraya konumland\u0131rmak istiyoruz,\nderler.\nAlmanca\u2019da bir s\xF6z vard\u0131r: Total falsch. Yani, tamamen yanl\u0131\u015F. Do\u011Fru olan tek bir taraf\u0131 bile yok.\nMarka konumland\u0131rma \xFCr\xFCnle, hizmetle, \xFCr\xFCn \xF6zellikleriyle ya da pazarla ilgili de\u011Fildir. Markan\u0131n patronlar\u0131n\u0131n istek ve arzular\u0131yla ise hi\xE7 ilgili de\u011Fildir.\nKonumland\u0131rma, insanlar\u0131n zihninde olan bitenle ilgilidir. \xDCr\xFCn, \xFCr\xFCn \xF6zellikleri, pazar dinamikleri ya da \u015Fahsi arzular\u0131n\u0131z, insanlar\u0131n zihnindeki yerle\u015Fik g\xF6r\xFC\u015Flerle \xF6rt\xFC\u015Fmeyebilir.\nEn bilinen \xF6rnek: Mesela g\xFCvenli otomobil denince \xE7o\u011Fu ki\u015Finin akl\u0131na Volvo gelir.\nSizce Volvo'dan daha g\xFCvenli..." },
  { slug: "seo-zihninizi-tembellestiriyor-olabilir", title: "Markan\u0131z i\xE7in SEO'nun zararlar\u0131", tags: ["\u0130lham kayna\u011F\u0131"], excerpt: "Bulabilece\u011Finiz en iyi SEO hack'i bu yaz\u0131da", coreContent: 'Markan\u0131z bir pazar yeri markas\u0131 de\u011Filse, kendi markan\u0131zla kendi \xFCr\xFCn ya da hizmetinizi sat\u0131yorsan\u0131z, arama motoru optimizasyonu zihninizi tembelle\u015Ftiriyor olabilir.\nAnl\u0131yorum, akan bir trafik var ve siz de o trafikten pay almaya \xE7al\u0131\u015F\u0131yorsunuz. Mesela \xE7anta almak i\xE7in \u201C\xE7ar\u015F\u0131ya \xE7\u0131kan\u201D binlerce ki\u015Fiden baz\u0131s\u0131n\u0131, kendi "d\xFCkkan\u0131n\u0131za" sokup sizin markan\u0131z\u0131 sat\u0131n almalar\u0131n\u0131 istiyorsunuz.\nHakl\u0131s\u0131n\u0131z, yap\u0131n, pay\u0131n\u0131z\u0131 da al\u0131n. Ama o pay\u0131n zihninizi tembelle\u015Ftirmesine izin vermeyin. Bu i\u015Fin ba\u015Fka bir yolu daha var.\nDaha zor, daha uzun ama daha do\u011Fru ve daha karl\u0131 ba\u015Fka bir yol...\nEvden Louis Vuitton, Samsonite ya da JanSport almak i\xE7in \xE7\u0131kanlar var. Onlar \xE7anta aram\u0131yorlar. Hangi markay\u0131 sat\u0131n alacaklar\u0131 belli.\nAs\u0131l amac\u0131n\u0131z, herhangi bir aramada insanlar\u0131n kar\u015F\u0131s\u0131na \xE7\u0131kan herhangi bir \xFCr\xFCn olmak...' },
  { slug: "konumlandirmanin-cevap-vermeye-calistigi-tek-soru", title: "Konumland\u0131rman\u0131n cevap vermeye \xE7al\u0131\u015Ft\u0131\u011F\u0131 tek soru", tags: ["Marka konumland\u0131rma", "\xD6zel makale"], excerpt: "Sadece konumland\u0131rman\u0131n de\u011Fil, pazarlamayla ilgili at\u0131lan her ad\u0131m\u0131n cevap vermesi gereken tek soru", coreContent: "Marka konumland\u0131rman\u0131n cevap vermeye \xE7al\u0131\u015Ft\u0131\u011F\u0131 tek bir soru var.\nAsl\u0131nda sadece konumland\u0131rman\u0131n de\u011Fil, pazarlamayla ilgili at\u0131lan her ad\u0131m\u0131n cevap vermesi gereken tek soru var. O soru da, vatanda\u015F\u0131n sordu\u011Fu \u015Fu soru:\nNeden rakiplerinden birini de\u011Fil de, senin markan\u0131 sat\u0131n alay\u0131m?\nPazarlama gurular\u0131, dan\u0131\u015Fmanlar ve ka\u015Far pazarlamac\u0131lar i\u015Fi ne kadar karma\u015F\u0131k g\xF6sterseler de, pazarlaman\u0131n g\xF6revi asl\u0131nda bu kadar basit: Vatanda\u015F\u0131n, neden rakiplerinden birini de\u011Fil de, senin markan\u0131 sat\u0131n alay\u0131m, sorusuna ikna edici bir cevap vermek.\nEtraf\u0131m\u0131zda her ihtiyac\u0131m\u0131z i\xE7in onlarca alternatif marka var. Tuvalet ka\u011F\u0131d\u0131 i\xE7in bile 4-5 marka aras\u0131ndan karar vermek durumunday\u0131z. Hayat\u0131m\u0131za basit\xE7e devam etmek i\xE7in y\xFCzlerce marka alternatifi aras\u0131nda s\xFCrekli karar vermemiz gerekiyor.\nBir yandan da s\xFCrekli..." },
  { slug: "premium-algilanmak-isteyen-urkek-ceylanlar", title: "Premium alg\u0131lanmak isteyen \xFCrkek ceylanlar", tags: ["Marka hikayeleri", "\xD6zel makale"], excerpt: "L\xFCks alg\u0131lanman\u0131n en basit yolu ve T\xFCrkiye'deki \xFCrkek ceylanlar", coreContent: "\u015Eimdi size, pahal\u0131 oldu\u011Funu reklamlar\u0131nda a\xE7\u0131k\xE7a s\xF6yleyen ve bu tavr\u0131n\u0131 25 y\u0131l s\xFCrd\xFCren bir markadan bahsedece\u011Fim. Ama \xF6nce, k\u0131sa bir T\xFCrkiye turu ataca\u011F\u0131z.\nSiz hi\xE7 T\xFCrkiye\u2019de, pahal\u0131 oldu\u011Funu korkmadan \xE7ekinmeden a\xE7\u0131k\xE7a belirten bir marka g\xF6rd\xFCn\xFCz m\xFC? G\xF6rmediniz, g\xF6remezsiniz. \xC7\xFCnk\xFC bizim markalar\u0131m\u0131z\u0131 y\xF6netenlerin \xE7o\u011Fu, yavru bir ceylan gibidir, \xFCrkektir.\nMesela l\xFCks alg\u0131lanmak isterler ama pahal\u0131 olduklar\u0131n\u0131 s\xF6ylemek ya da g\xF6stermek istemezler.\nYa da tam tersi\u2026\n%50 indirim yaparlar, bununla ilgili reklamlar isterler, brief verirler, ama\nkampanya fiyat odakl\u0131 alg\u0131lans\u0131n istemiyoruz,\nderler.\nReklamc\u0131 garibanlar da,\nfiyat odakl\u0131 alg\u0131lanmayan %50 indirim kampanyas\u0131\nyapmak, gibi sa\xE7ma sapan i\u015Flerle u\u011Fra\u015F\u0131rlar.\nB\xF6yle anlams\u0131z \xE7ekinceleri olmayan bir ekip, 1982\u2019de \u0130ngiltere\u2019de, Stella Artois..." },
  { slug: "goz-mu-kulak-mi", title: "G\xF6z m\xFC, kulak m\u0131?", tags: ["Yeni marka yaratmak", "\xD6zel makale"], excerpt: "Marka ismi se\xE7erken dikkat edilecek noktalardan biri", coreContent: "Pazarlama camias\u0131 genelde g\xF6z\xFCn kulaktan \xFCst\xFCn oldu\u011Funa inan\u0131r. Asl\u0131nda pek \xF6yle de\u011Fil.\nYani bir resim, bin kelimeye bedel de\u011Fil.\nE\u011Fer \xF6yle olsayd\u0131, elimizde bunu anlatan bir resim olurdu. Ama yok.\nElimizde 5 kelime var ve diyor ki: Bir resim bin kelimeye bedeldir.\nBiz de bunu sorgulamadan inan\u0131yoruz. Sa\xE7ma.\nHatta Psikolog Thomas Sticht tam tersini savunuyor ve diyor ki:\nBir s\xF6z\xFCn bin resme bedel oldu\u011Funu d\xFC\u015F\xFCnmeyi ye\u011Flerim. D\xFC\u015F\xFCn\xFCn, kavramlar\u0131 temsil etmeye \xE7al\u0131\u015Fan ka\xE7 resim g\xF6rd\xFCn\xFCz? Tanr\u0131, d\xFCr\xFCstl\xFCk, g\xFCvenilirlik ve sevgi gibi s\xF6zc\xFCkler. Bu kavramlar\u0131 resimlerle temsil etmek son derece zordur, bu y\xFCzden bir\xE7ok durumda bir s\xF6z\xFCn bin resme bedel oldu\u011Fu kan\u0131s\u0131nday\u0131m.\nWashington \xDCniversitesi\u2019nden Dr. Elizabeth Loftus da, ki kendisi insan zihninin i\u015Fleyi\u015Fi \xFCzerine 8 kitap yazm\u0131\u015F bir..." },
  { slug: "ortak-akil-yontemini-bosverin", title: "Ortak ak\u0131l y\xF6ntemini bo\u015Fverin", tags: ["Yeni marka yaratmak", "\xD6zel makale"], excerpt: "Yeni bir marka i\xE7in en b\xFCy\xFCk risk", coreContent: "Parlak ve y\u0131k\u0131c\u0131 bir fikri, lideri olmayan 12 ki\u015Finin bulundu\u011Fu bir toplant\u0131 masas\u0131na getirirseniz, can \xE7eki\u015Ferek \xF6lmesini izlersiniz. Hi\xE7 \u015Fa\u015Fmaz.\n\u201COrtak ak\u0131l\u201D y\xF6ntemi sadece sakin denizde, f\u0131rt\u0131nas\u0131z havada, gidece\u011Fi yer belli olan gemiyi rotada tutup makul bir yolculuk ya\u015Famak i\xE7in faydal\u0131 olabilir.\nAma yeni bir k\u0131ta ke\u015Ffetmek i\xE7in yola \xE7\u0131kacak bir gemide, ortak ak\u0131lla karar almaya kalkarsan\u0131z, de\u011Fil yeni bir k\u0131ta ke\u015Ffetmek, limandan bile \xE7\u0131kamayabilirsiniz.\n\xC7\xFCnk\xFC insanlar, yenilik ve yarat\u0131c\u0131l\u0131k taraftar\u0131 olduklar\u0131n\u0131 s\xF6yleseler de, asl\u0131nda yenilikten ve yarat\u0131c\u0131l\u0131ktan korkar. Bu y\xFCzden yeni bir fikri ortak akl\u0131n \xF6n\xFCne atarsan\u0131z,\n\xE7i\u011F \xE7i\u011F yerler.\nTarihe bakman\u0131z yeterli. D\xFCnyay\u0131 de\u011Fi\u015Ftiren fikirler, ortak akl\u0131n de\u011Fil, bireylerin inad\u0131yla uygulanabildi.\nYa da Henry Ford\u2019un me\u015Fhur s\xF6z\xFCn\xFC..." },
  { slug: "yeni-bir-marka-yaratirken-asil-risk", title: "Yeni bir marka yarat\u0131rken as\u0131l risk\u2026", tags: ["Yeni marka yaratmak"], excerpt: "Var olan bir pazar\u0131 hedeflemek mi, var olmayan bir pazar\u0131 hedeflemek mi?", coreContent: "1970\u2019lerin sonunda Ted Turner isimli bir adam, yeni bir televizyon kanal\u0131 kurmak istedi. Ama etraf\u0131ndaki herkes deli oldu\u011Funu d\xFC\u015F\xFCnd\xFC, \xE7\xFCnk\xFC fikri \xE7ok sa\xE7mayd\u0131.\nTurner reklamc\u0131yd\u0131. Outdoor reklam alanlar\u0131 satan bir \u015Firketi vard\u0131. Televizyon i\u015Fi hakk\u0131nda da tecr\xFCbesi yok de\u011Fildi. 10 y\u0131l kadar \xF6nce k\xFC\xE7\xFCk bir yerel kanal\u0131 sat\u0131n alm\u0131\u015F, birka\xE7 sene i\xE7inde de k\xE2rl\u0131 hale getirmi\u015Fti. Ama kurmak istedi\u011Fi yeni kanal kimsenin akl\u0131na yatm\u0131yordu.\nTurner kimseyi dinlemedi, bildi\u011Fini okudu ve 1 Haziran 1980\u2019de kanal yay\u0131na ba\u015Flad\u0131. O g\xFCn itibariyle de dalga konusu oldu. Di\u011Fer televizyoncular kanal\u0131 k\xFC\xE7\xFCmsemek i\xE7in, kanala \u201CChicken Noodle Network\u201D diyorlard\u0131.\n\xC7\xFCnk\xFC sabahtan ak\u015Fama, 24 saat durmaks\u0131z\u0131n haber yay\u0131nlayan bir kanal, o d\xF6nemde herkese \xE7ok tuhaf geliyordu. Kim 24 saat haber izlerdi ki? 24 saat..." },
  { slug: "buyumek-ve-hayatta-kalmak-farkli-seyler", title: "B\xFCy\xFCmek ve hayatta kalmak farkl\u0131 \u015Feyler", tags: ["Yeni marka yaratmak"], excerpt: "\xC7o\u011Fu yeni marka, nas\u0131l hayatta kalaca\u011F\u0131 konusunda hi\xE7 kafa yormadan nas\u0131l b\xFCy\xFCyece\u011Fi konusunu d\xFC\u015F\xFCnmeye ba\u015Fl\u0131yor.", coreContent: "B\xFCy\xFCmeyle ilgili konu\u015Fan \xE7ok.\nBen yeni bir markay\u0131 hayatta tutmayla ilgileniyorum.\n\xC7\xFCnk\xFC b\xFCy\xFCmekle hayatta kalmak, 2 farkl\u0131 kavram, 2 farkl\u0131 a\u015Fama.\n\xC7o\u011Fu yeni marka, nas\u0131l hayatta kalaca\u011F\u0131 konusuna hi\xE7 kafa yormadan, nas\u0131l b\xFCy\xFCyece\u011Fi konusunu d\xFC\u015F\xFCnmeye ba\u015Fl\u0131yor. Belki hayatta kalman\u0131n yolunun b\xFCy\xFCmekten ge\xE7ti\u011Fine inan\u0131yorlar, belki de sadece h\u0131rs. Bilemem\u2026\nAma hayatta kalman\u0131n yolunun b\xFCy\xFCme oldu\u011Funu varsayarsan\u0131z, markan\u0131z\u0131 b\xFCy\xFCtmeye \xE7al\u0131\u015F\u0131rken \xE7ak\u0131labilirsiniz. Yani saatte 30 km h\u0131zla duvara \xE7arpacakken, b\xFCy\xFCme a\u015Fk\u0131 y\xFCz\xFCnden, 220 ile \xE7arpabilirsiniz.\nHasar farkl\u0131 olur.\nMarkalar\u0131n kaderini belirleyen s\xFCre: 6 dakika 42 saniye\nHer y\u0131l piyasaya s\xFCr\xFClen 30.000 yeni \xFCr\xFCn\xFCn %95\u2019i neden \xE7ak\u0131l\u0131yor? Yeni bir markan\u0131n y\xFCkselmesini sa\u011Flayan ne?\nEngin Tezcan\nEngin Tezcan" },
  { slug: "markaniz-bir-super-kahraman-degil", title: "Markan\u0131z bir s\xFCper kahraman de\u011Fil. Belediye ba\u015Fkan\u0131 da de\u011Fil.", tags: [], excerpt: "Yeni markalar i\xE7in 2 \xF6nemli uyar\u0131", coreContent: "Yeni bir marka yaratma a\u015Famas\u0131ndaysan\u0131z, \u015Fu ikisini akl\u0131n\u0131zdan \xE7\u0131karmay\u0131n:\n1- Markan\u0131z bir s\xFCper kahraman de\u011Fil\nYani markan\u0131z\u0131n herkesin her derdine \xE7are bulmak gibi bir y\xFCk\xFCml\xFCl\xFC\u011F\xFC yok. D\xFCnyan\u0131n t\xFCm problemlerini \xE7\xF6zmeye \xE7al\u0131\u015Fmay\u0131n. K\xFC\xE7\xFCk bir kitlenin tek bir problemini basit\xE7e \xE7\xF6zerek ba\u015Flay\u0131n, yeter.\n\xC7o\u011Fu dev marka b\xF6yle ba\u015Flad\u0131.\n\xD6zellikle dijital \xFCr\xFCn ve hizmetlerde, i\u015Fin kontrolden \xE7\u0131kmas\u0131 \xE7ok daha kolay olabiliyor. Evet, QR kodu z\u0131plat\u0131p tersten falan okutabilirsiniz, biliyoruz. Ama okutmay\u0131n. Gerek yok.\nTeknik olarak bir \u015Feyi yapabiliyor olman\u0131z, yapman\u0131z gerekti\u011Fi anlam\u0131na gelmiyor.\n\xD6nce markan\u0131z\u0131 dar bir alana odaklay\u0131n ve insanlar\u0131n, markan\u0131z\u0131n o i\u015Fte uzman oldu\u011Funu d\xFC\u015F\xFCnmelerini sa\u011Flay\u0131n.\n2- Markan\u0131z devlet ba\u015Fkanl\u0131\u011F\u0131na oynayan bir belediye ba\u015Fkan\u0131 de\u011Fil\nYani herkes markan\u0131z\u0131..." },
  { slug: "yeni-bir-marka-yaratan-girisimcilerin-kafasini-karistiran-pazarlama-aforizmalari", title: "Yeni bir marka yaratan giri\u015Fimcilerin kafas\u0131n\u0131 kar\u0131\u015Ft\u0131ran pazarlama aforizmalar\u0131", tags: ["Yeni marka yaratmak"], excerpt: "Pazarlama literat\xFCr\xFCn\xFC bir alet \xE7antas\u0131 gibi d\xFC\u015F\xFCn\xFCn. \u0130\xE7inde tornavidadan penseye, \u0130ngiliz anahtar\u0131ndan \xE7ekice bir\xE7ok alet var.", coreContent: "Pazarlamayla ve reklamla ilgili etrafta dola\u015Fan ilgi \xE7ekici aforizmalar, yeni bir marka yaratma a\u015Famas\u0131ndaki giri\u015Fimcilerin kafas\u0131n\u0131 \xE7ok kar\u0131\u015Ft\u0131r\u0131yor.\nMesela, \xFCr\xFCn\xFC de\u011Fil fayday\u0131 satmak\u2026\nYa da Starbucks\u2019\u0131n \xFCr\xFCn de\u011Fil, deneyim satmas\u0131\u2026\nSosyal medyada pazarlamayla ilgili 3-5 hesab\u0131 takip eden herkes, benzer c\xFCmleleri mutlaka duymu\u015Ftur. Bu c\xFCmleler yanl\u0131\u015F da de\u011Fil. Ama s\u0131k\u0131nt\u0131 \u015Furada:\nPazarlama literat\xFCr\xFCn\xFC bir alet \xE7antas\u0131 gibi d\xFC\u015F\xFCn\xFCn. \u0130\xE7inde tornavidadan penseye, \u0130ngiliz anahtar\u0131ndan \xE7ekice bir\xE7ok alet var.\nBu aletleri biliyor olman\u0131z, onlar\u0131 ne zaman ve nas\u0131l kullanaca\u011F\u0131n\u0131z\u0131 bildi\u011Finiz anlam\u0131na gelmiyor.\nMesela, \xFCr\xFCn\xFC de\u011Fil de fayday\u0131 satmak\u2026\nEvet pazarlama ve reklam\u0131n alet \xE7antas\u0131nda b\xF6yle bir alet var. \xC7ok da i\u015Fe yarayan bir alettir. Ama bu aleti kullanman\u0131n yeri ve zaman\u0131 var.\n\u0130\u015Finiz..." },
  { slug: "kopyalanamayacak-tek-sey", title: "Kopyalanamayacak tek \u015Fey", tags: [], excerpt: "B\xFCt\xE7enizi ve enerjinizi odaklaman\u0131z gereken yer", coreContent: "Muhte\u015Fem \xFCr\xFCn\xFCn\xFCz\xFCn kopyalanmas\u0131 ve bir benzerinin piyasaya \xE7\u0131kmas\u0131, \xE7ok k\u0131sa s\xFCrecek.\nAn meselesi. Neredeyse ak\u015Famdan sabaha\u2026\n\xC7\xFCnk\xFC rekabet yo\u011Fun, ileti\u015Fim \xE7ok h\u0131zl\u0131, kopyalamak \xE7ok kolay.\nK\u0131sacas\u0131, \xFCr\xFCnler \xF6yle ya da b\xF6yle, h\u0131zl\u0131ca ayn\u0131 seviyeye geliyor, gelecek.\nPeki kopyalanamayacak tek \u015Fey ne?\nSize ait olan ve hi\xE7bir rakibin \xE7alamayaca\u011F\u0131 yeg\xE2ne \u015Fey?\nMarkan\u0131z\u0131n ismi.\nBir \u015Fekilde yasal olarak korunuyor.\nDurum buyken, b\xFCt\xE7enizi ve enerjinizi nereye odaklaman\u0131z gerekti\u011Fi \xE7ok a\xE7\u0131k de\u011Fil mi?\nMarkalarla ilgili sava\u015F, insanlar\u0131n zihninde kazan\u0131l\u0131r ya da kaybedilir. Pazarda de\u011Fil.\nMarka isminizi vakit ge\xE7 olmadan insanlar\u0131n zihninde do\u011Fru bir konuma yerle\u015Ftirebilirseniz, \xFCr\xFCnler ayn\u0131 seviyeye geldi\u011Finde, ki birg\xFCn gelecek, avantajl\u0131 olan siz olursunuz." },
  { slug: "muhafazakar-pazarlamacilar", title: "Muhafazakar Pazarlamac\u0131lar", tags: ["Yeni marka yaratmak"], excerpt: "Yeni markalar\u0131n \xF6n\xFCndeki en b\xFCy\xFCk engellerden biri", coreContent: "Baz\u0131 pazarlamac\u0131lar\u0131, anneniz gibi d\xFC\u015F\xFCnebilirsiniz.\nPilav\u0131 40 y\u0131ld\u0131r \u201Co \u015Fekilde\u201D yapan annenizi, pilav\u0131 \u201Cba\u015Fka t\xFCrl\xFC\u201D yapmaya ikna edemezsiniz. Tabaklar\u0131 \u201Co rafa\u201D de\u011Fil \u201Cbu rafa\u201D koymaya da ikna edemezsiniz. Tezgah\u0131 \u201Co bezle\u201D de\u011Fil \u201Cbu bezle\u201D silmeye de\u2026\nSizi dinliyormu\u015F gibi g\xF6r\xFCn\xFCr. Sonra bildi\u011Fi gibi yapar.\nBu pazarlamac\u0131lar\u0131n annelerimizden tek fark\u0131, s\xFCrekli olarak, \u201Casl\u0131nda out of the box d\xFC\u015F\xFCnmemiz gerek\u201D demeleridir. Derler ama yapamazlar. \xC7\xFCnk\xFC kutunun i\xE7indedirler. Hatta kutuyu onlar yaratm\u0131\u015Ft\u0131r.\n\u0130\u015Fte bunlar, muhafazakar pazarlamac\u0131lar.\nBu y\xFCzden, muhafazakar pazarlamac\u0131 tecr\xFCbesiyle zehirlenmemi\u015F toprak, yeni ve g\xFC\xE7l\xFC bir marka yaratacak y\u0131k\u0131c\u0131 bir fikrin ye\u015Fermesi i\xE7in daha uygundur.\nMesela perakende kanal\u0131n\u0131 aradan \xE7\u0131kar\u0131p bilgisayar\u0131 direkt satmak, Dell\u2019in kurucusu Michael..." },
  { slug: "kalite-pazarlama-icin-anlamsiz-bir-kelime", title: "Kalite, pazarlama i\xE7in anlams\u0131z bir kelime", tags: ["Yeni marka yaratmak"], excerpt: "Kalite, markan\u0131z\u0131 kurtar\u0131r m\u0131?", coreContent: "\xDCr\xFCn\xFCn\xFCn ya da hizmetinin piyasadaki en kalitelisi oldu\u011Funu iddia etmeyen \xE7ok az patron ve pazarlama y\xF6neticisi tan\u0131d\u0131m. \xC7o\u011Fu, \u0131srarla en kalitelisi olduklar\u0131n\u0131 iddia ediyorlard\u0131.\nKimin do\u011Fru s\xF6yledi\u011Fi kimin i\u015Fkembeden sallad\u0131\u011F\u0131 umrumda de\u011Fil. \xC7\xFCnk\xFC kalite, pazarlama ve markalama i\xE7in \xF6nemli bir kavram de\u011Fil.\nT\xFCketiciler i\xE7in kalite art\u0131k bir ekstra de\u011Fil, do\u011Fal bir beklenti. Kaliteli bir \xFCr\xFCn ya da hizmet \xF6v\xFCn\xFClecek bir \u015Fey de\u011Fil, zaten olmas\u0131 gereken.\nKalite art\u0131k sadece oyuna girmenize ve oyunda kalman\u0131za yarar. \xD6ne ge\xE7menizi sa\u011Flamaz.\nBu y\xFCzden kalite \xFCzerine bir marka in\u015Fa etmeye \xE7al\u0131\u015Fmak deniz kenar\u0131nda kumdan kale yapmak gibi. Kalenin \xF6mr\xFC pek uzun olmaz.\nMaalesef \xE7o\u011Fu patron ve pazarlamac\u0131 bir hayal d\xFCnyas\u0131nda ya\u015F\u0131yor. \xA0Zannediyorlar ki pazarda sadece kendi markalar\u0131 ve..." },
  { slug: "stratejinizi-test-etmenin-en-ucuz-ve-en-basit-yolu", title: "Stratejinizi test etmenin en ucuz ve en basit yolu", tags: [], excerpt: "Size sunulan stratejinin do\u011Fru bir strateji olup olmad\u0131\u011F\u0131n\u0131 merak m\u0131 ediyorsunuz?", coreContent: "\u0130\u015F d\xFCnyas\u0131nda da bir strateji enflasyonu oldu\u011Funun fark\u0131ndas\u0131n\u0131zd\u0131r. Marka stratejisi, b\xFCy\xFCme stratejisi, deneyim stratejisi, dijital strateji, o strateji, bu strateji derken, sa\u011Fl\u0131kl\u0131 bir pazarlama y\xF6neticisi g\xFCnde 8 stratejiyle kar\u015F\u0131la\u015F\u0131yor. Peki bunlardan hangileri ger\xE7ekten i\u015Fe yarar, hangileri fasa fiso, test etmek gerekmiyor mu?\nGerekiyor. Markalar da bunun i\xE7in ara\u015Ft\u0131rmalara binlerce lira harc\u0131yor. \u015Eimdi size, bir stratejiyi test etmek i\xE7in \xE7ok daha ucuz bir y\xF6ntem \xF6nerece\u011Fim. Hatta bedava. Sonucu da garantili.\nSize sunulan stratejinin do\u011Fru bir strateji olup olmad\u0131\u011F\u0131n\u0131 merak m\u0131 ediyorsunuz? Hemen kendinize \u015Fu soruyu sorun: Bu stratejiyi en b\xFCy\xFCk rakibim uygulasayd\u0131, can\u0131m ne kadar s\u0131k\u0131l\u0131rd\u0131?\nCan\u0131m \xE7ok s\u0131k\u0131l\u0131rd\u0131, hatta uykular\u0131m ka\xE7ard\u0131,\ndiyorsan\u0131z, o strateji \xE7ok do\u011Fru bir..." },
  { slug: "etkili-bir-marka-stratejisi-olusturmanin-ilk-sarti", title: "Etkili bir marka stratejisi olu\u015Fturman\u0131n ilk \u015Fart\u0131", tags: ["Marka konumland\u0131rma"], excerpt: "\xC7o\u011Fu marka y\xF6neticisi, sorumlu oldu\u011Fu marka hakk\u0131nda yeterince d\xFCr\xFCst olamaz.", coreContent: "Etkili bir marka stratejisi olu\u015Fturman\u0131n ilk \u015Fart\u0131 ne yeterli veri ne de do\u011Fru i\xE7g\xF6r\xFCd\xFCr. \u0130htiyac\u0131n\u0131z olan ilk \u015Fey d\xFCr\xFCstl\xFCkt\xFCr.\n\xC7o\u011Fu marka y\xF6neticisi, sorumlu oldu\u011Fu marka hakk\u0131nda yeterince d\xFCr\xFCst olamaz. \xC7\xFCnk\xFC 7 g\xFCn 24 saat emek verdi\u011Fi markas\u0131n\u0131, oldu\u011Fundan daha g\xFC\xE7l\xFC g\xF6rmeye meyillidir. Kuzguna yavrusu \u015Fahin g\xF6r\xFCn\xFCr.\nBu objektif olamama h\xE2li, eldeki verilere bile yans\u0131r. Verilerin, kendi varsay\u0131mlar\u0131n\u0131 teyit etmeyen k\u0131s\u0131mlar\u0131n\u0131 g\xF6rmezden gelmeye kadar gider.\n\u0130\u015Fin i\xE7ine ego ve kibir de girince, markay\u0131 y\xF6neten ekip ger\xE7eklikten kopar.\nDan\u0131\u015Fman ve ajans tayfas\u0131 da belki \xE7aps\u0131zl\u0131ktan, belki de,\naman Ali R\u0131za bey, a\u011Fz\u0131m\u0131z\u0131n tad\u0131 ka\xE7mas\u0131n,\ndiyerek ger\xE7eklerden bahsetmeyince, i\u015Fler \xE7\u0131\u011Fr\u0131ndan \xE7\u0131kar.\nB\xF6yle \xE7ok ekiple kar\u015F\u0131la\u015Ft\u0131m. O markalar\u0131n bir k\u0131sm\u0131 yok oldu gitti. Di\u011Fer k\u0131sm\u0131 da h\xE2l\xE2..." },
  { slug: "baska-bir-sey-cemil-bey", title: "Ba\u015Fka bir \u015Fey Cemil bey", tags: [], excerpt: 'Bir marka kendini "ba\u015Fka bir \u015Fey" olarak tan\u0131mlarsa...', coreContent: "Yeni bir proje i\xE7in bir \u015Firkete tan\u0131\u015Fma toplant\u0131s\u0131na gitti\u011Finizi hayal edin. Girdiniz toplant\u0131 odas\u0131na ve odadakilerden biri, sizi di\u011Ferleriyle tan\u0131\u015Ft\u0131rmaya ba\u015Flad\u0131:\n\u015E\xFCkr\xFC bey, CEO\u2019muz. Masan\u0131n ucundaki beyefendi Sabri bey, IT sorumlumuz. Nazan han\u0131m pazarlama direkt\xF6r\xFCm\xFCz. Cemil bey de ne sat\u0131\u015F ne pazarlama, ba\u015Fka bir \u015Fey\u2026\nBa\u015Fka bir \u015Fey Cemil bey hakk\u0131nda ne d\xFC\u015F\xFCn\xFCrs\xFCn\xFCz? Sa\xE7ma de\u011Fil mi?\nPazarlamac\u0131 de\u011Filmi\u015F, sat\u0131\u015F\xE7\u0131 da de\u011Filmi\u015F, ba\u015Fka bir \u015Feymi\u015F. Neymi\u015F? Belli de\u011Fil. Orada duruyor \xF6yle\u2026\nPeki projeniz hakk\u0131nda konu\u015Fmaya ba\u015Flad\u0131\u011F\u0131n\u0131zda, Cemil beye hi\xE7 odaklan\u0131r m\u0131s\u0131n\u0131z?\nMesela pazarlaman\u0131n \xF6zellikle duymas\u0131 gereken \u015Feyleri pazarlama direkt\xF6r\xFC Nazan han\u0131ma, IT\u2019nin duymas\u0131 gerekenleri \xF6zellikle IT sorumlusu Sabri beye bakarak anlat\u0131rs\u0131n\u0131z, do\u011Fal olarak.\nHangi durumlarda, ne sat\u0131\u015F ne..." },
  { slug: "unilever-kanat-cirpsa", title: "Unilever kanat \xE7\u0131rpsa\u2026", tags: [], excerpt: "Bizde anlams\u0131z bir tsunami olmas\u0131 normal mi?", coreContent: "Unilever CEO\u2019su Alan Jope, insanlar ve gezegen i\xE7in harekete ge\xE7en markalar\u0131n\u0131n, Unilever\u2019in di\u011Fer markalar\u0131ndan %69 daha h\u0131zl\u0131 b\xFCy\xFCd\xFC\u011F\xFCn\xFC iddia ediyor.\n\u015Eimdi do\u011Fal olarak, insanlar ve gezegen i\xE7in harekete ge\xE7mek ne demek, merak ediyorsunuz. Ben de merak ettim, girdim web sitelerine bakt\u0131m.\n\u201CAmac\u0131 olan markalar b\xFCy\xFCyor, i\u015Fte kan\u0131t\u0131\u201D ba\u015Fl\u0131kl\u0131 bir sayfaya ula\u015Ft\u0131m.\nTamam dedim, arad\u0131\u011F\u0131m\u0131 buldum.\nBeyefendinin bahsetti\u011Fi, insanlar ve gezegen i\xE7in harekete ge\xE7en markalarla ilgili bilgi, aynen burada da var. Bu markalar\u0131, Unilever\u2019in \u201Cs\xFCrd\xFCr\xFClebilir ya\u015Fam markalar\u0131\u201D olarak tan\u0131mlam\u0131\u015Flar.\nAralar\u0131nda Dove, Knorr, Persil, Omo ve Lipton\u2019un da oldu\u011Fu baz\u0131 markalar\u0131 \xF6rnek vermi\u015Fler ve bunlar\u0131n di\u011Fer Unilever markalar\u0131na g\xF6re %69 daha h\u0131zl\u0131 b\xFCy\xFCd\xFC\u011F\xFC, bu sayfada da \xF6zellikle belirtmi\u015Fler.\nFakat ben..." },
  { slug: "baska-bir-ajansin-kasasinda-saklanan-bir-kitap-ogilvynin-hayatini-nasil-degistirdi", title: "Ba\u015Fka bir ajans\u0131n kasas\u0131nda saklanan bir kitap, Ogilvy\u2019nin hayat\u0131n\u0131 nas\u0131l de\u011Fi\u015Ftirdi?", tags: ["Pazar yaz\u0131lar\u0131"], excerpt: "3 Kas\u0131m 1960\u2019da, reklam tarihinin gelmi\u015F ge\xE7mi\u015F en tan\u0131nm\u0131\u015F ismi David Ogilvy, masas\u0131nda bir mektup buldu. Zarfta, Ogilvy\u2019nin \u201Cuygunsuz\u201D bir foto\u011Fraf\u0131 ve bir not vard\u0131. Notta \u015F\xF6yle yaz\u0131yordu:", coreContent: "3 Kas\u0131m 1960\u2019da, reklam tarihinin gelmi\u015F ge\xE7mi\u015F en tan\u0131nm\u0131\u015F ismi David Ogilvy, masas\u0131nda bir mektup buldu. Zarfta, Ogilvy\u2019nin \u201Cuygunsuz\u201D bir foto\u011Fraf\u0131 ve bir not vard\u0131. Notta \u015F\xF6yle yaz\u0131yordu:\n\u201CBu a\xE7\u0131k bir \u015Fantaj giri\u015Fimidir. Bana bir kese ka\u011F\u0131d\u0131 i\xE7inde, i\u015Faretlenmemi\u015F banktnotlarla 10.000 dolar g\xF6ndermezseniz, bu foto\u011Fraf\u0131 FBI, New York Times ve G\xF6\xE7menlik B\xFCrosu\u2019na g\xF6nderece\u011Fim.\u201D\nO zamanlar Amerika\u2019da pop\xFCler bir yazar kadar kadar \xFCnl\xFC olan David Ogilvy\u2019ye bu \u015Fantaj mektubunu g\xF6nderen, Rosser Reeves isimli ba\u015Fka bir reklamc\u0131yd\u0131. Bates isimli bir ajans\u0131n orta\u011F\u0131 olan bu reklamc\u0131, ayn\u0131 zamanda David Ogilvy\u2019nin eski bacana\u011F\u0131yd\u0131.\nO g\xFCnlerde 40\u2019l\u0131 ya\u015Flar\u0131n\u0131n sonlar\u0131nda olan bu iki eski bacanak, 50\u2019lerin ve 60\u2019lar\u0131n Amerika\u2019s\u0131nda, reklam d\xFCnyas\u0131n\u0131n iki farkl\u0131 kutbunu temsil ediyordu. Amerikan..." },
  { slug: "neden-bazi-yeni-markalar-serdar-ortac-gibi-dusunuyor", title: "Neden baz\u0131 yeni markalar Serdar Orta\xE7 gibi d\xFC\u015F\xFCn\xFCyor?", tags: ["Yeni marka yaratmak"], excerpt: "Serdar Orta\xE7 gibi d\xFC\u015F\xFCnmedi\u011Fimiz s\xFCrece, yeni markalar i\xE7in s\xFCrekli yeni f\u0131rsatlar var.", coreContent: "Serdar Orta\xE7\u2019\u0131n me\u015Fhur cevab\u0131n\u0131 hat\u0131rlars\u0131n\u0131z. \u015Eark\u0131lar\u0131n\u0131n birbirine \xE7ok benzedi\u011Fi, hatta hep ayn\u0131 \u015Fark\u0131y\u0131 yapt\u0131\u011F\u0131 s\xF6ylenince, topu topu 7 nota var, ka\xE7 ayr\u0131 beste yap\u0131labilir ki, demi\u015Fti.\nSerdar Orta\xE7 gibi d\xFC\u015F\xFCnmedi\u011Fimiz s\xFCrece, yeni markalar i\xE7in s\xFCrekli yeni f\u0131rsatlar var. \xC7\xFCnk\xFC elimizde, 7 notadan da fazlas\u0131, binlerce kelime var.\n\u015Eimdi hemen, kelimeler yeni bir marka i\xE7in ne f\u0131rsat yaratabilir ki, diye sorabilirsiniz. Hakl\u0131s\u0131n\u0131z, \xE7\xFCnk\xFC pazarlama literat\xFCr\xFCn\xFCn b\xFCy\xFCk k\u0131sm\u0131, markalamay\u0131 anlat\u0131rken bu k\u0131sm\u0131 g\xF6rmezden gelir.\nG\xF6rmezden gelir demeyelim de hadi, etraf\u0131ndan dolan\u0131r, \xF6z\xFCne inmez.\n\xDCr\xFCn, hizmet, deneyim, bilinirlik, bulunurluk, logo, renk, alg\u0131, marka ki\u015Fili\u011Fi, marka \xF6z\xFC derken, i\u015Fin \xF6z\xFC ayr\u0131nt\u0131larda bo\u011Fulur. Mesela t\xFCm bu sayd\u0131klar\u0131m\u0131 kusursuz yapan ama \xE7ak\u0131lan yeni markalar..." },
  { slug: "markalari-buyuten-nedir", title: "Markalar\u0131 b\xFCy\xFCten nedir?", tags: ["Yeni marka yaratmak"], excerpt: "Konuya pazarlamac\u0131 g\xF6z\xFCyle bakarsan\u0131z, markalar\u0131 b\xFCy\xFCten etkenleri sadece pazarlamayla ilgili kavramlarda arars\u0131n\u0131z.", coreContent: "Konuya pazarlamac\u0131 g\xF6z\xFCyle bakarsan\u0131z, markalar\u0131 b\xFCy\xFCten etkenleri sadece pazarlamayla ilgili kavramlarda arars\u0131n\u0131z. \xDCr\xFCnde, fiyatta, bilinirlikte, bulunurlukta vs\u2026\nBu biraz, elimize bir matkap ge\xE7ti\u011Finde, evdeki duvarlara bak\u0131p matkab\u0131 kullanmak i\xE7in bahane aramam\u0131za benziyor.\nBen markalar\u0131 b\xFCy\xFCten \u015Feyin, sadece pazarlamayla ilgili olmayan, daha yukar\u0131da bir kavram oldu\u011Funa inan\u0131yorum: Rekabet.\nMarkalar rekabetle b\xFCy\xFCr.\n\u0130ster pazarlamaya, ister spora, ister sanata, ister bilime, ister d\xFCnya tarihine bak\u0131n. Rekabetin oldu\u011Fu yerde geli\u015Fme ve b\xFCy\xFCme vard\u0131r.\nBilgisayardan penisiline, bug\xFCn hala kulland\u0131\u011F\u0131m\u0131z pek \xE7ok bilimsel ve teknolojik yenili\u011Fi, rekabetin en vah\u015Fi haline, ge\xE7ti\u011Fimiz y\xFCzy\u0131ldaki 2 d\xFCnya sava\u015F\u0131na bor\xE7luyuz.\nSo\u011Fuk Sava\u015F rekabeti, insano\u011Flunun Ay\u2019a gitmesini sa\u011Flad\u0131.\nKola..." },
  { slug: "marka-olmak-mi-tercih-edilen-bir-marka-olmak-mi", title: "Marka olmak m\u0131, tercih edilen bir marka olmak m\u0131?", tags: [], excerpt: "T\xFCrkiye \u015Fartlar\u0131nda, marka olmakla, tercih edilen bir marka olmak aras\u0131nda ne fark var?", coreContent: "T\xFCrkiye \u015Fartlar\u0131nda, marka olmakla, tercih edilen bir marka olmak aras\u0131nda ne fark var?\nDa\u011Flar kadar fark var.\nKapitalizmi ve sanayi devrimini \u0131skalam\u0131\u015F olmam\u0131zdan olsa gerek, maalesef bizde hala \u201Cmarka olmak\u201D konu\u015Fuluyor. Marka dan\u0131\u015Fmanlar\u0131, marka olmaktan bahsedip duruyor.\nAma \xFClkede \u015Fu an teorik anlamda marka olmay\u0131 anlatmak, T\xFCrkiye\u2019nin Bat\u0131l\u0131la\u015Fma ser\xFCveni gibi, tepeden inme.\nT\xFCrkiye gibi baz\u0131 trenleri ka\xE7\u0131rm\u0131\u015F bir \xFClkede, pazarlamada as\u0131l mesele, tam anlam\u0131yla marka olmak ya da olmamak de\u011Fil. Tercih edilip edilmemek. \xC7\xFCnk\xFC tercih edilirseniz i\u015Fletmeniz b\xFCy\xFCr, geliriniz artar, para kazan\u0131rs\u0131n\u0131z.\nVe \xFCstelik kitaplarda yaz\u0131lan \u015Fekilde, Bat\u0131l\u0131 anlamda, logosuyla kimli\u011Fiyle, \xF6z\xFCyle deneyimiyle, tam anlam\u0131yla bir marka olmak, tercih edilmenizi garanti etmez. Marka olman\u0131n teknik olarak..." },
  { slug: "orta-marka-tuzagi", title: "Orta marka tuza\u011F\u0131", tags: [], excerpt: "Baz\u0131 yeni markalar, belirli bir \xE7\u0131tay\u0131 neden a\u015Famazlar?", coreContent: "Baz\u0131 yeni markalar, belirli bir \xE7\u0131tay\u0131 neden a\u015Famazlar?\nYeni bir marka yarat\u0131rken verece\u011Finiz en kritik karar, isim, logo ya da marka kimli\u011Finden ziyade, markay\u0131 2\u20133 kelimeyle basit\xE7e nas\u0131l tan\u0131mlad\u0131\u011F\u0131n\u0131zd\u0131r.\nYanl\u0131\u015F bir tan\u0131mlama markan\u0131n do\u011Far do\u011Fmaz \xE7ak\u0131lmas\u0131na ya da orta marka tuza\u011F\u0131na tak\u0131lmas\u0131na sebep olur.\nYanl\u0131\u015F kelime se\xE7imleri y\xFCz\xFCnden do\u011Far do\u011Fmaz \xE7ak\u0131lan markalar i\xE7in\n\u015Fu yaz\u0131da\n\xF6rnekler var.\nOrta marka tuza\u011F\u0131 derken kast\u0131m da \u015Fu:\n\u201COrta gelir tuza\u011F\u0131\u201D ifadesini duymu\u015Fsunuzdur. \xDClkedeki ki\u015Fi ba\u015F\u0131na d\xFC\u015Fen gelir seviyesinin, bir noktada tak\u0131l\u0131p kalmas\u0131n\u0131, y\xFCkselmemesini anlat\u0131r.\nMarkalar i\xE7in de b\xF6yle bir tuzak var.\nBaz\u0131 yeni markalar da, yanl\u0131\u015F kelime se\xE7imleri sebebiyle, belirli bir \xE7\u0131tay\u0131 asla a\u015Famazlar. Pazarla birlikte b\xFCy\xFCrler belki ama belli bir seviyede kal\u0131r, hi\xE7bir zaman..." },
  { slug: "yeni-bir-marka-yaratirken-vereceginiz-en-hayati-karar", title: "Yeni bir marka yarat\u0131rken verece\u011Finiz en hayati karar", tags: ["Marka konumland\u0131rma"], excerpt: "Yeni bir marka yarat\u0131rken, markay\u0131 tan\u0131mlayaca\u011F\u0131n\u0131z 2\u20133 s\xF6zc\xFCk, markan\u0131z i\xE7in verece\u011Finiz en hayati karar olacakt\u0131r.", coreContent: "Yeni bir marka yarat\u0131rken, markay\u0131 tan\u0131mlayaca\u011F\u0131n\u0131z 2\u20133 s\xF6zc\xFCk, markan\u0131z i\xE7in verece\u011Finiz en hayati karar olacakt\u0131r.\nYeni markan\u0131z\u0131 do\u011Fru tan\u0131mlamazsan\u0131z:\n\xDCr\xFCn ya da hizmetiniz harika da olsa,\n\u0130sim ve logonuz muhte\u015Fem de olsa,\nMarka kimli\u011Finizi d\xF6rt d\xF6rtl\xFCk de tasarlasan\u0131z,\nSat\u0131\u015F ve da\u011F\u0131t\u0131mda \xE7ok g\xFC\xE7l\xFC de olsan\u0131z,\n\u0130yi bir b\xFCt\xE7eyle ve \xF6d\xFCll\xFC reklamlarla da yola \xE7\u0131ksan\u0131z,\n\xE7ak\u0131lma ihtimaliniz \xE7ok ama \xE7ok y\xFCksek olur.\n\xD6rnek mi istiyorsunuz?\n\xD6rnekleri hat\u0131rlaman\u0131z zor, \xE7\xFCnk\xFC \xE7ak\u0131ld\u0131lar, art\u0131k yoklar:)\nAma baz\u0131lar\u0131n\u0131 size hat\u0131rlatabilirim.\nYap\u0131 Kredi Nuvo\nYap\u0131 Kredi 5\u20136 y\u0131l \xF6nce, Nuvo ad\u0131nda yeni bir marka lansman\u0131 yapm\u0131\u015Ft\u0131.\nReklam filmlerini g\xF6r\xFCr g\xF6rmez de \xE7ak\u0131laca\u011F\u0131n\u0131 s\xF6ylemi\u015Ftim. (\xD6yle arkada\u015F ortam\u0131nda da de\u011Fil, MediaCat dergisine,\nbir r\xF6portajda.\n)\nPeki nereden bildim?\nReklam filmlerinde..." }
];
var BLOG_TOPIC_INDEX = [
  { tag: "\xD6zel makaleler", count: 163, topArticles: ["Ba\u015Far\u0131l\u0131 \u015Firketler neden kendi mezarlar\u0131n\u0131 kazar? (Harvard Notlar\u0131 - 1)", "Asimetrik s\u0131\xE7rama", "Uzmanlar da yer", "M\xFC\u015Fteriyi anlama", "Persona Yalan\u0131 - Teoman ve Ali Ko\xE7"] },
  { tag: "Gayrinizami Markalama", count: 43, topArticles: ["Sar\u0131 bikini", "B\xFCy\xFCmenin b\xFCy\xFCs\xFC", "Sezar'\u0131n fiyat\u0131", "Fakirseniz s\u0131k\u0131c\u0131 olamazs\u0131n\u0131z", "Canavar\u0131n cesareti"] },
  { tag: "Gayrinizami Notlar", count: 38, topArticles: ["\u{1F4EE}5 paral\u0131k masa", "\u{1F4EE}Yatarken ne giyerdi?", "\u{1F4EE}\u0130sim se\xE7mek", "\u{1F4EE}Sinsi veri", "\u{1F4EE}Rol yapmay\u0131n l\xFCtfen!"] },
  { tag: "\u0130lham kayna\u011F\u0131", count: 36, topArticles: ["\u{1F5DD}\uFE0FG\xF6r\xFCnmeyen \xE7\xF6z\xFCmler", "\u{1F5DD}\uFE0FAc\u0131mas\u0131z yaz\u0131", "Do\u011Fru karar vermenin yolu", "Yeterince net misiniz?", "Yolunuzu t\u0131kayan 5 engel #4"] },
  { tag: "LimitedPost", count: 28, topArticles: ["\u{1F4F0}Limited Post #27", "\u{1F4F0}Limited Post #26", "\u{1F4F0}Limited Post #25", "Y\u0131l\u0131n en \xE7ok okunanlar\u0131 - 2023", "\u{1F4F0}Limited Post #24"] },
  { tag: "K\u0131l\xE7\u0131ks\u0131z Markalama", count: 26, topArticles: ["\u{1F41F}K\u0131l\xE7\u0131ks\u0131z Markalama: Reklam nedir?", "\u{1F41F}K\u0131l\xE7\u0131ks\u0131z Markalama: 360 derece pazarlama ileti\u015Fimi nedir?", "\u{1F41F}K\u0131l\xE7\u0131ks\u0131z Markalama: Marka mimarisi nedir?", "\u{1F41F}K\u0131l\xE7\u0131ks\u0131z Markalama: Mecra nedir?", "\u{1F41F}K\u0131l\xE7\u0131ks\u0131z Markalama: Kanca nedir?"] },
  { tag: "Gayrinizami Pazarlama", count: 25, topArticles: ["Paran\u0131z yoksa d\xFC\u015F\xFCnmek zorundas\u0131n\u0131z", "Dengesiz y\xF6netin", "Gev\u015Fetme sanat\u0131", "Pazarlama neden \xE7are de\u011Fil?", "\xC7ok \xE7al\u0131\u015Fmak kurtarmaz"] },
  { tag: "Marka hikayeleri", count: 15, topArticles: ["Bug\xFCn neden \xF6nemli bir g\xFCn?", "Pizzay\u0131 t\xFCm d\xFCnya tan\u0131rken lahmacun neden yerel kald\u0131?", "Markan\u0131z\u0131n k\u0131rmas\u0131 gereken kilit", "Hangi hikayeler satt\u0131r\u0131r?", "Shein, yeni Amazon olur mu?"] },
  { tag: "Pazar yaz\u0131lar\u0131", count: 15, topArticles: ["Postan\u0131n g\xFCc\xFC\u{1F4EA}", "Pazarlama tarihinin en b\xFCy\xFCk skandallar\u0131ndan biri: New Coke", "Karar vermenin maliyeti", "Ahududu", "Bir markay\u0131 do\u011Furan, ya\u015Fatan ve \xF6ld\xFCren 3 farkl\u0131 \u015Fey"] },
  { tag: "Yeni marka yaratmak", count: 15, topArticles: ["T\xFCketiciye soru sorulur mu?", "Dev markalardan ilham al\u0131rken dikkat etmeniz gerekenler", "En az marka ismi kadar \xF6nemli olan ba\u015Fka bir isim", "Yeni markalar i\xE7in 2 temel strateji prensibi", "Bu bir uyar\u0131d\u0131r"] },
  { tag: "12ilke", count: 13, topArticles: ["Y\u0131l\u0131n en \xE7ok okunanlar\u0131 - 2023", "\u0130lke #12: Markana a\u015F\u0131k olma!", "\u0130lke #11: H\u0131zl\u0131 y\xFCkseli\u015F bekleme, sabret", "\u0130lke #10: Karma\u015F\u0131kl\u0131\u011F\u0131n de\u011Fil basitli\u011Fin pe\u015Finden ko\u015F", "\u0130lke #9: Yeni markalar yaratmaktan korkma"] },
  { tag: "Marka konumland\u0131rma", count: 9, topArticles: ["Konumland\u0131rman\u0131n mast\xFCrbasyondan fark\u0131", "En \xE7ok sorulan soru: Apple\u2019\u0131n marka konumland\u0131rmas\u0131 ne?", "Marka konumland\u0131rma nedir?", "Konumland\u0131rma ve a\u015F\u0131r\u0131 sadele\u015Ftirme", "3 mercek\u{1F4CC}"] },
  { tag: "Yasak Elmalar", count: 7, topArticles: ["Y\u0131l\u0131n en \xE7ok okunanlar\u0131 - 2023", "Yasak elma: Yavru k\xF6pek yakla\u015F\u0131m\u0131\u{1F34E}", "Yasak elma: \xDCr\xFCn \xE7e\u015Fitlili\u011Fi\u{1F34E}", "Yasak elma: Eklemek\u{1F34E}", "Yasak elma: M\xFC\u015Fteri ihtiya\xE7lar\u0131 \u{1F34E}"] },
  { tag: "\xD6zel makale", count: 6, topArticles: ["Karma\u015F\u0131k bir \xFCr\xFCn\xFC anlatman\u0131n 2 basit yolu", "Marka konumland\u0131rma hakk\u0131nda s\xF6ylenen en b\xFCy\xFCk yalan", "Konumland\u0131rman\u0131n cevap vermeye \xE7al\u0131\u015Ft\u0131\u011F\u0131 tek soru", "Premium alg\u0131lanmak isteyen \xFCrkek ceylanlar", "G\xF6z m\xFC, kulak m\u0131?"] },
  { tag: "News", count: 4, topArticles: ["Y\u0131l\u0131n en \xE7ok okunanlar\u0131 - 2023", "Y\u0131l\u0131n en \xE7ok okunanlar\u0131", "\u{1F3F4}\u200D\u2620\uFE0FKorsan \xE7a\u011F\u0131n\u0131n ba\u015Flang\u0131c\u0131", "Plaza T\xFCrk\xE7esinin milyonlarca dolarl\u0131k maliyeti"] },
  { tag: "Limited Post", count: 1, topArticles: ["Yolunuzu t\u0131kayan 5 engel #4"] }
];
var BLOG_QUOTES = [
  "Bu kadar \xE7ok insan\u0131n beni sizin felsefenizin \xF6nde gelen rakibi olarak g\xF6rmesi grotesk ve benim i\xE7in neredeyse trajik. Asl\u0131nda en ate\u015Fli \xF6\u011Frencinizim.",
  "oyuncak kategorisinde Toys R Us\u2019a t\xFCketici talebi h\xE2l\xE2 g\xFC\xE7l\xFC. M\xFC\u015Fterinin markam\u0131z\u0131 deneyimlemek istedi\u011Fi kanallara yat\u0131r\u0131m yapmaya devam edece\u011Fiz",
  "ad\u0131nda bir kitap yazm\u0131\u015F. Daha do\u011Frusu, ajans\u0131 i\xE7in yol g\xF6sterici bir d\xF6k\xFCman olarak kaleme ald\u0131\u011F\u0131 y\xF6ntemi, sonradan kitapla\u015Ft\u0131rm\u0131\u015F. Ogilvy\u2019nin",
  "etkisini azaltmak i\xE7in kafeini azaltm\u0131\u015Flar. Bunun yerine %100 organik kakao, ayurveda otlar\u0131 ve fonksiyonel mantarlar eklemi\u015Fler. Sonu\xE7ta bir",
  "Dakiklik, kar\u015F\u0131lama, haz\u0131rl\u0131k,\xA0anlat\u0131m, konunun ard\u0131c\u0131ll\u0131\u011F\u0131,\xA0\xF6rnekler, \xFCst d\xFCzeydeydi. Farkl\u0131 bir bak\u0131\u015F a\xE7\u0131s\u0131.\xA0Herkese tavsiye ediyorum.",
  "silmeye de\u2026\nSizi dinliyormu\u015F gibi g\xF6r\xFCn\xFCr. Sonra bildi\u011Fi gibi yapar.\nBu pazarlamac\u0131lar\u0131n annelerimizden tek fark\u0131, s\xFCrekli olarak,",
  "olsa gerek, de\u011Fil mi? Toplant\u0131 odas\u0131na girdiler, nas\u0131l daha iyi fikir buluruz, sorusu \xE7er\xE7evesinde beyin f\u0131rt\u0131nas\u0131 yapt\u0131lar ve",
  "\u2026u\xE7aklar, geni\u015F ama anlams\u0131z bir alan bombalamas\u0131 yerine, \xFCretim merkezlerine yo\u011Funla\u015Fm\u0131\u015F olsayd\u0131, sava\u015F 1943'te bitebilirdi.",
  "n\u0131\xA0 bulman\u0131n \xF6nemini konu\u015Ftuk. \xC7\xF6z\xFCl\xFCnce di\u011Fer bir\xE7ok d\xFC\u011F\xFCm\xFC \xE7\xF6zen as\u0131l d\xFC\u011F\xFCm\xFC\u2026\nSonra bu d\xFC\u011F\xFCm\xFC bulmak i\xE7in do\u011Fru",
  "zihnimiz i\xE7in net bir adres tarifi. Somut.\nHedefi b\xF6yle tan\u0131mlarsak, zihnimiz g\xFCn i\xE7inde belki de y\xFCzlerce kez",
  "an\u0131 ya\u015F\u0131yordu.\n2.\nRodney Brooks 1954\u2019te Adelaide, Avustralya\u2019da do\u011Fdu. Daha 4 ya\u015F\u0131ndayken ailesi ona",
  "zihnimiz i\xE7in net bir adres tarifi de\u011Fil. \xC7\xFCnk\xFC somut de\u011Fil. Zihnimiz buna \xE7\xF6z\xFCm bulamaz.\nAma",
  "istemi\u015Fler. Ben de konumland\u0131r\u0131lmam\u0131\u015F markalar olarak, daha lansman d\xF6nemindeki 2 markan\u0131n,",
  "Newsweek muhabirinin \u015Fa\u015Fk\u0131nl\u0131ktan dilinin tutulmas\u0131n\u0131n sebebi, medyan\u0131n Ogilvy ve Reeves\u2019i",
  "dosyas\u0131nda duruyor.\nReklam ajanslar\u0131n\u0131n zaten ah\u0131 gitmi\u015F vah\u0131 kalm\u0131\u015F, onlar\u0131n m\xFC\u015Fteriye",
  "bahane bulabilir. Ve sonu\xE7ta kilo vermeye ba\u015Flayabiliriz.\nAma ayn\u0131 zihnimiz g\xFCn i\xE7inde",
  "girdi. Tahtadan yap\u0131lm\u0131\u015F, i\xE7inde f\u0131r\xE7a olan tuhaf \u015Feyi Tacettin\u2019e g\xF6sterdi ve dedi ki:",
  "vard\u0131r.\nSizin de markan\u0131zla girmeye niyetlendi\u011Finiz pazar kasaba gibiyse, markan\u0131z\u0131n",
  "\u0130yi odaklanm\u0131\u015F bir \u015Firket, genele hitap edenden \xE7ok daha sa\u011Flam bir konumdad\u0131r.",
  "E\u011Fer farkl\u0131 bir yan\u0131n\u0131z yoksa, fiyat\u0131n\u0131z\u0131n d\xFC\u015F\xFCk olmas\u0131nda yarar var.",
  "geldi mi?\nGeldi,\ndedi kar\u015F\u0131daki ses. Herkes \xE7ok heyecanl\u0131yd\u0131.\nKline",
  "Sade, net bir e\u011Fitimdi. \u0130\u015Fimde alaca\u011F\u0131m kararlara faydas\u0131 olacak.",
  "uzaktan da olsa bildikleri i\xE7in, kendi yapt\u0131klar\u0131 i\u015Fi ortalama,",
  "Vizyon a\xE7\u0131c\u0131 ve hizalanmak i\xE7in yol g\xF6sterici bir e\u011Fitim oldu.",
  "olarak tan\u0131mlama ihtimali var m\u0131? Ma\u011Faran\u0131n d\u0131\u015F\u0131nda o markadan",
  "Markan\u0131z\u0131 butik ve premium bir marka olarak konumland\u0131raca\u011F\u0131z",
  "ya bast\u0131 ve telefonla Stanford\u2019daki arkada\u015F\u0131na tekrar sordu.",
  "g\xF6r\xFCnmek i\xE7in \xF6zel g\xFCn pe\u015Finde ko\u015Fuyor olmas\u0131n sak\u0131n?\nL\xFCtfen",
  "ismiyle \u015Firketini kurdu. Birka\xE7 ay sonra da \u015Firketin ismini,",
  "s\xF6yleyece\u011Finizi d\xFC\u015F\xFCnseniz iyi olur.\n\u0130\u015Fin g\xFCzel taraf\u0131,",
  "E\u011Fer insanlara sorsayd\u0131m, daha h\u0131zl\u0131 atlar isterlerdi.",
  "bir foto\u011Fraf\u0131 ve bir not vard\u0131. Notta \u015F\xF6yle yaz\u0131yordu:",
  "in nas\u0131l konulaca\u011F\u0131n\u0131 g\xF6rd\xFCk.\nArd\u0131ndan, te\u015Fhise uygun",
  "s\xF6yleyece\u011Finiz de\u011Fil. \u0130lk ve as\u0131l d\xFC\u015F\xFCnmeniz gereken,",
  "yi ald\u0131n m\u0131?\nK\u0131sa s\xFCre sonra kar\u015F\u0131daki cevap verdi:",
  "ten bahsediyorum.\n\u0130lk g\xFCn, markalar\u0131 kilitleyen",
  "denen \xFCr\xFCn\xFC anlamaz, sat\u0131n almaz. Biz buna",
  "butik, profesyonel, m\xFC\u015Fterisine \xF6nem veren",
  "aman a\u011Fz\u0131m\u0131z\u0131n tad\u0131 ka\xE7mas\u0131n Ali R\u0131za bey",
  "Amac\u0131 olan markalar b\xFCy\xFCyor, i\u015Fte kan\u0131t\u0131"
];

// src/pipeline/agents/blogStrategyAdvisor.ts
async function runBlogStrategyAdvisor(normalizedData, researchFindings, strategistOutput) {
  let researchContext = "";
  const hasResearch = researchFindings && researchFindings.sourcesUsed !== 0;
  if (hasResearch) {
    const competitorSummary = researchFindings.competitors.map((c) => `- ${c.name}: ${c.positioning}`).join("\n");
    researchContext = `
## Sektor Arastirmasi
- Rakipler: ${competitorSummary || "Bilgi yok"}
- Pazar Buyuklugu: ${researchFindings.marketData.marketSize}
- Buyume Hizi: ${researchFindings.marketData.growthRate}
- Tuketici Trendleri: ${researchFindings.marketData.consumerTrends.join("; ") || "Bilgi yok"}
- Firsatlar: ${researchFindings.opportunities.join("; ") || "Bilgi yok"}
- Tehditler: ${researchFindings.threats.join("; ") || "Bilgi yok"}
`;
  }
  const taSegments = strategistOutput.targetAudience;
  const targetAudienceSummary = typeof taSegments === "string" ? taSegments : `Birincil: ${taSegments.primarySegment?.demographics || "Belirtilmedi"} \u2014 ${taSegments.primarySegment?.behavioralProfile || ""}`;
  const principlesSummary = BLOG_PRINCIPLES.slice(0, 60).map((p) => `- [${p.tags.join(", ")}] "${p.title}": ${p.excerpt}${p.coreContent ? ` \u2014 ${p.coreContent.slice(0, 300)}` : ""}`).join("\n");
  const topicsSummary = BLOG_TOPIC_INDEX.slice(0, 12).map((t) => `- ${t.tag} (${t.count} yazi): ${t.topArticles.slice(0, 3).join(", ")}`).join("\n");
  const quotesSummary = BLOG_QUOTES.slice(0, 30).map((q) => `- "${q}"`).join("\n");
  const prompt = `Sen stratejik danismanin blog felsefesini temsil eden bir marka danismanisin. ${BLOG_AUTHOR_META.site} adresinde ${BLOG_AUTHOR_META.totalArticles} blog yazisi yayinlanmis, "Gayrinizami Markalama" felsefesiyle bilinen stratejik yaklasimlar icermektedir \u2014 geleneksel pazarlama dogmalarini sorgular, sira disi ve cesur yaklasimlar savunur.

Gorevlerin:
1. Onerilen marka stratejisini stratejik danismanin felsefi cercevesinden degerlendir
2. Blog yazilarindaki stratejik prensipleri bu markaya SOMUT OLARAK uygula
3. Icerik stratejisini yazarin tarzi, sesi ve konularina gore sekillendirerek UYGULANABILIR oneriler sun

## Yazarin Temel Temalari
${topicsSummary}

## Yazarin Stratejik Yazilari (Ozetler)
${principlesSummary}

## Yazarin Sozleri
${quotesSummary}

---

## Analiz Edilecek Isletme
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
- Hedef Kitle: ${targetAudienceSummary}
- Farklilik: ${strategistOutput.differentiator}
- Rekabet Avantaji: ${strategistOutput.competitiveAdvantage}
${researchContext}
---

Yukaridaki stratejiyi stratejik danismanin blog yazilarindaki felsefe ve yaklasimlarla karsilastirarak asagidaki JSON yapisinda bir degerlendirme olustur:

{
  "philosophicalAlignment": {
    "score": 7,
    "rationale": "Onerilen stratejinin stratejik danismanin felsefesiyle ne kadar uyumlu oldugu. Somut blog referanslariyla acikla. (2-3 cumle)",
    "alignedPrinciples": [
      "UYUMLU PRENSIP 1: Blog yazilarindan hangi prensip bu stratejiyi destekliyor? Blog basligini ve icerigini referans goster.",
      "UYUMLU PRENSIP 2: ..."
    ],
    "conflictingPrinciples": [
      "CELISEN PRENSIP 1: Blog yazilarindan hangi prensip bu stratejiyle celisiyor? Neden? Blog basligini referans goster.",
      "CELISEN PRENSIP 2: ..."
    ]
  },
  "strategicRecommendations": [
    {
      "area": "positioning",
      "recommendation": "Blog yazilarindaki bir prensibi bu markaya SOMUT olarak uygulayan oneri. Ornek: 'Dengesiz yonetin yazisindaki gibi, 4P dengesini bozarak [X]'e agirlik verin.'",
      "blogReference": "Referans alinan blog yazisinin basligi"
    },
    {
      "area": "differentiation",
      "recommendation": "Farklilasmak icin blog felsefesinden bir uygulama onerisi",
      "blogReference": "Blog basligi"
    },
    {
      "area": "content",
      "recommendation": "Icerik stratejisi icin blog tarzindan bir uygulama onerisi",
      "blogReference": "Blog basligi"
    }
  ],
  "contentStrategyInsights": {
    "toneAlignment": "Bu markanin iletisim tonunun stratejik danismanin yazim tarziyla nasil iliskilendirilecegi. (1-2 cumle)",
    "contentPillars": [
      "ICERIK SUTUNU 1: Blog temalarindan esinlenerek bu markaya ozgu bir icerik sutunu",
      "ICERIK SUTUNU 2: ...",
      "ICERIK SUTUNU 3: ..."
    ],
    "narrativeApproach": "Bu markanin hikaye anlatim yaklasimi nasil olmali? Blog yazilarindaki anlatim tekniklerinden (hikaye, provokasyon, karsilastirma) hangisi uygun? (1-2 cumle)",
    "topicSuggestions": [
      "KONU 1: Blog temalarindan esinlenerek bu markaya ozel bir icerik konusu onerisi",
      "KONU 2: ...",
      "KONU 3: ...",
      "KONU 4: ...",
      "KONU 5: ..."
    ]
  },
  "authorPerspective": "Stratejik danismanin bu markayi incelese ne derdi? Gayrinizami Markalama uslubunda, cesur bakis acisiyla 3-5 cumlelik bir degerlendirme yaz. Cesur, dogrudan.",
  "unconventionalInsights": [
    "GAYRINIZAMI ICGORU 1: Blog felsefesinden esinlenen, geleneksel pazarlama yaklasimlarindan farkli, cesur bir oneri. (1-2 cumle)",
    "GAYRINIZAMI ICGORU 2: Sira disi bir bakis acisi veya strateji onerisi. (1-2 cumle)"
  ]
}

KRITIK KURALLAR:
1. Her oneri ve degerlendirme SOMUT bir blog yazisina referans vermeli. Genel laflar YASAK.
2. "authorPerspective" alaninda Gayrinizami Markalama uslubunda yaz \u2014 provoke edici, hikayeli, dogmalara meydan okuyan.
3. "contentPillars" 3-5 adet olmali, HER biri blog temalarindan esinlenmeli ama BU MARKAYA OZEL olmali.
4. "topicSuggestions" 5-7 adet olmali, HER biri blog yazilarinin yaklasimini bu markaya uygulayan somut konular.
5. "strategicRecommendations" 3-5 adet, her biri FARKLI bir alana odaklanmali: positioning, differentiation, content, audience, competition.
6. "unconventionalInsights" 2-3 adet, GELENEKSEL pazarlama mantigi DISINDA dusun \u2014 tam da stratejik danismanin yapacagi gibi.
7. score degeri DUNUK (3-4) ise stratejinin neden SIRADAN ve CESARET EKSIK oldugunu acikla. YUKSEK (8-9) ise neden GAYRINIZAMI ve CESUR oldugunu belirt.
8. Tum metinler TURKCE olmali.
9. Sadece JSON don, baska bir sey yazma.`;
  const parsed = await generateJSON("flash", prompt, "BlogStrategyAdvisor", {
    temperature: 0.8,
    maxOutputTokens: 8192
  });
  return {
    philosophicalAlignment: {
      score: typeof parsed.philosophicalAlignment?.score === "number" ? Math.min(10, Math.max(0, parsed.philosophicalAlignment.score)) : 5,
      rationale: parsed.philosophicalAlignment?.rationale || "Degerlendirme tamamlanamadi.",
      alignedPrinciples: Array.isArray(parsed.philosophicalAlignment?.alignedPrinciples) ? parsed.philosophicalAlignment.alignedPrinciples : [],
      conflictingPrinciples: Array.isArray(parsed.philosophicalAlignment?.conflictingPrinciples) ? parsed.philosophicalAlignment.conflictingPrinciples : []
    },
    strategicRecommendations: Array.isArray(parsed.strategicRecommendations) && parsed.strategicRecommendations.length > 0 ? parsed.strategicRecommendations.map((r) => ({
      area: r.area || "general",
      recommendation: r.recommendation || "",
      blogReference: r.blogReference || ""
    })) : [{ area: "general", recommendation: "Blog bazli degerlendirme tamamlanamadi.", blogReference: "" }],
    contentStrategyInsights: {
      toneAlignment: parsed.contentStrategyInsights?.toneAlignment || "",
      contentPillars: Array.isArray(parsed.contentStrategyInsights?.contentPillars) ? parsed.contentStrategyInsights.contentPillars : [],
      narrativeApproach: parsed.contentStrategyInsights?.narrativeApproach || "",
      topicSuggestions: Array.isArray(parsed.contentStrategyInsights?.topicSuggestions) ? parsed.contentStrategyInsights.topicSuggestions : []
    },
    authorPerspective: parsed.authorPerspective || "Yazar perspektifi olusturulamadi.",
    unconventionalInsights: Array.isArray(parsed.unconventionalInsights) && parsed.unconventionalInsights.length > 0 ? parsed.unconventionalInsights : ["Gayrinizami icgoru olusturulamadi."]
  };
}

// src/pipeline/agents/strategySynthesizer.ts
async function runStrategySynthesizer(normalizedData, researchFindings, strategistOutput, challengerOutput, blogAdvisorOutput = null, businessContext) {
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
  let blogAdvisorSummary = "";
  if (blogAdvisorOutput) {
    blogAdvisorSummary = `

### Blog Strateji Danismani Degerlendirmesi (Stratejik Blog Danismani Perspektifi)
- Felsefi Uyum Skoru: ${blogAdvisorOutput.philosophicalAlignment.score}/10
- Gerekce: ${blogAdvisorOutput.philosophicalAlignment.rationale}
- Uyumlu Prensipler: ${blogAdvisorOutput.philosophicalAlignment.alignedPrinciples.join("; ") || "Yok"}
- Celisen Prensipler: ${blogAdvisorOutput.philosophicalAlignment.conflictingPrinciples.join("; ") || "Yok"}
- Stratejik Oneriler:
${blogAdvisorOutput.strategicRecommendations.map((r) => `  - [${r.area}] ${r.recommendation} (Kaynak: ${r.blogReference})`).join("\n")}
- Icerik Stratejisi:
  - Ton Uyumu: ${blogAdvisorOutput.contentStrategyInsights.toneAlignment}
  - Icerik Sutunlari: ${blogAdvisorOutput.contentStrategyInsights.contentPillars.join(", ")}
  - Anlati Yaklasimi: ${blogAdvisorOutput.contentStrategyInsights.narrativeApproach}
- Yazar Perspektifi: ${blogAdvisorOutput.authorPerspective}
- Gayrinizami Icgoruler:
${blogAdvisorOutput.unconventionalInsights.map((i) => `  - ${i}`).join("\n")}`;
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
  const expertCount = 1 + (challengerOutput ? 1 : 0) + (blogAdvisorOutput ? 1 : 0);
  const debateInstruction = expertCount === 3 ? "Uc farkli uzmanin goruslerini sentezlemen gerekiyor: Strateji uzmani, seytan avukati ve blog strateji danismani (stratejik blog danismani perspektifi). Her ucunun en guclu argumanlarin birlestirerek, cesur ama temelli nihai stratejiyi olustur." : challengerOutput ? "Iki farkli uzmanin goruslerini inceleyip en iyi stratejiyi sentezlemen gerekiyor. Strateji uzmaninin onerisiyle seytan avukatinin elestirisini dengeleyerek, en guclu ve tutarli sonucu olustur." : blogAdvisorOutput ? "Strateji uzmaninin onerisi ve blog strateji danismaninin (stratejik blog danismani perspektifi) degerlendirmesini sentezleyerek nihai stratejiyi olustur." : "Strateji uzmaninin onerisini inceleyip, rafine ederek nihai stratejiyi olusturman gerekiyor. Karsi-analiz mevcut olmadigindan, kendi elestirel gozunle stratejiyi guclendirerek sentezle.";
  const sourceCount = researchFindings?.sourcesUsed || 0;
  const bc = businessContext;
  const businessContextSection = bc ? `
## Isletme Baglam Bilgileri (Dogrudan Musteri Beyani)
- Isletme Tanimi: ${bc.businessDescription || "Belirtilmedi"}
- Bilinen Rakipler: ${bc.competitors || "Belirtilmedi"}
- Cografi Kapsam: ${bc.geoScope || "Belirtilmedi"}
- Dijital Platformlar: ${bc.digitalPresence?.join(", ") || "Belirtilmedi"}
- Instagram Takipci: ${bc.instagramFollowers || "Belirtilmedi"}
- Aylik Butce: ${bc.monthlyBudget || "Belirtilmedi"}
- Isletme Asamasi: ${bc.businessStage || "Belirtilmedi"}
- Basvuru Nedeni: ${bc.triggerReason || "Belirtilmedi"}
` : "";
  const budgetCalibration = bc?.monthlyBudget ? `
12. BUTCE KALIBRASYONU: Musterinin aylik butcesi "${bc.monthlyBudget}" olarak belirtilmis. actionPlan'daki TUM onerileri bu butceye uygun olacak sekilde kalibre et. Butceyi asan oneriler YAPMA. Ornegin: "starter" (0-5K TL) butce icin "profesyonel video produksiyon" ONERME, bunun yerine "smartphone ile cekilen UGC icerik" gibi butce-uyumlu alternatifler sun.` : "";
  const stageCalibration = bc?.businessStage ? `
13. ISLETME ASAMASI KALIBRASYONU: Isletme "${bc.businessStage}" asamasinda. actionPlan'daki "owner" alanlarini buna gore ayarla \u2014 yeni/"idea" asamasindaki isletmeler icin "Isletme sahibi" veya "Freelancer" yaz, buyuyen/yerlesik isletmeler icin "Sosyal medya yoneticisi", "Icerik ekibi" gibi pozisyonlar kullanabilirsin. Ayrica strateji onerileri isletmenin olgunluk seviyesine uygun olmali.` : "";
  const digitalCalibration = bc?.digitalPresence ? `
14. DIJITAL VARLIK KALIBRASYONU: Musterinin aktif oldugu platformlar: ${bc.digitalPresence.join(", ")}. ${bc.digitalPresence.includes("none") ? "Musteri HICBIR platformda aktif DEGIL \u2014 actionPlan sifirdan dijital varlik olusturmaya odaklanmali." : `Mevcut platformlari OPTIMIZE etme onerileri on planda olmali, yeni platform onerileri ikincil kalmali.`}` : "";
  const triggerCalibration = bc?.triggerReason ? `
15. TETIKLEYICI NEDEN ONCELIKLENDIRMESI: Musterinin basvuru nedeni "${bc.triggerReason}". actionPlan'in "immediate" fazini bu nedene dogrudan cevap verecek sekilde onceliklendir. Ornegin: "sales_drop" \u2192 satis artirici aksiyonlar once, "launch" \u2192 marka bilinirlik aksiyonlari once, "rebrand" \u2192 kimlik yenileme aksiyonlari once.` : "";
  const prompt = `Sen bir marka stratejisi basparlak direktorsun (CSO). ${debateInstruction}

## Isletme Profili
- Isletme: ${normalizedData.businessName}
- Sektor: ${normalizedData.sector}
- Genel Profil: ${normalizedData.overallProfile}
- Veri Kalitesi: ${normalizedData.dataQualityScore}
- Tespit Edilen Oruntular: ${normalizedData.detectedPatterns.join("; ") || "Yok"}
${businessContextSection}
## Uzman Gorusleri
${strategistSummary}
${competitiveMapSummary}
${challengerSummary}
${blogAdvisorSummary}
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
   - "strengths" \u2014 hangi anket cevabi veya veri bunu destekliyor?
   - "opportunities" \u2014 hangi rakibin hangi acigi, hangi pazar trendi?
   - "challenges" \u2014 hangi pazar kosulu, hangi rakip tehdidi?

11. DAHILI JARGON YASAK \u2014 Bu rapor MUSTERIYE gosterilecek. Asagidaki terimleri KESINLIKLE KULLANMA:
   - "wizard", "wizard-anketi", "wizard-anketindeki", "score", "score1", "score2", "score3" \u2192 YERINE: "Ankete verdiginiz yanita gore..." veya "Degerlendirilme formundaki yanitlariniza gore..."
   - "agent", "pipeline", "multi-agent", "dataNormalizer", "brandStrategist", "brandChallenger", "blogAdvisor", "synthesizer" \u2192 HICBIRINI KULLANMA
   - "prompt", "LLM", "Gemini", "AI modeli" \u2192 KULLANMA
   - Dahili teknik referanslar yerine DOGAL bir dil kullan: "Analizimiz sonucunda...", "Degerlendirmemize gore..."

4. "positioning.competitiveLandscape" ISIMLI RAKIPLERLE pazar haritasi cikaracak.

5. "actionPlan" her fazda EN AZ 2, EN FAZLA 4 aksiyon icermeli. Her aksiyonun "metric" alani OLCULEBILIR olmali.

6. "brandPersonality.archetype" seciminde her iki uzmanin da goruslerini dikkate al.

7. "visualWorld.colorPalette" tam olarak 4 renk icermeli: primary, secondary, accent ve neutral.

8. ${challengerOutput ? "Her iki uzmanin goruslerini referans goster." : "Strateji uzmaninin onerisini nasil rafine ettigini acikla."}

9. Tum metinler TURKCE olmali.
10. Sadece JSON don, baska bir sey yazma.${budgetCalibration}${stageCalibration}${digitalCalibration}${triggerCalibration}`;
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
    () => runBrandStrategist(normalizedData, researchFindings, input.businessContext),
    state,
    true
  );
  if (!strategistOutput) {
    throw new Error("Brand strategist failed \u2014 pipeline cannot continue");
  }
  state.strategistOutput = strategistOutput;
  let challengerOutput = null;
  let blogAdvisorOutput = null;
  if (!isLite && remainingTime(startTime) > 22e3) {
    const [challResult, blogResult] = await Promise.all([
      runAgent(
        "brandChallenger",
        () => runBrandChallenger(normalizedData, researchFindings, strategistOutput),
        state,
        false
      ),
      runAgent(
        "blogStrategyAdvisor",
        () => runBlogStrategyAdvisor(normalizedData, researchFindings, strategistOutput),
        state,
        false
      )
    ]);
    challengerOutput = challResult;
    blogAdvisorOutput = blogResult;
  } else if (!isLite) {
    console.log("Skipping challenger + blog advisor: not enough time remaining");
    state.errors.push({
      agent: "brandChallenger",
      error: "Skipped due to timeout budget",
      timestamp: Date.now()
    });
  }
  state.challengerOutput = challengerOutput ?? void 0;
  state.blogAdvisorOutput = blogAdvisorOutput ?? void 0;
  let synthesizedAnalysis = null;
  if (remainingTime(startTime) > 8e3) {
    synthesizedAnalysis = await runAgent(
      "strategySynthesizer",
      () => runStrategySynthesizer(normalizedData, researchFindings, strategistOutput, challengerOutput, blogAdvisorOutput, input.businessContext),
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
  extractResearchJSON,
  pollDeepResearch,
  runBlogStrategyAdvisor,
  runBrandChallenger,
  runBrandStrategist,
  runDataNormalizer,
  runPipeline,
  runSectorResearch,
  runStrategySynthesizer,
  startDeepResearch
};
