import React from 'react';
import SectionBase, { GlassCard, SectionTitle, BigText, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  visual: SectionVisual | undefined;
  positioning?: any;
  strategicDepth?: any;
  strategyScenarios?: any;
  analysis?: any;
}

export default function StrategySection({ index, visual, positioning, strategicDepth, strategyScenarios, analysis }: Props) {
  const scenarios = strategyScenarios
    ? [
        { key: 'conservative', label: 'Muhafazakâr', color: '#94a3b8', data: strategyScenarios.conservative },
        { key: 'recommended', label: 'Önerilen', color: '#4ade80', data: strategyScenarios.recommended },
        { key: 'agresif', label: 'Agresif', color: '#f472b6', data: strategyScenarios.aggressive },
      ]
    : [];

  return (
    <SectionBase id="strategy" index={index} label="Strateji" visual={visual} overlayOpacity={0.72}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Positioning statement — hero text */}
        {positioning?.statement && (
          <div style={{ marginBottom: 40, maxWidth: 800 }}>
            <SectionTitle>Konumlandırma</SectionTitle>
            <BigText style={{ fontSize: 'clamp(22px, 3vw, 44px)', lineHeight: 1.3 }}>
              {positioning.statement}
            </BigText>
            {positioning?.differentiator && (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 12, lineHeight: 1.6 }}>
                Ayrıştırıcı: {positioning.differentiator}
              </p>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: strategicDepth ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr', gap: 20 }}>
          {/* Scenarios */}
          {scenarios.length > 0 && (
            <div>
              <SectionTitle>Büyüme Senaryoları</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {scenarios.map(({ key, label, color, data }) => data && (
                  <GlassCard key={key} style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {label}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{data.timeframe}</span>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>
                      {data.description}
                    </p>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>💰 {data.investmentLevel}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>⚡ {data.risk}</span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {/* SWOT compact 2×2 */}
          {analysis && (analysis.strengths?.length > 0 || analysis.opportunities?.length > 0) && (
            <GlassCard style={{ marginTop: scenarios.length ? 12 : 0 }}>
              <SectionTitle>Güçlü Yönler & Fırsatlar</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: '💪 Güçlü', items: analysis.strengths, color: '#4ade80' },
                  { label: '🚀 Fırsat', items: analysis.opportunities, color: '#60a5fa' },
                  { label: '⚠️ Zorluk', items: analysis.challenges, color: '#facc15' },
                  { label: '💡 Öneri', items: analysis.recommendations, color: '#c084fc' },
                ].map(({ label, items, color }) => items?.length > 0 && (
                  <div key={label}>
                    <div style={{ color, fontSize: 10, fontWeight: 700, marginBottom: 5 }}>{label}</div>
                    {(items || []).slice(0, 2).map((item: string) => (
                      <div key={item} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 3, lineHeight: 1.4 }}>
                        · {item.slice(0, 55)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Strategic depth */}
          {strategicDepth && (
            <div>
              {strategicDepth.transformationStatement && (
                <GlassCard style={{ marginBottom: 16 }}>
                  <SectionTitle>Dönüşüm İddiası</SectionTitle>
                  <p style={{ color: '#fff', fontSize: 15, lineHeight: 1.6, fontStyle: 'italic' }}>
                    "{strategicDepth.transformationStatement}"
                  </p>
                </GlassCard>
              )}

              {(strategicDepth.weStandFor?.length > 0 || strategicDepth.weStandAgainst?.length > 0) && (
                <GlassCard>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div>
                      <SectionTitle>Savunduklarımız</SectionTitle>
                      {(strategicDepth.weStandFor || []).slice(0, 3).map((item: string) => (
                        <div key={item} style={{ color: 'rgba(74,222,128,0.9)', fontSize: 13, marginBottom: 6, display: 'flex', gap: 8 }}>
                          <span>✓</span><span>{item}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <SectionTitle>Karşı Durduklarımız</SectionTitle>
                      {(strategicDepth.weStandAgainst || []).slice(0, 3).map((item: string) => (
                        <div key={item} style={{ color: 'rgba(248,113,113,0.9)', fontSize: 13, marginBottom: 6, display: 'flex', gap: 8 }}>
                          <span>✗</span><span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              )}
            </div>
          )}
        </div>
      </div>
    </SectionBase>
  );
}
