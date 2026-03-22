import React, { useState } from 'react';
import SectionBase, { GlassCard, SectionTitle, BigText, Tag, C, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  visual: SectionVisual | undefined;
  brandClaim?: any;
  contentStrategy?: any;
  messagingArchitecture?: any;
}

const CHANNEL_LABELS: Record<string, string> = {
  instagram: 'Instagram', website_hero: 'Web Hero', campaign_tagline: 'Kampanya',
  email_subject: 'E-posta', linkedin: 'LinkedIn', story: 'Story',
  twitter: 'Twitter', tiktok: 'TikTok',
};

export default function LanguageSection({ index, visual, brandClaim, contentStrategy, messagingArchitecture }: Props) {
  const examples = brandClaim?.contentExamples || [];
  const [activeChannel, setActiveChannel] = useState(0);
  const toneExamples = brandClaim?.languageGuide?.toneExamples || [];
  const pillars = contentStrategy?.pillars?.slice(0, 4) || [];
  const keyMessages = contentStrategy?.keyMessages?.slice(0, 3) || [];
  const hashtags = contentStrategy?.hashtags?.slice(0, 8) || [];

  return (
    <SectionBase id="language" index={index} label="Dil & İçerik" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Messaging architecture */}
        {messagingArchitecture?.coreMessage && (
          <div style={{ marginBottom: 22, maxWidth: 820 }}>
            <SectionTitle>Ana Mesaj</SectionTitle>
            <p style={{ color: C.text, fontSize: 'clamp(14px, 1.5vw, 18px)', lineHeight: 1.6, fontWeight: 600, marginBottom: 10 }}>
              {messagingArchitecture.coreMessage}
            </p>
            {(messagingArchitecture.taglineCandidates || []).slice(0, 4).length > 0 && (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {(messagingArchitecture.taglineCandidates as string[]).slice(0, 4).map((t: string) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Brand claim hero */}
        {brandClaim?.claim && (
          <div style={{ marginBottom: 24, maxWidth: 820 }}>
            <SectionTitle>Marka İddiaası</SectionTitle>
            <BigText style={{ fontSize: 'clamp(18px, 2.5vw, 38px)', lineHeight: 1.3 }}>
              {brandClaim.claim}
            </BigText>
            {brandClaim?.claimRationale && (
              <p style={{ color: C.faint, fontSize: 12, marginTop: 10, lineHeight: 1.7 }}>
                {brandClaim.claimRationale}
              </p>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20 }}>

          {/* Left: language guide + content pillars */}
          <div>
            {brandClaim?.languageGuide && (
              <>
                <GlassCard style={{ marginBottom: 10 }}>
                  <SectionTitle>✅ Kullan</SectionTitle>
                  {(brandClaim.languageGuide.usePhrases || []).slice(0, 5).map((p: string) => (
                    <div key={p} style={{
                      color: C.green, fontSize: 12, marginBottom: 7,
                      paddingBottom: 7, borderBottom: `1px solid ${C.cardBorder}`,
                    }}>
                      "{p}"
                    </div>
                  ))}
                </GlassCard>
                <GlassCard style={{ marginBottom: 10 }}>
                  <SectionTitle>❌ Kullanma</SectionTitle>
                  {(brandClaim.languageGuide.avoidPhrases || []).slice(0, 5).map((p: string) => (
                    <div key={p} style={{
                      color: C.red, fontSize: 12, marginBottom: 7,
                      paddingBottom: 7, borderBottom: `1px solid ${C.cardBorder}`,
                      textDecoration: 'line-through',
                    }}>
                      "{p}"
                    </div>
                  ))}
                </GlassCard>
              </>
            )}

            {/* Content pillars */}
            {pillars.length > 0 && (
              <GlassCard>
                <SectionTitle>İçerik Sütunları</SectionTitle>
                {pillars.map((p: any, i: number) => (
                  <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < pillars.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                      {p.title || p.pillar || p}
                    </div>
                    {p.description && (
                      <div style={{ color: C.mid, fontSize: 11, lineHeight: 1.5 }}>{p.description.slice(0, 100)}</div>
                    )}
                  </div>
                ))}
              </GlassCard>
            )}
          </div>

          {/* Right: content examples + tone + key messages */}
          <div>
            {examples.length > 0 && (
              <GlassCard style={{ marginBottom: 10 }}>
                <SectionTitle>İçerik Örnekleri</SectionTitle>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                  {examples.map((ex: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setActiveChannel(i)}
                      style={{
                        padding: '4px 10px', borderRadius: 12, cursor: 'pointer',
                        border: `1px solid ${activeChannel === i ? 'rgba(0,0,0,0.2)' : C.cardBorder}`,
                        background: activeChannel === i ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.5)',
                        color: activeChannel === i ? C.text : C.faint,
                        fontSize: 10, fontWeight: activeChannel === i ? 700 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {CHANNEL_LABELS[ex.channel] || ex.channel}
                    </button>
                  ))}
                </div>
                {examples[activeChannel] && (
                  <div>
                    <p style={{ color: C.text, fontSize: 13, lineHeight: 1.7, fontStyle: 'italic' }}>
                      "{examples[activeChannel].content}"
                    </p>
                    {examples[activeChannel].note && (
                      <p style={{ color: C.faint, fontSize: 11, marginTop: 7 }}>
                        💡 {examples[activeChannel].note}
                      </p>
                    )}
                  </div>
                )}
              </GlassCard>
            )}

            {toneExamples.length > 0 && (
              <GlassCard style={{ marginBottom: 10 }}>
                <SectionTitle>Ton Örnekleri</SectionTitle>
                {toneExamples.slice(0, 2).map((ex: any, i: number) => (
                  <div key={i} style={{ marginBottom: i < toneExamples.length - 1 ? 12 : 0 }}>
                    <div style={{ color: C.faint, fontSize: 10, marginBottom: 5 }}>{ex.situation}</div>
                    <div style={{ color: C.red, fontSize: 12, marginBottom: 3 }}>✗ {ex.wrongWay}</div>
                    <div style={{ color: C.green, fontSize: 12 }}>✓ {ex.rightWay}</div>
                  </div>
                ))}
              </GlassCard>
            )}

            {keyMessages.length > 0 && (
              <GlassCard style={{ marginBottom: 10 }}>
                <SectionTitle>Temel Mesajlar</SectionTitle>
                {keyMessages.map((msg: string, i: number) => (
                  <div key={i} style={{ color: C.mid, fontSize: 13, lineHeight: 1.55, marginBottom: 6, display: 'flex', gap: 8 }}>
                    <span style={{ color: C.faint, fontFamily: 'monospace', fontSize: 10, minWidth: 14 }}>{i + 1}.</span>
                    <span>{msg}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {hashtags.length > 0 && (
              <GlassCard>
                <SectionTitle>Hashtag'ler</SectionTitle>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {hashtags.map((h: string) => (
                    <Tag key={h} color={C.blueBg}>#{h.replace(/^#/, '')}</Tag>
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
