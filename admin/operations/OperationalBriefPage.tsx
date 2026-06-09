import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Save } from 'lucide-react';
import { useTenantId } from '@/shared/hooks/useTenant';
import {
  OperationalBrief,
  OPERATIONAL_BRIEF_SECTIONS,
  OPERATIONAL_BRIEF_STATUS_LABELS,
  CONVERSION_CHANNEL_LABELS,
  ConversionChannel,
} from '@/shared/types/operationalBrief';
import {
  ensureBriefForLead,
  getOperationalBrief,
  updateOperationalBrief,
} from '@/shared/services/operationalBriefService';

// ─────────────────────────────────────────────────────────────────────────
// Alan tanımları: her bölümün düz metin alanları (key → etiket + ipucu)
// Karmaşık alanlar (boolean, çoklu seçim) ayrıca render edilir.
// ─────────────────────────────────────────────────────────────────────────
type FieldDef = { key: string; label: string; hint?: string; long?: boolean };

const TEXT_FIELDS: Record<string, FieldDef[]> = {
  performance: [
    { key: 'monthlyRevenue', label: 'Aylık ciro aralığı', hint: 'Opsiyonel — gizli kalabilir' },
    { key: 'monthlyWebsiteVisitors', label: 'Aylık web ziyaretçisi' },
    { key: 'instagramEngagementRate', label: 'Ort. Instagram etkileşim oranı' },
    { key: 'monthlyLeadsOrSales', label: 'Aylık müşteri adayı / satış adedi' },
    { key: 'averageOrderValue', label: 'Ortalama sepet/işlem tutarı' },
    { key: 'currentMonthlyAdSpend', label: 'Mevcut aylık reklam harcaması' },
    { key: 'currentRoasOrCac', label: 'Mevcut ROAS / müşteri edinme maliyeti' },
    { key: 'baselineNotes', label: 'Not', hint: 'Bilinen sayılar, dönemsel kıyas', long: true },
  ],
  production: [
    { key: 'shootAccessNotes', label: 'Çekim erişimi', hint: 'Lokasyon, ürün, model, izin', long: true },
    { key: 'monthlyContentCapacityNeeded', label: 'Beklenen aylık içerik hacmi', hint: 'Örn. 12 post + 8 reel' },
    { key: 'brandAssetFiles', label: 'Logo/font/renk dosyaları durumu', hint: 'Var / yok / link' },
    { key: 'contentApprover', label: 'İçeriği onaylayan kişi', hint: 'İsim / rol' },
    { key: 'approvalTurnaround', label: 'Onay süresi', hint: 'Örn. 24 saat, haftada 1 toplu' },
  ],
  catalog: [
    { key: 'heroProducts', label: 'Öne çıkarılacak ürün/hizmetler', long: true },
    { key: 'highestMarginItems', label: 'En yüksek marjlı kalemler' },
    { key: 'newOrSeasonalLaunches', label: 'Yaklaşan lansman / sezonsal ürün' },
    { key: 'itemsToDeprioritize', label: 'Öne çıkarılMAYACAKlar' },
    { key: 'priceRange', label: 'Fiyat aralığı' },
  ],
  seasonality: [
    { key: 'peakPeriods', label: 'Yoğun dönemler', hint: 'Örn. Kasım–Aralık, bayram öncesi' },
    { key: 'slowPeriods', label: 'Ölü sezon' },
    { key: 'upcomingKeyDates', label: 'Yaklaşan kritik tarihler', long: true },
    { key: 'recurringCampaigns', label: 'Düzenli kampanyalar' },
  ],
  conversion: [
    { key: 'salesCycleLength', label: 'Karar/satış döngüsü süresi' },
    { key: 'whoHandlesInbound', label: 'Gelen talebe kim, ne kadar hızlı yanıt veriyor?' },
    { key: 'conversionNotes', label: 'Funnel darboğazı / sızıntı', long: true },
  ],
  dataAssets: [
    { key: 'emailListSize', label: 'E-posta listesi büyüklüğü' },
    { key: 'customerDataNotes', label: 'Sadakat programı / geçmiş alıcı verisi', long: true },
  ],
  constraints: [
    { key: 'legalOrComplianceLimits', label: 'Söylenemeyecekler', hint: 'Yasal/sektörel iddia kısıtları', long: true },
    { key: 'toneOrContentNoGo', label: 'Yapılmayacak içerik/ton' },
    { key: 'competitorsOffLimits', label: 'Adı geçirilmeyecek rakipler' },
    { key: 'accountAccessReady', label: 'Verilecek hesap erişimleri', hint: 'Meta BM, Google Ads, web admin' },
    { key: 'internalContacts', label: 'Ajansın muhatap olacağı kişiler', long: true },
  ],
};

const BOOL_FIELDS: Record<string, FieldDef[]> = {
  performance: [{ key: 'hasAnalyticsAccess', label: 'GA4 / Meta Insights erişimi sağlanabilir mi?' }],
  production: [
    { key: 'canShootOnSite', label: 'Mekânda/sahada çekim yapılabilir mi?' },
    { key: 'productSamplesAvailable', label: 'Çekim için ürün numunesi sağlanabilir mi?' },
  ],
  dataAssets: [
    { key: 'hasCrm', label: 'CRM / müşteri veritabanı var mı?' },
    { key: 'hasPixelInstalled', label: 'Meta Pixel / GA etiketi kurulu mu?' },
  ],
};

const ASSET_READINESS_OPTIONS = [
  { id: 'rich', label: 'Zengin (bol profesyonel görsel/video)' },
  { id: 'some', label: 'Bir miktar var' },
  { id: 'minimal', label: 'Çok az' },
  { id: 'none', label: 'Hiç yok' },
];

