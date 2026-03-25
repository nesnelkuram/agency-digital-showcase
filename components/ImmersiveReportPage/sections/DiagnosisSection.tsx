import React from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, C, toStr, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  total?: number;
  visual: SectionVisual | undefined;
  diagnosisSummary?: any;
  brandMaturity?: any;
  dataQuality?: any;
  synthesisRationale?: string;
  consultantIntro?: string;
  businessContext?: any;
}

const MATURITY_LEVELS = ['pre_brand', 'emerging', 'developing', 'mature'];
const MATURITY_LABELS: Record<string, string> = {
  pre_brand: 'Ön-Marka', emerging: 'Gelişen', developing: 'Olgunlaşan', mature: 'Olgun',
};

const STAGE_LABELS: Record<string, string> = {
  idea: 'Fikir Aşaması', new: 'Yeni Kuruldu (0-1 yıl)',
  growing: 'Büyüme Aşaması (1-3 yıl)', established: 'Yerleşik (3+ yıl)',
};

export default function DiagnosisSection({ index, total, visual, diagnosisSummary, brandMaturity, dataQuality, synthesisRationale, consultantIntro, businessContext }: Props) {
  const maturityIdx = MATURITY_LEVELS.indexOf(brandMaturity?.level || '');

  return (
    <SectionBase id="diagnosis" index={index} total={total} label="Teşhis & Öngörü" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Consultant intro — client-facing only */}
        {consultantIntro && (
          <div style={{ marginBottom: 22, maxWidth: 860, borderLeft: `3px solid rgba(0,0,0,0.15)`, paddingLeft: 18 }}>
            <p style={{ color: C.mid, fontSize: 'clamp(13px, 1.4vw, 16px)', lineHeight: 1.7, fontStyle: 'italic' }}>
              {consultantIntro}
            </p>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 18, alignItems: 'start',
        }}>
          {/* Left: Perception vs Reality */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {diagnosisSummary?.criticalMisalignment && (
              <GlassCard style={{ background: C.negBg, border: `1px solid ${C.neg}25` }}>
                <div style={{ color: C.neg, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 5 }}>
                  Kritik Uyumsuzluk
                </div>
                <p style={{ color: C.text, fontSize: 13, fontWeight: 600, lineHeight: 1.55 }}>
                  {diagnosisSummary.criticalMisalignment}
                </p>
              </GlassCard>
            )}

            {diagnosisSummary?.perceptionVsReality?.length > 0 && (
              <GlassCard>
                <SectionTitle>Algı vs Gerçeklik</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {diagnosisSummary.perceptionVsReality.map((item: any, i: number) => (
                    <div key={i}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
                        gap: 8, marginBottom: 5,
                      }}>
                        <div style={{ background: 'rgba(155,35,53,0.06)', border: `1px solid ${C.neg}18`, borderRadius: 8, padding: '8px 12px' }}>
                          <div style={{ color: C.neg, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Algı</div>
                          <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.5 }}>{item.perception}</p>
                        </div>
                        <div style={{ background: 'rgba(45,106,79,0.07)', border: `1px solid ${C.pos}18`, borderRadius: 8, padding: '8px 12px' }}>
                          <div style={{ color: C.pos, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Gerçeklik</div>
                          <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.5 }}>{item.reality}</p>
                        </div>
                      </div>
                      {(item.gap || item.recommendation) && (
                        <div style={{ background: C.tagBg, borderRadius: 8, padding: '7px 10px' }}>
                          {item.gap && <p style={{ color: C.mid, fontSize: 11, marginBottom: item.recommendation ? 3 : 0 }}>
                            <span style={{ color: C.faint }}>Fark: </span>{item.gap}
                          </p>}
                          {item.recommendation && <p style={{ color: C.mid, fontSize: 11 }}>
                            <span style={{ color: C.text, fontWeight: 600 }}>Öneri: </span>{item.recommendation}
                          </p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {diagnosisSummary?.blindSpots?.length > 0 && (
              <GlassCard>
                <SectionTitle>Görülmeyen Güçler</SectionTitle>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {diagnosisSummary.blindSpots.map((b: any, i: number) => (
                    <Tag key={i}>{toStr(b)}</Tag>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Business context */}
            {businessContext && (
              <GlassCard>
                <SectionTitle>İş Profili</SectionTitle>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))',
                  gap: 8,
                }}>
                  {[
                    { label: 'İş Aşaması', value: STAGE_LABELS[businessContext.businessStage] || businessContext.businessStage },
                    { label: 'Coğrafi Alan', value: businessContext.geoScope },
                    { label: 'Çalışan Sayısı', value: businessContext.employeeCount },
                    { label: 'Aylık Ciro', value: businessContext.monthlyRevenue },
                  ].filter(f => f.value).map(({ label, value }) => (
                    <div key={label} style={{ background: C.tagBg, borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ color: C.faint, fontSize: 9, marginBottom: 3 }}>{label}</div>
                      <div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>
                {businessContext.primaryGoal && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ color: C.faint, fontSize: 10, marginBottom: 3 }}>BİRİNCİL HEDEF</div>
                    <p style={{ color: C.mid, fontSize: 12 }}>{businessContext.primaryGoal}</p>
                  </div>
                )}
                {businessContext.digitalPlatforms?.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {businessContext.digitalPlatforms.map((p: string) => (
                      <Tag key={p}>{p}</Tag>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}
          </div>

          {/* Right: Maturity + Data Quality */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {brandMaturity && (
              <GlassCard>
                <SectionTitle>Marka Olgunluk Seviyesi</SectionTitle>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  {MATURITY_LEVELS.map((level, i) => (
                    <div key={level} style={{
                      flex: 1, height: 6, borderRadius: 3,
                      background: i <= maturityIdx ? C.text : 'rgba(0,0,0,0.1)',
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  {MATURITY_LEVELS.map((level) => (
                    <span key={level} style={{
                      fontSize: 9, fontFamily: 'monospace',
                      color: brandMaturity.level === level ? C.text : C.xfaint,
                      fontWeight: brandMaturity.level === level ? 700 : 400,
                    }}>
                      {MATURITY_LABELS[level]}
                    </span>
                  ))}
                </div>

                {brandMaturity.factors && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 100px), 1fr))',
                    gap: 8,
                  }}>
                    {[
                      { label: 'İş Yaşı', value: brandMaturity.factors.businessAge ?? 0 },
                      { label: 'Marka Varlıkları', value: brandMaturity.factors.brandAssets ?? 0 },
                      { label: 'Dijital Varlık', value: brandMaturity.factors.digitalPresence ?? 0 },
                      { label: 'Kitle Büyüklüğü', value: brandMaturity.factors.audienceSize ?? 0 },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background: C.tagBg, borderRadius: 8, padding: '7px 10px' }}>
                        <div style={{ color: C.faint, fontSize: 9, marginBottom: 4 }}>{label}</div>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {[1, 2, 3].map(n => (
                            <div key={n} style={{
                              flex: 1, height: 4, borderRadius: 2,
                              background: n <= value ? C.text : 'rgba(0,0,0,0.1)',
                            }} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {brandMaturity.reportFocus && (
                  <p style={{ color: C.mid, fontSize: 11, lineHeight: 1.55, marginTop: 10 }}>
                    {brandMaturity.reportFocus}
                  </p>
                )}
              </GlassCard>
            )}

            {dataQuality?.contradictions?.length > 0 && (
              <GlassCard>
                <SectionTitle>Dikkat Gerektiren Noktalar</SectionTitle>
                {dataQuality.contradictions.map((c: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, color: C.mid, fontSize: 12, lineHeight: 1.5 }}>
                    <span style={{ color: C.neg, fontWeight: 700 }}>!</span>
                    <span>{c}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {dataQuality?.patterns?.length > 0 && (
              <GlassCard>
                <SectionTitle>Tespit Edilen Örüntüler</SectionTitle>
                {dataQuality.patterns.map((p: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, color: C.mid, fontSize: 12, lineHeight: 1.5 }}>
                    <span style={{ color: C.pos }}>·</span>
                    <span>{p}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {!diagnosisSummary && !brandMaturity && !dataQuality && (
              <GlassCard>
                <SectionTitle>Analiz Notu</SectionTitle>
                <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65 }}>
                  Bu analiz marka durumunuzu çok boyutlu olarak değerlendirmektedir. Teşhis verileri bu raporu hazırlayan pipeline'ın çalıştırıldığı versiyona bağlıdır.
                </p>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </SectionBase>
  );
}
