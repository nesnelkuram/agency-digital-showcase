import React from 'react';
import SectionBase, { GlassCard, SectionTitle, BigText, Tag, C, toStr, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  total?: number;
  visual: SectionVisual | undefined;
  brandPersonality?: any;
  brandCharacter?: any;
  visualWorld?: any;
  qualityMetrics?: any;
  brandNarrative?: any;
  emotionalNarrative?: any;
  brandEnemy?: string;
}


export default function BrandIdentitySection({ index, total, visual, brandPersonality, brandCharacter, visualWorld, qualityMetrics, brandNarrative, emotionalNarrative, brandEnemy }: Props) {
  const palette = visualWorld?.colorPalette?.slice(0, 6) || [];
  const traits = brandPersonality?.traits || [];
  const sliders = brandCharacter?.sliders;
  const behaviors = brandCharacter?.behaviors || [];
  const score = qualityMetrics?.distinctivenessScore;
  const keywords = visualWorld?.moodKeywords || [];

  return (
    <SectionBase id="identity" index={index} total={total} label="Marka Kimliği" visual={visual}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
        gap: 20, maxWidth: 1200, margin: '0 auto',
      }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Archetype */}
          <div>
            <SectionTitle>Marka Arketipi</SectionTitle>
            {brandPersonality?.archetype && (
              <BigText style={{ marginBottom: 6 }}>{brandPersonality.archetype}</BigText>
            )}
            <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
              {brandPersonality?.tone && <span>Ton: <em>{brandPersonality.tone}</em></span>}
              {brandPersonality?.tone && brandPersonality?.voice && <span style={{ color: C.xfaint }}> · </span>}
              {brandPersonality?.voice && <span>Ses: <em>{brandPersonality.voice}</em></span>}
            </p>
            {traits.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {traits.map((t: any, i: number) => <Tag key={i}>{toStr(t)}</Tag>)}
              </div>
            )}
          </div>

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
                <div key={label} style={{ marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: C.mid, fontSize: 11 }}>{label}</span>
                    <span style={{ color: C.faint, fontSize: 10 }}>{value}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${value}%`, background: 'linear-gradient(90deg, rgba(0,0,0,0.15), rgba(0,0,0,0.5))', borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </GlassCard>
          )}

          {/* Behaviors */}
          {behaviors.length > 0 && (
            <GlassCard>
              <SectionTitle>Davranışlar</SectionTitle>
              {behaviors.map((b: any, i: number) => (
                <div key={i} style={{ color: C.mid, fontSize: 12, marginBottom: 5, display: 'flex', gap: 8, lineHeight: 1.45 }}>
                  <span style={{ color: C.pos, fontWeight: 700 }}>·</span><span>{toStr(b)}</span>
                </div>
              ))}
            </GlassCard>
          )}

          {/* Dinner party description */}
          {brandCharacter?.dinnerPartyDescription && (
            <GlassCard>
              <SectionTitle>Kişilik Metaforu</SectionTitle>
              <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65, fontStyle: 'italic' }}>
                "{brandCharacter.dinnerPartyDescription}"
              </p>
            </GlassCard>
          )}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Score + Onlyness */}
          <div style={{ display: 'flex', gap: 10 }}>
            {score !== undefined && (
              <GlassCard style={{ flex: 1, textAlign: 'center', padding: '14px 18px' }}>
                <div style={{ color: C.faint, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 4 }}>Özgünlük</div>
                <div style={{ color: C.text, fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{score}<span style={{ fontSize: 13, color: C.faint }}>/100</span></div>
              </GlassCard>
            )}
            {brandEnemy && (
              <GlassCard style={{ flex: 2, padding: '14px 18px' }}>
                <div style={{ color: C.neg, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 4 }}>Marka Düşmanı</div>
                <p style={{ color: C.text, fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{brandEnemy}</p>
              </GlassCard>
            )}
          </div>

          {/* Onlyness test */}
          {qualityMetrics?.onlynessTest && (
            <GlassCard>
              <SectionTitle>Teklik Testi</SectionTitle>
              <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65 }}>{qualityMetrics.onlynessTest}</p>
            </GlassCard>
          )}

          {/* Brand narrative */}
          {brandNarrative?.elevatorPitch && (
            <GlassCard>
              <SectionTitle>Asansör Konuşması</SectionTitle>
              <p style={{ color: C.mid, fontSize: 13, lineHeight: 1.65 }}>{brandNarrative.elevatorPitch}</p>
            </GlassCard>
          )}

          {/* Manifesto excerpt */}
          {(emotionalNarrative?.manifesto || brandNarrative?.brandManifesto) && (
            <GlassCard>
              <SectionTitle>Manifesto</SectionTitle>
              <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.7, fontStyle: 'italic' }}>
                {(emotionalNarrative?.manifesto || brandNarrative?.brandManifesto || '').slice(0, 250)}…
              </p>
              {emotionalNarrative?.oneLinePromise && (
                <p style={{ color: C.text, fontSize: 13, fontWeight: 700, marginTop: 8 }}>
                  "{emotionalNarrative.oneLinePromise}"
                </p>
              )}
            </GlassCard>
          )}

          {/* Color palette */}
          {palette.length > 0 && (
            <GlassCard>
              <SectionTitle>Renk Paleti</SectionTitle>
              <div style={{ display: 'flex', gap: 10 }}>
                {palette.map((c: any, i: number) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: c.hex || '#ccc', border: `1px solid ${C.cardBorder}`, marginBottom: 4 }} />
                    <div style={{ color: C.faint, fontSize: 9, fontFamily: 'monospace' }}>{c.hex}</div>
                    {c.usage && <div style={{ color: C.mid, fontSize: 9 }}>{c.usage.slice(0, 10)}</div>}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Visual mood */}
          {(keywords.length > 0 || visualWorld?.typographyStyle) && (
            <GlassCard>
              <SectionTitle>Görsel Dünya</SectionTitle>
              {keywords.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                  {keywords.map((k: string) => <Tag key={k}>{k}</Tag>)}
                </div>
              )}
              {visualWorld?.typographyStyle && <p style={{ color: C.mid, fontSize: 11, marginBottom: 3 }}>Tipografi: <em>{visualWorld.typographyStyle}</em></p>}
              {visualWorld?.imageryStyle && <p style={{ color: C.mid, fontSize: 11 }}>Görsel: <em>{visualWorld.imageryStyle}</em></p>}
            </GlassCard>
          )}
        </div>
      </div>
    </SectionBase>
  );
}
