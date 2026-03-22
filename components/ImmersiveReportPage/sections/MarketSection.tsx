import React from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, C, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  visual: SectionVisual | undefined;
  sectorResearch?: any;
  competitorDiscovery?: any;
  analysis?: any;
  digitalPresence?: any;
}

export default function MarketSection({ index, visual, sectorResearch, competitorDiscovery, analysis, digitalPresence }: Props) {
  const competitors = [
    ...(competitorDiscovery?.knownCompetitors || []),
    ...(competitorDiscovery?.discoveredCompetitors || []),
    ...(sectorResearch?.competitors || []),
  ].slice(0, 8);

  const trends = sectorResearch?.marketTrends?.slice(0, 5) || [];
  const market = sectorResearch?.marketData;

  return (
    <SectionBase id="market" index={index} label="Rekabet & Pazar" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,0.75fr)', gap: 18 }}>

          {/* Left: SWOT + competitors */}
          <div>
            {/* SWOT */}
            {analysis && (analysis.strengths?.length > 0 || analysis.opportunities?.length > 0) && (
              <GlassCard style={{ marginBottom: 12 }}>
                <SectionTitle>SWOT Analizi</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: '💪 Güçlü Yönler', items: analysis.strengths, color: C.pos },
                    { label: '🚀 Fırsatlar', items: analysis.opportunities, color: '#1d4ed8' },
                    { label: '⚠️ Zorluklar', items: analysis.challenges, color: '#a16207' },
                    { label: '💡 Öneriler', items: analysis.recommendations, color: '#7c3aed' },
                  ].map(({ label, items, color }) => (items as string[] | undefined)?.length ? (
                    <div key={label}>
                      <div style={{ color, fontSize: 10, fontWeight: 700, marginBottom: 5 }}>{label}</div>
                      {(items as string[]).slice(0, 3).map((item: string) => (
                        <div key={item} style={{ color: C.mid, fontSize: 11, marginBottom: 3, lineHeight: 1.4 }}>
                          · {item.slice(0, 70)}
                        </div>
                      ))}
                    </div>
                  ) : null)}
                </div>
              </GlassCard>
            )}

            {/* Market stats */}
            {market && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {market.marketSize && (
                  <GlassCard style={{ flex: 1, padding: '12px 14px' }}>
                    <div style={{ color: C.faint, fontSize: 9, textTransform: 'uppercase' }}>Pazar Büyüklüğü</div>
                    <div style={{ color: C.text, fontSize: 16, fontWeight: 700, marginTop: 3 }}>{market.marketSize}</div>
                  </GlassCard>
                )}
                {market.growthRate && (
                  <GlassCard style={{ flex: 1, padding: '12px 14px' }}>
                    <div style={{ color: C.faint, fontSize: 9, textTransform: 'uppercase' }}>Büyüme</div>
                    <div style={{ color: C.pos, fontSize: 16, fontWeight: 700, marginTop: 3 }}>{market.growthRate}</div>
                  </GlassCard>
                )}
                {market.keyPlayers && (
                  <GlassCard style={{ flex: 1, padding: '12px 14px' }}>
                    <div style={{ color: C.faint, fontSize: 9, textTransform: 'uppercase' }}>Oyuncular</div>
                    <div style={{ color: C.text, fontSize: 12, fontWeight: 600, marginTop: 3 }}>{market.keyPlayers}</div>
                  </GlassCard>
                )}
              </div>
            )}

            {/* Competitors grid */}
            {competitors.length > 0 && (
              <div>
                <SectionTitle>Rakipler</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, maxHeight: '38vh', overflowY: 'auto' }}>
                  {competitors.map((c: any, i: number) => (
                    <GlassCard key={i} style={{ padding: '12px 14px' }}>
                      <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{c.name}</div>
                      <div style={{ color: C.mid, fontSize: 11, lineHeight: 1.5, marginBottom: 7 }}>
                        {(c.positioning || '').slice(0, 80)}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(c.strengths || []).slice(0, 2).map((s: string) => (
                          <Tag key={s} color={C.posBg}>{s.slice(0, 18)}</Tag>
                        ))}
                        {(c.weaknesses || []).slice(0, 1).map((w: string) => (
                          <Tag key={w} color={C.negBg}>{w.slice(0, 18)}</Tag>
                        ))}
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: trends + landscape + digital */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {trends.length > 0 && (
              <GlassCard>
                <SectionTitle>Sektör Trendleri</SectionTitle>
                {trends.map((t: string, i: number) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    paddingBottom: 8, marginBottom: 8,
                    borderBottom: i < trends.length - 1 ? `1px solid ${C.cardBorder}` : 'none',
                  }}>
                    <span style={{ color: C.xfaint, fontFamily: 'monospace', fontSize: 10, minWidth: 18 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ color: C.mid, fontSize: 12, lineHeight: 1.5 }}>{t}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {competitorDiscovery?.competitiveLandscapeSummary && (
              <GlassCard>
                <SectionTitle>Rekabet Özeti</SectionTitle>
                <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.65 }}>
                  {competitorDiscovery.competitiveLandscapeSummary.slice(0, 280)}
                </p>
              </GlassCard>
            )}

            {/* Digital presence summary */}
            {digitalPresence && (
              <GlassCard>
                <SectionTitle>Dijital Varlık</SectionTitle>
                {digitalPresence.overallDigitalScore !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ color: C.faint, fontSize: 11 }}>Dijital Skor</div>
                    <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${digitalPresence.overallDigitalScore * 10}%`, background: C.text, borderRadius: 2 }} />
                    </div>
                    <div style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{digitalPresence.overallDigitalScore}/10</div>
                  </div>
                )}
                {digitalPresence.criticalGaps?.slice(0, 2).map((g: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 4, color: C.mid, fontSize: 11 }}>
                    <span style={{ color: C.neg }}>!</span><span>{g}</span>
                  </div>
                ))}
                {digitalPresence.quickWins?.slice(0, 2).map((w: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 4, color: C.mid, fontSize: 11 }}>
                    <span style={{ color: C.pos }}>→</span><span>{w}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Entry barriers + competitive threats */}
            {competitorDiscovery?.entryBarriers?.length > 0 && (
              <GlassCard>
                <SectionTitle>Giriş Engelleri</SectionTitle>
                {competitorDiscovery.entryBarriers.slice(0, 3).map((b: string, i: number) => (
                  <div key={i} style={{ color: C.mid, fontSize: 12, marginBottom: 4 }}>· {b}</div>
                ))}
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </SectionBase>
  );
}
