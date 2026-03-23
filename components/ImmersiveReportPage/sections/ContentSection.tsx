import React, { useState } from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, C, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  total?: number;
  visual: SectionVisual | undefined;
  contentStrategy?: any;
  socialMediaTemplates?: any[];
  blogInsights?: any;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#e1306c',
  tiktok: '#010101',
  linkedin: '#0a66c2',
  twitter: '#1da1f2',
  facebook: '#1877f2',
  youtube: '#ff0000',
};

export default function ContentSection({ index, total, visual, contentStrategy, socialMediaTemplates, blogInsights }: Props) {
  const [openTemplate, setOpenTemplate] = useState<number | null>(null);
  const pillars = contentStrategy?.pillars || [];
  const keyMessages = contentStrategy?.keyMessages || [];
  const toneGuidelines = contentStrategy?.toneGuidelines || [];
  const hashtags = contentStrategy?.hashtags || [];
  const themes = contentStrategy?.themes || [];
  const templates = socialMediaTemplates || [];

  if (!contentStrategy && !templates.length) return null;

  return (
    <SectionBase id="content" index={index} total={total} label="İçerik Stratejisi" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Scheduling hero */}
        {contentStrategy?.schedulingRecommendation && (
          <div style={{
            marginBottom: 24, padding: '14px 20px',
            background: 'rgba(255,255,255,0.6)', borderRadius: 12,
            border: `1px solid ${C.cardBorder}`,
            borderLeft: `4px solid ${C.pos}`,
          }}>
            <span style={{ color: C.faint, fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.2em' }}>YAYIN TAKVİMİ · </span>
            <span style={{ color: C.mid, fontSize: 13 }}>{contentStrategy.schedulingRecommendation}</span>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: 18,
        }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Pillars */}
            {pillars.length > 0 && (
              <GlassCard>
                <SectionTitle>İçerik Sütunları</SectionTitle>
                {pillars.map((p: any, i: number) => (
                  <div key={i} style={{
                    marginBottom: 10, paddingBottom: 10,
                    borderBottom: i < pillars.length - 1 ? `1px solid ${C.cardBorder}` : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ color: C.text, fontFamily: 'monospace', fontSize: 10 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                        {p.title || p.pillar || p}
                      </div>
                      {p.percentage && (
                        <Tag color={C.tagBg}>{p.percentage}%</Tag>
                      )}
                    </div>
                    {p.description && (
                      <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.55, paddingLeft: 26 }}>
                        {p.description}
                      </p>
                    )}
                    {p.examples?.length > 0 && (
                      <div style={{ paddingLeft: 26, display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                        {p.examples.slice(0, 3).map((ex: string) => (
                          <Tag key={ex} color={C.tagBg}>{ex.slice(0, 28)}</Tag>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Key messages */}
            {keyMessages.length > 0 && (
              <GlassCard>
                <SectionTitle>Temel Mesajlar</SectionTitle>
                {keyMessages.map((msg: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, color: C.mid, fontSize: 13, lineHeight: 1.55 }}>
                    <span style={{ color: C.xfaint, fontFamily: 'monospace', fontSize: 10, minWidth: 18, marginTop: 2 }}>{i + 1}.</span>
                    <span>{msg}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Themes */}
            {themes.length > 0 && (
              <GlassCard>
                <SectionTitle>İçerik Temaları</SectionTitle>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {themes.map((t: any, i: number) => (
                    <Tag key={i} color={C.tagBg}>{t.theme || t}</Tag>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Blog insights */}
            {blogInsights?.keyRecommendations?.length > 0 && (
              <GlassCard style={{ background: C.blueBg, border: `1px solid ${C.blue}25` }}>
                <SectionTitle>İçerik Önerileri</SectionTitle>
                {blogInsights.keyRecommendations.map((r: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, color: C.mid, fontSize: 12, lineHeight: 1.5 }}>
                    <span style={{ color: C.blue, fontWeight: 700 }}>→</span>
                    <span>{r}</span>
                  </div>
                ))}
              </GlassCard>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Tone guidelines */}
            {toneGuidelines.length > 0 && (
              <GlassCard>
                <SectionTitle>Ton Kılavuzu</SectionTitle>
                {toneGuidelines.map((g: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, color: C.mid, fontSize: 12, lineHeight: 1.5 }}>
                    <span style={{ color: C.pos }}>·</span><span>{g}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Hashtags */}
            {hashtags.length > 0 && (
              <GlassCard>
                <SectionTitle>Hashtag Stratejisi</SectionTitle>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {hashtags.map((h: string, i: number) => (
                    <span key={i} style={{
                      background: 'rgba(0,0,0,0.06)', border: `1px solid ${C.cardBorder}`,
                      borderRadius: 16, padding: '4px 12px',
                      color: C.text, fontSize: 12, fontFamily: 'monospace',
                    }}>
                      #{h.replace(/^#/, '')}
                    </span>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Content mix */}
            {contentStrategy?.contentMix && (
              <GlassCard>
                <SectionTitle>İçerik Karması</SectionTitle>
                {Object.entries(contentStrategy.contentMix).map(([key, val]: [string, any]) => (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ color: C.mid, fontSize: 12 }}>{key}</span>
                      <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{typeof val === 'number' ? `${val}%` : val}</span>
                    </div>
                    {typeof val === 'number' && (
                      <div style={{ height: 3, background: 'rgba(0,0,0,0.07)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${val}%`, background: C.text, borderRadius: 2 }} />
                      </div>
                    )}
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Social media templates */}
            {templates.length > 0 && (
              <GlassCard>
                <SectionTitle>Sosyal Medya Şablonları ({templates.length})</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {templates.map((tmpl: any, i: number) => (
                    <div key={i} style={{
                      borderRadius: 10, overflow: 'hidden',
                      border: `1px solid ${C.cardBorder}`,
                    }}>
                      {/* Template header */}
                      <button
                        onClick={() => setOpenTemplate(openTemplate === i ? null : i)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '10px 14px',
                          background: 'rgba(255,255,255,0.6)', border: 'none', cursor: 'pointer',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: PLATFORM_COLORS[tmpl.platform?.toLowerCase()] || C.mid,
                            display: 'inline-block',
                          }} />
                          <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>
                            {tmpl.platform} · {tmpl.format}
                          </span>
                          {tmpl.pillar && <Tag color={C.tagBg}>{tmpl.pillar}</Tag>}
                        </div>
                        <span style={{ color: C.faint, fontSize: 12 }}>{openTemplate === i ? '−' : '+'}</span>
                      </button>

                      {openTemplate === i && (
                        <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.4)' }}>
                          {tmpl.hookLine && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ color: C.faint, fontSize: 10, marginBottom: 3 }}>KANCA</div>
                              <p style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>"{tmpl.hookLine}"</p>
                            </div>
                          )}
                          {tmpl.bodyTemplate && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ color: C.faint, fontSize: 10, marginBottom: 3 }}>METIN ŞABLONU</div>
                              <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.6 }}>{tmpl.bodyTemplate}</p>
                            </div>
                          )}
                          {tmpl.callToAction && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ color: C.faint, fontSize: 10, marginBottom: 3 }}>CTA</div>
                              <p style={{ color: C.pos, fontSize: 12, fontWeight: 600 }}>{tmpl.callToAction}</p>
                            </div>
                          )}
                          {tmpl.exampleCaption && (
                            <div style={{
                              background: C.tagBg, borderRadius: 8, padding: '10px 12px', marginTop: 8,
                            }}>
                              <div style={{ color: C.faint, fontSize: 10, marginBottom: 4 }}>ÖRNEK ALTYAZI</div>
                              <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.65 }}>{tmpl.exampleCaption}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </SectionBase>
  );
}
