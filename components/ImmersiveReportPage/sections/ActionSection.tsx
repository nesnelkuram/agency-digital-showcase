import React from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, C, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  visual: SectionVisual | undefined;
  actionPlan?: any;
  kpiFramework?: any;
  intibaRoadmap?: any;
}

const PHASE_COLORS = [C.pink, C.yellow, C.green];

export default function ActionSection({ index, visual, actionPlan, kpiFramework, intibaRoadmap }: Props) {
  const phases = [
    { key: 'immediate', label: 'Hemen', color: C.pink, items: actionPlan?.immediate || [] },
    { key: 'shortTerm', label: '30 Gün', color: C.yellow, items: actionPlan?.shortTerm || [] },
    { key: 'mediumTerm', label: '90 Gün', color: C.green, items: actionPlan?.mediumTerm || [] },
  ].filter(p => p.items.length > 0);

  return (
    <SectionBase id="action" index={index} label="Eylem Planı" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle>90 Günlük Strateji Planı</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: kpiFramework ? 'minmax(0,1.35fr) minmax(0,0.65fr)' : '1fr', gap: 24 }}>

          {/* Action phases */}
          <div>
            {intibaRoadmap?.phases?.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {intibaRoadmap.phases.map((phase: any, i: number) => (
                  <GlassCard key={i} style={{ flex: 1, padding: '12px 14px' }}>
                    <div style={{
                      color: PHASE_COLORS[i] || C.slate,
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
                      textTransform: 'uppercase', marginBottom: 5,
                    }}>
                      Faz {i + 1} · {phase.durationDays}g
                    </div>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{phase.label}</div>
                    <div style={{ color: C.mid, fontSize: 11, lineHeight: 1.5, marginBottom: 6 }}>
                      {phase.focus}
                    </div>
                    <div style={{
                      color: C.faint, fontSize: 10,
                      borderTop: `1px solid ${C.cardBorder}`, paddingTop: 6,
                    }}>
                      🎯 {phase.milestone}
                    </div>
                  </GlassCard>
                ))}
              </div>
            ) : phases.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {phases.map(({ label, color, items }) => (
                  <GlassCard key={label} style={{ flex: 1, padding: '12px 14px' }}>
                    <div style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
                      {label}
                    </div>
                    {items.slice(0, 3).map((item: any) => (
                      <div key={item.action} style={{
                        marginBottom: 8, paddingBottom: 8,
                        borderBottom: `1px solid ${C.cardBorder}`,
                      }}>
                        <div style={{ color: C.text, fontSize: 12, marginBottom: 2 }}>{item.action}</div>
                        <div style={{ color: C.faint, fontSize: 10 }}>{item.owner}{item.metric ? ` · ${item.metric}` : ''}</div>
                      </div>
                    ))}
                  </GlassCard>
                ))}
              </div>
            )}

            {/* Roadmap services (from intibaRoadmap phases) */}
            {intibaRoadmap?.phases?.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: '34vh', overflowY: 'auto' }}>
                {intibaRoadmap.phases.flatMap((phase: any, pi: number) =>
                  (phase.services || []).slice(0, 2).map((svc: any, si: number) => (
                    <GlassCard key={`${pi}-${si}`} style={{ padding: '10px 12px' }}>
                      <div style={{ color: PHASE_COLORS[pi] || C.slate, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>
                        {phase.label}
                      </div>
                      <div style={{ color: C.text, fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{svc.name}</div>
                      <div style={{ color: C.mid, fontSize: 11 }}>{(svc.rationale || '').slice(0, 70)}</div>
                    </GlassCard>
                  ))
                ).slice(0, 6)}
              </div>
            )}

            {/* Fallback action items (if roadmap + actionPlan both present) */}
            {intibaRoadmap && phases.length > 0 && (
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {phases.map(({ label, color, items }) => (
                  <div key={label}>
                    <div style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>{label}</div>
                    {items.slice(0, 2).map((item: any) => (
                      <div key={item.action} style={{
                        color: C.mid, fontSize: 11, marginBottom: 5,
                        paddingLeft: 8, borderLeft: `2px solid ${color}50`,
                        lineHeight: 1.4,
                      }}>
                        {item.action}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KPI Framework */}
          {kpiFramework && (
            <div>
              <GlassCard style={{ marginBottom: 10 }}>
                <SectionTitle>Kuzey Yıldızı Metriği</SectionTitle>
                <div style={{ color: C.text, fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
                  {kpiFramework.northStar?.metric}
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <div style={{ color: C.faint, fontSize: 9, textTransform: 'uppercase' }}>Şu An</div>
                    <div style={{ color: C.mid, fontSize: 12 }}>{kpiFramework.northStar?.currentEstimate}</div>
                  </div>
                  <div>
                    <div style={{ color: C.faint, fontSize: 9, textTransform: 'uppercase' }}>90G Hedef</div>
                    <div style={{ color: C.green, fontSize: 13, fontWeight: 700 }}>{kpiFramework.northStar?.target90Day}</div>
                  </div>
                </div>
              </GlassCard>

              {(kpiFramework.leading || []).slice(0, 4).map((kpi: any) => (
                <GlassCard key={kpi.metric} style={{ marginBottom: 8, padding: '10px 14px' }}>
                  <div style={{ color: C.text, fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{kpi.metric}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: C.mid, fontSize: 11 }}>{kpi.measurementMethod}</span>
                    <Tag color={C.greenBg}>{kpi.target}</Tag>
                  </div>
                </GlassCard>
              ))}

              {kpiFramework.reviewCadence && (
                <GlassCard style={{ padding: '10px 14px' }}>
                  <SectionTitle>Değerlendirme Periyodu</SectionTitle>
                  <div style={{ color: C.mid, fontSize: 12 }}>{kpiFramework.reviewCadence}</div>
                </GlassCard>
              )}
            </div>
          )}
        </div>
      </div>
    </SectionBase>
  );
}
