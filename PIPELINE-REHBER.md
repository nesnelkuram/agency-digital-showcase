# intiba Multi-Agent Pipeline Rehberi

> Pipeline v3.4.0 — Bu dokuman, kullanicinin form doldurmasindan raporun ekrana gelmesine kadar her adimi, "bir cocuga anlatir gibi" aciklar.

---

## Buyuk Resim: Ne Oluyor?

Bir musteri adayi (lead) web sitemizdeki formu dolduruyor. Admin panelinde "Analiz Et" butonuna bastiginda, **9 farkli yapay zeka ajani** sirayla ve paralel olarak calisiyor. Her biri farkli bir ise bakiyor: biri veriyi duzenliyor, biri internette arastirma yapiyor, biri strateji kuruyor, biri o stratejiyi elestiriyor, biri blog felsefesiyle kiyasliyor, biri web sitesini inceliyor, biri rakipleri kesiyor, biri hepsini birlestiriyor, biri de acilis konusmasi yaziyor.

Sonucta ortaya cikarici, somut, kanit tabanli bir **Marka Strateji Raporu** cikiyor.

---

## Akis Semasi (Workflow)

```
                         KULLANICI
                            |
                    [Form Doldurur]
                            |
                      ADMIN PANELI
                            |
                  "Multi-Agent Analiz"
                     butonuna basar
                            |
              ================================
              |   API: /analyze-start (60sn)  |
              ================================
                    /       |       \
                   /        |        \
          Agent 1:     Deep Research    Website
        dataNormalizer   baslatilir    HTML cekilir
        (veri duzenleme) (Google'da    (cheerio ile
                          arastirma)   parse edilir)
                   \        |        /
                    \       |       /
              ================================
              | Sonuc: normalizedData,       |
              | drInteractionId, websiteData |
              ================================
                            |
                    [Frontend bekler,
                     polling baslar]
                            |
              ================================
              | API: /analyze-continue (300sn)|
              ================================
                            |
                  ----- FAZA A -----
                   Deep Research'u
                   poll et (bekle)
                            |
                   Sonuc geldi mi?
                  /                \
                EVET               HAYIR
                 |            Grounding fallback
                 |            (hizli web arama)
                 |                  |
              researchFindings   researchFindings
                  \                /
                   \              /
                  ----- FAZ B -----
                   3 Agent PARALEL:
                  /       |       \
                 /        |        \
          Agent 3:    Agent 7:    Agent 8:
          Brand       Dijital     Rakip
          Strategist  Varlik      Kesfi
          (ZORUNLU)   Analizci
                 \        |        /
                  \       |       /
                   2 Agent PARALEL:
                  /               \
          Agent 4a:           Agent 4b:
          Brand               Blog Strateji
          Challenger          Danismani
          (seytan avukati)    (blog felsefesi)
                  \               /
                   \             /
                    Agent 5:
                    Strateji
                    Sentezleyici
                    (hepsini birlestirir)
                            |
                    Agent 6:
                    Danisman Giris
                    Yazari
                            |
              ================================
              |   NIHAI RAPOR OLUSTURULUR    |
              |   Firestore'a kaydedilir     |
              ================================
                            |
                    RAPOR SAYFASI
                    (musteri gorur)
```

---

## Adim 0: Kullanici Formu Dolduruyor

Kullanici web sitemizdeki **QuoteWizard** formunu dolduruyor. Bu form asamali bir anket:

### Toplanan Bilgiler

| Alan | Ornek | Nereden |
|------|-------|---------|
| **Ad Soyad** | "Ahmet Yilmaz" | Iletisim formu |
| **Isletme Adi** | "Rakle Cam" | Iletisim formu |
| **E-posta** | "ahmet@rakle.com" | Iletisim formu |
| **Sektor** | "Cam & Dekorasyon" | Sektor secimi |
| **Anket Cevaplari** | 20+ soru-cevap | Asamali wizard |
| **Anket Puanlari** | {score1: 7, score2: 5...} | Otomatik hesaplama |
| **Talep Edilen Hizmetler** | ["Sosyal Medya", "Web Tasarim"] | Hizmet secimi |
| **Is Tanimi** | "El yapimi cam urunler..." | businessContext |
| **Web Sitesi** | "https://www.rakle.com.tr" | businessContext |
| **Instagram** | "raklecam" | businessContext |
| **Rakipler** | "Pasabahce, Karaca" | businessContext |
| **Cografi Kapsam** | "Turkiye geneli" | businessContext |
| **Dijital Platformlar** | ["Instagram", "Web sitesi"] | businessContext |
| **Takipci Araligi** | "1K-5K" | businessContext |
| **Aylik Butce** | "5.000-10.000 TL" | businessContext |
| **Isletme Asamasi** | "Buyuyen" | businessContext |
| **Neden Basvurdu** | "Dijital buyume istiyoruz" | businessContext |

Bu veriler Firestore'a **BrandLead** olarak kaydedilir.

---

## Adim 1: Admin "Analiz Et" Butonuna Basiyor

Admin panelinde LeadDetailPage'de admin lead'i gorur ve **"Multi-Agent Analiz"** butonuna tiklar.

Frontend su veriyi API'ye gonderir:

