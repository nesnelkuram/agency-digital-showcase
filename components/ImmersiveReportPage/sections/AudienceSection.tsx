import React, { useState } from 'react';
import SectionBase, { GlassCard, SectionTitle, BigText, Tag, C, toStr, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  total?: number;
  visual: SectionVisual | undefined;
  positioning?: any;
  consumerTest?: any;
}

export default function AudienceSection({ index, total, visual, positioning, consumerTest }: Props) {
  const segments = positioning?.targetSegments?.slice(0, 4) || [];
  const personas = consumerTest?.personas?.slice(0, 3) || [];
  const [activeTab, setActiveTab] = useState(0);

  return (
    <SectionBase id="audience" index={index} total={total} label="Hedef Kitle & Konumlandırma" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Positioning statement hero */}
        {positioning?.statement && (
          <div style={{ marginBottom: 20, maxWidth: 820 }}>
            <SectionTitle>Konumlandırma</SectionTitle>
            <BigText style={{ fontSize: 'clamp(17px, 2.2vw, 32px)', lineHeight: 1.3, marginBottom: 8 }}>
              {positioning.statement}
            </BigText>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {positioning.differentiator && (
                <p style={{ color: C.mid, fontSize: 12 }}>Ayrıştırıcı: <em>{positioning.differentiator}</em></p>
              )}
              {positioning.competitiveAdvantage && (
                <p style={{ color: C.mid, fontSize: 12 }}>Avantaj: <em>{positioning.competitiveAdvantage}</em></p>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 18 }}>

          {/* Left: Segments */}
          <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            <SectionTitle>Hedef Segmentler</SectionTitle>
            {positioning?.targetAudience && (
              <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>{positioning.targetAudience}</p>
            )}
            {segments.map((seg: any, i: number) => (
              <GlassCard key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                  <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{seg.segmentLabel || `Segment ${i + 1}`}</div>
                  {seg.estimatedSegmentSize && <Tag>{seg.estimatedSegmentSize}</Tag>}
                </div>
                {seg.demographics && <div style={{ color: C.faint, fontSize: 11, marginBottom: 5 }}>{seg.demographics}</div>}
                {seg.coreNeed && <div style={{ color: C.mid, fontSize: 12, lineHeight: 1.5, marginBottom: 6 }}>{seg.coreNeed}</div>}
                {seg.psychographics && (
                  <div style={{ color: C.mid, fontSize: 11, lineHeight: 1.5, marginBottom: 6, fontStyle: 'italic' }}>
                    {toStr(seg.psychographics).slice(0, 120)}
                  </div>
                )}
                {seg.mediaHabits && (
                  <div style={{ color: C.faint, fontSize: 11, marginBottom: 6 }}>Medya: {seg.mediaHabits}</div>
                )}
                {(seg.purchaseTriggers || []).length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(seg.purchaseTriggers as any[]).map((t: any, i: number) => (
                      <Tag key={i}>{toStr(t).slice(0, 28)}</Tag>
                    ))}
                  </div>
                )}
              </GlassCard>
            ))}

            {/* Value proposition reasoning */}
            {positioning?.valuePropositionReasoning && (
              <GlassCard style={{ marginTop: 4 }}>
                <SectionTitle>Değer Önerisi Gerekçesi</SectionTitle>
                <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.65 }}>
                  {String(positioning.valuePropositionReasoning).slice(0, 220)}
                </p>
              </GlassCard>
            )}
          </div>

          {/* Right: Personas + consumer test */}
          <div>
            {personas.length > 0 ? (
              <>
                {/* Viability score */}
                {consumerTest?.overallViabilityScore !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                    <div style={{ color: C.faint, fontSize: 11 }}>Genel Uygulanabilirlik</div>
                    <div style={{ flex: 1, height: 5, background: 'rgba(0,0,0,0.08)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${consumerTest.overallViabilityScore * 10}%`, background: C.text, borderRadius: 3 }} />
                    </div>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{consumerTest.overallViabilityScore}/10</div>
                  </div>
                )}

                {/* Persona tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {personas.map((p: any, i: number) => (
                    <button key={i} onClick={() => setActiveTab(i)} style={{
                      padding: '5px 12px', borderRadius: 18, cursor: 'pointer',
                      border: `1px solid ${activeTab === i ? 'rgba(0,0,0,0.2)' : C.cardBorder}`,
                      background: activeTab === i ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.5)',
                      color: activeTab === i ? C.text : C.faint,
                      fontSize: 11, fontWeight: activeTab === i ? 700 : 400, transition: 'all 0.15s',
                    }}>
                      {p.personaLabel || `Persona ${i + 1}`}
                    </button>
                  ))}
                </div>

                {personas[activeTab] && (
                  <GlassCard>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{personas[activeTab].personaLabel}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ width: 60, height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${(personas[activeTab].alignmentScore || 0) * 10}%`, background: C.text, borderRadius: 2 }} />
                        </div>
                        <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{personas[activeTab].alignmentScore}/10</span>
                      </div>
                    </div>

                    {personas[activeTab].demographics && (
                      <div style={{ color: C.faint, fontSize: 11, marginBottom: 8 }}>{personas[activeTab].demographics}</div>
                    )}

                    {personas[activeTab].recommendedMessageAngle && (
                      <div style={{ color: C.mid, fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
                        {personas[activeTab].recommendedMessageAngle}
                      </div>
                    )}

                    {/* JTBD scenario */}
                    {consumerTest?.jtbdScenarios?.[activeTab] && (
                      <div style={{ background: C.tagBg, borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                        <div style={{ color: C.faint, fontSize: 10, marginBottom: 3 }}>İŞ YAPILACAK SENARYO</div>
                        <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.55 }}>
                          {toStr(consumerTest.jtbdScenarios[activeTab].scenario || consumerTest.jtbdScenarios[activeTab]).slice(0, 150)}
                        </p>
                      </div>
                    )}

                    {personas[activeTab].objections?.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ color: C.faint, fontSize: 10, marginBottom: 4 }}>OLASI İTİRAZLAR</div>
                        {personas[activeTab].objections.map((o: string) => (
                          <div key={o} style={{ display: 'flex', gap: 7, marginBottom: 4 }}>
                            <span style={{ color: C.neg, fontSize: 11 }}>·</span>
                            <span style={{ color: C.mid, fontSize: 12 }}>{o}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {personas[activeTab].resonancePoints?.length > 0 && (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {personas[activeTab].resonancePoints.map((r: any, i: number) => (
                          <Tag key={i} color={C.posBg}>{toStr(r).slice(0, 30)}</Tag>
                        ))}
                      </div>
                    )}
                  </GlassCard>
                )}
              </>
            ) : (
              /* No personas fallback */
              positioning && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {positioning.uniqueValueProposition && (
                    <GlassCard>
                      <SectionTitle>Değer Önerisi</SectionTitle>
                      <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65 }}>{positioning.uniqueValueProposition}</p>
                    </GlassCard>
                  )}
                </div>
              )
            )}

            {/* Market readiness */}
            {consumerTest?.marketReadiness && (
              <GlassCard style={{ marginTop: 10, padding: '10px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: consumerTest.overallFeedback ? 8 : 0 }}>
                  <span style={{ color: C.mid, fontSize: 12 }}>Pazar Hazırlığı</span>
                  <Tag color={
                    consumerTest.marketReadiness === 'hazir' ? C.posBg :
                    consumerTest.marketReadiness === 'iyilestirme_gerekli' ? 'rgba(161,98,7,0.1)' : C.negBg
                  }>
                    {consumerTest.marketReadiness === 'hazir' ? 'Hazır' :
                     consumerTest.marketReadiness === 'iyilestirme_gerekli' ? 'İyileştirme Gerekli' : 'Yeniden Düşünülmeli'}
                  </Tag>
                </div>
                {consumerTest.overallFeedback && (
                  <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.55 }}>{toStr(consumerTest.overallFeedback).slice(0, 200)}</p>
                )}
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </SectionBase>
  );
}
