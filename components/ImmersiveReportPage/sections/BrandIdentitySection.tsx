import React from 'react';
import SectionBase, { GlassCard, SectionTitle, BigText, Tag, type SectionVisual } from '../SectionBase';

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
  const palette = visualWorld?.colorPalette?.slice(0, 4) || [];
  const traits = brandPersonality?.traits?.slice(0, 5) || [];
  const sliders = brandCharacter?.sliders;
  const score = qualityMetrics?.distinctivenessScore;

  return (
    <SectionBase id="identity" index={index} label="Marka Kimliği" visual={visual}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 24, maxWidth: 1200, margin: '0 auto' }}>

        {/* Left */}
        <div>
          <SectionTitle>Marka Arketipi</SectionTitle>
          {brandPersonality?.archetype && (
            <BigText style={{ marginBottom: 16 }}>{brandPersonality.archetype}</BigText>
          )}
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
            {brandPersonality?.tone && <span>Ton: <em>{brandPersonality.tone}</em> · </span>}
            {brandPersonality?.voice && <span>Ses: <em>{brandPersonality.voice}</em></span>}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
            {traits.map((t: string) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>

          {score !== undefined && (
            <GlassCard style={{ display: 'inline-block', padding: '12px 24px' }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>Özgünlük Skoru</div>
              <div style={{ color: '#fff', fontSize: 32, fontWeight: 800 }}>{score}<span style={{ fontSize: 16, opacity: 0.5 }}>/100</span></div>
            </GlassCard>
          )}
        </div>

        {/* Right */}
        <div>
          {/* Brand narrative elevator pitch */}
          {(brandNarrative?.elevatorPitch || emotionalNarrative?.oneLinePromise) && (
            <GlassCard style={{ marginBottom: 16 }}>
              <SectionTitle>Asansör Konuşması</SectionTitle>
              {brandNarrative?.elevatorPitch && (
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.65, marginBottom: emotionalNarrative?.oneLinePromise ? 10 : 0 }}>
                  {brandNarrative.elevatorPitch}
                </p>
              )}
              {emotionalNarrative?.oneLinePromise && (
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontStyle: 'italic', borderTop: brandNarrative?.elevatorPitch ? '1px solid rgba(255,255,255,0.08)' : 'none', paddingTop: brandNarrative?.elevatorPitch ? 8 : 0 }}>
                  "{emotionalNarrative.oneLinePromise}"
                </p>
              )}
            </GlassCard>
          )}

          {/* Color palette */}
          {palette.length > 0 && (
            <GlassCard style={{ marginBottom: 16 }}>
              <SectionTitle>Renk Paleti</SectionTitle>
              <div style={{ display: 'flex', gap: 12 }}>
                {palette.map((c: any, i: number) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: c.hex || '#333',
                      border: '1px solid rgba(255,255,255,0.15)',
                      marginBottom: 6,
                    }} />
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'monospace' }}>{c.hex}</div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>{c.usage}</div>
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
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{label}</span>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{value}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                    <div style={{
                      height: '100%', width: `${value}%`,
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.8))',
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
