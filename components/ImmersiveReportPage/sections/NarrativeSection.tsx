import React from 'react';
import SectionBase, { GlassCard, SectionTitle, BigText, C, toStr, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  total?: number;
  visual: SectionVisual | undefined;
  brandNarrative?: any;
  emotionalNarrative?: any;
  messagingArchitecture?: any;
}

export default function NarrativeSection({ index, total, visual, brandNarrative, emotionalNarrative, messagingArchitecture }: Props) {
  const manifesto = emotionalNarrative?.manifesto || brandNarrative?.brandManifesto;
  const taglines = messagingArchitecture?.taglineCandidates || [];

  if (!brandNarrative && !emotionalNarrative && !messagingArchitecture) return null;

  return (
    <SectionBase id="narrative" index={index} total={total} label="Marka Anlatısı" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* One-line promise hero */}
        {emotionalNarrative?.oneLinePromise && (
          <div style={{ marginBottom: 28, maxWidth: 860, borderLeft: `3px solid ${C.neg}`, paddingLeft: 20 }}>
            <SectionTitle>Marka Sözü</SectionTitle>
            <BigText style={{ fontSize: 'clamp(20px, 2.8vw, 42px)', lineHeight: 1.2, color: C.text }}>
              "{emotionalNarrative.oneLinePromise}"
            </BigText>
          </div>
        )}

        {/* Taglines */}
        {taglines.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {taglines.map((t: any, i: number) => (
              <span key={i} style={{
                background: 'rgba(255,255,255,0.7)', border: `1px solid ${C.cardBorder}`,
                borderRadius: 20, padding: '6px 16px',
                color: C.mid, fontSize: 12, letterSpacing: '0.05em',
              }}>
                {toStr(t)}
              </span>
            ))}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 18,
        }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Elevator pitch */}
            {brandNarrative?.elevatorPitch && (
              <GlassCard>
                <SectionTitle>30 Saniyelik Anlatı</SectionTitle>
                <p style={{ color: C.mid, fontSize: 14, lineHeight: 1.75, fontStyle: 'italic' }}>
                  "{brandNarrative.elevatorPitch}"
                </p>
              </GlassCard>
            )}

            {/* Social media bio */}
            {brandNarrative?.socialMediaBio && (
              <GlassCard>
                <SectionTitle>Sosyal Medya Bio'su</SectionTitle>
                <p style={{ color: C.text, fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
                  {brandNarrative.socialMediaBio}
                </p>
                <div style={{ color: C.xfaint, fontSize: 10, fontFamily: 'monospace' }}>
                  {brandNarrative.socialMediaBio.length} karakter
                </div>
              </GlassCard>
            )}

            {/* Core message */}
            {messagingArchitecture?.coreMessage && (
              <GlassCard>
                <SectionTitle>Marka Vaadi</SectionTitle>
                <p style={{ color: C.mid, fontSize: 14, lineHeight: 1.65, fontWeight: 600 }}>
                  {messagingArchitecture.coreMessage}
                </p>
              </GlassCard>
            )}

            {/* Elevator pitches by duration */}
            {messagingArchitecture?.elevatorPitches && (
              <GlassCard>
                <SectionTitle>Sunuş Konuşmaları</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { key: 'thirtySecond', label: '30 saniye' },
                    { key: 'twoMinute', label: '2 dakika' },
                    { key: 'investorPitch', label: 'Yatırımcı' },
                  ].filter(t => messagingArchitecture.elevatorPitches[t.key]).map(({ key, label }) => (
                    <div key={key}>
                      <div style={{ color: C.faint, fontSize: 10, fontFamily: 'monospace', marginBottom: 4 }}>{label}</div>
                      <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65, fontStyle: 'italic' }}>
                        "{messagingArchitecture.elevatorPitches[key]}"
                      </p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Audience messages */}
            {messagingArchitecture?.audienceMessages?.length > 0 && (
              <GlassCard>
                <SectionTitle>Kitleye Özel Mesajlar</SectionTitle>
                {messagingArchitecture.audienceMessages.map((am: any, i: number) => (
                  <div key={i} style={{
                    marginBottom: 12, paddingBottom: 12,
                    borderBottom: i < messagingArchitecture.audienceMessages.length - 1 ? `1px solid ${C.cardBorder}` : 'none',
                  }}>
                    {am.audience && (
                      <div style={{ color: C.faint, fontSize: 10, fontFamily: 'monospace', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{am.audience}</div>
                    )}
                    {am.headline && <div style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{am.headline}</div>}
                    {am.subheadline && <div style={{ color: C.mid, fontSize: 13, marginBottom: 3 }}>{am.subheadline}</div>}
                    {am.message && !am.headline && <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.55 }}>{am.message}</p>}
                    {am.proof && <div style={{ color: C.faint, fontSize: 11, fontStyle: 'italic' }}>"{am.proof}"</div>}
                  </div>
                ))}
              </GlassCard>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Manifesto */}
            {manifesto && (
              <div style={{
                background: 'rgba(28,25,22,0.9)', border: 'none', borderRadius: 14,
                padding: '20px 24px', boxSizing: 'border-box',
              }}>
                <div style={{
                  color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: '0.32em',
                  textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 12,
                }}>
                  Manifesto
                </div>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.85, fontStyle: 'italic' }}>
                  {manifesto}
                </p>
                {emotionalNarrative?.oneLinePromise && (
                  <div style={{
                    marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: 'monospace',
                  }}>
                    "{emotionalNarrative.oneLinePromise}"
                  </div>
                )}
              </div>
            )}

            {/* Transformation story */}
            {emotionalNarrative?.transformationStory && (
              <GlassCard>
                <SectionTitle>Dönüşüm Hikayesi</SectionTitle>
                <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.75 }}>
                  {emotionalNarrative.transformationStory}
                </p>
              </GlassCard>
            )}

            {/* Brand story / origin */}
            {(brandNarrative?.brandStory || brandNarrative?.originStory) && (
              <GlassCard>
                <SectionTitle>{brandNarrative?.originStory ? 'Kuruluş Hikayesi' : 'Marka Hikayesi'}</SectionTitle>
                <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.75 }}>
                  {brandNarrative?.originStory || brandNarrative?.brandStory}
                </p>
              </GlassCard>
            )}

            {/* Hero moments */}
            {emotionalNarrative?.heroMoments?.length > 0 && (
              <GlassCard>
                <SectionTitle>Kahraman Anları</SectionTitle>
                {emotionalNarrative.heroMoments.map((moment: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: C.pos, fontWeight: 700, marginTop: 2 }}>★</span>
                    <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.55 }}>{toStr(moment)}</p>
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
