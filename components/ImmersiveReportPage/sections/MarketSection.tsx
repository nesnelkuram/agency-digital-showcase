import React from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, type SectionVisual } from '../SectionBase';

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
  ].slice(0, 6);

  const trends = sectorResearch?.marketTrends?.slice(0, 4) || [];
  const market = sectorResearch?.marketData;

  return (
    <SectionBase id="market" index={index} label="Pazar" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle>Rekabet Ortamı</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,0.8fr)', gap: 24 }}>
          {/* Competitor grid */}
          <div>
            {market && (
              <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
                {market.marketSize && (
                  <GlassCard style={{ flex: 1, padding: '16px 20px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Pazar Büyüklüğü</div>
                    <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginTop: 4 }}>{market.marketSize}</div>
                  </GlassCard>
                )}
                {market.growthRate && (
                  <GlassCard style={{ flex: 1, padding: '16px 20px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Büyüme</div>
                    <div style={{ color: '#4ade80', fontSize: 20, fontWeight: 700, marginTop: 4 }}>{market.growthRate}</div>
                  </GlassCard>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10, maxHeight: '55vh', overflowY: 'auto' }}>
              {competitors.map((c: any, i: number) => (
                <GlassCard key={i} style={{ padding: '16px 20px' }}>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{c.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>
                    {(c.positioning || '').slice(0, 80)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(c.strengths || []).slice(0, 2).map((s: string) => (
                      <Tag key={s} color="rgba(74, 222, 128, 0.15)">{s.slice(0, 20)}</Tag>
                    ))}
                    {(c.weaknesses || []).slice(0, 1).map((w: string) => (
                      <Tag key={w} color="rgba(248, 113, 113, 0.15)">{w.slice(0, 20)}</Tag>
                    ))}
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* Trends */}
          <div>
            {trends.length > 0 && (
              <GlassCard style={{ marginBottom: 20 }}>
                <SectionTitle>Sektör Trendleri</SectionTitle>
                {trends.map((t: string, i: number) => (
                  <div key={i} style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    paddingBottom: 12, marginBottom: 12,
                    borderBottom: i < trends.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', fontSize: 11, minWidth: 20 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5 }}>{t}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {competitorDiscovery?.competitiveLandscapeSummary && (
              <GlassCard>
                <SectionTitle>Özet</SectionTitle>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6 }}>
                  {competitorDiscovery.competitiveLandscapeSummary.slice(0, 280)}
                </p>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </SectionBase>
  );
}