```json
{
  "contact": {
    "name": "Ahmet Yilmaz",
    "businessName": "Rakle Cam",
    "email": "ahmet@rakle.com"
  },
  "sector": "Cam & Dekorasyon",
  "wizard": {
    "answers": { "q1": "premium", "q2": "genc_yetiskin", ... },
    "scores": { "score1": 7, "score2": 5, "score3": 8 },
    "stageResults": [...],
    "businessContext": {
      "businessDescription": "El yapimi cam urunler...",
      "websiteUrl": "https://www.rakle.com.tr",
      "instagramHandle": "raklecam",
      "competitors": "Pasabahce, Karaca",
      "geoScope": "Turkiye geneli",
      ...
    }
  },
  "requestedServices": ["Sosyal Medya Yonetimi", "Web Tasarim"],
  "leadId": "abc123",
  "adminNotes": "Premium segmente odaklaniyorlar"
}
```

---

## Adim 2: analyze-start (Ilk 60 Saniye)

`POST /api/analyze-start` cagrildigi anda **3 is ayni anda (paralel) baslar:**

### 2A. Agent 1: Data Normalizer (Veri Duzenleyici)

**Ne yapiyor?** Ham anket verisini yapilandirmis bir formata cevirir. Cevaplari asama asama gruplar, oruntuleri tespit eder, celiskileri yakalar.

**Model:** Gemini Flash (hizli, ucuz)

**Gemini'ye giden prompt ozeti:**

> "Sen bir veri normalizasyon uzmanisin. Asagidaki ham marka degerlendirme wizard verisini yapilandirilmis formata donustur."

Sonra tum anket cevaplari, puanlar, asama sonuclari prompt'a eklenir.

**Gemini'den ne istiyoruz?**

| Alan | Aciklama |
|------|----------|
| `structuredAnswers` | Her asama icin duzenlenmis soru-cevaplar |
| `detectedPatterns` | "Butun cevaplarda 'premium' vurgusu var", "Dijital varlik zayif" gibi oruntu tespitleri (3-5 adet) |
| `contradictions` | "Butce sinirli ama premium hedefliyor" gibi celiskiler |
| `dataQualityScore` | 0-1 arasi veri kalitesi puani |
| `missingAreas` | Cevaplanmamis alanlar |
| `overallProfile` | "Rakle Cam, cam sektorunde premium segmentte konumlanan, dijital varligi zayif olan bir isletme..." gibi 2-3 cumlelik ozet |

**Cikti ornegi:**
```json
{
  "sector": "Cam & Dekorasyon",
  "businessName": "Rakle Cam",
  "structuredAnswers": [
    {
      "stage": 0,
      "stageName": "Marka Temelleri",
      "questions": [
        {
          "id": "q1",
          "question": "Markanizin fiyat konumlandirmasi nedir?",
          "answer": "premium",
          "answerLabel": "Premium segment",
          "score": 8
        }
      ]
    }
  ],
  "detectedPatterns": [
    "Premium konumlandirma vurgusu tutarli",
    "Dijital kanal varligi sinirli",
    "El yapimi/zanaat odakli uretim"
  ],
  "contradictions": [],
  "dataQualityScore": 0.82,
  "missingAreas": ["Detayli butce bilgisi"],
  "overallProfile": "Rakle Cam, el yapimi cam urunler ureten..."
}
```

---

### 2B. Deep Research Baslatilir

**Ne yapiyor?** Google'in Deep Research ozelligini kullanarak internette kapsamli bir arastirma baslatir. Bu arastirma **5-10 dakika** surebilir, bu yuzden sadece baslatiyoruz, sonucunu sonra alacagiz.

**Model:** Gemini Deep Research (ozel mod — interneti tarar)

**Gemini'ye giden prompt:**

> "Sen bir sektor arastirmacisisin. 'Rakle Cam' hakkinda KAPSAMLI ve URUN BAZLI bir arastirma yap."

Prompt 5 adimdan olusor:

| Adim | Ne Arastiriliyor |
|------|-----------------|
| **ADIM 1 — Markanin Kendisi** | Web sitesini bul, urunleri listele, fiyatlari bul, konumlandirmayi anla |
| **ADIM 2 — Urun Bazli Rakipler** | Her urun kategorisi icin dogrudan rakipleri bul (en az 4, en fazla 8) |
| **ADIM 3 — Pazar Verileri** | Pazar buyuklugu, buyume orani, tuketici davranislari |
| **ADIM 4 — Hedef Kitle Profili** | Kim aliyor? Yas, gelir, motivasyon, kanal tercihleri |
| **ADIM 5 — Dijital Varlik Analizi** | Instagram hesabini bul ve analiz et, web sitesini UX acisindan degerlendir, rakiplerin dijital varliklarini kiyasla |

Deep Research bu prompt'u alir ve **Google'da onlarca arama yaparak** detayli bir rapor olusturur. Gercek web sitelerini ziyaret eder, gercek verileri toplar.

**Cikti:** Bir `drInteractionId` (takip numarasi) — sonuclari daha sonra alacagiz.

---

### 2C. Website HTML Cekilir

