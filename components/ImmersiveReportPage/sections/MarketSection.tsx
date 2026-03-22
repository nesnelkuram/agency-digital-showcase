import React from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, C, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  visual: SectionVisual | undefined;
  sectorResearch?: any;
  competitorDiscovery?: any;
}

export default function MarketSection({ index, visual, sectorResearch, competitorDiscovery }: Props) {
  const competitors = [
    ...(competitorDiscovery?.knownCompetitors || []),
    ...(competitorDiscovery?.discoveredCompetitors || []),
    ...(sectorResearch?.competitors || []),
  ].slice(0, 8);

  const trends = sectorResearch?.marketTrends?.slice(0, 5) || [];
  const market = sectorResearch?.marketData;
  const painPoints = sectorResearch?.consumerPainPoints?.slice(0, 3) || [];
  const opportunities = sectorResearch?.emergingOpportunities?.slice(0, 3) || [];

  return (
    <SectionBase id="market" index={index} label="Pazar" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle>Rekabet Ortamı</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,0.7fr)', gap: 20 }}>
          {/* Left: market stats + competitor grid */}
          <div>
            {market && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                {market.marketSize && (
                  <GlassCard style={{ flex: 1, padding: '14px 18px' }}>
                    <div style={{ color: C.faint, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Pazar Büyüklüğü</div>
                    <div style={{ color: C.text, fontSize: 18, fontWeight: 700, marginTop: 4 }}>{market.marketSize}</div>
                  </GlassCard>
                )}
                {market.growthRate && (
                  <GlassCard style={{ flex: 1, padding: '14px 18px' }}>
                    <div style={{ color: C.faint, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Büyüme</div>
                    <div style={{ color: C.green, fontSize: 18, fontWeight: 700, marginTop: 4 }}>{market.growthRate}</div>
                  </GlassCard>
                )}
                {market.keyPlayers && (
                  <GlassCard style={{ flex: 1, padding: '14px 18px' }}>
                    <div style={{ color: C.faint, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Oyuncular</div>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{market.keyPlayers}</div>
                  </GlassCard>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, maxHeight: '52vh', overflowY: 'auto' }}>
              {competitors.map((c: any, i: number) => (
                <GlassCard key={i} style={{ padding: '14px 16px' }}>
                  <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{c.name}</div>
                  <div style={{ color: C.mid, fontSize: 11, lineHeight: 1.5, marginBottom: 8 }}>
                    {(c.positioning || '').slice(0, 90)}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(c.strengths || []).slice(0, 2).map((s: string) => (
                      <Tag key={s} color={C.greenBg}>{s.slice(0, 20)}</Tag>
                    ))}
                    {(c.weaknesses || []).slice(0, 1).map((w: string) => (
                      <Tag key={w} color={C.redBg}>{w.slice(0, 20)}</Tag>
                    ))}
                  </div>
                </GlassCard>
              ))}
            </div>

            {competitorDiscovery?.competitiveLandscapeSummary && (
              <GlassCard style={{ marginTop: 10 }}>
                <SectionTitle>Rekabet Özeti</SectionTitle>
                <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.6 }}>
                  {competitorDiscovery.competitiveLandscapeSummary.slice(0, 300)}
                </p>
              </GlassCard>
            )}
          </div>

          {/* Right: trends + pain points + opportunities */}
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

            {painPoints.length > 0 && (
              <GlassCard>
                <SectionTitle>Tüketici Sorunları</SectionTitle>
                {painPoints.map((p: string, i: number) => (
                  <div key={i} style={{ color: C.mid, fontSize: 12, marginBottom: 6, display: 'flex', gap: 8 }}>
                    <span style={{ color: C.red }}>·</span><span>{p}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {opportunities.length > 0 && (
              <GlassCard>
                <SectionTitle>Fırsatlar</SectionTitle>
                {opportunities.map((o: string, i: number) => (
                  <div key={i} style={{ color: C.mid, fontSize: 12, marginBottom: 6, display: 'flex', gap: 8 }}>
                    <span style={{ color: C.green }}>→</span><span>{o}</span>
                  </div>
                ))}
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </SectionBase>
  );
}
