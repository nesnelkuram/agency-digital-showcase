import React from 'react';
import { motion } from 'framer-motion';
import SectionBase, { C, GlassCard, SectionTitle, toStr } from '../SectionBase';
import type { SectionVisual } from '../SectionBase';

interface RealityCheckItem {
  clientBelief: string;
  marketReality: string;
  theInsight: string;
  opportunityCost: string;
  actionablePivot: string;
}

interface SoWhatItem {
  rawData: string;
  implication: string;
  action: string;
}

interface RealityCheckSectionProps {
  index: number;
  total: number;
  visual?: SectionVisual;
  executiveSummary?: string;
  realityCheck?: RealityCheckItem[];
  soWhatAnalysis?: SoWhatItem[];
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export default function RealityCheckSection({
  index, total, visual,
  executiveSummary,
  realityCheck,
  soWhatAnalysis,
}: RealityCheckSectionProps) {
  const hasContent = executiveSummary || (realityCheck && realityCheck.length > 0) || (soWhatAnalysis && soWhatAnalysis.length > 0);
  if (!hasContent) return null;

  return (
    <SectionBase id="realitycheck" index={index} total={total} label="Gerçeklik Testi" visual={visual}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <SectionTitle>Gerçeklik Testi — Reality Check</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 3, minHeight: 40, background: C.neg,
            borderRadius: 2, flexShrink: 0, marginTop: 4,
          }} />
          <h2 style={{
            color: C.text, fontSize: 'clamp(24px, 3vw, 42px)',
            fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.02em',
            margin: 0,
          }}>
            Siz ne sanıyordunuz,<br />pazar ne söylüyor?
          </h2>
        </div>

        {/* Executive Summary */}
        {executiveSummary && (
          <GlassCard style={{
            marginBottom: 36,
            borderLeft: `3px solid ${C.neg}`,
            background: 'rgba(155,35,53,0.06)',
            borderRadius: '0 14px 14px 0',
          }}>
            <div style={{
              color: C.neg, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.28em', textTransform: 'uppercase',
              fontFamily: 'monospace', marginBottom: 10,
            }}>
              Yönetici Özeti
            </div>
            <p style={{
              color: C.text, fontSize: 'clamp(14px, 1.5vw, 18px)',
              lineHeight: 1.6, fontWeight: 500, margin: 0,
            }}>
              {toStr(executiveSummary)}
            </p>
          </GlassCard>
        )}

