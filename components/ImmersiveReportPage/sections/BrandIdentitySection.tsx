import React from 'react';
import SectionBase, { FeatureCard, GlassCard, CompactCard, CardStack, TwoCol, SectionTitle, Tag, C, toStr, type SectionVisual } from '../SectionBase';

interface Props {
  index: number; total?: number; visual: SectionVisual | undefined;
  brandPersonality?: any; brandCharacter?: any; visualWorld?: any;
  emotionalNarrative?: any; brandEnemy?: string;
}

export default function BrandIdentitySection({ index, total, visual, brandPersonality, brandCharacter, visualWorld, emotionalNarrative, brandEnemy }: Props) {
  const palette = visualWorld?.colorPalette?.slice(0, 6) || [];
  const traits = brandPersonality?.traits || [];
  const sliders = brandCharacter?.sliders;
  const behaviors = brandCharacter?.behaviors || [];
  const keywords = visualWorld?.moodKeywords || [];
  const styleDirectives = visualWorld?.styleDirectives || [];

  return (
    <SectionBase id="identity" index={index} total={total} label="Marka Kimliği" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── HERO: Archetype display ── */}
        {brandPersonality?.archetype && (
          <div style={{ marginBottom: 36, display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: C.xfaint, fontSize: 11, fontFamily: C.mono, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>Karakter Tipi</div>
              <div style={{ color: C.text, fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, fontFamily: C.serif, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {toStr(brandPersonality.archetype)}
              </div>
            </div>
            {(brandPersonality?.tone || brandPersonality?.voice) && (
              <p style={{ color: C.mid, fontSize: 15, lineHeight: 1.5, margin: 0, marginBottom: 4 }}>
                {brandPersonality?.tone && <span>Ton: <em>{toStr(brandPersonality.tone)}</em></span>}
                {brandPersonality?.tone && brandPersonality?.voice && <span style={{ color: C.xfaint }}> · </span>}
                {brandPersonality?.voice && <span>Ses: <em>{toStr(brandPersonality.voice)}</em></span>}
              </p>
            )}
          </div>
        )}

        {traits.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
            {traits.map((t: any, i: number) => <Tag key={i}>{toStr(t)}</Tag>)}
          </div>
        )}

        <TwoCol>
          {/* ── LEFT: Character + Brand Enemy ── */}
          <CardStack>
            {/* Brand enemy */}
            {brandEnemy && (
              <FeatureCard accent={C.neg} style={{ padding: '22px 28px' }}>
                <div style={{ color: C.neg, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Marka Düşmanı</div>
                <p style={{ color: C.text, fontSize: 16, fontWeight: 700, lineHeight: 1.45, margin: 0, fontFamily: C.serif }}>{toStr(brandEnemy)}</p>
              </FeatureCard>
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
                  <div key={label} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                      <span style={{ color: C.mid, fontSize: 13 }}>{label}</span>
                      <span style={{ color: C.faint, fontSize: 12, fontFamily: C.mono }}>{value}</span>
                    </div>
                    <div style={{ height: 10, background: 'rgba(0,0,0,0.05)', borderRadius: 5, position: 'relative' }}>
                      <div style={{
                        height: '100%', width: `${value}%`, borderRadius: 5,
                        background: `linear-gradient(90deg, rgba(26,22,20,0.1), rgba(26,22,20,0.4))`,
                        transition: 'width 0.6s ease',
                      }} />
                      <div style={{
                        position: 'absolute', top: -3, left: `${value}%`, transform: 'translateX(-50%)',
                        width: 16, height: 16, borderRadius: '50%',
                        background: C.text, border: '3px solid #fff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                      }} />
                    </div>
                  </div>
                ))}
              </GlassCard>
            )}

            {behaviors.length > 0 && (
              <GlassCard>
                <SectionTitle>Davranışlar</SectionTitle>
                {behaviors.map((b: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, lineHeight: 1.55 }}>
                    <span style={{ color: C.pos, fontWeight: 700, fontSize: 16, flexShrink: 0 }}>·</span>
                    <span style={{ color: C.mid, fontSize: 14 }}>{toStr(b)}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {brandCharacter?.dinnerPartyDescription && (
              <FeatureCard accent={C.faint} style={{ padding: '24px 28px' }}>
                <SectionTitle>Kişilik Metaforu</SectionTitle>
                <p style={{ color: C.mid, fontSize: 16, lineHeight: 1.75, fontStyle: 'italic', fontFamily: C.serif, margin: 0 }}>
                  "{toStr(brandCharacter.dinnerPartyDescription)}"
                </p>
              </FeatureCard>
            )}
          </CardStack>

          {/* ── RIGHT: Manifesto + Visual World ── */}
          <CardStack>
            {/* Manifesto — dark card */}
            {(emotionalNarrative?.manifesto) && (
              <div style={{
                background: 'rgba(26,22,20,0.93)', borderRadius: 18,
                padding: '28px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              }}>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', fontFamily: C.sans, fontWeight: 600, marginBottom: 16 }}>
                  Manifesto
                </div>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 1.85, fontStyle: 'italic', fontFamily: C.serif, margin: 0 }}>
                  {toStr(emotionalNarrative.manifesto)}
                </p>
                {emotionalNarrative?.oneLinePromise && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: C.serif, fontWeight: 600, margin: 0 }}>
                      "{toStr(emotionalNarrative.oneLinePromise)}"
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Color palette strip */}
            {palette.length > 0 && (
              <GlassCard>
                <SectionTitle>Renk Paleti</SectionTitle>
                <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', marginBottom: 10, height: 48 }}>
                  {palette.map((c: any, i: number) => (
                    <div key={i} style={{ flex: 1, background: c.hex || '#ccc' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  {palette.map((c: any, i: number) => (
                    <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ color: C.faint, fontSize: 10, fontFamily: C.mono }}>{c.hex}</div>
                      {c.usage && <div style={{ color: C.xfaint, fontSize: 10 }}>{c.usage.slice(0, 12)}</div>}
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Visual world — full (mood + typography + imagery + directives) */}
            {(keywords.length > 0 || visualWorld?.typographyStyle || styleDirectives.length > 0) && (
              <GlassCard>
                <SectionTitle>Görsel Dünya</SectionTitle>
                {keywords.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                    {keywords.map((k: string) => <Tag key={k}>{k}</Tag>)}
                  </div>
                )}
                {visualWorld?.typographyStyle && <p style={{ color: C.mid, fontSize: 14, margin: '0 0 6px 0' }}>Tipografi: <em>{visualWorld.typographyStyle}</em></p>}
                {visualWorld?.imageryStyle && <p style={{ color: C.mid, fontSize: 14, margin: '0 0 6px 0' }}>Görsel Stili: <em>{visualWorld.imageryStyle}</em></p>}
                {styleDirectives.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.cardBorder}` }}>
                    <div style={{ color: C.faint, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Stil Yönergeleri</div>
                    {styleDirectives.map((d: string, i: number) => (
                      <div key={i} style={{ color: C.mid, fontSize: 14, marginBottom: 5, lineHeight: 1.5 }}>· {d}</div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}
          </CardStack>
        </TwoCol>
      </div>
    </SectionBase>
  );
}
