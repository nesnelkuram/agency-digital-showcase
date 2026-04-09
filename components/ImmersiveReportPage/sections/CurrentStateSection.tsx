import React from 'react';
import { motion } from 'framer-motion';
import SectionBase, { FeatureCard, GlassCard, CompactCard, CardStack, TwoCol, SectionTitle, Tag, C, toStr, type SectionVisual } from '../SectionBase';

interface Props {
  index: number; total?: number; visual: SectionVisual | undefined;
  executiveSummary?: string;
  brandMaturity?: any;
  businessContext?: any;
  soWhatAnalysis?: any[];
  blindSpots?: any[];
}

const MATURITY_LEVELS = ['pre_brand', 'emerging', 'developing', 'mature'];
const MATURITY_LABELS: Record<string, string> = { pre_brand: 'Ön-Marka', emerging: 'Gelişen', developing: 'Olgunlaşan', mature: 'Olgun' };
const STAGE_LABELS: Record<string, string> = { idea: 'Fikir Aşaması', new: 'Yeni Kuruldu (0-1 yıl)', growing: 'Büyüme Aşaması (1-3 yıl)', established: 'Yerleşik (3+ yıl)' };

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeItem = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } };

export default function CurrentStateSection({ index, total, visual, executiveSummary, brandMaturity, businessContext, soWhatAnalysis, blindSpots }: Props) {
  const maturityIdx = MATURITY_LEVELS.indexOf(brandMaturity?.level || '');
  const hasContent = executiveSummary || brandMaturity || businessContext || soWhatAnalysis?.length || blindSpots?.length;
  if (!hasContent) return null;

  return (
    <SectionBase id="currentstate" index={index} total={total} label="Mevcut Durum" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── HERO: Executive Summary ── */}
        {executiveSummary && (
          <FeatureCard accent={C.accent} style={{ marginBottom: 36 }}>
            <div style={{ color: C.accent, fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: C.mono, marginBottom: 12 }}>
              Genel Değerlendirme
            </div>
            <p style={{ color: C.text, fontSize: 'clamp(15px, 1.6vw, 20px)', lineHeight: 1.65, fontWeight: 500, margin: 0, fontFamily: C.serif }}>
              {toStr(executiveSummary)}
            </p>
          </FeatureCard>
        )}

        <TwoCol>
          {/* ── LEFT: Maturity + Business Context ── */}
          <CardStack>
            {/* Brand Maturity */}
            {brandMaturity && (
              <FeatureCard accent={C.text}>
                <SectionTitle>Marka Olgunluk Seviyesi</SectionTitle>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {MATURITY_LEVELS.map((level, i) => (
                    <div key={level} style={{
                      flex: 1, height: 12, borderRadius: 6,
                      background: i <= maturityIdx ? C.text : 'rgba(0,0,0,0.07)',
                      transition: 'background 0.4s',
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  {MATURITY_LEVELS.map((level) => (
                    <span key={level} style={{
                      fontSize: 11, fontFamily: C.mono,
                      color: brandMaturity.level === level ? C.text : C.xfaint,
                      fontWeight: brandMaturity.level === level ? 700 : 400,
                    }}>
                      {MATURITY_LABELS[level]}
                    </span>
                  ))}
                </div>

                {brandMaturity.factors && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'İş Yaşı', value: brandMaturity.factors.businessAge ?? 0 },
                      { label: 'Marka Varlıkları', value: brandMaturity.factors.brandAssets ?? 0 },
                      { label: 'Dijital Varlık', value: brandMaturity.factors.digitalPresence ?? 0 },
                      { label: 'Kitle Büyüklüğü', value: brandMaturity.factors.audienceSize ?? 0 },
                    ].map(({ label, value }) => (
                      <CompactCard key={label} style={{ padding: '10px 14px' }}>
                        <div style={{ color: C.faint, fontSize: 11, marginBottom: 6 }}>{label}</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {[1, 2, 3].map(n => (
                            <div key={n} style={{ flex: 1, height: 8, borderRadius: 4, background: n <= value ? C.text : 'rgba(0,0,0,0.07)' }} />
                          ))}
                        </div>
                      </CompactCard>
                    ))}
                  </div>
                )}

                {brandMaturity.reportFocus && (
                  <p style={{ color: C.mid, fontSize: 14, lineHeight: 1.65, marginTop: 16, margin: '16px 0 0 0' }}>{brandMaturity.reportFocus}</p>
                )}
              </FeatureCard>
            )}

            {/* Business Context */}
            {businessContext && (
              <GlassCard>
                <SectionTitle>İş Profili</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {[
                    { label: 'İş Aşaması', value: STAGE_LABELS[businessContext.businessStage] || businessContext.businessStage },
                    { label: 'Coğrafi Alan', value: businessContext.geoScope },
                    { label: 'Çalışan Sayısı', value: businessContext.employeeCount },
                    { label: 'Aylık Ciro', value: businessContext.monthlyRevenue },
                  ].filter(f => f.value).map(({ label, value }) => (
                    <CompactCard key={label}>
                      <div style={{ color: C.faint, fontSize: 11, marginBottom: 4, letterSpacing: '0.06em' }}>{label}</div>
                      <div style={{ color: C.text, fontSize: 15, fontWeight: 600 }}>{value}</div>
                    </CompactCard>
                  ))}
                </div>
                {businessContext.primaryGoal && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.cardBorder}` }}>
                    <div style={{ color: C.faint, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Birincil Hedef</div>
                    <p style={{ color: C.mid, fontSize: 14, margin: 0, lineHeight: 1.55 }}>{businessContext.primaryGoal}</p>
                  </div>
                )}
                {businessContext.digitalPlatforms?.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {businessContext.digitalPlatforms.map((p: string) => <Tag key={p}>{p}</Tag>)}
                  </div>
                )}
              </GlassCard>
            )}

            {/* Blind spots */}
            {blindSpots && blindSpots.length > 0 && (
              <GlassCard style={{ borderLeft: `4px solid ${C.pos}` }}>
                <SectionTitle>Görülmeyen Güçler</SectionTitle>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {blindSpots.map((b: any, i: number) => <Tag key={i} color={C.posBg}>{toStr(b)}</Tag>)}
                </div>
              </GlassCard>
            )}
          </CardStack>

          {/* ── RIGHT: So-What Analysis ── */}
          <CardStack>
            {soWhatAnalysis && soWhatAnalysis.length > 0 && (
              <>
                <SectionTitle>Ne Anlama Geliyor?</SectionTitle>
                <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-10% 0px' }}>
                  <CardStack gap={14}>
                    {soWhatAnalysis.map((sw: any, i: number) => (
                      <motion.div key={i} variants={fadeItem}>
                        <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <div style={{ color: C.faint, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>Tespit</div>
                            <p style={{ color: C.mid, fontSize: 14, lineHeight: 1.55, margin: 0 }}>{toStr(sw.rawData)}</p>
                          </div>
                          <CompactCard style={{ background: 'rgba(37,99,235,0.05)', padding: '14px 16px' }}>
                            <div style={{ color: C.blue, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>Bunun Anlamı</div>
                            <p style={{ color: C.text, fontSize: 15, lineHeight: 1.55, margin: 0, fontWeight: 600 }}>{toStr(sw.implication)}</p>
                          </CompactCard>
                          <CompactCard style={{ background: 'rgba(26,122,66,0.06)', padding: '14px 16px' }}>
                            <div style={{ color: C.pos, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>Yapılması Gereken</div>
                            <p style={{ color: C.pos, fontSize: 14, lineHeight: 1.55, margin: 0, fontWeight: 500 }}>{toStr(sw.action)}</p>
                          </CompactCard>
                        </GlassCard>
                      </motion.div>
                    ))}
                  </CardStack>
                </motion.div>
              </>
            )}
          </CardStack>
        </TwoCol>
      </div>
    </SectionBase>
  );
}
