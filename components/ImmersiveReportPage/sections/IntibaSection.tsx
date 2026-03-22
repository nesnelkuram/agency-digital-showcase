import React from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, C, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  visual: SectionVisual | undefined;
  intibaEngagement?: any;
  intibaRoadmap?: any;
  brandName?: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  kritik: C.red, onemli: C.yellow, opsiyonel: C.slate,
};
const PRIORITY_LABEL: Record<string, string> = {
  kritik: 'Kritik', onemli: 'Önemli', opsiyonel: 'Opsiyonel',
};

export default function IntibaSection({ index, visual, intibaEngagement, intibaRoadmap, brandName }: Props) {
  const services = intibaEngagement?.recommendedServices?.slice(0, 6) || [];
  const roadmapServices = intibaRoadmap?.phases?.flatMap((p: any) =>
    (p.services || []).map((s: any) => ({ ...s, phaseLabel: p.label }))
  ).slice(0, 6) || [];

  const displayServices = services.length > 0 ? services : roadmapServices;

  return (
    <SectionBase id="intiba" index={index} label="İntiba Hizmetleri" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 24 }}>
          {/* Services */}
          <div>
            <SectionTitle>Önerilen Hizmetler</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
              {displayServices.map((svc: any, i: number) => (
                <GlassCard key={i} style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                      {svc.service || svc.name}
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: PRIORITY_COLOR[svc.priority] || C.slate,
                      background: `${PRIORITY_COLOR[svc.priority] || C.slate}18`,
                      border: `1px solid ${PRIORITY_COLOR[svc.priority] || C.slate}30`,
                      padding: '2px 8px', borderRadius: 10,
                    }}>
                      {PRIORITY_LABEL[svc.priority] || svc.priority}
                    </span>
                  </div>
                  <div style={{ color: C.mid, fontSize: 11, lineHeight: 1.5, marginBottom: 5 }}>
                    {(svc.description || svc.rationale || '').slice(0, 110)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {svc.estimatedInvestment && (
                      <span style={{ color: C.faint, fontSize: 10 }}>💰 {svc.estimatedInvestment}</span>
                    )}
                    {svc.expectedImpact && (
                      <span style={{ color: C.mid, fontSize: 10 }}>📈 {svc.expectedImpact}</span>
                    )}
                    {svc.phaseLabel && <Tag>{svc.phaseLabel}</Tag>}
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* Right: rationale + outcomes + CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {intibaRoadmap?.rationale && (
              <GlassCard>
                <SectionTitle>Neden Bu Yol Haritası</SectionTitle>
                <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.7 }}>
                  {intibaRoadmap.rationale}
                </p>
              </GlassCard>
            )}

            {intibaEngagement?.threeMonthRoadmap && !intibaRoadmap?.rationale && (
              <GlassCard>
                <SectionTitle>3 Aylık Plan</SectionTitle>
                <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.7 }}>
                  {intibaEngagement.threeMonthRoadmap}
                </p>
              </GlassCard>
            )}

            {(intibaEngagement?.expectedOutcomes || []).length > 0 && (
              <GlassCard>
                <SectionTitle>Beklenen Sonuçlar</SectionTitle>
                {intibaEngagement.expectedOutcomes.slice(0, 4).map((outcome: string) => (
                  <div key={outcome} style={{
                    display: 'flex', gap: 8, marginBottom: 8,
                    color: C.mid, fontSize: 12, lineHeight: 1.5,
                  }}>
                    <span style={{ color: C.green, fontWeight: 700 }}>→</span>
                    <span>{outcome}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {/* CTA */}
            <GlassCard style={{
              background: C.text,
              border: 'none',
              textAlign: 'center',
              marginTop: 'auto',
            }}>
              <div style={{ color: '#fff', fontSize: 17, fontWeight: 700, marginBottom: 5 }}>
                Bir sonraki adımı atalım
              </div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 16 }}>
                {brandName && `${brandName} için`} özel strateji seansı — ücretsiz
              </div>
              <a
                href="https://intiba.com.tr"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  background: '#fff', color: C.text,
                  padding: '9px 26px', borderRadius: 24,
                  fontSize: 12, fontWeight: 700, textDecoration: 'none',
                  letterSpacing: '0.03em',
                }}
              >
                intiba.com.tr →
              </a>
            </GlassCard>
          </div>
        </div>
      </div>
    </SectionBase>
  );
}