const OperationalBriefPage: React.FC = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const tenantId = useTenantId();

  const navState = (location.state || {}) as { businessName?: string; sector?: string };

  const [brief, setBrief] = useState<OperationalBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string>('performance');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tenantId || !leadId) return;
      try {
        const briefId = await ensureBriefForLead(tenantId, {
          id: leadId,
          businessName: navState.businessName || 'İşletme',
          sector: navState.sector || '',
        });
        const loaded = await getOperationalBrief(briefId);
        if (!cancelled) setBrief(loaded);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Brief yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, leadId]);

  const setField = (sectionKey: string, fieldKey: string, value: unknown) => {
    setBrief((prev) => {
      if (!prev) return prev;
      const section = { ...(prev as any)[sectionKey], [fieldKey]: value };
      return { ...prev, [sectionKey]: section };
    });
  };

  const saveSection = async (sectionKey: string) => {
    if (!brief) return;
    setSavingSection(sectionKey);
    setSavedSection(null);
    try {
      await updateOperationalBrief(
        brief.id,
        { [sectionKey]: (brief as any)[sectionKey] } as Partial<OperationalBrief>,
        { filledBy: 'admin' }
      );
      const refreshed = await getOperationalBrief(brief.id);
      setBrief(refreshed);
      setSavedSection(sectionKey);
      setTimeout(() => setSavedSection(null), 2000);
    } catch (e: any) {
      setError(e?.message || 'Kaydedilemedi');
    } finally {
      setSavingSection(null);
    }
  };

  const completion = brief?.completionPercent ?? 0;
  const conversionChannels = (brief?.conversion?.primaryChannels || []) as ConversionChannel[];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="p-8 text-center font-grotesk">
        <p className="text-red-600">{error || 'Brief bulunamadı'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-neutral-100 rounded-full text-sm">
          Geri Dön
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-neutral-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold font-ramillas">Operasyonel Brief</h1>
          <p className="text-sm text-neutral-500 font-grotesk">
            {brief.businessName} — stratejiyi aylık faaliyet planına dönüştürmek için operasyonel veri
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-grotesk text-neutral-500 mb-1">
          <span>{OPERATIONAL_BRIEF_STATUS_LABELS[brief.status]}</span>
          <span>%{completion} dolu</span>
        </div>
        <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
          <div className="h-full bg-[#171717] transition-all" style={{ width: `${completion}%` }} />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {OPERATIONAL_BRIEF_SECTIONS.map((section) => {
          const isOpen = openSection === section.key;
          const sectionData = (brief as any)[section.key] || {};
          return (
            <div key={section.key} className="border border-neutral-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenSection(isOpen ? '' : section.key)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50"
              >
                <div>
                  <div className="font-semibold font-grotesk text-sm">{section.title}</div>
                  <div className="text-xs text-neutral-500 font-grotesk">{section.description}</div>
                </div>
                <span className="text-neutral-400 text-sm">{isOpen ? '−' : '+'}</span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                  {/* AssetReadiness (sadece production) */}
                  {section.key === 'production' && (
                    <label className="block">
                      <span className="text-xs font-grotesk text-neutral-600">Mevcut profesyonel görsel/video stoku</span>
                      <select
                        value={sectionData.existingVisualAssets || ''}
                        onChange={(e) => setField('production', 'existingVisualAssets', e.target.value || undefined)}
                        className="mt-1 w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm"
                      >
                        <option value="">Seçin</option>
                        {ASSET_READINESS_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  {/* Text fields */}
                  {(TEXT_FIELDS[section.key] || []).map((f) => (
                    <label key={f.key} className="block">
                      <span className="text-xs font-grotesk text-neutral-600">
                        {f.label}{f.hint ? <span className="text-neutral-400"> — {f.hint}</span> : null}
                      </span>
                      {f.long ? (
                        <textarea
                          value={sectionData[f.key] || ''}
                          onChange={(e) => setField(section.key, f.key, e.target.value)}
                          rows={2}
                          className="mt-1 w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm resize-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={sectionData[f.key] || ''}
                          onChange={(e) => setField(section.key, f.key, e.target.value)}
                          className="mt-1 w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm"
                        />
                      )}
                    </label>
                  ))}

                  {/* Conversion channels (sadece conversion) */}
                  {section.key === 'conversion' && (
                    <div>
                      <span className="text-xs font-grotesk text-neutral-600">Satışın gerçekleştiği ana kanal(lar)</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(Object.keys(CONVERSION_CHANNEL_LABELS) as ConversionChannel[]).map((ch) => {
                          const active = conversionChannels.includes(ch);
                          return (
                            <button
                              key={ch}
                              type="button"
                              onClick={() => {
                                const next = active
                                  ? conversionChannels.filter((c) => c !== ch)
                                  : [...conversionChannels, ch];
                                setField('conversion', 'primaryChannels', next);
                              }}
                              className={`px-3 py-1 rounded-full text-xs font-grotesk border ${
                                active ? 'bg-[#171717] text-white border-[#171717]' : 'border-neutral-300 text-neutral-600'
                              }`}
                            >
                              {CONVERSION_CHANNEL_LABELS[ch]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Boolean fields */}
                  {(BOOL_FIELDS[section.key] || []).map((f) => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!sectionData[f.key]}
                        onChange={(e) => setField(section.key, f.key, e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-grotesk text-neutral-700">{f.label}</span>
                    </label>
                  ))}

                  <button
                    onClick={() => saveSection(section.key)}
                    disabled={savingSection === section.key}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm disabled:opacity-50"
                  >
                    {savingSection === section.key ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : savedSection === section.key ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {savedSection === section.key ? 'Kaydedildi' : 'Bölümü Kaydet'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OperationalBriefPage;
