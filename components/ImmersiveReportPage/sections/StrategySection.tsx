import React from 'react';
import SectionBase, { GlassCard, SectionTitle, BigText, Tag, C, type SectionVisual } from '../SectionBase';

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
        { key: 'conservative', label: 'Muhafazakâr', color: C.slate, data: strategyScenarios.conservative },
        { key: 'recommended', label: 'Önerilen', color: C.green, data: strategyScenarios.recommended },
        { key: 'aggressive', label: 'Agresif', color: C.pink, data: strategyScenarios.aggressive },
      ]
    : [];

  return (
    <SectionBase id="strategy" index={index} label="Strateji" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Positioning hero */}
        {positioning?.statement && (
          <div style={{ marginBottom: 28, maxWidth: 820 }}>
            <SectionTitle>Konumlandırma</SectionTitle>
            <BigText style={{ fontSize: 'clamp(20px, 2.8vw, 40px)', lineHeight: 1.25 }}>
              {positioning.statement}
            </BigText>
            {positioning?.differentiator && (
              <p style={{ color: C.mid, fontSize: 13, marginTop: 10, lineHeight: 1.6 }}>
                Ayrıştırıcı: {positioning.differentiator}
              </p>
            )}
            {positioning?.uniqueValueProposition && (
              <p style={{ color: C.mid, fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
                Değer Önerisi: {positioning.uniqueValueProposition}
              </p>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: strategicDepth ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr', gap: 18 }}>

          {/* Scenarios */}
          {scenarios.filter(s => s.data).length > 0 && (
            <div>
              <SectionTitle>Büyüme Senaryoları</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scenarios.map(({ key, label, color, data }) => data && (
                  <GlassCard key={key} style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {label}
                      </span>
                      <span style={{ color: C.faint, fontSize: 10 }}>{data.timeframe}</span>
                    </div>
                    <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>
                      {data.description}
                    </p>
                    <div style={{ display: 'flex', gap: 14 }}>
                      {data.investmentLevel && <span style={{ color: C.faint, fontSize: 11 }}>💰 {data.investmentLevel}</span>}
                      {data.risk && <span style={{ color: C.faint, fontSize: 11 }}>⚡ {data.risk}</span>}
                      {data.expectedROI && <span style={{ color: C.faint, fontSize: 11 }}>📈 {data.expectedROI}</span>}
                    </div>
                  </GlassCard>
                ))}
              </div>

              {/* SWOT 2×2 */}
              {analysis && (analysis.strengths?.length > 0 || analysis.opportunities?.length > 0) && (
                <GlassCard style={{ marginTop: 10 }}>
                  <SectionTitle>Güçlü Yönler & Fırsatlar</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: '💪 Güçlü', items: analysis.strengths, color: C.green },
                      { label: '🚀 Fırsat', items: analysis.opportunities, color: C.blue },
                      { label: '⚠️ Zorluk', items: analysis.challenges, color: C.yellow },
                      { label: '💡 Öneri', items: analysis.recommendations, color: C.purple },
                    ].map(({ label, items, color }) => items?.length > 0 && (
                      <div key={label}>
                        <div style={{ color, fontSize: 10, fontWeight: 700, marginBottom: 5 }}>{label}</div>
                        {(items as string[]).slice(0, 2).map((item: string) => (
                          <div key={item} style={{ color: C.mid, fontSize: 11, marginBottom: 3, lineHeight: 1.4 }}>
                            · {item.slice(0, 60)}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
            </div>
          )}

          {/* Strategic depth */}
          {strategicDepth && (
            <div>
              {strategicDepth.transformationStatement && (
                <GlassCard style={{ marginBottom: 12 }}>
                  <SectionTitle>Dönüşüm İddiası</SectionTitle>
                  <p style={{ color: C.text, fontSize: 14, lineHeight: 1.6, fontStyle: 'italic', fontWeight: 600 }}>
                    "{strategicDepth.transformationStatement}"
                  </p>
                </GlassCard>
              )}

              {strategicDepth.coreStrategy && (
                <GlassCard style={{ marginBottom: 12 }}>
                  <SectionTitle>Temel Strateji</SectionTitle>
                  <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65 }}>
                    {strategicDepth.coreStrategy}
                  </p>
                </GlassCard>
              )}

              {(strategicDepth.weStandFor?.length > 0 || strategicDepth.weStandAgainst?.length > 0) && (
                <GlassCard>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <SectionTitle>Savunduklarımız</SectionTitle>
                      {(strategicDepth.weStandFor || []).slice(0, 4).map((item: string) => (
                        <div key={item} style={{ color: C.green, fontSize: 12, marginBottom: 5, display: 'flex', gap: 7 }}>
                          <span>✓</span><span style={{ color: C.mid }}>{item}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <SectionTitle>Karşı Durduklarımız</SectionTitle>
                      {(strategicDepth.weStandAgainst || []).slice(0, 4).map((item: string) => (
                        <div key={item} style={{ color: C.red, fontSize: 12, marginBottom: 5, display: 'flex', gap: 7 }}>
                          <span>✗</span><span style={{ color: C.mid }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              )}

              {/* Long-term vision */}
              {strategicDepth.longTermVision && (
                <GlassCard style={{ marginTop: 12 }}>
                  <SectionTitle>Uzun Vadeli Vizyon</SectionTitle>
                  <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65 }}>
                    {strategicDepth.longTermVision.slice(0, 200)}
                  </p>
                </GlassCard>
              )}
            </div>
          )}

          {/* If no scenarios but has analysis, show full SWOT */}
          {!scenarios.filter(s => s.data).length && analysis && (
            <GlassCard>
              <SectionTitle>Analiz</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { label: '💪 Güçlü Yönler', items: analysis.strengths, color: C.green },
                  { label: '🚀 Fırsatlar', items: analysis.opportunities, color: C.blue },
                  { label: '⚠️ Zorluklar', items: analysis.challenges, color: C.yellow },
                  { label: '💡 Öneriler', items: analysis.recommendations, color: C.purple },
                ].map(({ label, items, color }) => items?.length > 0 && (
                  <div key={label}>
                    <div style={{ color, fontSize: 10, fontWeight: 700, marginBottom: 6 }}>{label}</div>
                    {(items as string[]).slice(0, 3).map((item: string) => (
                      <div key={item} style={{ color: C.mid, fontSize: 12, marginBottom: 4, lineHeight: 1.45 }}>
                        · {item}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </SectionBase>
  );
}
