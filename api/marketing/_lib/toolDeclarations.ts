/**
 * Gemini function declarations for Marketing AI Agent
 */
import { Type } from '@google/genai';

export const toolDeclarations = [
  // ============================================
  // Account & Campaign Management
  // ============================================
  {
    name: 'list_connected_accounts',
    description: 'Bagli platform hesaplarini listeler (Meta, Google, TikTok vb.). Konusma basinda mutlaka cagir.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_account_campaigns',
    description: 'Belirtilen hesaba ait kampanyalari getirir. Varsayilan olarak sadece aktif kampanyalari dondurur. Tum kampanyalar icin statusFilter=all kullan.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        platformAccountId: { type: Type.STRING, description: 'Platform hesap ID (Firestore doc ID)' },
        statusFilter: { type: Type.STRING, description: 'Filtre: "active" (varsayilan, sadece aktif), "paused" (duraklatilmis), "all" (tumu), "inactive" (aktif olmayan)' },
      },
      required: ['platformAccountId'],
    },
  },
  {
    name: 'get_campaign_details',
    description: 'Kampanya detayini getirir (reklam setleri, reklamlar dahil).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        campaignId: { type: Type.STRING, description: 'Firestore kampanya doc ID' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'get_campaign_performance',
    description: 'Meta API uzerinden kampanya performans metriklerini getirir.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        campaignId: { type: Type.STRING, description: 'Meta campaign ID' },
        datePreset: { type: Type.STRING, description: 'Tarih araligi: last_7d, last_30d, last_90d' },
        level: { type: Type.STRING, description: 'Detay seviyesi: campaign, adset, ad' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'sync_campaigns',
    description: 'Meta API\'den kampanyalari cekerek Firestore\'a kaydeder.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        platformAccountId: { type: Type.STRING, description: 'Hangi hesap icin sync yapilacak' },
      },
    },
  },
  {
    name: 'create_marketing_plan',
    description: 'Tum bilgiler toplandiktan sonra pazarlama plani olusturur.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        planData: {
          type: Type.OBJECT,
          description: 'Tam pazarlama plan verisi (name, brand, objectives, audience, budget, platforms, timeline, campaigns, kpis)',
          properties: {
            name: { type: Type.STRING },
            brand: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                industry: { type: Type.STRING },
              },
            },
            objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
            audience: {
              type: Type.OBJECT,
              properties: {
                ageMin: { type: Type.NUMBER },
                ageMax: { type: Type.NUMBER },
                genders: { type: Type.ARRAY, items: { type: Type.STRING } },
                interests: { type: Type.ARRAY, items: { type: Type.STRING } },
                locations: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            budget: {
              type: Type.OBJECT,
              properties: {
                total: { type: Type.NUMBER },
                currency: { type: Type.STRING },
                dailyBudget: { type: Type.NUMBER },
              },
            },
            platforms: { type: Type.ARRAY, items: { type: Type.STRING } },
            timeline: {
              type: Type.OBJECT,
              properties: {
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
              },
            },
            campaigns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Kampanya adi' },
                  platform: { type: Type.STRING, description: 'Platform: meta, google, tiktok vb.' },
                  metaObjective: { type: Type.STRING, description: 'Meta objective: OUTCOME_AWARENESS, OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT, OUTCOME_LEADS, OUTCOME_SALES' },
                  adSets: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        dailyBudget: { type: Type.NUMBER, description: 'Gunluk butce TL' },
                      },
                    },
                  },
                },
                required: ['name', 'platform'],
              },
            },
            kpis: {
              type: Type.OBJECT,
              properties: {
                impressions: { type: Type.NUMBER },
                clicks: { type: Type.NUMBER },
                conversions: { type: Type.NUMBER },
              },
            },
          },
          required: ['name'],
        },
      },
      required: ['planData'],
    },
  },
  {
    name: 'get_marketing_stats',
    description: 'Dashboard istatistiklerini getirir (toplam kampanya, harcama vb.).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        projectId: { type: Type.STRING, description: 'Opsiyonel proje ID filtresi' },
      },
    },
  },

  // ============================================
  // Approval-required tools
  // ============================================
  {
    name: 'pause_campaign',
    description: 'Kampanyayi duraklatir (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        campaignId: { type: Type.STRING, description: 'Meta campaign ID' },
        reason: { type: Type.STRING, description: 'Duraklatma nedeni' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'resume_campaign',
    description: 'Duraklatiilmis kampanyayi devam ettirir (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        campaignId: { type: Type.STRING, description: 'Meta campaign ID' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'update_budget',
    description: 'Kampanya veya reklam seti butcesini gunceller (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetId: { type: Type.STRING, description: 'Campaign veya AdSet ID' },
        targetType: { type: Type.STRING, description: 'campaign veya adset' },
        newBudget: { type: Type.NUMBER, description: 'Yeni butce (TL)' },
      },
      required: ['targetId', 'newBudget'],
    },
  },
  {
    name: 'publish_plan',
    description: 'Pazarlama planini Meta\'da yayinlar (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        planId: { type: Type.STRING, description: 'Marketing plan Firestore ID' },
      },
      required: ['planId'],
    },
  },
  {
    name: 'create_meta_ad',
    description: 'Meta\'da yeni reklam olusturur (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        adSetId: { type: Type.STRING, description: 'Hedef reklam seti ID' },
        adName: { type: Type.STRING, description: 'Reklam adi' },
        creative: {
          type: Type.OBJECT,
          description: 'Kreatif bilgileri',
          properties: {
            title: { type: Type.STRING },
            body: { type: Type.STRING },
            linkUrl: { type: Type.STRING },
            imageHash: { type: Type.STRING },
          },
        },
      },
      required: ['adSetId', 'adName'],
    },
  },
  {
    name: 'delete_campaign',
    description: 'Kampanyayi arsivler/siler (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        campaignId: { type: Type.STRING, description: 'Meta campaign ID' },
        reason: { type: Type.STRING, description: 'Silme nedeni' },
      },
      required: ['campaignId'],
    },
  },

  // ============================================
  // V3 Interactive Strategy Tools
  // ============================================
  {
    name: 'ask_strategy_questions',
    description: 'Interaktif strateji soru karti/formu gosterir. step: business_info, goals, target_audience, budget, platforms, timeline. inputType: single_select (tiklanabilir kartlar), multi_select (coklu secim), combined (form alanlari), text_input, number_input.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        step: { type: Type.STRING, description: 'Strateji adimi: business_info, goals, target_audience, budget, platforms, timeline' },
        question: { type: Type.STRING, description: 'Soru metni' },
        description: { type: Type.STRING, description: 'Soru aciklamasi (opsiyonel)' },
        inputType: { type: Type.STRING, description: 'Input tipi: single_select, multi_select, combined, text_input, number_input' },
        options: {
          type: Type.ARRAY,
          description: 'Secenekler (single_select/multi_select icin)',
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              description: { type: Type.STRING },
              icon: { type: Type.STRING, description: 'Emoji ikon (opsiyonel)' },
              recommended: { type: Type.BOOLEAN },
            },
            required: ['id', 'label'],
          },
        },
        fields: {
          type: Type.ARRAY,
          description: 'Form alanlari (combined icin)',
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              type: { type: Type.STRING, description: 'text, number, textarea, select' },
              placeholder: { type: Type.STRING },
              required: { type: Type.BOOLEAN },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['id', 'label', 'type'],
          },
        },
      },
      required: ['step', 'question', 'inputType'],
    },
  },
  {
    name: 'show_funnel_plan',
    description: 'Pazarlama hunisi planini gorsellestirir (TOFU/MOFU/BOFU). businessName, totalBudget, currency ve funnel dizisi icerir.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        businessName: { type: Type.STRING },
        totalBudget: { type: Type.NUMBER },
        currency: { type: Type.STRING },
        funnel: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              stage: { type: Type.STRING, description: 'tofu, mofu, bofu' },
              label: { type: Type.STRING },
              objective: { type: Type.STRING },
              metaObjective: { type: Type.STRING },
              budgetPercent: { type: Type.NUMBER },
              budgetAmount: { type: Type.NUMBER },
              targetKPIs: {
                type: Type.OBJECT,
                properties: {
                  impressions: { type: Type.NUMBER },
                  clicks: { type: Type.NUMBER },
                  conversions: { type: Type.NUMBER },
                  cpa: { type: Type.NUMBER },
                  roas: { type: Type.NUMBER },
                },
              },
              audienceSummary: { type: Type.STRING },
              creativeSuggestion: { type: Type.STRING },
            },
            required: ['stage', 'label', 'objective', 'budgetPercent', 'budgetAmount'],
          },
        },
        recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['businessName', 'totalBudget', 'currency', 'funnel'],
    },
  },
  {
    name: 'show_campaign_structure',
    description: 'Kampanya agac yapisini gosterir (Campaign → Ad Set → Ad).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        campaigns: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              platform: { type: Type.STRING, description: 'meta, google, tiktok' },
              funnelStage: { type: Type.STRING, description: 'tofu, mofu, bofu' },
              objective: { type: Type.STRING },
              platformObjective: { type: Type.STRING },
              budgetType: { type: Type.STRING, description: 'cbo veya abo' },
              dailyBudget: { type: Type.NUMBER },
              adSets: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    audienceType: { type: Type.STRING },
                    audienceDescription: { type: Type.STRING },
                    dailyBudget: { type: Type.NUMBER },
                    bidStrategy: { type: Type.STRING },
                    ads: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          format: { type: Type.STRING },
                          creativeSummary: { type: Type.STRING },
                        },
                        required: ['name', 'format'],
                      },
                    },
                  },
                  required: ['name', 'audienceType'],
                },
              },
            },
            required: ['name', 'platform', 'funnelStage', 'objective'],
          },
        },
      },
      required: ['campaigns'],
    },
  },
  {
    name: 'ask_budget_allocation',
    description: 'Butce dagilim formu gosterir (slider/input). Kullanici yuzdeleri ayarlayip onaylar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        totalBudget: { type: Type.NUMBER },
        currency: { type: Type.STRING },
        allocationType: { type: Type.STRING, description: 'funnel veya platform' },
        segments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              description: { type: Type.STRING },
              suggestedPercent: { type: Type.NUMBER },
              minPercent: { type: Type.NUMBER },
              maxPercent: { type: Type.NUMBER },
              color: { type: Type.STRING, description: 'Tailwind bg renk sinifi (orn: bg-indigo-400)' },
            },
            required: ['id', 'label', 'suggestedPercent', 'color'],
          },
        },
        showDailyBreakdown: { type: Type.BOOLEAN },
        durationDays: { type: Type.NUMBER },
      },
      required: ['totalBudget', 'currency', 'allocationType', 'segments'],
    },
  },
  {
    name: 'ask_audience_targeting',
    description: 'Kitle hedefleme builder gosterir. Yas, cinsiyet, lokasyon, ilgi alanlari, kitle tipi.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        funnelStage: { type: Type.STRING, description: 'tofu, mofu, bofu' },
        suggestedAgeRange: {
          type: Type.OBJECT,
          properties: { min: { type: Type.NUMBER }, max: { type: Type.NUMBER } },
        },
        suggestedGenders: { type: Type.ARRAY, items: { type: Type.STRING } },
        suggestedLocations: { type: Type.ARRAY, items: { type: Type.STRING } },
        suggestedInterests: { type: Type.ARRAY, items: { type: Type.STRING } },
        suggestedBehaviors: { type: Type.ARRAY, items: { type: Type.STRING } },
        audienceTypes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              description: { type: Type.STRING },
              recommended: { type: Type.BOOLEAN },
            },
            required: ['id', 'label'],
          },
        },
      },
      required: ['funnelStage'],
    },
  },
  {
    name: 'show_strategy_summary',
    description: 'Strateji ozet kartini gosterir. Kullanici onaylar veya duzenleme ister.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        businessName: { type: Type.STRING },
        industry: { type: Type.STRING },
        targetAudience: { type: Type.STRING },
        primaryGoal: { type: Type.STRING },
        totalBudget: { type: Type.NUMBER },
        currency: { type: Type.STRING },
        platforms: { type: Type.ARRAY, items: { type: Type.STRING } },
        funnelSummary: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              stage: { type: Type.STRING },
              budgetPercent: { type: Type.NUMBER },
              objective: { type: Type.STRING },
              audienceSummary: { type: Type.STRING },
            },
            required: ['stage', 'budgetPercent', 'objective'],
          },
        },
        timeline: { type: Type.STRING },
        keyMessages: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['businessName', 'primaryGoal', 'totalBudget', 'currency'],
    },
  },

  // ============================================
  // Research & Targeting Tools (NEW — Faz 1)
  // ============================================
  {
    name: 'search_interests',
    description: 'Meta ilgi alani hedefleme seceneklerini arar. Kitle olusturmada kullanilir. Sonuclar ID, isim ve tahmini kitle buyuklugu icerir.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Aranacak ilgi alani (orn: "spor", "moda", "teknoloji")' },
        limit: { type: Type.NUMBER, description: 'Maksimum sonuc sayisi (varsayilan 25)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_behaviors',
    description: 'Meta davranis hedefleme kategorilerini getirir. Kullanici davranislarina gore hedefleme icin kullanilir.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.NUMBER, description: 'Maksimum sonuc sayisi (varsayilan 50)' },
      },
    },
  },
  {
    name: 'search_demographics',
    description: 'Meta demografik hedefleme kategorilerini getirir. Gelir, aile durumu, cihaz, isletim sistemi vb.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        demographicClass: { type: Type.STRING, description: 'Demografik sinif: demographics, life_events, industries, income, family_statuses, user_device, user_os' },
        limit: { type: Type.NUMBER, description: 'Maksimum sonuc sayisi (varsayilan 50)' },
      },
      required: ['demographicClass'],
    },
  },
  {
    name: 'search_geo_locations',
    description: 'Meta cografi konum seceneklerini arar. Ulke, sehir, bolge bazinda hedefleme icin kullanilir.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Aranacak konum (orn: "Istanbul", "Turkiye", "Kadikoy")' },
        locationTypes: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Konum tipleri: country, region, city, zip, geo_market, electoral_district' },
        limit: { type: Type.NUMBER, description: 'Maksimum sonuc sayisi (varsayilan 25)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'estimate_audience_size',
    description: 'Belirli hedefleme kriterleri icin tahmini kitle buyuklugunu hesaplar. Kitle cok dar (<10K) veya genis (>50M) ise uyar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targeting: {
          type: Type.OBJECT,
          description: 'Meta targeting spec objesi',
          properties: {
            age_min: { type: Type.NUMBER },
            age_max: { type: Type.NUMBER },
            genders: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: '1=Erkek, 2=Kadin' },
            geo_locations: {
              type: Type.OBJECT,
              properties: {
                countries: { type: Type.ARRAY, items: { type: Type.STRING } },
                cities: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { key: { type: Type.STRING } } } },
                regions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { key: { type: Type.STRING } } } },
              },
            },
            flexible_spec: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  interests: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING } } } },
                  behaviors: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING } } } },
                },
              },
            },
          },
        },
        optimizationGoal: { type: Type.STRING, description: 'Optimizasyon hedefi: REACH, LINK_CLICKS, IMPRESSIONS, CONVERSIONS vb.' },
      },
      required: ['targeting'],
    },
  },
  {
    name: 'search_ads_archive',
    description: 'Meta Reklam Kutuphanesi\'nde (Ad Library) rakip reklamlarini arar. Rakip analizi ve ilham icin kullanilir.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        searchTerms: { type: Type.STRING, description: 'Aranacak terimler (marka adi, anahtar kelimeler)' },
        countries: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Hedef ulkeler (varsayilan ["TR"])' },
        adType: { type: Type.STRING, description: 'Reklam tipi: ALL, POLITICAL_AND_ISSUE_ADS (varsayilan ALL)' },
        limit: { type: Type.NUMBER, description: 'Maksimum sonuc sayisi (varsayilan 25)' },
      },
      required: ['searchTerms'],
    },
  },

  // ============================================
  // Creative & Image Tools (NEW — Faz 2A)
  // ============================================
  {
    name: 'upload_ad_image',
    description: 'Gorsel URL\'sini Meta reklam hesabina yukler. Yuklenen gorselin hash\'ini dondurur — creative olusturmada kullanilir.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        imageUrl: { type: Type.STRING, description: 'Yuklenecek gorselin URL\'si' },
      },
      required: ['imageUrl'],
    },
  },
  {
    name: 'create_ad_creative',
    description: 'Reklam kreatif sablonu olusturur (gorsel + baslik + metin + CTA + link). upload_ad_image ile alinan imageHash kullanilabilir.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Reklam basligi' },
        body: { type: Type.STRING, description: 'Reklam metni' },
        pageId: { type: Type.STRING, description: 'Facebook Sayfa ID (opsiyonel — hesaptan otomatik alinir)' },
        linkUrl: { type: Type.STRING, description: 'Hedef URL' },
        imageHash: { type: Type.STRING, description: 'upload_ad_image\'dan alinan gorsel hash' },
        callToAction: { type: Type.STRING, description: 'CTA tipi: LEARN_MORE, SHOP_NOW, SIGN_UP, DOWNLOAD, CONTACT_US, BOOK_NOW, GET_OFFER, SUBSCRIBE' },
        description: { type: Type.STRING, description: 'Link aciklamasi (alt metin)' },
      },
      required: ['title', 'body'],
    },
  },
  {
    name: 'get_ad_creatives',
    description: 'Hesaptaki reklam kreatiflerini listeler. Gorsel, baslik, durum bilgileri icerir.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.NUMBER, description: 'Maksimum sonuc sayisi (varsayilan 25)' },
      },
    },
  },
  {
    name: 'get_creative_details',
    description: 'Belirli bir kreatiifin tum detaylarini getirir: gorsel, baslik, metin, CTA, link, durum.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        creativeId: { type: Type.STRING, description: 'Meta Creative ID' },
      },
      required: ['creativeId'],
    },
  },

  // ============================================
  // Campaign/AdSet/Ad Write Tools (NEW — Faz 2B)
  // ============================================
  {
    name: 'create_campaign_v2',
    description: 'Yeni Meta kampanya olusturur. PAUSED olarak baslar (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Kampanya adi' },
        objective: { type: Type.STRING, description: 'Hedef: OUTCOME_AWARENESS, OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT, OUTCOME_LEADS, OUTCOME_SALES' },
        buyingType: { type: Type.STRING, description: 'Satin alma tipi: AUCTION (varsayilan) veya RESERVED' },
        dailyBudget: { type: Type.NUMBER, description: 'CBO icin gunluk butce (TL)' },
        bidStrategy: { type: Type.STRING, description: 'Teklif stratejisi: LOWEST_COST_WITHOUT_CAP, LOWEST_COST_WITH_BID_CAP, COST_CAP' },
        specialAdCategories: { type: Type.STRING, description: 'Ozel kategori: HOUSING, EMPLOYMENT, CREDIT veya [] (varsayilan)' },
      },
      required: ['name', 'objective'],
    },
  },
  {
    name: 'create_adset_v2',
    description: 'Yeni reklam seti olusturur. PAUSED olarak baslar (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Reklam seti adi' },
        campaignId: { type: Type.STRING, description: 'Hedef kampanya Meta ID' },
        dailyBudget: { type: Type.NUMBER, description: 'Gunluk butce (TL)' },
        optimizationGoal: { type: Type.STRING, description: 'Optimizasyon hedefi: REACH, LINK_CLICKS, IMPRESSIONS, CONVERSIONS, LANDING_PAGE_VIEWS' },
        targeting: {
          type: Type.OBJECT,
          description: 'Meta targeting_spec objesi (age_min, age_max, geo_locations, flexible_spec vb.)',
          properties: {
            age_min: { type: Type.NUMBER },
            age_max: { type: Type.NUMBER },
            genders: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            geo_locations: {
              type: Type.OBJECT,
              properties: {
                countries: { type: Type.ARRAY, items: { type: Type.STRING } },
                cities: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { key: { type: Type.STRING } } } },
              },
            },
            flexible_spec: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  interests: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING } } } },
                  behaviors: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING } } } },
                },
              },
            },
          },
        },
        billingEvent: { type: Type.STRING, description: 'Faturalandirma: IMPRESSIONS (varsayilan), LINK_CLICKS' },
        bidStrategy: { type: Type.STRING, description: 'Teklif stratejisi' },
        bidAmount: { type: Type.NUMBER, description: 'Teklif tutari (TL)' },
        startTime: { type: Type.STRING, description: 'Baslangic zamani (ISO 8601)' },
        endTime: { type: Type.STRING, description: 'Bitis zamani (ISO 8601)' },
      },
      required: ['name', 'campaignId', 'dailyBudget', 'optimizationGoal'],
    },
  },
  {
    name: 'create_ad_v2',
    description: 'Yeni reklam olusturur. Mevcut creative kullanir. PAUSED olarak baslar (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Reklam adi' },
        adsetId: { type: Type.STRING, description: 'Hedef reklam seti Meta ID' },
        creativeId: { type: Type.STRING, description: 'Kullanilacak creative Meta ID' },
      },
      required: ['name', 'adsetId', 'creativeId'],
    },
  },
  {
    name: 'update_campaign_v2',
    description: 'Mevcut kampanyayi gunceller: ad, durum, butce, teklif stratejisi (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        campaignId: { type: Type.STRING, description: 'Meta campaign ID' },
        name: { type: Type.STRING, description: 'Yeni kampanya adi' },
        status: { type: Type.STRING, description: 'Yeni durum: ACTIVE, PAUSED' },
        dailyBudget: { type: Type.NUMBER, description: 'Yeni gunluk butce (TL)' },
        bidStrategy: { type: Type.STRING, description: 'Yeni teklif stratejisi' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'update_adset_v2',
    description: 'Mevcut reklam setini gunceller: hedefleme, butce, teklif, durum (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        adsetId: { type: Type.STRING, description: 'Meta adset ID' },
        name: { type: Type.STRING, description: 'Yeni reklam seti adi' },
        status: { type: Type.STRING, description: 'Yeni durum: ACTIVE, PAUSED' },
        dailyBudget: { type: Type.NUMBER, description: 'Yeni gunluk butce (TL)' },
        targeting: { type: Type.OBJECT, description: 'Yeni targeting spec' },
        optimizationGoal: { type: Type.STRING, description: 'Yeni optimizasyon hedefi' },
        bidStrategy: { type: Type.STRING, description: 'Yeni teklif stratejisi' },
      },
      required: ['adsetId'],
    },
  },
  {
    name: 'update_ad_v2',
    description: 'Mevcut reklami gunceller: ad, durum, creative (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        adId: { type: Type.STRING, description: 'Meta ad ID' },
        name: { type: Type.STRING, description: 'Yeni reklam adi' },
        status: { type: Type.STRING, description: 'Yeni durum: ACTIVE, PAUSED' },
        creativeId: { type: Type.STRING, description: 'Yeni creative ID' },
      },
      required: ['adId'],
    },
  },
  {
    name: 'create_budget_schedule',
    description: 'Zamanlanmis butce plani olusturur — belirli tarihler arasinda butce artirma/azaltma (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetId: { type: Type.STRING, description: 'Hedef kampanya veya adset Meta ID' },
        budgetValue: { type: Type.NUMBER, description: 'Butce degeri (TL)' },
        timeStart: { type: Type.STRING, description: 'Baslangic zamani (ISO 8601)' },
        timeEnd: { type: Type.STRING, description: 'Bitis zamani (ISO 8601)' },
        targetType: { type: Type.STRING, description: 'Hedef tipi: campaign veya adset (varsayilan adset)' },
      },
      required: ['targetId', 'budgetValue', 'timeStart', 'timeEnd'],
    },
  },

  // ============================================
  // A/B Testing Tools (NEW — Faz 3)
  // ============================================
  {
    name: 'create_ab_test',
    description: 'A/B testi olusturur. 3 mod: dynamic_creative (tek adset, coklu varyant), ad_study (Meta native split test), manual_split (kopyala+farkli creative). (ONAY GEREKTIRIR)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        testName: { type: Type.STRING, description: 'Test adi' },
        testType: { type: Type.STRING, description: 'Test tipi: dynamic_creative, ad_study, manual_split' },
        campaignId: { type: Type.STRING, description: 'Hedef kampanya ID (ad_study icin)' },
        adsetId: { type: Type.STRING, description: 'Hedef adset ID (dynamic_creative icin)' },
        variants: {
          type: Type.OBJECT,
          description: 'Dynamic creative icin asset_feed_spec (images, titles, bodies dizileri)',
          properties: {
            images: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { hash: { type: Type.STRING } } } },
            titles: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } } },
            bodies: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } } },
          },
        },
        cells: {
          type: Type.ARRAY,
          description: 'Ad study icin test gruplari',
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              treatment_percentage: { type: Type.NUMBER },
              adsets: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
        startTime: { type: Type.STRING, description: 'Test baslangic zamani (ISO 8601)' },
        endTime: { type: Type.STRING, description: 'Test bitis zamani (ISO 8601)' },
      },
      required: ['testName', 'testType'],
    },
  },
  {
    name: 'get_ab_test_results',
    description: 'A/B test sonuclarini getirir. Dynamic creative icin adset ID, ad_study icin study ID kullanin.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        testId: { type: Type.STRING, description: 'Test ID (adset ID veya study ID)' },
        testType: { type: Type.STRING, description: 'Test tipi: dynamic_creative veya ad_study' },
      },
      required: ['testId', 'testType'],
    },
  },
  {
    name: 'duplicate_adset',
    description: 'Mevcut reklam setini kopyalar. A/B split test icin kullanilir. Reklamlari da kopyalar (opsiyonel). (ONAY GEREKTIRIR)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        sourceAdsetId: { type: Type.STRING, description: 'Kopyalanacak reklam seti Meta ID' },
        newName: { type: Type.STRING, description: 'Yeni reklam seti adi' },
        copyAds: { type: Type.BOOLEAN, description: 'Reklamlari da kopyala (varsayilan true)' },
      },
      required: ['sourceAdsetId', 'newName'],
    },
  },

  // ============================================
  // Performance & Reporting (NEW — Faz 4)
  // ============================================
  {
    name: 'get_performance_summary',
    description: 'Tum kampanyalarin KPI ozetini getirir: harcama, gosterim, tiklama, donusum, CTR, CPA + onceki donemle karsilastirma.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        dateStart: { type: Type.STRING, description: 'Baslangic tarihi (YYYY-MM-DD, varsayilan 30 gun once)' },
        dateEnd: { type: Type.STRING, description: 'Bitis tarihi (YYYY-MM-DD, varsayilan bugun)' },
        campaignId: { type: Type.STRING, description: 'Opsiyonel: Belirli kampanya Firestore ID' },
      },
    },
  },
  {
    name: 'get_performance_breakdown',
    description: 'Performans verilerini platform, kampanya veya gunluk bazda kirar. Tablo formatinda sunar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        breakdownType: { type: Type.STRING, description: 'Kirilim tipi: platform, campaign, daily (varsayilan campaign)' },
        dateStart: { type: Type.STRING, description: 'Baslangic tarihi (YYYY-MM-DD)' },
        dateEnd: { type: Type.STRING, description: 'Bitis tarihi (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'get_budget_overview',
    description: 'Tum kampanyalarin butce kullanim durumunu gosterir. >85% kullanan kampanyalar icin uyari verir.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_budget_alerts',
    description: 'Sadece butce uyarisi olan kampanyalari listeler (>85% kullanim).',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_reports_list',
    description: 'Mevcut pazarlama raporlarini listeler (en yeniden eskiye, max 20).',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'generate_report',
    description: 'AI destekli pazarlama performans raporu olusturur. Ozet, bulgular ve oneriler icerir (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        dateStart: { type: Type.STRING, description: 'Rapor baslangic tarihi (YYYY-MM-DD)' },
        dateEnd: { type: Type.STRING, description: 'Rapor bitis tarihi (YYYY-MM-DD)' },
        reportType: { type: Type.STRING, description: 'Rapor tipi: performance, budget, campaign (varsayilan performance)' },
        title: { type: Type.STRING, description: 'Rapor basligi (opsiyonel)' },
      },
    },
  },
  {
    name: 'get_optimization_suggestions',
    description: 'AI ile kampanya optimizasyon onerileri uretir. Her oneri: baslik, aciklama, etki seviyesi icerir.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'forecast_budget',
    description: 'Belirli bir kampanya icin AI butce tahmini yapar: gunluk harcama hizi, tahmini bitis tarihi, risk seviyesi.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        campaignId: { type: Type.STRING, description: 'Kampanya Firestore doc ID' },
      },
      required: ['campaignId'],
    },
  },

  // ============================================
  // Automation Rules (NEW — Faz 5)
  // ============================================
  {
    name: 'get_automation_rules',
    description: 'Otomasyon kurallarini listeler: ad, durum, kosullar, frekans, istatistikler.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_rule_execution_log',
    description: 'Belirli bir otomasyon kuralinin calisma gecmisini getirir.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ruleId: { type: Type.STRING, description: 'Kural Firestore doc ID' },
      },
      required: ['ruleId'],
    },
  },
  {
    name: 'create_automation_rule',
    description: 'Yeni otomasyon kurali olusturur: kosullar + aksiyon + frekans (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Kural adi' },
        conditions: {
          type: Type.ARRAY,
          description: 'Kosul dizisi',
          items: {
            type: Type.OBJECT,
            properties: {
              metric: { type: Type.STRING, description: 'Metrik: ctr, cpc, cpa, roas, spend, impressions, conversions, frequency, quality_score' },
              operator: { type: Type.STRING, description: 'Operator: greater_than, less_than, equals, between' },
              value: { type: Type.NUMBER, description: 'Esik degeri' },
              value2: { type: Type.NUMBER, description: 'Ikinci deger (between icin)' },
              timeWindow: { type: Type.STRING, description: 'Zaman penceresi: last_24h, last_3d, last_7d, last_30d' },
            },
            required: ['metric', 'operator', 'value'],
          },
        },
        conditionLogic: { type: Type.STRING, description: 'Kosul mantigi: and veya or (varsayilan and)' },
        action: {
          type: Type.OBJECT,
          description: 'Tetiklenecek aksiyon',
          properties: {
            type: { type: Type.STRING, description: 'Aksiyon tipi: pause_adset, increase_budget, decrease_budget, send_alert, change_bid, pause_campaign' },
            value: { type: Type.NUMBER, description: 'Aksiyon degeri (butce degisikligi yuzde vb.)' },
            notifyEmail: { type: Type.BOOLEAN, description: 'E-posta bildirimi gonder' },
          },
          required: ['type'],
        },
        frequency: { type: Type.STRING, description: 'Kontrol sikligi: hourly, every_6h, daily, weekly' },
        campaignIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Hedef kampanya ID listesi' },
      },
      required: ['name', 'conditions', 'action'],
    },
  },
  {
    name: 'update_automation_rule',
    description: 'Mevcut otomasyon kuralini gunceller: durum, kosullar, aksiyon (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ruleId: { type: Type.STRING, description: 'Kural Firestore doc ID' },
        name: { type: Type.STRING, description: 'Yeni kural adi' },
        status: { type: Type.STRING, description: 'Yeni durum: active, paused, archived' },
        conditions: { type: Type.ARRAY, description: 'Yeni kosullar', items: { type: Type.OBJECT, properties: { metric: { type: Type.STRING }, operator: { type: Type.STRING }, value: { type: Type.NUMBER } } } },
        conditionLogic: { type: Type.STRING, description: 'and veya or' },
        action: { type: Type.OBJECT, description: 'Yeni aksiyon', properties: { type: { type: Type.STRING }, value: { type: Type.NUMBER } } },
        frequency: { type: Type.STRING, description: 'Yeni frekans' },
      },
      required: ['ruleId'],
    },
  },
  {
    name: 'delete_automation_rule',
    description: 'Otomasyon kuralini siler (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ruleId: { type: Type.STRING, description: 'Silinecek kural Firestore doc ID' },
      },
      required: ['ruleId'],
    },
  },

  // ============================================
  // Competitor Intelligence (NEW — Faz 6)
  // ============================================
  {
    name: 'get_competitors',
    description: 'Izlenen rakipleri listeler: ad, web sitesi, sektor, platformlar, durum.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_competitor_analysis',
    description: 'Belirli bir rakibin en son SWOT analizini gosterir.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        competitorId: { type: Type.STRING, description: 'Rakip Firestore doc ID' },
      },
      required: ['competitorId'],
    },
  },
  {
    name: 'add_competitor',
    description: 'Yeni rakip izleme listesine ekler (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Rakip firma adi' },
        website: { type: Type.STRING, description: 'Web sitesi URL' },
        sector: { type: Type.STRING, description: 'Sektor' },
        platforms: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Izlenecek platformlar: meta, google, tiktok, linkedin' },
        frequency: { type: Type.STRING, description: 'Analiz sikligi: daily, weekly, monthly' },
      },
      required: ['name'],
    },
  },
  {
    name: 'analyze_competitor',
    description: 'AI rakip analizi baslatir: SWOT, strateji ozeti, reklam ornekleri, oneriler (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        competitorId: { type: Type.STRING, description: 'Analiz yapilacak rakip Firestore doc ID' },
      },
      required: ['competitorId'],
    },
  },

  // ============================================
  // AdSet & Ad Read Tools (NEW — Faz 1)
  // ============================================
  {
    name: 'get_adsets',
    description: 'Hesap veya belirli bir kampanyadaki reklam setlerini listeler. Hedefleme, butce ve durum bilgileri icerir.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        campaignId: { type: Type.STRING, description: 'Opsiyonel: Belirli kampanyanin Meta campaign ID\'si' },
        statusFilter: { type: Type.STRING, description: 'Filtre: "active", "paused", "all" (varsayilan all)' },
        limit: { type: Type.NUMBER, description: 'Maksimum sonuc sayisi (varsayilan 50)' },
      },
    },
  },
  {
    name: 'get_adset_details',
    description: 'Belirli bir reklam setinin tum detaylarini getirir: hedefleme agaci, butce, teklif stratejisi, ogrenme asamasi.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        adsetId: { type: Type.STRING, description: 'Meta Ad Set ID' },
      },
      required: ['adsetId'],
    },
  },
  {
    name: 'get_ads',
    description: 'Reklam seti veya kampanya altindaki reklamlari listeler. Kreatif onizleme ve durum bilgileri icerir.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        adsetId: { type: Type.STRING, description: 'Opsiyonel: Belirli reklam seti Meta ID' },
        campaignId: { type: Type.STRING, description: 'Opsiyonel: Belirli kampanya Meta ID' },
        statusFilter: { type: Type.STRING, description: 'Filtre: "active", "paused", "all" (varsayilan all)' },
        limit: { type: Type.NUMBER, description: 'Maksimum sonuc sayisi (varsayilan 50)' },
      },
    },
  },
  {
    name: 'get_ad_details',
    description: 'Belirli bir reklaimin tum detaylarini getirir: kreatif onizleme, inceleme durumu, Meta onerileri.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        adId: { type: Type.STRING, description: 'Meta Ad ID' },
      },
      required: ['adId'],
    },
  },
];