**Ne yapiyor?** Eger kullanici web sitesi URL'si verdiyse (ornegin `https://www.rakle.com.tr`), o siteyi indirir ve **cheerio** kutuphanesiyle parse eder.

**Model:** Yok — bu saf kod, yapay zeka degil.

**Ne cikariliyor?**

| Alan | Ornek |
|------|-------|
| `title` | "Rakle Cam - El Yapimi Cam Urunler" |
| `metaDescription` | "Premium cam dekorasyon urunleri..." |
| `navigation` | ["Ana Sayfa", "Urunler", "Hakkimizda", "Iletisim"] |
| `productListings` | [{name: "Cam Vazo", price: "450 TL"}, ...] |
| `ctaButtons` | ["Satin Al", "Bize Ulasin"] |
| `headings` | ["Koleksiyonlarimiz", "Neden Rakle?", ...] |
| `textContent` | Sayfanin ilk 5000 karakter metin icerigi |

Bu veri daha sonra **Agent 7'ye** (Dijital Varlik Analizcisi) verilecek.

---

### 2'nin Sonucu

`analyze-start` 3 isi bitirince frontend'e su cevabi doner:

```json
{
  "status": "researching",
  "drInteractionId": "dr_abc123",
  "normalizedData": { ... },
  "websiteData": { ... },
  "input": { ... }
}
```

Frontend bu cevabi alir ve hemen `analyze-continue`'yu cagirmaya baslar.

---

## Adim 3: analyze-continue — FAZ A: Arastirma (0-250sn)

`POST /api/analyze-continue` cagriliyor. Ilk is: Deep Research'un sonuclarini beklemek.

### Deep Research Polling

Frontend'ten gelen `drInteractionId`'yi kullanarak Google'a soruyoruz: "Arastirma bitti mi?"

- **Bitti:** Harika! Sonuclari aliyoruz ve JSON'a ceviriyoruz.
- **Hala calisiyor:** Frontend'e "hala arastiriyorum" diyoruz, frontend 15-20sn sonra tekrar soruyor.
- **Basarisiz oldu:** Plan B'ye geciyoruz (Grounding Fallback).

### Grounding Fallback (Plan B)

Deep Research basarisiz olursa, Gemini'nin **Google Search grounding** ozelligini kullaniyoruz. Bu daha hizli ama daha az kapsamli. 3 paralel arama yapilir:

1. **Rakip aramasi:** "Cam sektorunde Turkiye'de [marka] ile ayni segmentte rekabet eden markalar"
2. **Pazar aramasi:** "Cam sektoru Turkiye pazar buyuklugu, buyume hizi, tuketici profili"
3. **Trend aramasi:** "Cam sektoru firsatlar, tehditler, benchmark metrikler"

### Arastirma Sonucu (ResearchFindings)

Her iki yoldan da gelen ham metin, Gemini Pro'ya verilip **yapilandirmis JSON'a** cevrilir:

```json
{
  "competitors": [
    {
      "name": "Pasabahce",
      "website": "https://www.pasabahce.com",
      "positioning": "Genis urun yelpazesi, orta-premium segment",
      "strengths": ["Guclu dagitim agi", "Marka bilinirlig"],
      "weaknesses": ["El yapimi segmentte zayif"],
      "estimatedScale": "5000+ calisan, global"
    }
  ],
  "marketData": {
    "marketSize": "Turkiye cam ev esyasi pazari ~8 milyar TL",
    "growthRate": "%12 yillik buyume",
    "keyPlayers": ["Pasabahce", "Karaca", "Lav"],
    "consumerTrends": ["El yapimi urune talep artiyor"]
  },
  "targetAudienceInsights": {
    "demographics": "25-45 yas, orta-ust gelir, buyuksehir",
    "psychographics": "Estetik deger, ev dekorasyonu merakli",
    "painPoints": ["Kaliteli el yapimi cam bulmak zor"],
    "purchaseBehavior": "Online arastirma + magaza deneyimi"
  },
  "opportunities": ["El yapimi segmentte bosluk"],
  "threats": ["Ucuz ithal urunler"]
}
```

---

## Adim 4: analyze-continue — FAZ B: Ajanlar Calisiyor

