import React, { useState } from 'react';
import SectionBase, { FeatureCard, GlassCard, CompactCard, CardStack, TwoCol, SectionTitle, BigText, Tag, PillTabs, C, toStr, type SectionVisual } from '../SectionBase';

interface Props {
  index: number; total?: number; visual: SectionVisual | undefined;
  brandClaim?: any;
  brandNarrative?: any;
  messagingArchitecture?: any;
  contentStrategy?: any;
  socialMediaTemplates?: any[];
}

const CHANNEL_LABELS: Record<string, string> = { instagram: 'Instagram', website_hero: 'Web Hero', campaign_tagline: 'Kampanya', email_subject: 'E-posta', linkedin: 'LinkedIn', story: 'Story', twitter: 'Twitter', tiktok: 'TikTok' };
const PITCH_TABS = [{ key: 'thirtySecond', label: '30 saniye' }, { key: 'twoMinute', label: '2 dakika' }, { key: 'investorPitch', label: 'Yatırımcı' }];
const PLATFORM_COLORS: Record<string, string> = { instagram: '#e1306c', tiktok: '#010101', linkedin: '#0a66c2', twitter: '#1da1f2', facebook: '#1877f2', youtube: '#ff0000' };

export default function MessagingSection({ index, total, visual, brandClaim, brandNarrative, messagingArchitecture, contentStrategy, socialMediaTemplates }: Props) {
  const [activePitch, setActivePitch] = useState(0);
  const [activeChannel, setActiveChannel] = useState(0);
  const [openTemplate, setOpenTemplate] = useState<number | null>(null);

  const examples = brandClaim?.contentExamples || [];
  const toneExamples = brandClaim?.languageGuide?.toneExamples || [];
  const pillars = contentStrategy?.pillars || [];
  const hashtags = contentStrategy?.hashtags || [];
  const templates = socialMediaTemplates || [];
  const elevatorPitches = messagingArchitecture?.elevatorPitches;
  const audienceMessages = messagingArchitecture?.audienceMessages?.slice(0, 3) || [];

  return (
    <SectionBase id="messaging" index={index} total={total} label="Mesaj & İçerik" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── HERO: Brand Claim ── */}
        {brandClaim?.claim && (
          <div style={{ marginBottom: 32, maxWidth: 860 }}>
            <SectionTitle>Marka İddiası</SectionTitle>
            <BigText style={{ fontSize: 'clamp(20px, 2.8vw, 40px)', lineHeight: 1.25, marginBottom: 10 }}>
              "{brandClaim.claim}"
            </BigText>
            {brandClaim?.claimRationale && <p style={{ color: C.faint, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{brandClaim.claimRationale}</p>}
            {messagingArchitecture?.coreMessage && <p style={{ color: C.mid, fontSize: 15, fontWeight: 600, margin: '12px 0 0 0' }}>Ana mesaj: {messagingArchitecture.coreMessage}</p>}
          </div>
        )}

        {/* Taglines */}
        {messagingArchitecture?.taglineCandidates?.length > 0 && (
          <div style={{ marginBottom: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {messagingArchitecture.taglineCandidates.slice(0, 5).map((t: any, i: number) => <Tag key={i}>{toStr(t)}</Tag>)}
          </div>
        )}

        <TwoCol>
          {/* ── LEFT: Language Guide + Messaging ── */}
          <CardStack>
            {/* Language guide — use/avoid */}
            {brandClaim?.languageGuide && (
              <FeatureCard accent={C.blue}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                  <div style={{ paddingRight: 18, borderRight: `1px solid ${C.cardBorder}` }}>
                    <SectionTitle>Kullan</SectionTitle>
                    {(brandClaim.languageGuide.usePhrases || []).slice(0, 5).map((p: any, i: number) => (
                      <div key={i} style={{ color: C.pos, fontSize: 14, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.cardBorder}` }}>"{toStr(p)}"</div>
                    ))}
                  </div>
                  <div style={{ paddingLeft: 18 }}>
                    <SectionTitle>Kullanma</SectionTitle>
                    {(brandClaim.languageGuide.avoidPhrases || []).slice(0, 5).map((p: any, i: number) => (
                      <div key={i} style={{ color: C.neg, fontSize: 14, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.cardBorder}`, textDecoration: 'line-through' }}>"{toStr(p)}"</div>
                    ))}
                  </div>
                </div>
              </FeatureCard>
            )}

            {/* Tone examples */}
            {toneExamples.length > 0 && (
              <GlassCard>
                <SectionTitle>Ton Örnekleri</SectionTitle>
                {toneExamples.slice(0, 3).map((ex: any, i: number) => (
                  <div key={i} style={{ marginBottom: i < toneExamples.length - 1 ? 16 : 0, paddingBottom: i < toneExamples.length - 1 ? 16 : 0, borderBottom: i < toneExamples.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                    <div style={{ color: C.faint, fontSize: 12, marginBottom: 8 }}>{ex.situation}</div>
                    <div style={{ color: C.neg, fontSize: 14, marginBottom: 5 }}>✗ {ex.wrongWay}</div>
                    <div style={{ color: C.pos, fontSize: 14 }}>✓ {ex.rightWay}</div>
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Elevator pitches — tabbed */}
            {elevatorPitches && Object.values(elevatorPitches).some(Boolean) && (
              <FeatureCard accent={C.accent}>
                <SectionTitle>Sunuş Konuşmaları</SectionTitle>
                <PillTabs tabs={PITCH_TABS.filter(t => elevatorPitches[t.key]).map(t => ({ key: t.key, label: t.label }))} active={activePitch} onChange={setActivePitch} />
                {(() => {
                  const available = PITCH_TABS.filter(t => elevatorPitches[t.key]);
                  const text = available[activePitch] ? elevatorPitches[available[activePitch].key] : null;
                  return text ? <p style={{ color: C.mid, fontSize: 16, lineHeight: 1.7, fontStyle: 'italic', fontFamily: C.serif, margin: 0 }}>"{text}"</p> : null;
                })()}
              </FeatureCard>
            )}

            {/* Elevator pitch + social bio */}
            {(brandNarrative?.elevatorPitch || brandNarrative?.socialMediaBio) && (
              <GlassCard>
                {brandNarrative?.elevatorPitch && (
                  <div style={{ marginBottom: brandNarrative?.socialMediaBio ? 16 : 0 }}>
                    <SectionTitle>Asansör Konuşması</SectionTitle>
                    <p style={{ color: C.mid, fontSize: 15, lineHeight: 1.7, fontFamily: C.serif, fontStyle: 'italic', margin: 0 }}>"{brandNarrative.elevatorPitch}"</p>
                  </div>
                )}
                {brandNarrative?.socialMediaBio && (
                  <div style={{ paddingTop: brandNarrative?.elevatorPitch ? 16 : 0, borderTop: brandNarrative?.elevatorPitch ? `1px solid ${C.cardBorder}` : 'none' }}>
                    <SectionTitle>Sosyal Medya Bio'su</SectionTitle>
                    <p style={{ color: C.text, fontSize: 15, lineHeight: 1.6, margin: 0 }}>{brandNarrative.socialMediaBio}</p>
                    <div style={{ color: C.xfaint, fontSize: 12, fontFamily: C.mono, marginTop: 6 }}>{brandNarrative.socialMediaBio.length} karakter</div>
                  </div>
                )}
              </GlassCard>
            )}

            {/* Audience messages */}
            {audienceMessages.length > 0 && (
              <GlassCard>
                <SectionTitle>Kitleye Özel Mesajlar</SectionTitle>
                {audienceMessages.map((am: any, i: number) => (
                  <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < audienceMessages.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                    {am.audience && <div style={{ color: C.faint, fontSize: 12, fontFamily: C.mono, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{am.audience}</div>}
                    {am.headline && <div style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{am.headline}</div>}
                    {am.subheadline && <div style={{ color: C.mid, fontSize: 15, marginBottom: 4 }}>{am.subheadline}</div>}
                    {am.message && !am.headline && <p style={{ color: C.mid, fontSize: 15, lineHeight: 1.55, margin: 0 }}>{am.message}</p>}
                  </div>
                ))}
              </GlassCard>
            )}
          </CardStack>

          {/* ── RIGHT: Content Strategy + Templates ── */}
          <CardStack>
            {/* Content pillars */}
            {pillars.length > 0 && (
              <GlassCard>
                <SectionTitle>İçerik Sütunları</SectionTitle>
                {pillars.map((p: any, i: number) => (
                  <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < pillars.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                      <span style={{ color: C.text, fontFamily: C.mono, fontSize: 12 }}>{String(i + 1).padStart(2, '0')}</span>
                      <div style={{ color: C.text, fontSize: 15, fontWeight: 700 }}>{p.title || p.pillar || p}</div>
                      {p.percentage && <Tag>{p.percentage}%</Tag>}
                    </div>
                    {p.description && <p style={{ color: C.mid, fontSize: 14, lineHeight: 1.55, paddingLeft: 32, margin: 0 }}>{p.description}</p>}
                    {p.examples?.length > 0 && <div style={{ paddingLeft: 32, display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>{p.examples.slice(0, 3).map((ex: string) => <Tag key={ex}>{ex.slice(0, 28)}</Tag>)}</div>}
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Content mix */}
            {contentStrategy?.contentMix && (
              <GlassCard>
                <SectionTitle>İçerik Karması</SectionTitle>
                {Object.entries(contentStrategy.contentMix).map(([key, val]: [string, any]) => (
                  <div key={key} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: C.mid, fontSize: 14 }}>{key}</span>
                      <span style={{ color: C.text, fontSize: 14, fontWeight: 700, fontFamily: C.mono }}>{typeof val === 'number' ? `${val}%` : val}</span>
                    </div>
                    {typeof val === 'number' && (
                      <div style={{ height: 8, background: 'rgba(0,0,0,0.05)', borderRadius: 4 }}>
                        <div style={{ height: '100%', width: `${val}%`, background: C.text, borderRadius: 4, transition: 'width 0.6s ease' }} />
                      </div>
                    )}
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Hashtags */}
            {hashtags.length > 0 && (
              <GlassCard>
                <SectionTitle>Hashtag Stratejisi</SectionTitle>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {hashtags.map((h: string, i: number) => (
                    <span key={i} style={{ background: 'rgba(0,0,0,0.04)', border: `1px solid ${C.cardBorder}`, borderRadius: 18, padding: '6px 14px', color: C.text, fontSize: 13, fontFamily: C.mono }}>#{h.replace(/^#/, '')}</span>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Scheduling */}
            {contentStrategy?.schedulingRecommendation && (
              <CompactCard style={{ borderLeft: `4px solid ${C.pos}`, padding: '14px 18px' }}>
                <span style={{ color: C.faint, fontSize: 12, fontFamily: C.mono, letterSpacing: '0.14em' }}>YAYIN TAKVİMİ · </span>
                <span style={{ color: C.mid, fontSize: 14 }}>{contentStrategy.schedulingRecommendation}</span>
              </CompactCard>
            )}

            {/* Content examples — tabbed */}
            {examples.length > 0 && (
              <GlassCard>
                <SectionTitle>İçerik Örnekleri</SectionTitle>
                <PillTabs tabs={examples.map((ex: any, i: number) => ({ key: String(i), label: CHANNEL_LABELS[ex.channel] || ex.channel }))} active={activeChannel} onChange={setActiveChannel} />
                {examples[activeChannel] && (
                  <div>
                    <p style={{ color: C.text, fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', fontFamily: C.serif, margin: 0 }}>"{examples[activeChannel].content}"</p>
                    {examples[activeChannel].note && <p style={{ color: C.faint, fontSize: 13, margin: '10px 0 0 0' }}>Not: {examples[activeChannel].note}</p>}
                  </div>
                )}
              </GlassCard>
            )}

            {/* Social media templates */}
            {templates.length > 0 && (
              <GlassCard>
                <SectionTitle>Sosyal Medya Şablonları ({templates.length})</SectionTitle>
                <CardStack gap={10}>
                  {templates.map((tmpl: any, i: number) => (
                    <div key={i} style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.cardBorder}` }}>
                      <button onClick={() => setOpenTemplate(openTemplate === i ? null : i)} style={{
                        width: '100%', textAlign: 'left', padding: '12px 16px', background: 'rgba(255,255,255,0.6)',
                        border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: C.sans,
                      }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: PLATFORM_COLORS[tmpl.platform?.toLowerCase()] || C.mid, display: 'inline-block' }} />
                          <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{tmpl.platform} · {tmpl.format}</span>
                        </div>
                        <span style={{ color: C.faint, fontSize: 14 }}>{openTemplate === i ? '−' : '+'}</span>
                      </button>
                      {openTemplate === i && (
                        <div style={{ padding: '16px 18px', background: 'rgba(255,255,255,0.4)' }}>
                          {tmpl.hookLine && <div style={{ marginBottom: 10 }}><div style={{ color: C.faint, fontSize: 12, marginBottom: 4, letterSpacing: '0.08em' }}>KANCA</div><p style={{ color: C.text, fontSize: 15, fontWeight: 600, margin: 0 }}>"{tmpl.hookLine}"</p></div>}
                          {tmpl.bodyTemplate && <div style={{ marginBottom: 10 }}><div style={{ color: C.faint, fontSize: 12, marginBottom: 4, letterSpacing: '0.08em' }}>METIN</div><p style={{ color: C.mid, fontSize: 14, lineHeight: 1.65, margin: 0 }}>{tmpl.bodyTemplate}</p></div>}
                          {tmpl.callToAction && <div><div style={{ color: C.faint, fontSize: 12, marginBottom: 4, letterSpacing: '0.08em' }}>CTA</div><p style={{ color: C.pos, fontSize: 14, fontWeight: 600, margin: 0 }}>{tmpl.callToAction}</p></div>}
                        </div>
                      )}
                    </div>
                  ))}
                </CardStack>
              </GlassCard>
            )}
          </CardStack>
        </TwoCol>
      </div>
    </SectionBase>
  );
}
