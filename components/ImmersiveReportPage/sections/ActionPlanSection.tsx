import React from 'react';
import SectionBase, { FeatureCard, GlassCard, CompactCard, CardStack, CardRow, TwoCol, SectionTitle, Tag, C, toStr, type SectionVisual } from '../SectionBase';

interface Props {
  index: number; total?: number; visual: SectionVisual | undefined;
  actionPlan?: any;
  kpiFramework?: any;
  intibaRoadmap?: any;
  intibaEngagement?: any;
  brandName?: string;
}

const PRIORITY_COLOR: Record<string, string> = { kritik: C.neg, onemli: '#b8860b', opsiyonel: C.faint };
const PRIORITY_LABEL: Record<string, string> = { kritik: 'Kritik', onemli: 'Önemli', opsiyonel: 'Opsiyonel' };

export default function ActionPlanSection({ index, total, visual, actionPlan, kpiFramework, intibaRoadmap, intibaEngagement, brandName }: Props) {
  const phaseData = [
    { key: 'immediate', label: 'Hemen', color: C.neg, items: actionPlan?.immediate || [] },
    { key: 'shortTerm', label: '30 Gün', color: C.warn, items: actionPlan?.shortTerm || [] },
    { key: 'mediumTerm', label: '90 Gün', color: C.pos, items: actionPlan?.mediumTerm || [] },
  ].filter(p => p.items.length > 0);

  const services = intibaEngagement?.recommendedServices?.slice(0, 8) || [];
  const roadmapServices = intibaRoadmap?.phases?.flatMap((p: any) => (p.services || []).map((s: any) => ({ ...s, phaseLabel: p.label }))).slice(0, 8) || [];
  const displayServices = services.length > 0 ? services : roadmapServices;

  return (
    <SectionBase id="actionplan" index={index} total={total} label="Eylem Planı" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── HERO: Roadmap phases timeline ── */}
        {intibaRoadmap?.phases?.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <SectionTitle>Yol Haritası</SectionTitle>
            <CardRow gap={14}>
              {intibaRoadmap.phases.map((phase: any, i: number) => (
                <FeatureCard key={i} accent={i === 0 ? C.accent : i === 1 ? C.warn : C.pos} style={{ flex: 1, padding: '22px 24px' }}>
                  <div style={{ color: C.faint, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Faz {i + 1} · {phase.durationDays}g
                  </div>
                  <div style={{ color: C.text, fontSize: 17, fontWeight: 700, fontFamily: C.serif, marginBottom: 6 }}>{phase.label}</div>
                  <div style={{ color: C.mid, fontSize: 14, lineHeight: 1.55, marginBottom: 12 }}>{phase.focus}</div>
                  <CompactCard style={{ padding: '8px 12px' }}>
                    <div style={{ color: C.faint, fontSize: 11, letterSpacing: '0.08em' }}>Hedef: {phase.milestone}</div>
                  </CompactCard>
                </FeatureCard>
              ))}
            </CardRow>
          </div>
        )}

        <TwoCol>
          {/* ── LEFT: Actions + Services ── */}
          <CardStack>
            {/* 90-day actions */}
            {phaseData.length > 0 && (
              <>
                <SectionTitle>90 Günlük Aksiyon Planı</SectionTitle>
                {phaseData.map(({ key, label, color, items }) => (
                  <GlassCard key={key} style={{ borderLeft: `4px solid ${color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                      <span style={{ color: C.text, fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
                      <span style={{ color: C.xfaint, fontSize: 12, fontFamily: C.mono }}>{items.length} aksiyon</span>
                    </div>
                    {items.map((item: any, i: number) => (
                      <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < items.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                        <div style={{ color: C.text, fontSize: 15, fontWeight: 600, marginBottom: 5, lineHeight: 1.45 }}>{item.action}</div>
                        {(item.owner || item.metric) && (
                          <div style={{ color: C.faint, fontSize: 13 }}>{item.owner}{item.metric ? ` · ${item.metric}` : ''}</div>
                        )}
                        {item.bottleneck && <div style={{ color: C.neg, fontSize: 13, marginTop: 6 }}>⚠ {item.bottleneck}</div>}
                      </div>
                    ))}
                  </GlassCard>
                ))}
              </>
            )}

            {/* Recommended services */}
            {displayServices.length > 0 && (
              <>
                <SectionTitle>Önerilen Hizmetler</SectionTitle>
                {displayServices.map((svc: any, i: number) => {
                  const pColor = PRIORITY_COLOR[svc.priority] || C.faint;
                  return (
                    <GlassCard key={i} style={{ borderLeft: `4px solid ${pColor}`, padding: '18px 22px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
                        <div style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>{svc.service || svc.name}</div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                          color: pColor, background: `${pColor}18`, border: `1px solid ${pColor}28`,
                          padding: '3px 10px', borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0,
                        }}>
                          {PRIORITY_LABEL[svc.priority] || svc.priority}
                        </span>
                      </div>
                      <div style={{ color: C.mid, fontSize: 14, lineHeight: 1.55, marginBottom: 10 }}>{(svc.description || svc.rationale || '').slice(0, 140)}</div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {svc.estimatedInvestment && <CompactCard style={{ padding: '4px 12px' }}><span style={{ color: C.faint, fontSize: 12 }}>Yatırım: <strong style={{ color: C.text }}>{svc.estimatedInvestment}</strong></span></CompactCard>}
                        {svc.expectedImpact && <CompactCard style={{ padding: '4px 12px' }}><span style={{ color: C.faint, fontSize: 12 }}>Etki: <strong style={{ color: C.text }}>{svc.expectedImpact}</strong></span></CompactCard>}
                        {svc.phaseLabel && <Tag>{svc.phaseLabel}</Tag>}
                      </div>
                    </GlassCard>
                  );
                })}
              </>
            )}
          </CardStack>

          {/* ── RIGHT: KPI + Outcomes + CTA ── */}
          <CardStack>
            {/* KPI North Star */}
            {kpiFramework?.northStar && (
              <FeatureCard accent={C.pos} style={{ textAlign: 'center', padding: '28px 32px' }}>
                <SectionTitle>Kuzey Yıldızı</SectionTitle>
                <div style={{ color: C.text, fontSize: 20, fontWeight: 700, fontFamily: C.serif, marginBottom: 16 }}>{kpiFramework.northStar.metric}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 32 }}>
                  <div>
                    <div style={{ color: C.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Şu An</div>
                    <div style={{ color: C.mid, fontSize: 18, fontFamily: C.serif }}>{kpiFramework.northStar.currentEstimate}</div>
                  </div>
                  <div style={{ width: 1, background: C.cardBorder }} />
                  <div>
                    <div style={{ color: C.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>90G Hedef</div>
                    <div style={{ color: C.pos, fontSize: 22, fontWeight: 700, fontFamily: C.serif }}>{kpiFramework.northStar.target90Day}</div>
                  </div>
                </div>
              </FeatureCard>
            )}

            {/* Leading KPIs */}
            {(kpiFramework?.leading || []).slice(0, 4).map((kpi: any) => (
              <GlassCard key={kpi.metric} style={{ padding: '16px 22px' }}>
                <div style={{ color: C.text, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{kpi.metric}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: C.mid, fontSize: 13 }}>{kpi.measurementMethod}</span>
                  <Tag color={C.posBg}>{kpi.target}</Tag>
                </div>
              </GlassCard>
            ))}

            {kpiFramework?.reviewCadence && (
              <CompactCard style={{ padding: '14px 18px' }}>
                <div style={{ color: C.faint, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Değerlendirme Sıklığı</div>
                <div style={{ color: C.mid, fontSize: 14 }}>{kpiFramework.reviewCadence}</div>
              </CompactCard>
            )}

            {/* Rationale */}
            {(intibaRoadmap?.rationale || intibaEngagement?.threeMonthRoadmap) && (
              <FeatureCard accent={C.accent}>
                <SectionTitle>{intibaRoadmap?.rationale ? 'Neden Bu Yol Haritası' : '3 Aylık Plan'}</SectionTitle>
                <p style={{ color: C.mid, fontSize: 15, lineHeight: 1.75, margin: 0 }}>{intibaRoadmap?.rationale || intibaEngagement?.threeMonthRoadmap}</p>
              </FeatureCard>
            )}

            {/* Expected outcomes */}
            {intibaEngagement?.expectedOutcomes?.length > 0 && (
              <GlassCard style={{ borderLeft: `4px solid ${C.pos}` }}>
                <SectionTitle>Beklenen Sonuçlar</SectionTitle>
                {intibaEngagement.expectedOutcomes.slice(0, 4).map((outcome: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, lineHeight: 1.55 }}>
                    <span style={{ color: C.pos, fontWeight: 700, fontSize: 16, flexShrink: 0 }}>→</span>
                    <span style={{ color: C.mid, fontSize: 14 }}>{toStr(outcome)}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {/* CTA */}
            <div style={{
              background: C.text, borderRadius: 18, padding: '32px 36px', textAlign: 'center',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)', marginTop: 'auto',
            }}>
              <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, fontFamily: C.serif, marginBottom: 8 }}>Bir sonraki adımı atalım</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, marginBottom: 22 }}>
                {brandName && `${brandName} için`} özel strateji seansı — ücretsiz
              </div>
              <a href="https://intiba.com.tr" target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-block', background: '#fff', color: C.text,
                padding: '12px 32px', borderRadius: 24, fontSize: 15, fontWeight: 700,
                textDecoration: 'none', fontFamily: C.sans,
              }}>
                intiba.com.tr →
              </a>
            </div>
          </CardStack>
        </TwoCol>
      </div>
    </SectionBase>
  );
}
