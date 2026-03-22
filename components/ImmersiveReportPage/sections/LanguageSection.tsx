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

const PITCH_TABS = [
  { key: 'thirtySecond', label: '30"' },
  { key: 'twoMinute', label: '2 dk' },
  { key: 'investorPitch', label: 'Yatırımcı' },
];

export default function LanguageSection({ index, visual, brandClaim, contentStrategy, messagingArchitecture }: Props) {
  const examples = brandClaim?.contentExamples || [];
  const [activeChannel, setActiveChannel] = useState(0);
  const [activePitch, setActivePitch] = useState(0);
  const toneExamples = brandClaim?.languageGuide?.toneExamples || [];
  const pillars = contentStrategy?.pillars?.slice(0, 4) || [];
  const keyMessages = contentStrategy?.keyMessages?.slice(0, 4) || [];

  const elevatorPitches = messagingArchitecture?.elevatorPitches;
  const audienceMessages = messagingArchitecture?.audienceMessages?.slice(0, 3) || [];

  return (
    <SectionBase id="language" index={index} label="Dil, Mesaj & İddia" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Brand claim hero */}
        {brandClaim?.claim && (
          <div style={{ marginBottom: 22, maxWidth: 840 }}>
            <SectionTitle>Marka İddiaası</SectionTitle>
            <BigText style={{ fontSize: 'clamp(18px, 2.6vw, 38px)', lineHeight: 1.25, marginBottom: 8 }}>
              "{brandClaim.claim}"
            </BigText>
            {brandClaim?.claimRationale && (
              <p style={{ color: C.faint, fontSize: 12, lineHeight: 1.7 }}>{brandClaim.claimRationale}</p>
            )}
            {messagingArchitecture?.coreMessage && (
              <p style={{ color: C.mid, fontSize: 13, fontWeight: 600, marginTop: 10 }}>
                Ana mesaj: {messagingArchitecture.coreMessage}
              </p>
            )}
          </div>
        )}

        {/* Tagline candidates */}
        {messagingArchitecture?.taglineCandidates?.length > 0 && (
          <div style={{ marginBottom: 18, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {messagingArchitecture.taglineCandidates.slice(0, 5).map((t: string) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }}>

          {/* Left: language guide + pillars + key messages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {brandClaim?.languageGuide && (
              <GlassCard>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <SectionTitle>✅ Kullan</SectionTitle>
                    {(brandClaim.languageGuide.usePhrases || []).slice(0, 5).map((p: string) => (
                      <div key={p} style={{ color: C.pos, fontSize: 12, marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid ${C.cardBorder}` }}>
                        "{p}"
                      </div>
                    ))}
                  </div>
                  <div>
                    <SectionTitle>❌ Kullanma</SectionTitle>
                    {(brandClaim.languageGuide.avoidPhrases || []).slice(0, 5).map((p: string) => (
                      <div key={p} style={{ color: C.neg, fontSize: 12, marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid ${C.cardBorder}`, textDecoration: 'line-through' }}>
                        "{p}"
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Tone examples */}
            {toneExamples.length > 0 && (
              <GlassCard>
                <SectionTitle>Ton Örnekleri</SectionTitle>
                {toneExamples.slice(0, 2).map((ex: any, i: number) => (
                  <div key={i} style={{ marginBottom: i < toneExamples.length - 1 ? 12 : 0, paddingBottom: i < toneExamples.length - 1 ? 12 : 0, borderBottom: i < toneExamples.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                    <div style={{ color: C.faint, fontSize: 10, marginBottom: 5 }}>{ex.situation}</div>
                    <div style={{ color: C.neg, fontSize: 12, marginBottom: 3 }}>✗ {ex.wrongWay}</div>
                    <div style={{ color: C.pos, fontSize: 12 }}>✓ {ex.rightWay}</div>
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Content pillars */}
            {pillars.length > 0 && (
              <GlassCard>
                <SectionTitle>İçerik Sütunları</SectionTitle>
                {pillars.map((p: any, i: number) => (
                  <div key={i} style={{ marginBottom: 7, paddingBottom: 7, borderBottom: i < pillars.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                    <div style={{ color: C.text, fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{p.title || p.pillar || p}</div>
                    {p.description && <div style={{ color: C.mid, fontSize: 11, lineHeight: 1.5 }}>{p.description.slice(0, 100)}</div>}
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Key messages */}
            {keyMessages.length > 0 && (
              <GlassCard>
                <SectionTitle>Temel Mesajlar</SectionTitle>
                {keyMessages.map((msg: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, color: C.mid, fontSize: 12, lineHeight: 1.5 }}>
                    <span style={{ color: C.faint, fontFamily: 'monospace', fontSize: 10, minWidth: 14 }}>{i + 1}.</span>
                    <span>{msg}</span>
                  </div>
                ))}
              </GlassCard>
            )}
          </div>

          {/* Right: elevator pitches + content examples + audience messages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Elevator pitches — tabbed */}
            {elevatorPitches && Object.values(elevatorPitches).some(Boolean) && (
              <GlassCard>
                <SectionTitle>Asansör Konuşmaları</SectionTitle>
                <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                  {PITCH_TABS.filter(t => elevatorPitches[t.key]).map((tab, i) => (
                    <button key={tab.key} onClick={() => setActivePitch(i)} style={{
                      padding: '4px 10px', borderRadius: 12, cursor: 'pointer',
                      border: `1px solid ${activePitch === i ? 'rgba(0,0,0,0.2)' : C.cardBorder}`,
                      background: activePitch === i ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.5)',
                      color: activePitch === i ? C.text : C.faint,
                      fontSize: 10, fontWeight: activePitch === i ? 700 : 400, transition: 'all 0.15s',
                    }}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                {(() => {
                  const availableTabs = PITCH_TABS.filter(t => elevatorPitches[t.key]);
                  const activeKey = availableTabs[activePitch]?.key;
                  const text = activeKey ? elevatorPitches[activeKey] : null;
                  return text ? (
                    <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.7, fontStyle: 'italic' }}>"{text}"</p>
                  ) : null;
                })()}
              </GlassCard>
            )}

            {/* Content examples — channel tabs */}
            {examples.length > 0 && (
              <GlassCard>
                <SectionTitle>İçerik Örnekleri</SectionTitle>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                  {examples.map((ex: any, i: number) => (
                    <button key={i} onClick={() => setActiveChannel(i)} style={{
                      padding: '4px 10px', borderRadius: 12, cursor: 'pointer',
                      border: `1px solid ${activeChannel === i ? 'rgba(0,0,0,0.2)' : C.cardBorder}`,
                      background: activeChannel === i ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.5)',
                      color: activeChannel === i ? C.text : C.faint,
                      fontSize: 10, fontWeight: activeChannel === i ? 700 : 400, transition: 'all 0.15s',
                    }}>
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
                      <p style={{ color: C.faint, fontSize: 11, marginTop: 6 }}>💡 {examples[activeChannel].note}</p>
                    )}
                  </div>
                )}
              </GlassCard>
            )}

            {/* Audience-specific messages */}
            {audienceMessages.length > 0 && (
              <GlassCard>
                <SectionTitle>Kitleye Özel Mesajlar</SectionTitle>
                {audienceMessages.map((am: any, i: number) => (
                  <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < audienceMessages.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                    {am.audience && <div style={{ color: C.faint, fontSize: 10, marginBottom: 3 }}>{am.audience}</div>}
                    <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.55 }}>{am.message || am}</p>
                  </div>
                ))}
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </SectionBase>
  );
}
