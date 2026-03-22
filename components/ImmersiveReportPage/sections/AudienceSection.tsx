import React, { useState } from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, C, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  visual: SectionVisual | undefined;
  positioning?: any;
  consumerTest?: any;
}

const LIKELIHOOD_COLOR: Record<string, string> = {
  yuksek: C.green, orta: '#a16207', dusuk: '#c2410c', cok_dusuk: '#b91c1c',
};
const LIKELIHOOD_LABEL: Record<string, string> = {
  yuksek: 'Yüksek', orta: 'Orta', dusuk: 'Düşük', cok_dusuk: 'Çok Düşük',
};

export default function AudienceSection({ index, visual, positioning, consumerTest }: Props) {
  const segments = positioning?.targetSegments?.slice(0, 4) || [];
  const personas = consumerTest?.personas?.slice(0, 3) || [];
  const [activeTab, setActiveTab] = useState(0);
  const targetDesc = positioning?.targetAudience || positioning?.primaryAudience;

  return (
    <SectionBase id="audience" index={index} label="Hedef Kitle" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle>Hedef Segmentler & Persona Analizi</SectionTitle>

        {targetDesc && (
          <p style={{ color: C.mid, fontSize: 14, lineHeight: 1.65, maxWidth: 800, marginBottom: 18 }}>
            {targetDesc}
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20 }}>
          {/* Segments */}
          <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
            {segments.map((seg: any, i: number) => (
              <GlassCard key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{seg.segmentLabel || `Segment ${i + 1}`}</div>
                  <Tag>{seg.estimatedSegmentSize}</Tag>
                </div>
                <div style={{ color: C.faint, fontSize: 11, marginBottom: 6 }}>{seg.demographics}</div>
                <div style={{ color: C.mid, fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}>{seg.coreNeed}</div>
                {seg.psychographics && (
                  <div style={{ color: C.mid, fontSize: 11, lineHeight: 1.5, marginBottom: 8, fontStyle: 'italic' }}>
                    {seg.psychographics.slice(0, 120)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {(seg.purchaseTriggers || []).slice(0, 3).map((t: string) => (
                    <Tag key={t} color={C.blueBg}>{t.slice(0, 28)}</Tag>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Consumer test personas */}
          {personas.length > 0 ? (
            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {personas.map((p: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    style={{
                      padding: '5px 14px', borderRadius: 20, cursor: 'pointer',
                      border: `1px solid ${activeTab === i ? 'rgba(0,0,0,0.2)' : C.cardBorder}`,
                      background: activeTab === i ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.5)',
                      color: activeTab === i ? C.text : C.faint,
                      fontSize: 11, fontWeight: activeTab === i ? 700 : 400,
                      transition: 'all 0.18s',
                    }}
                  >
                    {p.personaLabel || `Persona ${i + 1}`}
                  </button>
                ))}
              </div>

              {personas[activeTab] && (
                <GlassCard>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{personas[activeTab].personaLabel}</div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                      color: LIKELIHOOD_COLOR[personas[activeTab].purchaseLikelihood] || C.text,
                      background: `${LIKELIHOOD_COLOR[personas[activeTab].purchaseLikelihood] || C.text}18`,
                      border: `1px solid ${LIKELIHOOD_COLOR[personas[activeTab].purchaseLikelihood] || C.text}30`,
                    }}>
                      {LIKELIHOOD_LABEL[personas[activeTab].purchaseLikelihood] || personas[activeTab].purchaseLikelihood}
                    </span>
                  </div>

                  <div style={{ color: C.faint, fontSize: 11, marginBottom: 8 }}>
                    {personas[activeTab].demographics}
                  </div>

                  <div style={{ color: C.mid, fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
                    {personas[activeTab].recommendedMessageAngle}
                  </div>

                  {/* Alignment bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ color: C.faint, fontSize: 10 }}>Uyum</div>
                    <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2 }}>
                      <div style={{
                        height: '100%',
                        width: `${(personas[activeTab].alignmentScore || 0) * 10}%`,
                        background: LIKELIHOOD_COLOR[personas[activeTab].purchaseLikelihood] || C.green,
                        borderRadius: 2, transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <div style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>
                      {personas[activeTab].alignmentScore}/10
                    </div>
                  </div>

                  {(personas[activeTab].objections || []).length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ color: C.faint, fontSize: 10, marginBottom: 4 }}>OLASI İTİRAZLAR</div>
                      {personas[activeTab].objections.slice(0, 2).map((o: string) => (
                        <div key={o} style={{ color: C.mid, fontSize: 11, marginBottom: 4, display: 'flex', gap: 6 }}>
                          <span style={{ color: C.red }}>·</span><span>{o}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(personas[activeTab].resonancePoints || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {personas[activeTab].resonancePoints.slice(0, 3).map((r: string) => (
                        <Tag key={r} color={C.greenBg}>{r.slice(0, 30)}</Tag>
                      ))}
                    </div>
                  )}
                </GlassCard>
              )}

              {consumerTest?.marketReadiness && (
                <GlassCard style={{ marginTop: 10, padding: '10px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: C.mid, fontSize: 12 }}>Pazar Hazırlığı</span>
                    <Tag color={
                      consumerTest.marketReadiness === 'hazir' ? C.greenBg :
                      consumerTest.marketReadiness === 'iyilestirme_gerekli' ? C.yellowBg :
                      C.redBg
                    }>
                      {consumerTest.marketReadiness === 'hazir' ? 'Hazır' :
                       consumerTest.marketReadiness === 'iyilestirme_gerekli' ? 'İyileştirme Gerekli' : 'Yeniden Düşünülmeli'}
                    </Tag>
                  </div>
                  {consumerTest?.overallFeedback && (
                    <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.55, marginTop: 8 }}>
                      {consumerTest.overallFeedback.slice(0, 180)}
                    </p>
                  )}
                </GlassCard>
              )}
            </div>
          ) : (
            /* If no personas, show positioning details */
            positioning && (
              <div>
                {positioning.statement && (
                  <GlassCard style={{ marginBottom: 10 }}>
                    <SectionTitle>Konumlandırma</SectionTitle>
                    <p style={{ color: C.text, fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
                      {positioning.statement}
                    </p>
                    {positioning.differentiator && (
                      <p style={{ color: C.mid, fontSize: 12, marginTop: 8 }}>
                        Ayrıştırıcı: {positioning.differentiator}
                      </p>
                    )}
                  </GlassCard>
                )}
                {(positioning.uniqueValueProposition || positioning.valueProposition) && (
                  <GlassCard>
                    <SectionTitle>Değer Önerisi</SectionTitle>
                    <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65 }}>
                      {positioning.uniqueValueProposition || positioning.valueProposition}
                    </p>
                  </GlassCard>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </SectionBase>
  );
}
