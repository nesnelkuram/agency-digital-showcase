import React from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  visual: SectionVisual | undefined;
  actionPlan?: any;
  kpiFramework?: any;
  intibaRoadmap?: any;
}

export default function ActionSection({ index, visual, actionPlan, kpiFramework, intibaRoadmap }: Props) {
  const phases = [
    { key: 'immediate', label: 'Hemen', color: '#f472b6', items: actionPlan?.immediate || [] },
    { key: 'shortTerm', label: '30 Gün', color: '#facc15', items: actionPlan?.shortTerm || [] },
    { key: 'mediumTerm', label: '90 Gün', color: '#4ade80', items: actionPlan?.mediumTerm || [] },
  ].filter(p => p.items.length > 0);

  return (
    <SectionBase id="action" index={index} label="Eylem Planı" visual={visual} overlayOpacity={0.7}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTitle>90 Günlük Strateji Planı</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: kpiFramework ? '1.3fr 0.7fr' : '1fr', gap: 28 }}>

          {/* Action phases */}
          <div>
            {/* Roadmap phases from intibaRoadmap */}
            {intibaRoadmap?.phases?.length > 0 ? (
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                {intibaRoadmap.phases.map((phase: any, i: number) => (
                  <GlassCard key={i} style={{ flex: 1, padding: '16px 18px' }}>
                    <div style={{
                      color: ['#f472b6', '#facc15', '#4ade80'][i] || '#94a3b8',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
                      textTransform: 'uppercase', marginBottom: 6,
                    }}>
                      Faz {i + 1} · {phase.durationDays} gün
                    </div>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{phase.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>
                      {phase.focus}
                    </div>
                    <div style={{
                      color: 'rgba(255,255,255,0.35)', fontSize: 11,
                      borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8,
                    }}>
                      🎯 {phase.milestone}
                    </div>
                  </GlassCard>
                ))}
              </div>
            ) : (
              // Fallback: actionPlan phases
              <div style={{ display: 'flex', gap: 12 }}>
                {phases.map(({ label, color, items }) => (
                  <GlassCard key={label} style={{ flex: 1, padding: '16px 18px' }}>
                    <div style={{
                      color, fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10,
                    }}>
                      {label}
                    </div>
                    {items.slice(0, 3).map((item: any) => (
                      <div key={item.action} style={{
                        marginBottom: 10, paddingBottom: 10,
                        borderBottom: '1px solid rgba(255,255,255,0.07)',
                      }}>
                        <div style={{ color: '#fff', fontSize: 13, marginBottom: 2 }}>{item.action}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{item.owner} · {item.metric}</div>
                      </div>
                    ))}
                  </GlassCard>
                ))}
              </div>
            )}

            {/* Action items list (if roadmap exists) */}
            {intibaRoadmap && phases.length > 0 && (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {phases.map(({ label, color, items }) => (
                  <div key={label}>
                    <div style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', marginBottom: 8, textTransform: 'uppercase' }}>{label}</div>
                    {items.slice(0, 2).map((item: any) => (
                      <div key={item.action} style={{
                        color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 6,
                        paddingLeft: 10, borderLeft: `2px solid ${color}40`,
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
              <GlassCard style={{ marginBottom: 14 }}>
                <SectionTitle>Kuzey Yıldızı Metriği</SectionTitle>
                <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                  {kpiFramework.northStar?.metric}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>Şu An</div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{kpiFramework.northStar?.currentEstimate}</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>90 Gün Hedef</div>
                    <div style={{ color: '#4ade80', fontSize: 13, fontWeight: 700 }}>{kpiFramework.northStar?.target90Day}</div>
                  </div>
                </div>
              </GlassCard>

              {(kpiFramework.leading || []).slice(0, 3).map((kpi: any) => (
                <GlassCard key={kpi.metric} style={{ marginBottom: 10, padding: '12px 16px' }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{kpi.metric}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{kpi.measurementMethod}</span>
                    <Tag color="rgba(74,222,128,0.2)">{kpi.target}</Tag>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionBase>
  );
}
