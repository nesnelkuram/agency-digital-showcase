import React from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  visual: SectionVisual | undefined;
  intibaEngagement?: any;
  intibaRoadmap?: any;
  brandName?: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  kritik: '#f87171', onemli: '#facc15', opsiyonel: '#94a3b8',
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
    <SectionBase id="intiba" index={index} label="Intiba Hizmetleri" visual={visual} overlayOpacity={0.78}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {/* Services */}
          <div>
            <SectionTitle>Önerilen Hizmetler</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayServices.map((svc: any, i: number) => (
                <GlassCard key={i} style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
                      {svc.service || svc.name}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: PRIORITY_COLOR[svc.priority] || '#94a3b8',
                      background: `${PRIORITY_COLOR[svc.priority] || '#94a3b8'}18`,
                      padding: '3px 8px', borderRadius: 10,
                    }}>
                      {PRIORITY_LABEL[svc.priority] || svc.priority}
                    </span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.5, marginBottom: 6 }}>
                    {(svc.description || svc.rationale || '').slice(0, 100)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {svc.estimatedInvestment && (
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                        💰 {svc.estimatedInvestment}
                      </span>
                    )}
                    {svc.phaseLabel && (
                      <Tag color="rgba(255,255,255,0.1)">{svc.phaseLabel}</Tag>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* Right column: roadmap rationale + CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {intibaRoadmap?.rationale && (
              <GlassCard>
                <SectionTitle>Neden Bu Yol Haritası</SectionTitle>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.7 }}>
                  {intibaRoadmap.rationale}
                </p>
              </GlassCard>
            )}

            {intibaEngagement?.threeMonthRoadmap && !intibaRoadmap?.rationale && (
              <GlassCard>
                <SectionTitle>3 Aylık Plan</SectionTitle>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.7 }}>
                  {intibaEngagement.threeMonthRoadmap}
                </p>
              </GlassCard>
            )}

            {(intibaEngagement?.expectedOutcomes || []).length > 0 && (
              <GlassCard>
                <SectionTitle>Beklenen Sonuçlar</SectionTitle>
                {intibaEngagement.expectedOutcomes.slice(0, 4).map((outcome: string) => (
                  <div key={outcome} style={{
                    display: 'flex', gap: 10, marginBottom: 10, color: 'rgba(255,255,255,0.7)', fontSize: 13,
                  }}>
                    <span style={{ color: '#4ade80' }}>→</span>
                    <span>{outcome}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {/* CTA */}
            <GlassCard style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.25)',
              textAlign: 'center',
            }}>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                Bir sonraki adımı atalım
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 16 }}>
                {brandName && `${brandName} için`} özel strateji seansı — ücretsiz
              </div>
              <a
                href="https://intiba.com.tr"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  background: '#fff', color: '#0a0a0a',
                  padding: '10px 28px', borderRadius: 24,
                  fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  letterSpacing: '0.02em',
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