Arastirma tamamlaninca, simdiden elimizde var:
- `normalizedData` (Agent 1'den)
- `researchFindings` (Deep Research / Grounding'den)
- `websiteData` (cheerio parse'dan)

Simdi 6 ajan calisacak. Ilk 3'u **ayni anda (paralel)** calisir:

---

### Agent 3: Brand Strategist (Marka Stratejisti) — ZORUNLU

**Rolu:** Bir marka strateji uzmani gibi dusunur. Tum verileri alir ve markanin konumlandirmasini belirler.

**Alir:**
- normalizedData (duzenlenmis anket verileri)
- researchFindings (pazar arastirmasi)
- businessContext (is baglami)

**Model:** Gemini Pro (yaratici, derin dusunceli)

**Gemini'ye giden prompt ozeti:**

> "Sen deneyimli bir marka stratejistisin. Asagidaki veriyi analiz ederek markanin konumlandirilmasi icin detayli ve KANIT TABANLI bir strateji olustur."

Prompt'a sunlar eklenir:
- Isletme profili ve genel ozet
- Tum yapilandirmis cevaplar
- Tespit edilen oruntular ve celiskiler
- Sektor arastirmasi sonuclari (rakipler, pazar, trendler)

**Gemini'den ne istiyoruz?**

| Alan | Aciklama | Ornek |
|------|----------|-------|
| `archetype` | Jung arketipi | "Yaratici" |
| `archetypeRationale` | Neden bu arketip? KANITLARLA | "Anket cevaplarinda el yapimi vurgusu, arastirmada zanaat..." |
| `traits` | 3-5 kisilik ozelligi | ["Zanaat odakli", "Estetik duygulu", ...] |
| `tone` | Iletisim tonu + ORNEK CUMLE | "Sicak ve samimi — 'Her parcamiz bir hikaye anlatiyor'" |
| `voice` | Marka sesi + ORNEK CUMLE | "Bilgili ama ukala olmayan — 'Cam uflemenin 3000 yillik tarihinde...'" |
| `positioningStatement` | Konumlandirma cumlesi | "Evlerine anlam katan yetiskinler icin, el yapimi cam sanatiyla..." |
| `valuePropositionReasoning` | Ne uretiyor, kime fayda, fiyat | {whatBusinessProduces: "El yapimi cam vazo, bardak...", ...} |
| `targetAudience` | 2 segment detayli profil | {primarySegment: {demographics: "28-45, buyuksehir...", ...}} |
| `differentiator` | Rakiplerden farki | "Pasabahce'nin sunamadigi el yapimi..." |
| `competitiveAdvantage` | Rekabet avantaji | "Usta el isciligi + modern tasarim birlesiyor" |
| `competitiveMap` | Rakip karsilastirma tablosu | [{competitorName: "Pasabahce", ourAdvantage: "...", ...}] |

**Prompt'taki kritik kurallar:**
- Her iddia icin KANIT goster
- "Yenilikci ve dinamik" gibi bos laflar YASAK
- Kurgusal karakter YASAK ("Ayse, 32 yasinda" gibi)
- Segment tanimlari DAVRANISSAL olmali

---

### Agent 7: Digital Presence Analyzer (Dijital Varlik Analizcisi) — Opsiyonel

> Agent 3 ile AYNI ANDA calisir, ek sure yok!

**Rolu:** Markanin web sitesini ve Instagram'ini inceler, dijital olgunluk puani verir.

**Alir:**
- normalizedData
- researchFindings
- businessContext (websiteUrl, instagramHandle)
- websiteData (cheerio ile cekilmis HTML)

**Model:** Gemini Pro (tum alt gorevler icin)

**3 Alt Gorev Paralel Calisir:**

#### A) Website Analizi

Eger HTML verisi varsa (cheerio cekmis), Gemini'ye su verilir:

> "Sen bir dijital pazarlama ve UX uzmansin. 'Rakle Cam' markasinin web sitesini analiz et."
>
> Site verileri: baslik, meta aciklama, navigasyon, urunler, CTA butonlari, ilk 3000 karakter metin icerigi

**Gemini'den ne istiyoruz?**

| Alan | Ornek |
|------|-------|
| `designQuality` | 7/10 |
| `mobileOptimized` | true |
| `products` | [{name: "Cam Vazo", price: "450 TL", category: "Dekorasyon"}] |
| `pricingStrategy` | "premium" |
| `callToActions` | ["Satin Al", "Koleksiyonu Incele"] |
| `trustSignals` | ["100+ yorum", "Sertifikali usta"] |
| `strengths` | ["Gorsel kalite yuksek"] |
| `weaknesses` | ["Mobil navigasyon karisik"] |
| `recommendations` | ["Urun filtreleme ekle"] |

#### B) Instagram Analizi

2 paralel Google arama yapilir (grounding):
1. `site:instagram.com/raklecam "raklecam" profil bilgileri`
2. `"Rakle Cam" instagram analiz istatistik takipci`

Sonuclar Gemini Pro'ya verilip JSON'a cevrilir:

| Alan | Ornek |
|------|-------|
| `followerRange` | "2.5K-5K" |
| `postingFrequency` | "haftada 3-4" |
| `contentThemes` | ["Urun tanıtım", "Ustam iş başında", "Dekorasyon ilham"] |
| `visualStyle` | "Minimalist, beyaz arka plan agirlikli" |
| `engagementLevel` | "orta" |
| `contentMix` | {photoPercent: 60, videoPercent: 10, reelPercent: 20, carouselPercent: 10} |
| `strengths` | ["Gorsel tutarlilik iyi"] |
| `weaknesses` | ["Reel icerigi az"] |

#### C) Diger Platformlar

Kullanicinin bildirdigi platformlar (LinkedIn, TikTok, YouTube, X) icin basit bir "var/yok" tespiti yapilir.

**Nihai Cikti:**

```json
{
  "website": { ... },
  "instagram": { ... },
  "otherPlatforms": [
    {"platform": "LinkedIn", "status": "yok"},
    {"platform": "TikTok", "status": "yok"},
    {"platform": "YouTube", "status": "aktif"},
    {"platform": "X", "status": "yok"}
  ],
  "overallDigitalScore": 5.8,
  "digitalMaturityLevel": "gelisen",
  "criticalGaps": [
    "LinkedIn varligi yok",
    "Instagram Reel icerigi yetersiz"
  ],
  "quickWins": [
    "Meta description eksik — SEO icin eklenmeli",
    "CTA butonu net degil — donusum icin iyilestirilmeli"
  ]
}
```

---

### Agent 8: Competitor Discovery (Rakip Kesfi) — Opsiyonel

> Agent 3 ve Agent 7 ile AYNI ANDA calisir!

**Rolu:** Bilinen rakiplerin otesinde yeni rakipler kesfeder ve HEPSINI derinlemesine analiz eder.

**Alir:**
- normalizedData
- researchFindings (mevcut rakip listesi)
- businessContext (kullanicinin bildirdigi rakipler, cografi kapsam)

**Model:** Gemini Pro (grounding + enrichment)

**2 Fazda Calisir:**

#### Faz A: Kesfet (Grounding)

2 paralel Google arama yapilir:

1. **Sektor bazli:** "Cam sektorunde Turkiye bolgesinde faaliyet gosteren en onemli markalar... EN AZ 5 marka bul"
2. **Urun bazli:** "El yapimi cam urunleri Turkiye pazarinda rakipleri arastir. Bilinen: [Pasabahce, Karaca] — bunlari TEKRARLAMA, yeni bul"

#### Faz B: Zenginlestir (Gemini Pro)

Bilinen + yeni bulunan TUM rakipler tek bir Gemini Pro cagrisina gonderilir:

> "Sen bir rekabet analizi uzmanisin. 'Rakle Cam' icin TUM rakipleri analiz et."

**Gemini'den ne istiyoruz?**

| Alan | Aciklama |
|------|----------|
| `knownCompetitors` | Bilinen rakipler — zenginlestirilmis |
| `discoveredCompetitors` | YENI kesfedilen rakipler |
| `competitiveLandscapeSummary` | "Cam sektoru dagilmis bir yapi gosteriyor..." |
| `marketConcentration` | "dagilmis" / "yogun" / "oligopol" |
| `entryBarriers` | ["Yuksek baslangic yatirimi", ...] |
| `digitalBenchmark` | Rakiplerin ortalama dijital performansi |

Her rakip icin:
```json
{
  "name": "Nude Glass",
  "website": "https://www.nudeglass.com",
  "positioning": "Ultra-premium, sanat cam",
  "priceSegment": "premium",
  "strengths": ["Global marka", "Tasarimci isbirlikleri"],
  "weaknesses": ["Turkiye'de sinirli dagitim"],
  "digitalPresenceScore": 8,
  "source": "discovered"
}
```

---

### Kisa Ara: Ilk 3 Agent Bitti

Bu noktada elimizde var:
1. `normalizedData` — Duzenlenmis anket verileri
2. `researchFindings` — Pazar arastirmasi
3. `strategistOutput` — Marka stratejisi
4. `digitalPresence` — Dijital varlik analizi
5. `competitorDiscovery` — Rakip kesfi

Simdi 2 agent daha **paralel** calisacak:

---

### Agent 4a: Brand Challenger (Seytan Avukati)

**Rolu:** Stratejistin onerdigini ELESTIRIR. Zayif noktalarini bulur, alternatifler sunar.

**Alir:**
- normalizedData
- researchFindings
- strategistOutput (Agent 3'un ciktisi)

**Model:** Gemini Pro (temperature: 0.8 — daha yaratici/cesur)

**Gemini'ye giden prompt ozeti:**

> "Sen SEYTAN AVUKATI olarak gorev yapiyorsun. Bir strateji uzmani su marka konumlandirmasini onerdi. Senin gorevin bunu ELESTIREL ve KANIT TABANLI gozle incelemek."

Prompt'a stratejistin TUM ciktilari eklenir: arketip, konumlandirma, hedef kitle, farklilik...

**Gemini'den ne istiyoruz?**

| Alan | Aciklama | Ornek |
|------|----------|-------|
| `counterPosition` | Karsi pozisyon | "Stratejist premium diyor ama pazar verilerine gore orta segment %60 buyuyor..." |
| `alternativeArchetype` | Alternatif arketip | "Kasif" |
| `challengePoints` | 3-5 elestiri (KANITLI) | "Pasabahce premium segmentte %40 paya sahip, yeni giris riskli" |
| `alternativePositionings` | 2-3 alternatif konum | "Orta-premium'da 'erisilir luks' konumlandirmasi" |
| `riskAssessment` | Uygulama riskleri | "Premium fiyatlandirma dijital kanalda donusum oranini dusurur" |
| `blindSpots` | Kor noktalar | "Arastirma Z kusaginin cam dekorasyona ilgisini gosteriyor, stratejist bunu ele almamis" |

**Kurallar:**
- Elestiriler YAPICI olmali (yikmak degil, gelistirmek)
- Her elestiri KANIT icermeli
- Her biri farkli alana odaklanmali (pazar, hedef kitle, rekabet, uygulama, iletisim)

---

### Agent 4b: Blog Strategy Advisor (Blog Strateji Danismani)

**Rolu:** intiba'nin blog yazarinin "Gayrinizami Markalama" felsefesini bu markaya uygular. Geleneksel pazarlama dogmalarini sorgular.

**Alir:**
- normalizedData
- researchFindings
- strategistOutput
- Blog bilgi bankasi (50+ blog yazisi ozeti, prensipler, alintilar)

**Model:** Gemini Flash (temperature: 0.8 — cesur ve yaratici)

**Gemini'ye giden prompt ozeti:**

> "Sen stratejik danismanin blog felsefesini temsil eden bir marka danismanisin. 'Gayrinizami Markalama' felsefesiyle bilinen stratejik yaklasimlari bu markaya SOMUT olarak uygula."

Blog yazilarinin ozet ve prensipleri prompt'a eklenir.

**Gemini'den ne istiyoruz?**

| Alan | Aciklama | Ornek |
|------|----------|-------|
| `philosophicalAlignment.score` | Blog felsefesiyle uyum (1-10) | 7 |
| `alignedPrinciples` | Uyumlu prensipler | "'4P Dengesini Bozun' yazisindaki gibi, fiyat yerine deneyime odaklanma stratejisi uyumlu" |
| `conflictingPrinciples` | Celisen prensipler | "'Herkese Satma' yazisindaki gibi, hedef kitle daha da daraltilmali" |
| `strategicRecommendations` | Blog felsefesinden somut oneriler | {area: "differentiation", recommendation: "...", blogReference: "..."} |
| `contentPillars` | Blog temalarindan esinlenen icerik sutunlari | ["Cam Sanati Hikayeleri", "Ustanin Mutfagi", ...] |
| `topicSuggestions` | 5-7 somut konu onerisi | ["Neden Seri Uretim Size Uymuyor?"] |
| `authorPerspective` | Yazar bu markaya ne derdi? | "Rakle, cam sektorunun Banksy'si olmali..." |
| `unconventionalInsights` | Sira disi icgoruler | "Urunlerinizin 'kusurlarini' pazarlayin — her parcadaki el izleri USP'niz" |

---

### Agent 5: Strategy Synthesizer (Strateji Sentezleyici)

**Rolu:** Basparlak direktorun ofisi. Tum ajanlardan gelen bilgileri birlestirip NIHAI strateji raporunu olusturur.

**Alir:**
- normalizedData (Agent 1)
- researchFindings (Deep Research)
- strategistOutput (Agent 3)
- challengerOutput (Agent 4a)
- blogAdvisorOutput (Agent 4b)
- businessContext
- digitalPresence (Agent 7) — YENI
- competitorDiscovery (Agent 8) — YENI

**Model:** Gemini Pro (temperature: 0.6 — dengeli)

**Gemini'ye giden prompt ozeti:**

> "Sen bir marka stratejisi basparlak direktorsun. Onunde 5 uzmanin gorusleri var. Hepsini sentezleyerek NIHAI marka stratejisi raporunu olustur."

Prompt'a tum ajanlarin ciktilari eklenir. Eger dijital varlik ve rakip kesfi verileri varsa, bunlar da ek bolumler olarak eklenir:

```
## DIJITAL VARLIK ANALIZI
Genel Dijital Skor: 5.8/10
Dijital Olgunluk: gelisen
Web Sitesi: 7/10 — premium gorsel kalite, mobil uyumluluk iyi
Instagram: @raklecam — haftada 3-4 paylasim, orta etkilesim
Kritik Eksikler: LinkedIn yok, Reel icerigi az
Hizli Kazanimlar: Meta description eksik, CTA iyilestirmesi

## RAKIP KESFI
Bilinen Rakipler: Pasabahce, Karaca (zenginlestirilmis)
Kesfedilen Rakipler: Nude Glass, Koleksiyon, Decover...
Pazar Yogunlugu: dagilmis
Rakiplerin Ort. Dijital Skoru: 6.2
```

**Gemini'den ne istiyoruz?** (Nihai rapor yapisi)

| Bolum | Icerik |
|-------|--------|
| **brandPersonality** | Nihai arketip, kisilik ozellikleri, ton, ses |
| **positioning** | Konumlandirma cumlesi, hedef kitle, deger onerisi, segmentler, farklilik, rekabet avantaji, rekabet haritasi, alternatif pozisyonlar |
| **visualWorld** | 5-7 gorsel anahtar kelime, 4 renk paleti (hex kodlariyla), tipografi, gorsel stil |
| **contentStrategy** | 4-6 icerik sutunu, ton rehberi, anahtar mesajlar, hashtagler |
| **analysis** | SWOT: guclu yanlar, firsatlar, zorluklar, oneriler (KANITLI) |
| **actionPlan** | 0-30 gun, 30-60 gun, 60-90 gun aksiyon plani (her biri: aksiyon, sorumlu, metrik, etki) |
| **evidenceSummary** | Kaynak sayisi, URL'ler, veri tazeligi, guven seviyesi |
| **synthesisRationale** | "Neden bu sentezi yaptim" aciklamasi |

**Kritik kurallar:**
- **ANTI-JARGON:** "Dijital varlik guclendirilmeli" YASAK → "Instagram'da haftada 4 post + 2 Reel ile organik erisim %30 arttirilabilir"
- **UYGULANABILIRLIK:** Her oneri bir proje yoneticisinin HEMEN baslayabilecegi kadar net
- **KANIT ZORUNLU:** Her SWOT maddesi icin destekleyici veri
- **DAHILI TERIMLER YASAK:** "wizard", "agent", "pipeline", "Gemini" gibi teknik terimler KULLANILMAZ — bu rapor MUSTERIYE gosterilecek

---

### Agent 6: Consultant Intro Writer (Danisman Giris Yazari)

**Rolu:** Raporun EN BASINDA gosterilecek 4-6 cumlelik bir acilis konusmasi yazar. Isletme sahibi bunu ilk okuyacak.

**Alir:**
- normalizedData
- researchFindings
- synthesizedAnalysis (Agent 5'in ciktisi)
- blogAdvisorOutput (Agent 4b)
- businessContext

**Model:** Gemini Pro (temperature: 0.9 — en yaratici ayar)

**Gemini'ye giden prompt ozeti:**

> "Sen deneyimli bir marka strateji danismanisin. Isletme sahibiyle ILK TOPLANTIDA yuz yuze oturuyorsun. Ona 4-6 cumlelik bir ACILIS KONUSMASI yapacaksin."
>
> "Amac: karsi tarafin 'bu kisi benim isimi GERCEKTEN ANLIYOR' demesi."

**Kurallar:**
- RAKIP ISIMLERINI KULLAN ("Pasabahce", "Karaca" gibi gercek isimler)
- SOMUT GERCEKLIK: Bu isletmenin spesifik durumunu anlat
- PROVOKATIF OLABILIR: "Bu sekilde devam ederseniz 3 yil sonra ayni yerdesiniz"
- POHPOHLAMA YASAK: "Harika markaniz", "Basarili isletmeniz" YASAK
- METAFOR KULLAN ama klise degil
- LITMUS TEST: Isletme adini degistirsen cumle anlamsizlasmali

**Ornek cikti:**

> Pasabahce'nin rafta kazandigi savasi siz masada kazanacaksiniz — ama simdi masada bile degilsiniz. Raklecam'in Instagram'da 3K takipcisi var, Nude Glass'in 180K. Fark takipci degil; onlar cam satiyor, siz hikaye anlatmiyor. El yapimi her parcanizdaki o kucuk hava kabarcigi — o 'kusur' aslinda sizin en buyuk silahimiz. Simdi bu silahi nasil kullanacagimizi birlikte analiz edecegiz: dijital varligi sifirdan insa etmek, rakiplerin dokunmadigi 'erisilir luks' segmentini sahiplenmek ve her urun fotografi yerine bir usta hikayesi anlatmak.

---

## Adim 5: Rapor Olusturuluyor

Tum ajanlar bittikten sonra, `analyze-continue` sonuclari birlestirip **nihai analiz objesi**ni olusturur:

```json
{
  "brandPersonality": { "archetype": "Yaratici", "traits": [...], "tone": "...", "voice": "..." },
  "positioning": { "statement": "...", "targetAudience": "...", "targetSegments": [...], ... },
  "visualWorld": { "colorPalette": [...], "typographyStyle": "...", ... },
  "contentStrategy": { "pillars": [...], "hashtags": [...], ... },
  "analysis": { "strengths": [...], "opportunities": [...], "challenges": [...], "recommendations": [...] },
  "actionPlan": { "immediate": [...], "shortTerm": [...], "mediumTerm": [...] },
  "evidenceSummary": { "sourcesConsulted": 23, "keySourceUrls": [...], ... },

  "sectorResearch": { "competitors": [...], "marketData": {...}, ... },
  "debate": {
    "strategistPosition": "Yaratici arketipi + premium konumlandirma",
    "challengerPosition": "Risk: premium segmentte yogun rekabet",
    "blogAdvisorPosition": "Gayrinizami yaklasim: kusurlarinizi satış noktasi yapin",
    "synthesisRationale": "Stratejist kabul, challenger'in orta-premium onerisi entegre edildi, blog danismaninin 'kusur pazarlama' fikri benimsendi"
  },
  "blogAdvisorInsights": { "philosophicalAlignmentScore": 7, "contentPillars": [...], ... },
  "digitalPresence": { "overallDigitalScore": 5.8, "website": {...}, "instagram": {...}, ... },
  "competitorDiscovery": { "knownCompetitors": [...], "discoveredCompetitors": [...], ... },

  "consultantIntro": "Pasabahce'nin rafta kazandigi savasi...",

  "pipelineMetadata": {
    "version": "3.4.0",
    "agentsRun": ["dataNormalizer", "sectorResearch", "brandStrategist", "digitalPresenceAnalyzer", "competitorDiscovery", "brandChallenger", "blogStrategyAdvisor", "strategySynthesizer", "consultantIntroWriter"],
    "totalDuration": 187000,
    "researchMethod": "deep-research"
  }
}
```

Bu obje **Firestore'a** kaydedilir: `brandLeads/{leadId}/aiAnalysis`

---

## Adim 6: Rapor Sayfasi (Kullanicinin Gordugu)

Rapor sayfasi (`AnalysisReportPage.tsx`) bu veriyi alip guzel bir sayfa olarak gosterir.

### Rapor Bolumleri (Sirasiyla)

| # | Bolum | Veri Kaynagi | Gosterilen |
|---|-------|-------------|------------|
| 1 | **Kapak** | contact, sector | Isletme adi, sektor, analiz tarihi |
| 2 | **Danisman Girisi** | consultantIntro | 4-6 cumlelik acilis konusmasi |
| 3 | **Isletme Profili** | businessContext | Cografi kapsam, isletme asamasi, dijital platformlar |
| 4 | **Strateji Ozeti** | debate.synthesisRationale | Sentez mantigi |
| 5 | **Marka Kisiligi** | brandPersonality | Arketip, ozellikler, ton, ses |
| 6 | **Konumlandirma** | positioning | Konumlandirma cumlesi, deger onerisi, segmentler, farklilik |
| 7 | **SWOT Analizi** | analysis | Guclu yanlar, firsatlar, zorluklar, oneriler |
| 8 | **Rekabet Analizi** | sectorResearch.competitors | Her rakip icin kart: isim, site, konum, guclu/zayif yanlar |
| 9 | **Pazar Verileri** | sectorResearch.marketData | Pazar buyuklugu, buyume, trendler |
| 10 | **Gorsel Dunya** | visualWorld | Renk paleti (hex kodlariyla), tipografi, gorsel stil |
| 11 | **Icerik Stratejisi** | contentStrategy + blogAdvisorInsights | Icerik sutunlari, mesajlar, hashtagler, blog onerileri |
| 12 | **90 Gunluk Plan** | actionPlan | 3 fazda aksiyon plani (sorumlu + metrik + etki) |
| 13 | **CTA** | requestedServices | "intiba ile calisin" + talep edilen hizmetler |

---

## Zamanlama

```
analyze-start (maks 60sn):
  |-- DataNormalizer ------| ~5sn
  |-- DR Baslat -----------| ~2sn (sadece baslatiyor)
  |-- Website Fetch -------| ~3sn

analyze-continue (maks 300sn):
  |-- DR Poll --------------------...--| 30sn - 250sn (bekliyor)
  |-- Strategist ------| ~20-50sn  )
  |-- DigitalPresence -| ~15sn     ) PARALEL
  |-- CompetitorDisc. -| ~20sn     )
  |-- Challenger ------| ~15-27sn  ) PARALEL
  |-- BlogAdvisor -----| ~15-20sn  )
  |-- Synthesizer -----| ~30-67sn
  |-- IntroWriter -----| ~5-8sn

Toplam: ~3-6 dakika (DR suresine bagli)
```

---

## Hata Yonetimi (Bir Sey Ters Giderse)

| Durum | Ne Olur |
|-------|---------|
| Deep Research basarisiz | Grounding fallback devreye girer (hizli ama daha az kapsamli) |
| Website cekilemiyor | `website: null`, raporda "Analiz edilemedi" gosterilir |
| Instagram bulunamiyor | Isletme adiyla Google'da aranir |
| Agent 7 (Dijital) basarisiz | `null`, raporda bolum gosterilmez |
| Agent 8 (Rakip) basarisiz | `null`, mevcut ResearchFindings.competitors kullanilir |
| Agent 4a (Challenger) basarisiz | Sentezleyici sadece stratejist ciktisini kullanir |
| Agent 4b (Blog) basarisiz | Sentezleyici blog olmadan calisir |
| Agent 5 (Sentez) basarisiz | Fallback: stratejist ciktisi dogrudan rapor formatina cevirilir |
| Zaman bitiyor | Kalan ajanlar atlanir, eldeki veriyle rapor olusturulur |

**Prensip:** Pipeline ASLA tamamen bozulmaz. En kotu senaryoda bile stratejistin ciktisiyla bir rapor uretilir.

---

## Kullanilan Modeller

| Agent | Model | Neden |
|-------|-------|-------|
| DataNormalizer | Gemini Flash | Hizli, basit is, ucuz |
| Deep Research | Gemini DR | Kapsamli internet taramasi |
| Research Extraction | Gemini Pro | Karmasik metin → JSON |
| Brand Strategist | Gemini Pro | Derin analiz, yaratici dusunme |
| Brand Challenger | Gemini Pro | Elestirel dusunme |
| Blog Advisor | Gemini Flash | Blog KB ile hizli eslestirme |
| Strategy Synthesizer | Gemini Pro | Karmasik sentez |
| Consultant Intro | Gemini Pro | Yaratici yazim (temp: 0.9) |
| Digital Presence | Gemini Pro | Detayli analiz + grounding |
| Competitor Discovery | Gemini Pro | Grounding + zenginlestirme |

---

## Ozet: Bir Cumlede

Kullanici formu dolduruyor → Admin "Analiz Et" diyor → 9 yapay zeka ajani sirayla ve paralel calisiyor: veriyi duzenle, internette arastir, strateji kur, elestir, blog felsefesiyle kiyasla, web sitesini incele, rakipleri kesfet, hepsini birlestiR, acilis konusmasi yaz → Sonuc: somut, kanit tabanli, 90 gunluk aksiyon planli bir Marka Strateji Raporu.
