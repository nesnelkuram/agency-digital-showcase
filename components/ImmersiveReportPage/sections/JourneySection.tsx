import React, { useState } from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, C, toStr, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  total?: number;
  visual: SectionVisual | undefined;
  customerJourney?: any[];
  consumerTest?: any;
  perceptualMap?: any;
  businessName?: string;
}

const STAGE_COLORS: Record<string, string> = {
  farkindalik:    C.blue,
  ilgi:           C.pos,
  degerlendirme:  C.warn,
  satin_alma:     '#7c3aed',
  sadakat:        C.neg,
};

const STAGE_LABELS: Record<string, string> = {
  farkindalik: 'Farkındalık', ilgi: 'İlgi', degerlendirme: 'Değerlendirme',
  satin_alma: 'Satın Alma', sadakat: 'Sadakat',
};

const READINESS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  hazir: { label: 'Pazara Hazır', color: C.pos, bg: C.posBg },
  iyilestirme_gerekli: { label: 'İyileştirme Gerekli', color: C.warn, bg: C.warnBg },
  yeniden_dusunulmeli: { label: 'Yeniden Düşünülmeli', color: C.neg, bg: C.negBg },
};

export default function JourneySection({ index, total, visual, customerJourney, consumerTest, perceptualMap, businessName }: Props) {
  const [activePersona, setActivePersona] = useState(0);
  const personas = consumerTest?.personas || [];
  const readiness = consumerTest?.marketReadiness ? READINESS_CONFIG[consumerTest.marketReadiness] : null;

  if (!customerJourney?.length && !consumerTest && !perceptualMap) return null;

  return (
    <SectionBase id="journey" index={index} total={total} label="Müşteri Yolculuğu" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Readiness banner */}
        {readiness && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 24,
            background: readiness.bg, border: `1px solid ${readiness.color}30`,
            borderRadius: 12, padding: '8px 18px',
          }}>
            <span style={{ color: readiness.color, fontSize: 12, fontWeight: 700 }}>{readiness.label}</span>
            {consumerTest?.overallViabilityScore !== undefined && (
              <span style={{ color: C.mid, fontSize: 12 }}>· Uygulanabilirlik: <strong>{consumerTest.overallViabilityScore}/10</strong></span>
            )}
          </div>
        )}

        {/* Customer journey stages */}
        {customerJourney && customerJourney.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionTitle>Müşteri Yolculuğu Haritası</SectionTitle>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 160px), 1fr))`,
              gap: 10,
            }}>
              {customerJourney.map((stage: any, i: number) => {
                const color = STAGE_COLORS[stage.stage] || C.mid;
                return (
                  <GlassCard key={i} style={{ padding: '14px 16px', borderTop: `3px solid ${color}` }}>
                    <div style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
                      {stage.stageLabel || STAGE_LABELS[stage.stage] || stage.stage}
                    </div>
                    {stage.customerAction && (
                      <p style={{ color: C.text, fontSize: 12, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>
                        {stage.customerAction}
                      </p>
                    )}
                    {stage.emotion && (
                      <p style={{ color: C.mid, fontSize: 11, fontStyle: 'italic', marginBottom: 6 }}>
                        {stage.emotion}
                      </p>
                    )}
                    {stage.brandOpportunity && (
                      <div style={{
                        background: `${color}12`, borderRadius: 6, padding: '6px 8px', marginBottom: 6,
                      }}>
                        <p style={{ color: C.mid, fontSize: 11, lineHeight: 1.4 }}>{stage.brandOpportunity}</p>
                      </div>
                    )}
                    {stage.touchpoints?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {stage.touchpoints.slice(0, 3).map((tp: any, ti: number) => (
                          <Tag key={ti} color={C.tagBg}>{toStr(tp).slice(0, 22)}</Tag>
                        ))}
                      </div>
                    )}
                    {stage.contentType && (
                      <div style={{ color: C.faint, fontSize: 10, marginTop: 6 }}>📄 {stage.contentType}</div>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 18,
        }}>
          {/* Left: personas */}
          {personas.length > 0 && (
            <div>
              <SectionTitle>Persona Analizi</SectionTitle>

              {/* Persona tabs */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {personas.map((p: any, i: number) => (
                  <button key={i} onClick={() => setActivePersona(i)} style={{
                    padding: '5px 14px', borderRadius: 18, cursor: 'pointer',
                    border: `1px solid ${activePersona === i ? 'rgba(0,0,0,0.2)' : C.cardBorder}`,
                    background: activePersona === i ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.5)',
                    color: activePersona === i ? C.text : C.faint,
                    fontSize: 11, fontWeight: activePersona === i ? 700 : 400, transition: 'all 0.15s',
                  }}>
                    {p.personaLabel || `Persona ${i + 1}`}
                  </button>
                ))}
              </div>

              {personas[activePersona] && (
                <GlassCard>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ color: C.text, fontSize: 15, fontWeight: 700 }}>
                      {personas[activePersona].personaLabel}
                    </div>
                    {personas[activePersona].alignmentScore !== undefined && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 60, height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2 }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            width: `${(personas[activePersona].alignmentScore || 0) * 10}%`,
                            background: personas[activePersona].alignmentScore >= 7 ? C.pos : personas[activePersona].alignmentScore >= 4 ? C.warn : C.neg,
                          }} />
                        </div>
                        <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{personas[activePersona].alignmentScore}/10</span>
                      </div>
                    )}
                  </div>

                  {personas[activePersona].demographics && (
                    <div style={{ color: C.faint, fontSize: 11, marginBottom: 8 }}>{personas[activePersona].demographics}</div>
                  )}
                  {personas[activePersona].purchaseLikelihood && (
                    <div style={{ color: C.mid, fontSize: 12, marginBottom: 8 }}>
                      Satın alma olasılığı: <strong>{personas[activePersona].purchaseLikelihood}</strong>
                    </div>
                  )}
                  {personas[activePersona].recommendedMessageAngle && (
                    <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
                      {personas[activePersona].recommendedMessageAngle}
                    </p>
                  )}
                  {personas[activePersona].resonancePoints?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                      {personas[activePersona].resonancePoints.map((r: any, ri: number) => (
                        <Tag key={ri} color={C.posBg}>{toStr(r).slice(0, 35)}</Tag>
                      ))}
                    </div>
                  )}
                  {personas[activePersona].objections?.length > 0 && (
                    <div>
                      <div style={{ color: C.faint, fontSize: 10, marginBottom: 5 }}>OLASI İTİRAZLAR</div>
                      {personas[activePersona].objections.map((o: string, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 4 }}>
                          <span style={{ color: C.neg, fontSize: 11 }}>·</span>
                          <span style={{ color: C.mid, fontSize: 12 }}>{o}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              )}

              {consumerTest?.crossPersonaConcerns?.length > 0 && (
                <GlassCard style={{ marginTop: 12, background: C.warnBg, border: `1px solid ${C.warn}25` }}>
                  <SectionTitle>Ortak Endişeler</SectionTitle>
                  {consumerTest.crossPersonaConcerns.map((c: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, color: C.mid, fontSize: 12 }}>
                      <span style={{ color: C.warn, fontWeight: 700 }}>!</span><span>{c}</span>
                    </div>
                  ))}
                </GlassCard>
              )}

              {consumerTest?.overallFeedback && (
                <GlassCard style={{ marginTop: 12 }}>
                  <SectionTitle>Genel Değerlendirme</SectionTitle>
                  <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65 }}>{consumerTest.overallFeedback}</p>
                </GlassCard>
              )}
            </div>
          )}

          {/* Right: JTBD + perceptual map */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* JTBD scenarios */}
            {consumerTest?.jtbdScenarios?.length > 0 && (
              <GlassCard>
                <SectionTitle>Yapılacak İş Senaryoları</SectionTitle>
                {consumerTest.jtbdScenarios.map((s: any, i: number) => (
                  <div key={i} style={{
                    marginBottom: 14, paddingBottom: 14,
                    borderBottom: i < consumerTest.jtbdScenarios.length - 1 ? `1px solid ${C.cardBorder}` : 'none',
                  }}>
                    {s.situationLabel && (
                      <div style={{ color: C.faint, fontSize: 10, marginBottom: 4 }}>{s.situationLabel}</div>
                    )}
                    {s.jobToBeDone && (
                      <p style={{ color: C.text, fontSize: 13, fontWeight: 600, lineHeight: 1.5, marginBottom: 6 }}>{s.jobToBeDone}</p>
                    )}
                    {s.scenario && (
                      <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.55, marginBottom: 6 }}>{s.scenario}</p>
                    )}
                    {s.pushForces?.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ color: C.pos, fontSize: 10, marginBottom: 3 }}>İTİCİ GÜÇLER</div>
                        {s.pushForces.map((f: string) => (
                          <div key={f} style={{ color: C.mid, fontSize: 11, marginBottom: 2 }}>· {f}</div>
                        ))}
                      </div>
                    )}
                    {s.anxieties?.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ color: C.neg, fontSize: 10, marginBottom: 3 }}>ENDİŞELER</div>
                        {s.anxieties.map((a: string) => (
                          <div key={a} style={{ color: C.mid, fontSize: 11, marginBottom: 2 }}>· {a}</div>
                        ))}
                      </div>
                    )}
                    {s.strategyJobFitScore !== undefined && (
                      <div style={{ color: C.faint, fontSize: 10 }}>Strateji Uyumu: {s.strategyJobFitScore}/10</div>
                    )}
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Perceptual map */}
            {perceptualMap && (
              <GlassCard>
                <SectionTitle>Algısal Harita</SectionTitle>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <PerceptualMapSVG map={perceptualMap} businessName={businessName} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.pos }} />
                    <span style={{ color: C.mid, fontSize: 10 }}>{businessName}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.xfaint }} />
                    <span style={{ color: C.mid, fontSize: 10 }}>Rakipler</span>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </SectionBase>
  );
}

function PerceptualMapSVG({ map, businessName }: { map: any; businessName?: string }) {
  const size = 280;
  const padding = 40;
  const plotSize = size - padding * 2;
  const toPixel = (val: number) => padding + ((val + 5) / 10) * plotSize;

  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {/* Axes */}
      <line x1={padding} y1={size / 2} x2={size - padding} y2={size / 2} stroke={C.cardBorder} strokeWidth={1} />
      <line x1={size / 2} y1={padding} x2={size / 2} y2={size - padding} stroke={C.cardBorder} strokeWidth={1} />
      {/* Axis labels */}
      {map.xAxis?.lowEnd && <text x={padding - 4} y={size / 2 + 4} fontSize={9} fill={C.faint} textAnchor="end">{map.xAxis.lowEnd.slice(0, 10)}</text>}
      {map.xAxis?.highEnd && <text x={size - padding + 4} y={size / 2 + 4} fontSize={9} fill={C.faint} textAnchor="start">{map.xAxis.highEnd.slice(0, 10)}</text>}
      {map.yAxis?.highEnd && <text x={size / 2} y={padding - 6} fontSize={9} fill={C.faint} textAnchor="middle">{map.yAxis.highEnd.slice(0, 10)}</text>}
      {map.yAxis?.lowEnd && <text x={size / 2} y={size - padding + 14} fontSize={9} fill={C.faint} textAnchor="middle">{map.yAxis.lowEnd.slice(0, 10)}</text>}
      {/* Competitor positions */}
      {map.competitorPositions?.map((c: any) => (
        <g key={c.name}>
          <circle cx={toPixel(c.x)} cy={toPixel(-c.y)} r={6} fill={C.xfaint} opacity={0.7} />
          <text x={toPixel(c.x)} y={toPixel(-c.y) - 10} fontSize={9} fill={C.faint} textAnchor="middle">{c.name.slice(0, 12)}</text>
        </g>
      ))}
      {/* Brand position */}
      {map.brandPosition && (
        <g>
          <circle cx={toPixel(map.brandPosition.x)} cy={toPixel(-map.brandPosition.y)} r={8} fill={C.pos} />
          <text x={toPixel(map.brandPosition.x)} y={toPixel(-map.brandPosition.y) - 12} fontSize={10} fill={C.pos} textAnchor="middle" fontWeight="bold">
            {(businessName || 'Marka').slice(0, 12)}
          </text>
        </g>
      )}
    </svg>
  );
}
