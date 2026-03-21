import React, { useState } from 'react';
import SectionBase, { GlassCard, SectionTitle, BigText, Tag, type SectionVisual } from '../SectionBase';

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
};

export default function LanguageSection({ index, visual, brandClaim, contentStrategy, messagingArchitecture }: Props) {
  const examples = brandClaim?.contentExamples || [];
  const [activeChannel, setActiveChannel] = useState(0);
  const toneExamples = brandClaim?.languageGuide?.toneExamples || [];

  return (
    <SectionBase id="language" index={index} label="Dil & İddia" visual={visual} overlayOpacity={0.75}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Messaging architecture — Ana Mesaj + taglines */}
        {messagingArchitecture?.coreMessage && (
          <div style={{ marginBottom: 20, maxWidth: 800 }}>
            <SectionTitle>Ana Mesaj</SectionTitle>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'clamp(13px, 1.4vw, 17px)', lineHeight: 1.6, marginBottom: 10 }}>
              {messagingArchitecture.coreMessage}
            </p>
            {(messagingArchitecture.taglineCandidates || []).slice(0, 4).length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(messagingArchitecture.taglineCandidates as string[]).slice(0, 4).map((t: string) => (
                  <Tag key={t} color="rgba(255,255,255,0.1)">{t}</Tag>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Brand claim — hero */}
        {brandClaim?.claim && (
          <div style={{ marginBottom: 36, maxWidth: 800 }}>
            <SectionTitle>Marka İddiaası</SectionTitle>
            <BigText style={{ fontSize: 'clamp(20px, 2.8vw, 42px)', lineHeight: 1.3 }}>
              {brandClaim.claim}
            </BigText>
            {brandClaim?.claimRationale && (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 12, lineHeight: 1.7 }}>
                {brandClaim.claimRationale}
              </p>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>

          {/* Language guide */}
          <div>
            {brandClaim?.languageGuide && (
              <>
                <GlassCard style={{ marginBottom: 16 }}>
                  <SectionTitle>✅ Kullan</SectionTitle>
                  {(brandClaim.languageGuide.usePhrases || []).slice(0, 5).map((p: string) => (
                    <div key={p} style={{
                      color: 'rgba(74,222,128,0.9)', fontSize: 13, marginBottom: 8,
                      paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      "{p}"
                    </div>
                  ))}
                </GlassCard>
                <GlassCard>
                  <SectionTitle>❌ Kullanma</SectionTitle>
                  {(brandClaim.languageGuide.avoidPhrases || []).slice(0, 5).map((p: string) => (
                    <div key={p} style={{
                      color: 'rgba(248,113,113,0.8)', fontSize: 13, marginBottom: 8,
                      paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)',
                      textDecoration: 'line-through',
                    }}>
                      "{p}"
                    </div>
                  ))}
                </GlassCard>
              </>
            )}
          </div>

          {/* Content examples + tone */}
          <div>
            {examples.length > 0 && (
              <GlassCard style={{ marginBottom: 16 }}>
                <SectionTitle>İçerik Örnekleri</SectionTitle>
                {/* Channel tabs */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {examples.map((ex: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setActiveChannel(i)}
                      style={{
                        padding: '4px 12px', borderRadius: 14, cursor: 'pointer', border: 'none', fontSize: 11,
                        background: activeChannel === i ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
                        color: activeChannel === i ? '#fff' : 'rgba(255,255,255,0.45)',
                        fontWeight: activeChannel === i ? 700 : 400, transition: 'all 0.15s',
                      }}
                    >
                      {CHANNEL_LABELS[ex.channel] || ex.channel}
                    </button>
                  ))}
                </div>
                {examples[activeChannel] && (
                  <div>
                    <p style={{ color: '#fff', fontSize: 14, lineHeight: 1.7, fontStyle: 'italic' }}>
                      "{examples[activeChannel].content}"
                    </p>
                    {examples[activeChannel].note && (
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 8 }}>
                        💡 {examples[activeChannel].note}
                      </p>
                    )}
                  </div>
                )}
              </GlassCard>
            )}

            {toneExamples.length > 0 && (
              <GlassCard>
                <SectionTitle>Ton Örnekleri</SectionTitle>
                {toneExamples.slice(0, 2).map((ex: any, i: number) => (
                  <div key={i} style={{ marginBottom: i < toneExamples.length - 1 ? 14 : 0 }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 6 }}>{ex.situation}</div>
                    <div style={{ color: 'rgba(248,113,113,0.7)', fontSize: 12, marginBottom: 4 }}>✗ {ex.wrongWay}</div>
                    <div style={{ color: 'rgba(74,222,128,0.9)', fontSize: 12 }}>✓ {ex.rightWay}</div>
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
