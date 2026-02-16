import type { VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { withAuthOptional, OptionalAuthRequest } from './_lib/withAuth';

// Question ID → { question text, answer options } per sector
// IDs: 3,4,5 (Stage 0), 9,10,11 (Stage 1), 15,16,17 (Stage 2), 21,22,23 (Stage 3), 27,28,29 (Stage 4)
const QUESTION_MAP: Record<string, Record<string, { question: string; options: Record<string, string> }>> = {
  fmcg: {
    '3': { question: 'Uretim Tutarliligi', options: { varies: 'Her parti farkli', similar: 'Benzer ama degisken', mostly_stable: 'Buyuk olcude sabit', certified: 'Sertifikali kalite kontrol', other: 'Diger' } },
    '4': { question: 'Yogun Donem Kapasitesi', options: { collapses: 'Yetersiz kaliyor', struggling: 'Zorlaniyor', mostly_holds: 'Cogunlukla karsiliyor', planned: 'Planli kapasite', other: 'Diger' } },
    '5': { question: 'Talep Artisi Kapasitesi', options: { cannot: 'Karsilayamayiz', partially: 'Kismen karsilariz', yes: 'Evet, karsilariz', other: 'Diger' } },
    '9': { question: 'Kayip Duygusu', options: { trust: 'Guven', nostalgia: 'Nostalji', discovery: 'Kesif', health: 'Saglikli yasam', pride: 'Gurur', other: 'Diger' } },
    '10': { question: 'Deneyim Seviyesi', options: { basic: 'Temel ihtiyac', quality_story: 'Kalite + Hikaye', lifestyle: 'Yasam tarzi', other: 'Diger' } },
    '11': { question: 'Urun Felsefesi', options: { traditional: 'Geleneksel', modern_craft: 'Modern zanaat', innovative: 'Yenilikci', clean_label: 'Temiz etiket', other: 'Diger' } },
    '15': { question: 'Kriz Tepkisi', options: { compensate: 'Hemen telafi eder', defend: 'Kalite standardini savunur', explain: 'Seffaf aciklama yapar', challenge: 'Kanit ister', redesign: 'Sureci yeniden tasarlar', other: 'Diger' } },
    '16': { question: 'Ikna Yontemi', options: { consistency: 'Tutarlilik', origin: 'Kaynak hikayesi', certification: 'Sertifika ve test', community: 'Topluluk gucu', other: 'Diger' } },
    '17': { question: 'Iletisim Tonu', options: { minimal: 'Minimal', warm: 'Samimi', expert: 'Uzman', provocative: 'Cesur', other: 'Diger' } },
    '21': { question: 'En Zararli Tuketici Tipi', options: { price_only: 'Sadece fiyat odakli', disloyal: 'Kampanya bagimlisi', trend_chaser: 'Trend takipcisi', copycat_buyer: 'Market markasi tercihcisi', misinformed: 'Yanlis bilgilenmis', other: 'Diger' } },
    '22': { question: 'Sorun Tipi', options: { margin: 'Kar marji', perception: 'Marka algisi', instability: 'Talep istikrarsizligi', other: 'Diger' } },
    '23': { question: 'Yaklasim Tavri', options: { positioning: 'Konumlandirma ile filtreleme', channel: 'Kanal stratejisi', product_line: 'Urun hatti ayrimi', other: 'Diger' } },
    '27': { question: 'Birincil Hedef', options: { awareness: 'Marka bilinirigi', shelf_share: 'Raf payi', premium: 'Premium algi', loyalty: 'Tuketici sadakati', other: 'Diger' } },
    '28': { question: 'Buyume Hizi', options: { fast: 'Hizli penetrasyon', balanced: 'Dengeli buyume', niche: 'Nis derinlesme', other: 'Diger' } },
    '29': { question: 'Basari Isareti', options: { distribution: 'Dagitim genisligi', repeat_purchase: 'Tekrar satin alma', price_premium: 'Fiyat primi', category_leader: 'Kategori liderligi', export: 'Ihracat', other: 'Diger' } },
  },
  gastronomi: {
    '3': { question: 'Deneyim Tutarliligi', options: { varies: 'Kisiye gore degisiyor', similar: 'Benzer ama degisken', mostly_stable: 'Buyuk olcude sabit', sop_defined: 'SOP ile net', other: 'Diger' } },
    '4': { question: 'Pik Saat Dayanikliligi', options: { collapses: 'Cokuyor', struggling: 'Zorlaniyor', mostly_holds: 'Cogunlukla korunuyor', measured: 'Olcumlu sekilde korunuyor', other: 'Diger' } },
    '5': { question: 'Talep Artisi Kapasitesi', options: { cannot: 'Karsilayamayiz', partially: 'Kismen karsilariz', yes: 'Evet, karsilariz', other: 'Diger' } },
    '9': { question: 'Kayip Duygusu', options: { trust: 'Guven', curiosity: 'Merak', prestige: 'Prestij', warmth: 'Sicaklik', courage: 'Cesaret', other: 'Diger' } },
    '10': { question: 'Deneyim Seviyesi', options: { food_only: 'Yemek', food_ritual: 'Yemek + Ritual', full_journey: 'Bastan sona sahnelenmis yolculuk', other: 'Diger' } },
    '11': { question: 'Yorum Seviyesi', options: { authentic: 'Otantik', respectful: 'Saygili yorum', radical: 'Radikal', rewrite: 'Yeniden yazim', other: 'Diger' } },
    '15': { question: 'Kriz Tepkisi', options: { compensate: 'Telafi eder', defend: 'Standardi savunur', explain: 'Aciklar', challenge: 'Meydan okur', redesign: 'Yeniden tasarlar', other: 'Diger' } },
    '16': { question: 'Ikna Yontemi', options: { sop: 'SOP (Standart)', reference: 'Referans', knowledge: 'Bilgi', influence: 'Etki', other: 'Diger' } },
    '17': { question: 'Iletisim Tonu', options: { minimal: 'Minimal', prestigious: 'Prestijli', warm: 'Samimi', provocative: 'Provokatif', other: 'Diger' } },
    '21': { question: 'En Zararli Kitle', options: { price_focused: 'Fiyat odakli', closed_innovation: 'Yenilige kapali', show_off: 'Gosterisci', operation_disruptor: 'Operasyon bozucu', atmosphere_disruptor: 'Atmosfer bozucu', other: 'Diger' } },
    '22': { question: 'Sorun Tipi', options: { profitability: 'Karlilik', culture: 'Kultur', flow: 'Akis', other: 'Diger' } },
    '23': { question: 'Yaklasim Tavri', options: { soft: 'Nazik eleme', barrier: 'Bariyer', hard_no: 'Net red', other: 'Diger' } },
    '27': { question: 'Birincil Hedef', options: { awareness: 'Bilinirlik', prestige: 'Prestij', authority: 'Otorite', reservation: 'Rezervasyon', other: 'Diger' } },
    '28': { question: 'Buyume Hizi', options: { fast: 'Hizli', balanced: 'Dengeli', exclusive: 'Seckin', other: 'Diger' } },
    '29': { question: 'Basari Isareti', options: { occupancy: 'Doluluk', price_acceptance: 'Fiyat sorgusu azalmasi', quality_guest: 'Nitelikli misafir', guide_media: 'Rehber/Medya', loyalty: 'Sadakat', other: 'Diger' } },
  },
  retail: {
    '3': { question: 'Kanal Tutarliligi', options: { inconsistent: 'Tamamen farkli', somewhat: 'Kismen benzer', mostly: 'Buyuk olcude tutarli', unified: 'Tam entegre (omnichannel)', other: 'Diger' } },
    '4': { question: 'Yogun Donem Dayanikliligi', options: { collapses: 'Cokuyor', struggling: 'Zorlaniyor', mostly_holds: 'Cogunlukla dayaniyor', thrives: 'Guclenerek cikiyor', other: 'Diger' } },
    '5': { question: 'Talep Artisi Kapasitesi', options: { cannot: 'Karsilayamayiz', partially: 'Kismen karsilariz', yes: 'Evet, karsilariz', other: 'Diger' } },
    '9': { question: 'Kayip Duygusu', options: { discovery: 'Kesif', quality: 'Kalite guvencesi', status: 'Statu', trust: 'Guven', convenience: 'Kolaylik', other: 'Diger' } },
    '10': { question: 'Deneyim Seviyesi', options: { product_only: 'Urun', product_experience: 'Urun + Deneyim', full_journey: 'Bastan sona sahnelenmis yolculuk', other: 'Diger' } },
    '11': { question: 'Fiyat-Deger Konumlandirmasi', options: { affordable: 'Uygun fiyat', value: 'Kalite-fiyat dengesi', premium: 'Premium', luxury: 'Luks', other: 'Diger' } },
    '15': { question: 'Kriz Tepkisi', options: { compensate: 'Hemen telafi eder', defend: 'Politikayi uygular', explain: 'Durumu aciklar', challenge: 'Meydan okur', redesign: 'Cozum uretir', other: 'Diger' } },
    '16': { question: 'Ikna Yontemi', options: { consistency: 'Tutarlilik', social_proof: 'Sosyal kanit', expertise: 'Uzmanlik', emotion: 'Duygusal bag', other: 'Diger' } },
    '17': { question: 'Iletisim Tonu', options: { minimal: 'Minimal', prestigious: 'Prestijli', warm: 'Samimi', provocative: 'Provokatif', other: 'Diger' } },
    '21': { question: 'En Zararli Musteri Tipi', options: { serial_returner: 'Seri iade yapan', discount_only: 'Sadece indirim avcisi', theft_risk: 'Hirsizlik/dolandiricilik riski', time_waster: 'Zaman harcayan', brand_damager: 'Marka imajini bozan', other: 'Diger' } },
    '22': { question: 'Sorun Tipi', options: { profitability: 'Karlilik', culture: 'Marka kulturu', operations: 'Operasyon', other: 'Diger' } },
    '23': { question: 'Yaklasim Tavri', options: { soft: 'Nazik yonlendirme', barrier: 'Sistem bariyeri', hard_no: 'Net sinir', other: 'Diger' } },
    '27': { question: 'Birincil Hedef', options: { awareness: 'Bilinirlik', revenue: 'Ciro artisi', market_share: 'Pazar payi', loyalty: 'Musteri sadakati', other: 'Diger' } },
    '28': { question: 'Buyume Hizi', options: { fast: 'Hizli', balanced: 'Dengeli', slow_premium: 'Yavas ama degerli', other: 'Diger' } },
    '29': { question: 'Basari Isareti', options: { revenue_growth: 'Ciro artisi', basket_average: 'Sepet ortalamasi yukselisi', repeat_visit: 'Tekrar ziyaret', brand_recognition: 'Marka bilinirigi', other: 'Diger' } },
  },
  corporate: {
    '3': { question: 'Hizmet Teslimat Tutarliligi', options: { varies: 'Kisiye gore degisiyor', similar: 'Benzer ama degisken', mostly_stable: 'Buyuk olcude sabit', sop_defined: 'SOP ile net', other: 'Diger' } },
    '4': { question: 'Proje Yogunlugu Yonetimi', options: { collapses: 'Cokuyor', struggling: 'Zorlaniyor', mostly_holds: 'Cogunlukla korunuyor', measured: 'Olcumlu sekilde korunuyor', other: 'Diger' } },
    '5': { question: 'Is Hacmi Artisi Kapasitesi', options: { cannot: 'Karsilayamayiz', partially: 'Kismen karsilariz', yes: 'Evet, karsilariz', other: 'Diger' } },
    '9': { question: 'Kayip Duygusu', options: { trust: 'Guvenilirlik', innovation: 'Yenilikcilik', prestige: 'Prestij', partnership: 'Ortaklik', expertise: 'Uzmanlik', other: 'Diger' } },
    '10': { question: 'Hizmet Deneyim Seviyesi', options: { technical_solution: 'Teknik Cozum', solution_consulting: 'Cozum + Danismanlik', strategic_partnership: 'Stratejik Ortaklik', other: 'Diger' } },
    '11': { question: 'Yaklasim Stili', options: { traditional: 'Geleneksel', modern_twist: 'Modern yorumlu', radical: 'Radikal donusum', pioneer: 'Sektor oncusu', other: 'Diger' } },
    '15': { question: 'Kriz Tepkisi', options: { compensate: 'Telafi eder', defend: 'Sureci savunur', explain: 'Analiz eder ve aciklar', challenge: 'Beklentiyi sorgular', redesign: 'Yeniden tasarlar', other: 'Diger' } },
    '16': { question: 'Ikna Yontemi', options: { process: 'Surec ve metodoloji', reference: 'Referans ve sonuclar', knowledge: 'Bilgi ve uzmanlik', relationship: 'Iliski ve guven', other: 'Diger' } },
    '17': { question: 'Iletisim Tonu', options: { authoritative: 'Otoriter ve guvenli', consultative: 'Danisman ve yonlendirici', warm_professional: 'Samimi ama profesyonel', provocative: 'Provokatif ve dusundurcu', other: 'Diger' } },
    '21': { question: 'En Zararli Paydas Tipi', options: { price_hunter: 'Fiyat avcisi', scope_creep: 'Scope creep yapan', indecisive: 'Karar veremeyen', micromanager: 'Mikro yonetici', blame_shifter: 'Suc atan', other: 'Diger' } },
    '22': { question: 'Sorun Tipi', options: { profitability: 'Karlilik', culture: 'Sirket kulturu', quality: 'Teslimat kalitesi', reputation: 'Itibar', other: 'Diger' } },
    '23': { question: 'Yaklasim Tavri', options: { soft: 'Nazik yonlendirme', barrier: 'Bariyer sistemi', hard_no: 'Net red', other: 'Diger' } },
    '27': { question: 'Birincil Hedef', options: { authority: 'Sektor otoritesi', volume: 'Is hacmi buyutme', premium: 'Premium konumlanma', talent: 'Yetenek cekimi', other: 'Diger' } },
    '28': { question: 'Buyume Hizi', options: { aggressive: 'Agresif', balanced: 'Dengeli', selective: 'Secici', other: 'Diger' } },
    '29': { question: 'Basari Isareti', options: { contract_value: 'Sozlesme degeri', referral_rate: 'Referans orani', awards: 'Sektor odulleri', executive_recognition: 'Yonetim kadrosu tanirliligi', renewal_rate: 'Sozlesme yenileme orani', other: 'Diger' } },
  },
  tech: {
    '3': { question: 'Deneyim Tutarliligi', options: { inconsistent: 'Cihaza gore degisiyor', mostly_similar: 'Benzer ama degisken', largely_stable: 'Buyuk olcude sabit', design_system: 'Design system ile kontrollu', other: 'Diger' } },
    '4': { question: 'Yogunluk/Olceklenme Dayanikliligi', options: { crashes: 'Cokuyor', degrades: 'Belirgin yavasama', mostly_holds: 'Cogunlukla dayaniyor', resilient: 'Olcumlu sekilde dayanikli', other: 'Diger' } },
    '5': { question: '10x Buyume Kapasitesi', options: { cannot: 'Karsilayamayiz', partially: 'Kismen karsilariz', ready: 'Evet, haziriz', other: 'Diger' } },
    '9': { question: 'Kayip Duygusu', options: { innovation: 'Inovasyon', reliability: 'Guvenilirlik', speed: 'Hiz', simplicity: 'Sadelik', empowerment: 'Guclenme', other: 'Diger' } },
    '10': { question: 'Deneyim Seviyesi', options: { function_only: 'Fonksiyon', function_ux: 'Fonksiyon + UX', full_ecosystem: 'Tam ekosistem', other: 'Diger' } },
    '11': { question: 'Teknoloji Yaklasimi', options: { proven: 'Kanitlanmis', modern: 'Modern', experimental: 'Deneysel', pioneer: 'Oncu', other: 'Diger' } },
    '15': { question: 'Kriz Tepkisi', options: { transparent: 'Seffaf paylasum', compensate: 'Telafi eder', defend: 'Standardi savunur', innovate: 'Cozumle gelir', challenge: 'Meydan okur', other: 'Diger' } },
    '16': { question: 'Ikna Yontemi', options: { data: 'Veriyle', social_proof: 'Sosyal kanitla', product_led: 'Urunle', vision: 'Vizyonla', other: 'Diger' } },
    '17': { question: 'Iletisim Tonu', options: { technical: 'Teknik', friendly: 'Samimi', authoritative: 'Otoriter', provocative: 'Provokatif', other: 'Diger' } },
    '21': { question: 'En Zararli Kullanici Tipi', options: { freeloader: 'Bedavaci', feature_requester: 'Ozellik talep bombardimani', support_abuser: 'Destek istismarcisi', churn_risk: 'Churn riski yuksek', scope_creep: 'Kapsam genisletici', other: 'Diger' } },
    '22': { question: 'Sorun Tipi', options: { unit_economics: 'Birim ekonomi', product_focus: 'Urun odagi kaybi', team_morale: 'Ekip morali', brand_dilution: 'Marka sulanmasi', other: 'Diger' } },
    '23': { question: 'Filtreleme Yaklasimi', options: { soft: 'Nazik yonlendirme', pricing: 'Fiyatlandirma bariyeri', qualification: 'Kullanici kalifikasyonu', other: 'Diger' } },
    '27': { question: 'Birincil Hedef', options: { user_base: 'Kullanici tabani buyutme', mrr_arr: 'MRR/ARR artisi', market_leadership: 'Pazar liderligi', pmf: 'Urun-pazar uyumu (PMF)', other: 'Diger' } },
    '28': { question: 'Buyume Hizi', options: { blitzscale: 'Blitzscaling', sustainable: 'Surdurulebilir', bootstrapped: 'Organik / Bootstrap', other: 'Diger' } },
    '29': { question: 'Basari Isareti', options: { dau_mau: 'DAU/MAU orani', churn_reduction: 'Churn dususu', nps: 'NPS skoru', funding: 'Yatirim turu', revenue_milestone: 'Gelir esigi', other: 'Diger' } },
  },
  health: {
    '3': { question: 'Deneyim Tutarliligi', options: { varies: 'Kisiye gore degisiyor', similar: 'Benzer ama degisken', mostly_stable: 'Buyuk olcude sabit', sop_defined: 'Protokollerle net', other: 'Diger' } },
    '4': { question: 'Yogun Donem Dayanikliligi', options: { collapses: 'Cokuyor', struggling: 'Zorlaniyor', mostly_holds: 'Cogunlukla korunuyor', measured: 'Olcumlu sekilde korunuyor', other: 'Diger' } },
    '5': { question: 'Talep Artisi Kapasitesi', options: { cannot: 'Karsilayamayiz', partially: 'Kismen karsilariz', yes: 'Evet, karsilariz', other: 'Diger' } },
    '9': { question: 'Kayip Duygusu', options: { safety: 'Guvenlik', expertise: 'Uzmanlik', compassion: 'Sefkat', hope: 'Umut', trust: 'Guven', other: 'Diger' } },
    '10': { question: 'Deneyim Seviyesi', options: { treatment_only: 'Tedavi', treatment_care: 'Tedavi + Bakim', holistic_journey: 'Butunsel saglik yolculugu', other: 'Diger' } },
    '11': { question: 'Yaklasim Stili', options: { traditional: 'Geleneksel tip', integrative: 'Entegratif yaklasim', innovative: 'Yenilikci', pioneer: 'Oncu', other: 'Diger' } },
    '15': { question: 'Kriz Tepkisi', options: { compensate: 'Telafi eder', defend: 'Protokolu savunur', explain: 'Egitir', innovate: 'Alternatif sunar', challenge: 'Beklenti yonetimi yapar', other: 'Diger' } },
    '16': { question: 'Ikna Yontemi', options: { evidence: 'Kanit', reference: 'Referans', empathy: 'Empati', technology: 'Teknoloji', other: 'Diger' } },
    '17': { question: 'Iletisim Tonu', options: { clinical: 'Klinik & profesyonel', warm: 'Sicak & empatik', educational: 'Egitici & bilgilendirici', motivational: 'Motive edici & ilham verici', other: 'Diger' } },
    '21': { question: 'En Zararli Danisan Tipi', options: { dr_google: 'Dr. Google', price_only: 'Sadece fiyat arayan', non_compliant: 'Tedaviye uymayan', chronic_complainer: 'Surekli sikayetci', miracle_seeker: 'Mucize bekleyen', other: 'Diger' } },
    '22': { question: 'Sorun Tipi', options: { reputation: 'Itibar', team_morale: 'Ekip morali', operational: 'Operasyonel', other: 'Diger' } },
    '23': { question: 'Yaklasim Tavri', options: { education: 'Egitim ile yonlendirme', filtering: 'On filtreleme', referral: 'Yonlendirme', other: 'Diger' } },
    '27': { question: 'Birincil Hedef', options: { trust: 'Guvenilirlik', volume: 'Hasta hacmi', authority: 'Uzmanlik otoritesi', digital: 'Dijital saglik', other: 'Diger' } },
    '28': { question: 'Buyume Hizi', options: { aggressive: 'Agresif', balanced: 'Dengeli', selective: 'Secici', other: 'Diger' } },
    '29': { question: 'Basari Isareti', options: { satisfaction: 'Hasta memnuniyeti', occupancy: 'Randevu doluluk orani', referral: 'Referans orani', accreditation: 'Akreditasyon & oduller', retention: 'Hasta sadakati', other: 'Diger' } },
  },
  education: {
    '3': { question: 'Egitim Deneyimi Tutarliligi', options: { varies: 'Egitmene gore degisiyor', similar: 'Benzer ama degisken', mostly_stable: 'Buyuk olcude sabit', sop_defined: 'Standartlarla net', other: 'Diger' } },
    '4': { question: 'Yogun Donem Dayanikliligi', options: { collapses: 'Cokuyor', struggling: 'Zorlaniyor', mostly_holds: 'Cogunlukla korunuyor', measured: 'Olcumlu sekilde korunuyor', other: 'Diger' } },
    '5': { question: 'Talep Artisi Kapasitesi', options: { cannot: 'Karsilayamayiz', partially: 'Kismen karsilariz', yes: 'Evet, karsilariz', other: 'Diger' } },
    '9': { question: 'Kayip Duygusu', options: { growth: 'Gelisim', trust: 'Guven', belonging: 'Aidiyet', mastery: 'Ustalik', inspiration: 'Ilham', other: 'Diger' } },
    '10': { question: 'Deneyim Seviyesi', options: { knowledge_transfer: 'Bilgi Aktarimi', knowledge_mentoring: 'Bilgi + Mentorluk', full_transformation: 'Tam Donusum Yolculugu', other: 'Diger' } },
    '11': { question: 'Yaklasim Stili', options: { classic: 'Klasik', modern: 'Modern', experimental: 'Deneysel', revolutionary: 'Devrimci', other: 'Diger' } },
    '15': { question: 'Kriz Tepkisi', options: { compensate: 'Telafi eder', defend: 'Standardi savunur', explain: 'Veriyle aciklar', challenge: 'Meydan okur', redesign: 'Yeniden tasarlar', other: 'Diger' } },
    '16': { question: 'Ikna Yontemi', options: { results: 'Sonuclarla', reference: 'Referansla', knowledge: 'Bilgiyle', experience: 'Deneyimle', other: 'Diger' } },
    '17': { question: 'Iletisim Tonu', options: { authoritative: 'Otoriter', inspiring: 'Ilham verici', warm: 'Samimi', provocative: 'Provokatif', other: 'Diger' } },
    '21': { question: 'En Zararli Katilimci Tipi', options: { certificate_hunter: 'Sertifika avcisi', unmotivated: 'Motivasyonsuz', chronic_complainer: 'Surekli sikayetci', payment_issue: 'Odeme sorunu olan', disruptive: 'Sinif duzeni bozucu', other: 'Diger' } },
    '22': { question: 'Sorun Tipi', options: { quality: 'Egitim kalitesi dususu', reputation: 'Itibar kaybi', financial: 'Finansal kayip', culture: 'Kurum kulturu erozyonu', other: 'Diger' } },
    '23': { question: 'Yaklasim Tavri', options: { soft: 'Nazik yonlendirme', barrier: 'Bariyer sistemi', hard_no: 'Net kural', other: 'Diger' } },
    '27': { question: 'Birincil Hedef', options: { student_count: 'Ogrenci sayisi', education_quality: 'Egitim kalitesi', sector_authority: 'Sektor otoritesi', digital_transformation: 'Dijital donusum', other: 'Diger' } },
    '28': { question: 'Buyume Hizi', options: { fast: 'Hizli', balanced: 'Dengeli', selective: 'Seckin', other: 'Diger' } },
    '29': { question: 'Basari Isareti', options: { graduate_success: 'Mezun basarisi', enrollment_rate: 'Kayit doluluk orani', nps: 'NPS (Tavsiye Skoru)', accreditation: 'Akreditasyon ve sertifikasyon', other: 'Diger' } },
  },
};

const STAGE_NAMES = [
  'Operasyonel Gerceklik',
  'Marka Ruhu',
  'Marka Karakteri',
  'Kim Degiliz',
  'Hedef ve Basari',
];

// Question IDs grouped by stage
const STAGE_QUESTION_IDS: number[][] = [
  [3, 4, 5],
  [9, 10, 11],
  [15, 16, 17],
  [21, 22, 23],
  [27, 28, 29],
];

export default withAuthOptional(async (req: OptionalAuthRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  try {
    const { contact, sector, wizard, requestedServices } = req.body;

    if (!contact || !sector || !wizard) {
      return res.status(400).json({ error: 'Missing required fields: contact, sector, wizard' });
    }

    const client = new GoogleGenAI({ apiKey });

    const prompt = buildPrompt(contact, sector, wizard, requestedServices);

    const result = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const responseText = result.text ?? '';
    if (!responseText) {
      throw new Error('Gemini returned empty response');
    }
    const analysis = JSON.parse(responseText);

    return res.status(200).json({ success: true, analysis });
  } catch (error: any) {
    console.error('Gemini analysis error:', error);
    return res.status(500).json({ error: error.message || 'Analysis failed' });
  }
});

function buildPrompt(
  contact: { name: string; businessName: string; email: string },
  sector: string,
  wizard: { answers: Record<string, string>; scores: Record<string, number>; stageResults: any[] },
  requestedServices: { id: string; title: string }[]
): string {
  const stageResultsSummary = (wizard.stageResults || [])
    .map((s: any) => `- ${s.title}: ${s.description} (Skor: ${s.score})`)
    .join('\n');

  const sectorMap = QUESTION_MAP[sector];

  // Build detailed Q&A grouped by stage
  const detailedQA = STAGE_QUESTION_IDS.map((qIds, stageIdx) => {
    const stageName = STAGE_NAMES[stageIdx];
    const qaPairs = qIds.map((qId) => {
      const qIdStr = String(qId);
      const rawAnswer = wizard.answers?.[qIdStr];
      if (!rawAnswer) return null;

      const qInfo = sectorMap?.[qIdStr];
      const questionText = qInfo?.question || `Soru ${qIdStr}`;
      const answerLabel = qInfo?.options?.[rawAnswer] || rawAnswer;

      return `  - ${questionText}: ${answerLabel}`;
    }).filter(Boolean);

    if (qaPairs.length === 0) return null;
    return `### ${stageIdx}. ${stageName}\n${qaPairs.join('\n')}`;
  }).filter(Boolean).join('\n\n');

  // Build scores with question names
  const scoresSummary = Object.entries(wizard.scores || {}).map(([qId, score]) => {
    const qInfo = sectorMap?.[qId];
    const questionText = qInfo?.question || `Soru ${qId}`;
    return `  - ${questionText}: ${score}`;
  }).join('\n');

  const servicesList = (requestedServices || [])
    .map((s: { title: string }) => s.title)
    .join(', ');

  return `Sen deneyimli bir marka stratejisti ve kreatif direktorsun. Asagidaki marka degerlendirme verisini analiz et ve detayli bir marka stratejisi raporu olustur.

## Basvuru Bilgileri
- Isletme: ${contact.businessName}
- Yetkili: ${contact.name}
- Sektor: ${sector}
- Talep Edilen Hizmetler: ${servicesList}

## Wizard Asama Sonuclari
${stageResultsSummary}

## Detayli Soru-Cevaplar
${detailedQA}

## Skorlar
${scoresSummary}

---

Yukaridaki verilere dayanarak asagidaki JSON formatinda bir analiz uret. Tum icerikler TURKCE olmali.

{
  "brandPersonality": {
    "archetype": "Jung arketiplerinden biri (ornegin: Bakim Veren, Kral, Bilge, Asi, Yaratici, Kahraman, Sihirbaz, Asik, Soytari, Masum, Kasif, Siradan Adam)",
    "traits": ["3-5 adet marka kisilik ozelligi"],
    "tone": "Markanin iletisim tonu (ornegin: Sicak ve samimi, Uzman ve guvenilir)",
    "voice": "Markanin sesi (ornegin: Bilgili ama ukala olmayan, Yenilikci ama koklerinden kopuk olmayan)"
  },
  "visualWorld": {
    "moodKeywords": ["5-7 adet gorsel dunya anahtar kelimesi"],
    "colorPalette": [
      { "hex": "#hexkod", "name": "Renk adi", "usage": "primary" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "secondary" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "accent" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "neutral" }
    ],
    "typographyStyle": "Tipografi stili onerisi",
    "imageryStyle": "Fotograf ve gorsel icerik stili"
  },
  "contentStrategy": {
    "pillars": ["4-6 adet icerik sutunu"],
    "toneGuidelines": ["3-4 adet ton rehberi kurali"],
    "keyMessages": ["3-5 adet anahtar mesaj"],
    "hashtags": ["5-8 adet hashtag onerisi"]
  },
  "analysis": {
    "strengths": ["3-4 adet guclu yan"],
    "opportunities": ["3-4 adet firsat"],
    "challenges": ["2-3 adet zorluk"],
    "recommendations": ["4-6 adet stratejik oneri"]
  }
}

ONEMLI:
- Sadece JSON don, baska bir sey yazma
- Tum metinler Turkce olmali
- Renk kodlari gercekci ve sektore uygun olmali
- Oneriler somut ve uygulanabilir olmali
- Isletmenin sektorunu ve verdigi cevaplari dikkate al`;
}
