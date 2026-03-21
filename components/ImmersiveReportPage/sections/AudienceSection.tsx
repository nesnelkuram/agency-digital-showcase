import React, { useState } from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  visual: SectionVisual | undefined;
  positioning?: any;
  consumerTest?: any;
}

const LIKELIHOOD_COLOR: Record<string, string> = {
  yuksek: '#4ade80', orta: '#facc15', dusuk: '#fb923c', cok_dusuk: '#f87171',
};
const LIKELIHOOD_LABEL: Record<string, string> = {
  yuksek: 'Yüksek', orta: 'Orta', dusuk: 'Düşük', cok_dusuk: 'Çok Düşük',
};

export default function AudienceSection({ index, visual, positioning, consumerTest }: Props) {
  const segments = positioning?.targetSegments?.slice(0, 3) || [];
  const personas = consumerTest?.personas?.slice(0, 3) || [];
  const [activeTab, setActiveTab] = useState(0);

  return (
    <SectionBase id="audience" index={index} label="Hedef Kitle" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle>Hedef Segmentler & Persona Analizi</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {/* Segments */}
          <div>
            {segments.map((seg: any, i: number) => (
              <GlassCard key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{seg.segmentLabel || `Segment ${i + 1}`}</div>
                  <Tag color="rgba(255,255,255,0.1)">{seg.estimatedSegmentSize}</Tag>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 8 }}>{seg.demographics}</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}>{seg.coreNeed}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(seg.purchaseTriggers || []).slice(0, 3).map((t: string) => (
                    <Tag key={t} color="rgba(99, 102, 241, 0.2)">{t.slice(0, 25)}</Tag>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Consumer test personas */}
          {personas.length > 0 && (
            <div>
              {/* Tab bar */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {personas.map((p: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, cursor: 'pointer', border: 'none',
                      background: activeTab === i ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                      color: activeTab === i ? '#fff' : 'rgba(255,255,255,0.45)',
                      fontSize: 12, fontWeight: activeTab === i ? 600 : 400,
                      transition: 'all 0.2s',
                    }}
                  >
                    {p.personaLabel || `Persona ${i + 1}`}
                  </button>
                ))}
              </div>

              {personas[activeTab] && (
                <GlassCard>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{personas[activeTab].personaLabel}</div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      color: LIKELIHOOD_COLOR[personas[activeTab].purchaseLikelihood] || '#fff',
                      background: `${LIKELIHOOD_COLOR[personas[activeTab].purchaseLikelihood]}20`,
                    }}>
                      {LIKELIHOOD_LABEL[personas[activeTab].purchaseLikelihood] || personas[activeTab].purchaseLikelihood}
                    </span>
                  </div>

                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 10 }}>
                    {personas[activeTab].demographics}
                  </div>

                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                    {personas[activeTab].recommendedMessageAngle}
                  </div>

                  {/* Alignment score */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Uyum</div>
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                      <div style={{
                        height: '100%',
                        width: `${(personas[activeTab].alignmentScore || 0) * 10}%`,
                        background: LIKELIHOOD_COLOR[personas[activeTab].purchaseLikelihood] || '#4ade80',
                        borderRadius: 2, transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
                      {personas[activeTab].alignmentScore}/10
                    </div>
                  </div>

                  {(personas[activeTab].resonancePoints || []).slice(0, 2).length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {personas[activeTab].resonancePoints.slice(0, 3).map((r: string) => (
                        <Tag key={r} color="rgba(74, 222, 128, 0.15)">{r.slice(0, 30)}</Tag>
                      ))}
                    </div>
                  )}
                </GlassCard>
              )}

              {consumerTest?.marketReadiness && (
                <GlassCard style={{ marginTop: 16, padding: '12px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Pazar Hazırlığı</span>
                    <Tag color={
                      consumerTest.marketReadiness === 'hazir' ? 'rgba(74,222,128,0.2)' :
                      consumerTest.marketReadiness === 'iyilestirme_gerekli' ? 'rgba(250,204,21,0.2)' :
                      'rgba(248,113,113,0.2)'
                    }>
                      {consumerTest.marketReadiness === 'hazir' ? 'Hazır' :
                       consumerTest.marketReadiness === 'iyilestirme_gerekli' ? 'İyileştirme Gerekli' : 'Yeniden Düşünülmeli'}
                    </Tag>
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
