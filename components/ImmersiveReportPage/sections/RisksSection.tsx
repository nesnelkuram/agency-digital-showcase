import React from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, C, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  total?: number;
  visual: SectionVisual | undefined;
  riskMitigationPlans?: any[];
  qualityMetrics?: any;
  revenueImpact?: any;
}

const SEVERITY: Record<string, { color: string; bg: string }> = {
  yuksek: { color: C.neg, bg: C.negBg },
  orta:   { color: C.warn, bg: C.warnBg },
  dusuk:  { color: C.pos, bg: C.posBg },
};

function getSeverity(likelihood?: string, impact?: string) {
  if (likelihood === 'yuksek' && impact === 'yuksek') return SEVERITY.yuksek;
  if (likelihood === 'dusuk' && impact === 'dusuk') return SEVERITY.dusuk;
  return SEVERITY.orta;
}

export default function RisksSection({ index, total, visual, riskMitigationPlans, qualityMetrics, revenueImpact }: Props) {
  const risks = riskMitigationPlans || [];
  const swapTests = qualityMetrics?.onlynessTest?.competitorSwaps || [];

  if (!risks.length && !qualityMetrics && !revenueImpact) return null;

  return (
    <SectionBase id="risks" index={index} total={total} label="Riskler & Özgünlük" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: 18,
        }}>
          {/* Left: risk matrix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {risks.length > 0 && (
              <>
                <SectionTitle>Risk Matrisi</SectionTitle>
                {risks.map((plan: any, i: number) => {
                  const sev = getSeverity(plan.likelihood, plan.impact);
                  return (
                    <GlassCard key={i} style={{ background: sev.bg, border: `1px solid ${sev.color}22` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ color: C.text, fontSize: 13, fontWeight: 700, flex: 1, paddingRight: 8 }}>
                          {plan.risk}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                          {plan.likelihood && (
                            <Tag color={sev.bg}>{plan.likelihood === 'yuksek' ? 'Yüksek Risk' : plan.likelihood === 'dusuk' ? 'Düşük Risk' : 'Orta Risk'}</Tag>
                          )}
                          {plan.impact && (
                            <span style={{ color: sev.color, fontSize: 10, fontWeight: 700 }}>
                              Etki: {plan.impact}
                            </span>
                          )}
                        </div>
                      </div>
                      <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>
                        {plan.mitigation}
                      </p>
                      {plan.earlyWarning && (
                        <div style={{
                          background: 'rgba(0,0,0,0.04)', borderRadius: 7, padding: '7px 10px',
                          display: 'flex', gap: 7, alignItems: 'flex-start',
                        }}>
                          <span style={{ color: C.warn, fontSize: 11, fontWeight: 700 }}>⚠</span>
                          <p style={{ color: C.mid, fontSize: 11, lineHeight: 1.5 }}>
                            <strong>Erken Uyarı:</strong> {plan.earlyWarning}
                          </p>
                        </div>
                      )}
                      {(plan as any).expectedValue && (
                        <div style={{ marginTop: 6, color: C.faint, fontSize: 10 }}>
                          Beklenen Etki: {(plan as any).expectedValue}
                        </div>
                      )}
                    </GlassCard>
                  );
                })}
              </>
            )}
          </div>

          {/* Right: quality metrics + revenue impact */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Distinctiveness score */}
            {qualityMetrics?.distinctivenessScore !== undefined && (
              <GlassCard>
                <SectionTitle>Marka Özgünlük Skoru</SectionTitle>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 52, fontWeight: 900, color: C.text, lineHeight: 1 }}>
                    {qualityMetrics.distinctivenessScore}
                  </div>
                  <div style={{ color: C.faint, fontSize: 13, marginBottom: 6 }}>/100</div>
                </div>
                <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, marginBottom: 12 }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${qualityMetrics.distinctivenessScore}%`,
                    background: qualityMetrics.distinctivenessScore >= 70 ? C.pos :
                                qualityMetrics.distinctivenessScore >= 40 ? C.warn : C.neg,
                  }} />
                </div>
                {qualityMetrics.genericPhraseCount !== undefined && (
                  <div style={{ color: qualityMetrics.genericPhraseCount === 0 ? C.pos : C.warn, fontSize: 12 }}>
                    {qualityMetrics.genericPhraseCount === 0
                      ? '✓ Jenerik ifade yok — Mükemmel!'
                      : `${qualityMetrics.genericPhraseCount} jenerik ifade tespit edildi`}
                  </div>
                )}
              </GlassCard>
            )}

            {/* Onlyness test */}
            {qualityMetrics?.onlynessTest && (
              <GlassCard>
                <SectionTitle>Teklik Testi (Onlyness)</SectionTitle>
                {qualityMetrics.onlynessTest.statement && (
                  <div style={{
                    background: C.blueBg, border: `1px solid ${C.blue}20`,
                    borderRadius: 10, padding: '12px 16px', marginBottom: 12,
                  }}>
                    <p style={{ color: C.text, fontSize: 13, lineHeight: 1.65, fontStyle: 'italic' }}>
                      "{qualityMetrics.onlynessTest.statement}"
                    </p>
                  </div>
                )}
                {swapTests.length > 0 && (
                  <>
                    <div style={{ color: C.faint, fontSize: 10, marginBottom: 8 }}>
                      RAKIP DEĞIŞTIRME TESTI — Başka bir marka bu iddiayı sahiplenebilir mi?
                    </div>
                    {swapTests.map((swap: any, i: number) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 10px', marginBottom: 6,
                        background: swap.stillValid ? C.negBg : C.posBg,
                        borderRadius: 8, border: `1px solid ${swap.stillValid ? C.neg : C.pos}20`,
                      }}>
                        <span style={{ color: C.mid, fontSize: 12 }}>{swap.name}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: swap.stillValid ? C.neg : C.pos,
                        }}>
                          {swap.stillValid ? '✗ Sahiplenebilir' : '✓ Sahiplenemez'}
                        </span>
                      </div>
                    ))}
                    <div style={{ color: C.xfaint, fontSize: 10, marginTop: 8 }}>
                      ✓ = Rakip sahiplenemez = İyi ayrışma · ✗ = Rakip sahiplenebilir = Risk
                    </div>
                  </>
                )}
              </GlassCard>
            )}

            {/* Revenue impact */}
            {revenueImpact && (
              <GlassCard>
                <SectionTitle>Gelir Etkisi</SectionTitle>
                {revenueImpact.currentState && (
                  <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65, marginBottom: 12 }}>
                    {revenueImpact.currentState}
                  </p>
                )}
                {revenueImpact.growthDrivers?.length > 0 && (
                  <>
                    <div style={{ color: C.faint, fontSize: 10, marginBottom: 8 }}>BÜYÜME SÜRÜCÜLERİ</div>
                    {revenueImpact.growthDrivers.map((driver: any, i: number) => (
                      <GlassCard key={i} style={{ marginBottom: 8, padding: '10px 14px', background: C.posBg, border: `1px solid ${C.pos}20` }}>
                        <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                          {driver.driver}
                        </div>
                        <div style={{ display: 'flex', gap: 14 }}>
                          {driver.estimatedImpact && (
                            <span style={{ color: C.pos, fontSize: 11 }}>📈 {driver.estimatedImpact}</span>
                          )}
                          {driver.timeframe && (
                            <span style={{ color: C.faint, fontSize: 11 }}>⏱ {driver.timeframe}</span>
                          )}
                        </div>
                      </GlassCard>
                    ))}
                  </>
                )}
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </SectionBase>
  );
}
