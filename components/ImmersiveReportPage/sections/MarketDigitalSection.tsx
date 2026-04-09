import React from 'react';
import SectionBase, { FeatureCard, GlassCard, CompactCard, CardStack, CardRow, TwoCol, SectionTitle, Tag, MetricBar, C, toStr, type SectionVisual } from '../SectionBase';

interface Props {
  index: number; total?: number; visual: SectionVisual | undefined;
  sectorResearch?: any;
  competitorDiscovery?: any;
  analysis?: any;
  digitalPresence?: any;
}

export default function MarketDigitalSection({ index, total, visual, sectorResearch, competitorDiscovery, analysis, digitalPresence }: Props) {
  const competitors = [...(competitorDiscovery?.knownCompetitors || []), ...(competitorDiscovery?.discoveredCompetitors || []), ...(sectorResearch?.competitors || [])].slice(0, 12);
  const trends = sectorResearch?.marketTrends?.slice(0, 8) || [];
  const market = sectorResearch?.marketData;
  const website = digitalPresence?.website;
  const instagram = digitalPresence?.instagram;

  return (
    <SectionBase id="marketdigital" index={index} total={total} label="Pazar & Dijital" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── HERO: Market stats + Digital score ── */}
        <CardRow gap={14}>
          {market?.marketSize && (
            <FeatureCard style={{ flex: 1, textAlign: 'center', padding: '20px 22px' }}>
              <div style={{ color: C.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Pazar Büyüklüğü</div>
              <div style={{ color: C.text, fontSize: 24, fontWeight: 700, fontFamily: C.serif }}>{market.marketSize}</div>
            </FeatureCard>
          )}
          {market?.growthRate && (
            <FeatureCard accent={C.pos} style={{ flex: 1, textAlign: 'center', padding: '20px 22px' }}>
              <div style={{ color: C.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Büyüme</div>
              <div style={{ color: C.pos, fontSize: 24, fontWeight: 700, fontFamily: C.serif }}>{market.growthRate}</div>
            </FeatureCard>
          )}
          {digitalPresence?.overallDigitalScore !== undefined && (
            <FeatureCard accent={C.text} style={{ flex: 1, textAlign: 'center', padding: '20px 22px' }}>
              <div style={{ color: C.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Dijital Skor</div>
              <div style={{ color: C.text, fontSize: 24, fontWeight: 700, fontFamily: C.serif }}>{digitalPresence.overallDigitalScore}<span style={{ fontSize: 14, color: C.faint, fontFamily: C.mono }}>/10</span></div>
            </FeatureCard>
          )}
        </CardRow>

        <div style={{ marginTop: 28 }}>
          <TwoCol>
            {/* ── LEFT: SWOT + Competitors + Trends ── */}
            <CardStack>
              {/* SWOT */}
              {analysis && (analysis.strengths?.length > 0 || analysis.opportunities?.length > 0) && (
                <FeatureCard accent={C.blue}>
                  <SectionTitle>SWOT Analizi</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, rowGap: 16 }}>
                    {[
                      { label: 'Güçlü Yönler', items: analysis.strengths, color: C.pos },
                      { label: 'Fırsatlar', items: analysis.opportunities, color: C.blue },
                      { label: 'Zorluklar', items: analysis.challenges, color: C.warn },
                      { label: 'Öneriler', items: analysis.recommendations, color: '#7c3aed' },
                    ].map(({ label, items, color }) => (items as string[] | undefined)?.length ? (
                      <div key={label}>
                        <div style={{ color, fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
                        {(items as any[]).slice(0, 3).map((item: any, idx: number) => (
                          <div key={idx} style={{ color: C.mid, fontSize: 14, marginBottom: 6, lineHeight: 1.5 }}>· {toStr(item).slice(0, 80)}</div>
                        ))}
                      </div>
                    ) : null)}
                  </div>
                </FeatureCard>
              )}

              {/* Competitors */}
              {competitors.length > 0 && (
                <>
                  <SectionTitle>Rakipler</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {competitors.map((c: any, i: number) => (
                      <GlassCard key={i} style={{ padding: '16px 20px' }}>
                        <div style={{ color: C.text, fontSize: 15, fontWeight: 700, marginBottom: 5 }}>{c.name}</div>
                        <div style={{ color: C.mid, fontSize: 13, lineHeight: 1.55, marginBottom: 8 }}>{(c.positioning || '').slice(0, 90)}</div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {(c.strengths || []).slice(0, 2).map((s: any, si: number) => <Tag key={si} color={C.posBg}>{toStr(s).slice(0, 20)}</Tag>)}
                          {(c.weaknesses || []).slice(0, 1).map((w: any, wi: number) => <Tag key={wi} color={C.negBg}>{toStr(w).slice(0, 20)}</Tag>)}
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                </>
              )}

              {/* Trends */}
              {trends.length > 0 && (
                <GlassCard>
                  <SectionTitle>Sektör Trendleri</SectionTitle>
                  {trends.map((t: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 10, marginBottom: 10, borderBottom: i < trends.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                      <span style={{ color: C.xfaint, fontFamily: C.mono, fontSize: 12, minWidth: 22, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                      <span style={{ color: C.mid, fontSize: 14, lineHeight: 1.55 }}>{toStr(t)}</span>
                    </div>
                  ))}
                </GlassCard>
              )}

              {competitorDiscovery?.competitiveLandscapeSummary && (
                <FeatureCard accent={C.faint}>
                  <SectionTitle>Rekabet Özeti</SectionTitle>
                  <p style={{ color: C.mid, fontSize: 15, lineHeight: 1.65, margin: 0 }}>{toStr(competitorDiscovery.competitiveLandscapeSummary).slice(0, 300)}</p>
                </FeatureCard>
              )}
            </CardStack>

            {/* ── RIGHT: Digital Audit ── */}
            <CardStack>
              {/* Website */}
              {website && website.status !== 'not_provided' && (
                <GlassCard style={{ borderLeft: `4px solid ${website.status === 'analyzed' ? C.pos : C.faint}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <SectionTitle>Web Sitesi</SectionTitle>
                    {website.status && <Tag color={website.status === 'analyzed' ? C.posBg : C.tagBg}>{website.status}</Tag>}
                  </div>
                  {website.designQuality && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ color: C.mid, fontSize: 14 }}>Tasarım Kalitesi</span>
                      <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{website.designQuality}</span>
                    </div>
                  )}
                  {website.seoBasics && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ color: C.faint, fontSize: 12, marginBottom: 8, letterSpacing: '0.1em' }}>SEO TEMEL</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        {[{ key: 'hasTitle', label: 'Title' }, { key: 'hasDescription', label: 'Meta Desc' }, { key: 'hasOGTags', label: 'OG Tags' }, { key: 'mobileOptimized', label: 'Mobile' }].map(({ key, label }) => (
                          <CompactCard key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
                            <span style={{ color: website.seoBasics?.[key] || website[key] ? C.pos : C.neg, fontSize: 15, fontWeight: 700 }}>{website.seoBasics?.[key] || website[key] ? '✓' : '✗'}</span>
                            <span style={{ color: C.mid, fontSize: 13 }}>{label}</span>
                          </CompactCard>
                        ))}
                      </div>
                    </div>
                  )}
                  {website.overallImpression && <p style={{ color: C.mid, fontSize: 14, lineHeight: 1.6, margin: '0 0 10px 0' }}>{website.overallImpression}</p>}
                  {website.strengths?.length > 0 && <div style={{ marginBottom: 8 }}>{website.strengths.map((s: string, i: number) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 14 }}><span style={{ color: C.pos, flexShrink: 0 }}>✓</span><span style={{ color: C.mid }}>{s}</span></div>)}</div>}
                  {website.weaknesses?.length > 0 && <div>{website.weaknesses.map((w: string, i: number) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 14 }}><span style={{ color: C.neg, flexShrink: 0 }}>✗</span><span style={{ color: C.mid }}>{w}</span></div>)}</div>}
                </GlassCard>
              )}

              {/* Instagram */}
              {instagram && instagram.status !== 'not_provided' && (
                <GlassCard style={{ borderLeft: '4px solid #e1306c' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <SectionTitle>Instagram</SectionTitle>
                    {instagram.engagementLevel && <Tag>{instagram.engagementLevel}</Tag>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                    {[{ label: 'Takipçi', value: instagram.followerRange }, { label: 'Yayın Sıklığı', value: instagram.postingFrequency }, { label: 'Görsel Stil', value: instagram.visualStyle }].filter(i => i.value).map(({ label, value }) => (
                      <CompactCard key={label} style={{ textAlign: 'center', padding: '10px 12px' }}>
                        <div style={{ color: C.faint, fontSize: 11, marginBottom: 4 }}>{label}</div>
                        <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{value}</div>
                      </CompactCard>
                    ))}
                  </div>
                  {instagram.contentThemes?.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>{instagram.contentThemes.map((t: string) => <Tag key={t}>{t}</Tag>)}</div>}
                  {instagram.strengths?.length > 0 && <div style={{ marginBottom: 8 }}>{instagram.strengths.map((s: string, i: number) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 14 }}><span style={{ color: C.pos, flexShrink: 0 }}>✓</span><span style={{ color: C.mid }}>{s}</span></div>)}</div>}
                  {instagram.weaknesses?.length > 0 && <div>{instagram.weaknesses.map((w: string, i: number) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 14 }}><span style={{ color: C.neg, flexShrink: 0 }}>✗</span><span style={{ color: C.mid }}>{w}</span></div>)}</div>}
                </GlassCard>
              )}

              {/* Critical Gaps + Quick Wins */}
              {digitalPresence?.criticalGaps?.length > 0 && (
                <FeatureCard accent={C.neg} tint={C.negBg}>
                  <SectionTitle>Kritik Eksikler</SectionTitle>
                  {digitalPresence.criticalGaps.map((g: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 14, lineHeight: 1.55 }}>
                      <span style={{ color: C.neg, fontWeight: 700, flexShrink: 0 }}>!</span><span style={{ color: C.mid }}>{g}</span>
                    </div>
                  ))}
                </FeatureCard>
              )}
              {digitalPresence?.quickWins?.length > 0 && (
                <FeatureCard accent={C.pos} tint={C.posBg}>
                  <SectionTitle>Hızlı Kazanımlar</SectionTitle>
                  {digitalPresence.quickWins.map((w: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 14, lineHeight: 1.55 }}>
                      <span style={{ color: C.pos, fontWeight: 700, flexShrink: 0 }}>→</span><span style={{ color: C.mid }}>{w}</span>
                    </div>
                  ))}
                </FeatureCard>
              )}
            </CardStack>
          </TwoCol>
        </div>
      </div>
    </SectionBase>
  );
}