        {/* Reality Check Cards */}
        {realityCheck && realityCheck.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div style={{
              color: C.faint, fontSize: 10, letterSpacing: '0.28em',
              textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 16,
            }}>
              İnanç × Gerçeklik Çarpışmaları
            </div>
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-10% 0px' }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              {realityCheck.map((rc, i) => (
                <motion.div key={i} variants={item}>
                  <div style={{
                    background: C.card,
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: `1px solid ${C.cardBorder}`,
                    borderRadius: 14,
                    overflow: 'hidden',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}>
                    {/* Top: Belief vs Reality */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
                    }}>
                      {/* Client Belief */}
                      <div style={{
                        padding: '16px 20px',
                        borderRight: `1px solid ${C.cardBorder}`,
                      }}>
                        <div style={{
                          color: C.faint, fontSize: 9, fontWeight: 700,
                          letterSpacing: '0.24em', textTransform: 'uppercase',
                          fontFamily: 'monospace', marginBottom: 6,
                        }}>
                          Müşteri İnanıyor
                        </div>
                        <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                          {toStr(rc.clientBelief)}
                        </p>
                      </div>
                      {/* Arrow divider (hidden on mobile via grid) */}
                      {/* Market Reality */}
                      <div style={{
                        padding: '16px 20px',
                        background: 'rgba(155,35,53,0.04)',
                      }}>
                        <div style={{
                          color: C.neg, fontSize: 9, fontWeight: 700,
                          letterSpacing: '0.24em', textTransform: 'uppercase',
                          fontFamily: 'monospace', marginBottom: 6,
                        }}>
                          Pazar Gerçeği ↗
                        </div>
                        <p style={{ color: C.text, fontSize: 13, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                          {toStr(rc.marketReality)}
                        </p>
                      </div>
                    </div>

                    {/* The Insight */}
                    <div style={{
                      padding: '14px 20px',
                      borderTop: `1px solid ${C.cardBorder}`,
                      background: 'rgba(28,25,22,0.02)',
                    }}>
                      <div style={{
                        color: C.faint, fontSize: 9, fontWeight: 700,
                        letterSpacing: '0.24em', textTransform: 'uppercase',
                        fontFamily: 'monospace', marginBottom: 4,
                      }}>
                        Aha! İçgörüsü
                      </div>
                      <p style={{
                        color: C.text, fontSize: 14, lineHeight: 1.5,
                        fontWeight: 700, margin: 0, fontStyle: 'italic',
                      }}>
                        "{toStr(rc.theInsight)}"
                      </p>
                    </div>

                    {/* Bottom: Opportunity Cost + Pivot */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
                      borderTop: `1px solid ${C.cardBorder}`,
                    }}>
                      {/* Opportunity Cost */}
                      {rc.opportunityCost && (
                        <div style={{
                          padding: '12px 20px',
                          borderRight: `1px solid ${C.cardBorder}`,
                          background: 'rgba(161,98,7,0.05)',
                        }}>
                          <div style={{
                            color: C.warn, fontSize: 9, fontWeight: 700,
                            letterSpacing: '0.24em', textTransform: 'uppercase',
                            fontFamily: 'monospace', marginBottom: 4,
                          }}>
                            Fırsat Maliyeti
                          </div>
                          <p style={{ color: C.warn, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                            {toStr(rc.opportunityCost)}
                          </p>
                        </div>
                      )}
                      {/* Actionable Pivot */}
                      {rc.actionablePivot && (
                        <div style={{
                          padding: '12px 20px',
                          background: 'rgba(45,106,79,0.05)',
                        }}>
                          <div style={{
                            color: C.pos, fontSize: 9, fontWeight: 700,
                            letterSpacing: '0.24em', textTransform: 'uppercase',
                            fontFamily: 'monospace', marginBottom: 4,
                          }}>
                            Pivot →
                          </div>
                          <p style={{ color: C.pos, fontSize: 12, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                            {toStr(rc.actionablePivot)}
                          </p>
                        </div>
                      )}
                    </div>

                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        {/* So What Analysis */}
        {soWhatAnalysis && soWhatAnalysis.length > 0 && (
          <div>
            <div style={{
              color: C.faint, fontSize: 10, letterSpacing: '0.28em',
              textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 16,
            }}>
              Eee, Yani? — So What Analizi
            </div>
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-10% 0px' }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                gap: 12,
              }}
            >
              {soWhatAnalysis.map((sw, i) => (
                <motion.div key={i} variants={item}>
                  <GlassCard style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Raw data */}
                    <div>
                      <div style={{
                        color: C.faint, fontSize: 9, fontWeight: 700,
                        letterSpacing: '0.22em', textTransform: 'uppercase',
                        fontFamily: 'monospace', marginBottom: 4,
                      }}>
                        Veri
                      </div>
                      <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                        {toStr(sw.rawData)}
                      </p>
                    </div>
                    {/* Implication */}
                    <div style={{
                      background: 'rgba(28,25,22,0.04)',
                      borderRadius: 8,
                      padding: '10px 12px',
                    }}>
                      <div style={{
                        color: C.blue, fontSize: 9, fontWeight: 700,
                        letterSpacing: '0.22em', textTransform: 'uppercase',
                        fontFamily: 'monospace', marginBottom: 4,
                      }}>
                        Eee, Yani?
                      </div>
                      <p style={{ color: C.text, fontSize: 13, lineHeight: 1.5, margin: 0, fontWeight: 600 }}>
                        {toStr(sw.implication)}
                      </p>
                    </div>
                    {/* Action */}
                    <div style={{
                      background: 'rgba(45,106,79,0.07)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      marginTop: 'auto',
                    }}>
                      <div style={{
                        color: C.pos, fontSize: 9, fontWeight: 700,
                        letterSpacing: '0.22em', textTransform: 'uppercase',
                        fontFamily: 'monospace', marginBottom: 4,
                      }}>
                        Aksiyon →
                      </div>
                      <p style={{ color: C.pos, fontSize: 12, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                        {toStr(sw.action)}
                      </p>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

      </div>
    </SectionBase>
  );
}
