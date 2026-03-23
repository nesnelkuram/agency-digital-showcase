import React from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, C, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  total?: number;
  visual: SectionVisual | undefined;
  actionPlan?: any;
  kpiFramework?: any;
  intibaRoadmap?: any;
}

export default function ActionSection({ index, total, visual, actionPlan, kpiFramework, intibaRoadmap }: Props) {
  const phaseData = [
    { key: 'immediate', label: 'Hemen', dot: '●', items: actionPlan?.immediate || [] },
    { key: 'shortTerm', label: '30 Gün', dot: '●', items: actionPlan?.shortTerm || [] },
    { key: 'mediumTerm', label: '90 Gün', dot: '●', items: actionPlan?.mediumTerm || [] },
  ].filter(p => p.items.length > 0);

  return (
    <SectionBase id="action" index={index} total={total} label="Eylem Planı" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle>90 Günlük Strateji Planı</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 22 }}>

          {/* Action plan */}
          <div>
            {/* Roadmap phase cards */}
            {intibaRoadmap?.phases?.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {intibaRoadmap.phases.map((phase: any, i: number) => (
                  <GlassCard key={i} style={{ flex: 1, padding: '12px 14px' }}>
                    <div style={{ color: C.faint, fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 5 }}>
                      Faz {i + 1} · {phase.durationDays}g
                    </div>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{phase.label}</div>
                    <div style={{ color: C.mid, fontSize: 11, lineHeight: 1.5, marginBottom: 6 }}>{phase.focus}</div>
                    <div style={{ color: C.faint, fontSize: 10, borderTop: `1px solid ${C.cardBorder}`, paddingTop: 5 }}>
                      🎯 {phase.milestone}
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}

            {/* Action items by phase */}
            {phaseData.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${phaseData.length}, 1fr)`, gap: 10 }}>
                {phaseData.map(({ label, items }) => (
                  <GlassCard key={label} style={{ padding: '12px 14px' }}>
                    <SectionTitle>{label}</SectionTitle>
                    {items.map((item: any, i: number) => (
                      <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.cardBorder}` }}>
                        <div style={{ color: C.text, fontSize: 12, fontWeight: 600, marginBottom: 2, lineHeight: 1.4 }}>{item.action}</div>
                        <div style={{ color: C.faint, fontSize: 10 }}>
                          {item.owner && item.owner}{item.metric ? ` · ${item.metric}` : ''}
                        </div>
                        {(item.motivationScore || item.abilityScore) && (
                          <div style={{ color: C.faint, fontSize: 10, marginTop: 2 }}>
                            {item.motivationScore && `İstek ${item.motivationScore}/5`}
                            {item.abilityScore && `  Yeti ${item.abilityScore}/5`}
                          </div>
                        )}
                        {item.bottleneck && (
                          <div style={{ color: C.neg, fontSize: 10, marginTop: 2 }}>⚠ {item.bottleneck}</div>
                        )}
                      </div>
                    ))}
                  </GlassCard>
                ))}
              </div>
            )}
          </div>

          {/* KPI framework */}
          {kpiFramework && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* North Star */}
              {kpiFramework.northStar && (
                <GlassCard>
                  <SectionTitle>Kuzey Yıldızı</SectionTitle>
                  <div style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                    {kpiFramework.northStar.metric}
                  </div>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div>
                      <div style={{ color: C.faint, fontSize: 9, textTransform: 'uppercase' }}>Şu An</div>
                      <div style={{ color: C.mid, fontSize: 12 }}>{kpiFramework.northStar.currentEstimate}</div>
                    </div>
                    <div>
                      <div style={{ color: C.faint, fontSize: 9, textTransform: 'uppercase' }}>90G Hedef</div>
                      <div style={{ color: C.pos, fontSize: 13, fontWeight: 700 }}>{kpiFramework.northStar.target90Day}</div>
                    </div>
                  </div>
                </GlassCard>
              )}

              {/* Leading KPIs */}
              {(kpiFramework.leading || []).slice(0, 4).map((kpi: any) => (
                <GlassCard key={kpi.metric} style={{ padding: '10px 14px' }}>
                  <div style={{ color: C.text, fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{kpi.metric}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: C.mid, fontSize: 11 }}>{kpi.measurementMethod}</span>
                    <Tag color={C.posBg}>{kpi.target}</Tag>
                  </div>
                </GlassCard>
              ))}

              {kpiFramework.reviewCadence && (
                <GlassCard style={{ padding: '10px 14px' }}>
                  <SectionTitle>Değerlendirme</SectionTitle>
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
