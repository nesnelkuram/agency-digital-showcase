import React from 'react';
import SectionBase, { GlassCard, SectionTitle, BigText, Tag, C, toStr, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  total?: number;
  visual: SectionVisual | undefined;
  strategicDepth?: any;
  strategyScenarios?: any;
}


const VALUE_LEVELS = ['commodity', 'product', 'service', 'experience', 'transformation'];
const VALUE_LABELS: Record<string, string> = {
  commodity: 'Emtia', product: 'Ürün', service: 'Hizmet',
  experience: 'Deneyim', transformation: 'Dönüşüm',
};

export default function StrategySection({ index, total, visual, strategicDepth, strategyScenarios }: Props) {
  const scenarios = strategyScenarios ? [
    { key: 'conservative', label: 'Muhafazakâr', data: strategyScenarios.conservative },
    { key: 'recommended',  label: 'Önerilen ★', data: strategyScenarios.recommended },
    { key: 'aggressive',   label: 'Agresif',     data: strategyScenarios.aggressive },
  ] : [];

  const valueLevelIdx = VALUE_LEVELS.indexOf(strategicDepth?.valueLevel || '');

  return (
    <SectionBase id="strategy" index={index} total={total} label="Stratejik Derinlik" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Transformation statement hero */}
        {strategicDepth?.transformationStatement && (
          <div style={{ marginBottom: 24, maxWidth: 840, borderLeft: `3px solid rgba(0,0,0,0.18)`, paddingLeft: 18 }}>
            <SectionTitle>Dönüşüm İddiası</SectionTitle>
            <BigText style={{ fontSize: 'clamp(18px, 2.4vw, 34px)', lineHeight: 1.3 }}>
              "{toStr(strategicDepth.transformationStatement)}"
            </BigText>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: 18,
        }}>

          {/* Left: Customer problem pyramid + stands for/against */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {strategicDepth?.customerProblem && (
              <GlassCard>
                <SectionTitle>Müşteri Sorunu (3 Katman)</SectionTitle>
                {[
                  { label: 'İşlevsel', value: toStr(strategicDepth.customerProblem.functional), icon: '⚙️' },
                  { label: 'Duygusal', value: toStr(strategicDepth.customerProblem.emotional), icon: '💭' },
                  { label: 'Kimlik', value: toStr(strategicDepth.customerProblem.identity), icon: '🪞' },
                ].filter(l => l.value).map(({ label, value, icon }) => (
                  <div key={label} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.cardBorder}` }}>
                    <div style={{ color: C.faint, fontSize: 10, marginBottom: 3 }}>{icon} {label}</div>
                    <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.5 }}>{value}</p>
                  </div>
                ))}
              </GlassCard>
            )}

            {(strategicDepth?.weStandFor?.length > 0 || strategicDepth?.weStandAgainst?.length > 0) && (
              <GlassCard>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <SectionTitle>Savunduklarımız</SectionTitle>
                    {(strategicDepth.weStandFor || []).map((item: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 5 }}>
                        <span style={{ color: C.pos, fontWeight: 700, fontSize: 12 }}>✓</span>
                        <span style={{ color: C.mid, fontSize: 12, lineHeight: 1.45 }}>{toStr(item)}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <SectionTitle>Karşı Durduklarımız</SectionTitle>
                    {(strategicDepth.weStandAgainst || []).map((item: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 5 }}>
                        <span style={{ color: C.neg, fontWeight: 700, fontSize: 12 }}>✗</span>
                        <span style={{ color: C.mid, fontSize: 12, lineHeight: 1.45 }}>{toStr(item)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Cultural tension + value level */}
            <div style={{ display: 'flex', gap: 10 }}>
              {strategicDepth?.culturalTension && (
                <GlassCard style={{ flex: 1 }}>
                  <SectionTitle>Kültürel Gerilim</SectionTitle>
                  {typeof strategicDepth.culturalTension === 'object' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {strategicDepth.culturalTension.expectation && (
                        <div>
                          <div style={{ color: C.faint, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Beklenti</div>
                          <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.5 }}>{strategicDepth.culturalTension.expectation}</p>
                        </div>
                      )}
                      {strategicDepth.culturalTension.reality && (
                        <div>
                          <div style={{ color: C.faint, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Gerçeklik</div>
                          <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.5 }}>{strategicDepth.culturalTension.reality}</p>
                        </div>
                      )}
                      {strategicDepth.culturalTension.opportunity && (
                        <div>
                          <div style={{ color: C.pos, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Fırsat</div>
                          <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.5 }}>{strategicDepth.culturalTension.opportunity}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.55 }}>{strategicDepth.culturalTension}</p>
                  )}
                </GlassCard>
              )}
              {strategicDepth?.valueLevel && (
                <GlassCard style={{ flex: 1 }}>
                  <SectionTitle>Değer Seviyesi</SectionTitle>
                  <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                    {VALUE_LEVELS.map((level, i) => (
                      <div key={level} style={{
                        flex: 1, height: 5, borderRadius: 2,
                        background: i <= valueLevelIdx ? C.text : 'rgba(0,0,0,0.1)',
                      }} />
                    ))}
                  </div>
                  <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                    {VALUE_LABELS[strategicDepth.valueLevel] || strategicDepth.valueLevel}
                  </p>
                </GlassCard>
              )}
            </div>
          </div>

          {/* Right: Growth scenarios */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {scenarios.filter(s => s.data).length > 0 && (
              <>
                <SectionTitle>Büyüme Senaryoları</SectionTitle>
                {scenarios.map(({ key, label, data }) => data && (
                  <GlassCard key={key} style={{
                    padding: '14px 18px',
                    background: key === 'recommended' ? 'rgba(255,255,255,0.92)' : C.card,
                    border: key === 'recommended' ? `2px solid rgba(0,0,0,0.15)` : `1px solid ${C.cardBorder}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ color: C.text, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {label}
                      </span>
                      <span style={{ color: C.faint, fontSize: 10 }}>{data.timeframe}</span>
                    </div>
                    <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}>
                      {toStr(data.description)}
                    </p>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {data.investmentLevel && <span style={{ color: C.faint, fontSize: 11 }}>💰 {toStr(data.investmentLevel)}</span>}
                      {data.risk && <span style={{ color: C.faint, fontSize: 11 }}>⚡ {toStr(data.risk)}</span>}
                      {data.expectedROI && <span style={{ color: C.faint, fontSize: 11 }}>📈 {toStr(data.expectedROI)}</span>}
                    </div>
                    {data.expectedOutcome && (
                      <p style={{ color: C.mid, fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>{toStr(data.expectedOutcome)}</p>
                    )}
                  </GlassCard>
                ))}
              </>
            )}

            {/* Core strategy */}
            {strategicDepth?.coreStrategy && (
              <GlassCard>
                <SectionTitle>Temel Strateji</SectionTitle>
                <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65 }}>{toStr(strategicDepth.coreStrategy)}</p>
              </GlassCard>
            )}

            {/* Long term vision */}
            {strategicDepth?.longTermVision && (
              <GlassCard>
                <SectionTitle>Uzun Vadeli Vizyon</SectionTitle>
                <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65 }}>{toStr(strategicDepth.longTermVision).slice(0, 200)}</p>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </SectionBase>
  );
}
