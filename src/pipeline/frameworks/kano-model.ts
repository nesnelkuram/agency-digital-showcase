// Kano Model — Feature/Value Classification
// Must-have → Performance → Delighter

export interface KanoClassification {
  mustHave: Array<{ feature: string; currentState: 'present' | 'missing' | 'partial'; impact: string }>;
  performance: Array<{ feature: string; currentLevel: string; targetLevel: string; impact: string }>;
  delighter: Array<{ feature: string; description: string; surpriseFactor: string }>;
  indifferent: Array<{ feature: string; reason: string }>; // Features nobody cares about
  reverse: Array<{ feature: string; whyHarmful: string }>; // Features that actively hurt
}

export const KANO_PROMPT_SNIPPET = `
## Kano Model — Değer Önerisi Sınıflandırması
Markanın her değer faktörünü 5 kategoriye ayır:

**1. Olmazsa Olmaz (Must-have):** Yokluğu müşteriyi KAÇIRIR ama varlığı memnuniyet ARTIRMAZ
   - Örnek: Otel temizliği, restoran hijyeni, web sitesinin çalışması
   - Durum: present/missing/partial — eksik olanlar KRİTİK

**2. Performans (Performance):** Ne kadar çoksa o kadar iyi — doğrusal memnuniyet
   - Örnek: Hız, fiyat, çeşitlilik, kalite seviyesi
   - Hedef: Sektör ortalamasının ÜSTÜNDE konumlan

**3. Heyecan Verici (Delighter):** Beklenmeyen SÜRPRIZ — yokluğu sorun değil ama varlığı "vay!" dedirtir
   - Örnek: Kişiselleştirilmiş not, beklenmedik hediye, sıra dışı deneyim
   - BU KATEGORİ rekabetten ayrışmanın ANAHTARI

**4. İlgisiz (Indifferent):** Müşterinin umursamadığı — kaynak israfı
   - Bunlara yatırım YAPMA

**5. Ters Etki (Reverse):** Bazı müşterileri UZAKLAŞTIRAN özellikler
   - Örnek: Aşırı iletişim (spam), zorla upsell, gizli ücretler
`;
