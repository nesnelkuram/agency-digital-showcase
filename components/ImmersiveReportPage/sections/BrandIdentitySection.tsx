import React from 'react';
import SectionBase, { GlassCard, SectionTitle, BigText, Tag, C, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  visual: SectionVisual | undefined;
  brandPersonality?: any;
  brandCharacter?: any;
  visualWorld?: any;
  qualityMetrics?: any;
  brandNarrative?: any;
  emotionalNarrative?: any;
}

export default function BrandIdentitySection({ index, visual, brandPersonality, brandCharacter, visualWorld, qualityMetrics, brandNarrative, emotionalNarrative }: Props) {
  const palette = visualWorld?.colorPalette?.slice(0, 5) || [];
  const traits = brandPersonality?.traits?.slice(0, 6) || [];
  const sliders = brandCharacter?.sliders;
  const score = qualityMetrics?.distinctivenessScore;
  const keywords = visualWorld?.moodKeywords?.slice(0, 6) || [];

  return (
    <SectionBase id="identity" index={index} label="Marka Kimliği" visual={visual}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 24, maxWidth: 1200, margin: '0 auto' }}>

        {/* Left */}
        <div>
          <SectionTitle>Marka Arketipi</SectionTitle>
          {brandPersonality?.archetype && (
            <BigText style={{ marginBottom: 8 }}>{brandPersonality.archetype}</BigText>
          )}
          <p style={{ color: C.mid, fontSize: 14, lineHeight: 1.65, marginBottom: 18 }}>
            {brandPersonality?.tone && <span>Ton: <em>{brandPersonality.tone}</em></span>}
            {brandPersonality?.tone && brandPersonality?.voice && <span style={{ color: C.faint }}> · </span>}
            {brandPersonality?.voice && <span>Ses: <em>{brandPersonality.voice}</em></span>}
          </p>

          {traits.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
              {traits.map((t: string) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          )}

          {/* Mood keywords */}
          {keywords.length > 0 && (
            <GlassCard style={{ marginBottom: 16 }}>
              <SectionTitle>Görsel Atmosfer</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {keywords.map((k: string) => (
                  <Tag key={k} color="rgba(0,0,0,0.05)">{k}</Tag>
                ))}
              </div>
              {visualWorld?.typographyStyle && (
                <p style={{ color: C.mid, fontSize: 12, marginTop: 8 }}>
                  Tipografi: <em>{visualWorld.typographyStyle}</em>
                </p>
              )}
              {visualWorld?.imageryStyle && (
                <p style={{ color: C.mid, fontSize: 12, marginTop: 4 }}>
                  Görsel: <em>{visualWorld.imageryStyle}</em>
                </p>
              )}
            </GlassCard>
          )}

          {score !== undefined && (
            <GlassCard style={{ display: 'inline-block', padding: '12px 22px' }}>
              <div style={{ color: C.faint, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 4 }}>Özgünlük Skoru</div>
              <div style={{ color: C.text, fontSize: 30, fontWeight: 800 }}>{score}<span style={{ fontSize: 14, color: C.faint }}>/100</span></div>
            </GlassCard>
          )}
        </div>

        {/* Right */}
        <div>
          {/* Elevator pitch */}
          {(brandNarrative?.elevatorPitch || emotionalNarrative?.oneLinePromise) && (
            <GlassCard style={{ marginBottom: 14 }}>
              <SectionTitle>Asansör Konuşması</SectionTitle>
              {brandNarrative?.elevatorPitch && (
                <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65, marginBottom: emotionalNarrative?.oneLinePromise ? 10 : 0 }}>
                  {brandNarrative.elevatorPitch}
                </p>
              )}
              {emotionalNarrative?.oneLinePromise && (
                <p style={{ color: C.faint, fontSize: 12, fontStyle: 'italic', borderTop: brandNarrative?.elevatorPitch ? `1px solid ${C.cardBorder}` : 'none', paddingTop: brandNarrative?.elevatorPitch ? 8 : 0 }}>
                  "{emotionalNarrative.oneLinePromise}"
                </p>
              )}
            </GlassCard>
          )}

          {/* Brand narrative origin */}
          {brandNarrative?.originStory && (
            <GlassCard style={{ marginBottom: 14 }}>
              <SectionTitle>Köken Hikayesi</SectionTitle>
              <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65 }}>
                {brandNarrative.originStory.slice(0, 220)}
              </p>
            </GlassCard>
          )}

          {/* Color palette */}
          {palette.length > 0 && (
            <GlassCard style={{ marginBottom: 14 }}>
              <SectionTitle>Renk Paleti</SectionTitle>
              <div style={{ display: 'flex', gap: 10 }}>
                {palette.map((c: any, i: number) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: c.hex || '#ccc',
                      border: `1px solid ${C.cardBorder}`,
                      marginBottom: 5,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }} />
                    <div style={{ color: C.faint, fontSize: 9, fontFamily: 'monospace' }}>{c.hex}</div>
                    {c.usage && <div style={{ color: C.mid, fontSize: 9 }}>{c.usage.slice(0, 10)}</div>}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Character sliders */}
          {sliders && (
            <GlassCard>
              <SectionTitle>Karakter Spektrumu</SectionTitle>
              {[
                { label: 'Dost ←→ Otoriter', value: sliders.friendAuthority ?? 50 },
                { label: 'Genç ←→ Olgun', value: sliders.youngMature ?? 50 },
                { label: 'Eğlenceli ←→ Ciddi', value: sliders.playfulSerious ?? 50 },
                { label: 'Kitlesel ←→ Seçkin', value: sliders.massElite ?? 50 },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: C.mid, fontSize: 11 }}>{label}</span>
                    <span style={{ color: C.faint, fontSize: 10 }}>{value}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2 }}>
                    <div style={{
                      height: '100%', width: `${value}%`,
                      background: 'linear-gradient(90deg, rgba(0,0,0,0.2), rgba(0,0,0,0.5))',
                      borderRadius: 2,
                    }} />
                  </div>
                </div>
              ))}
            </GlassCard>
          )}
        </div>
      </div>
    </SectionBase>
  );
}
