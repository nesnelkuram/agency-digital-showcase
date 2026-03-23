import React from 'react';
import SectionBase, { GlassCard, SectionTitle, Tag, C, type SectionVisual } from '../SectionBase';

interface Props {
  index: number;
  total?: number;
  visual: SectionVisual | undefined;
  digitalPresence?: any;
  visualWorld?: any;
}

export default function DigitalSection({ index, total, visual, digitalPresence, visualWorld }: Props) {
  if (!digitalPresence && !visualWorld) return null;

  const website = digitalPresence?.website;
  const instagram = digitalPresence?.instagram;
  const palette = visualWorld?.colorPalette?.slice(0, 6) || [];
  const keywords = visualWorld?.moodKeywords || [];

  return (
    <SectionBase id="digital" index={index} total={total} label="Dijital Varlık & Görsel Dünya" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Overall digital score hero */}
        {digitalPresence?.overallDigitalScore !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'rgba(255,255,255,0.7)', border: `3px solid ${C.cardBorder}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>
              <span style={{ color: C.text, fontSize: 22, fontWeight: 900, lineHeight: 1 }}>
                {digitalPresence.overallDigitalScore}
              </span>
              <span style={{ color: C.faint, fontSize: 9, fontFamily: 'monospace' }}>/10</span>
            </div>
            <div>
              <div style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Dijital Olgunluk Skoru</div>
              {digitalPresence.digitalMaturityLevel && (
                <Tag color={C.tagBg}>{digitalPresence.digitalMaturityLevel}</Tag>
              )}
            </div>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: 18,
        }}>
          {/* Left column: platform details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Website */}
            {website && website.status !== 'not_provided' && (
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <SectionTitle>Web Sitesi</SectionTitle>
                  {website.status && (
                    <Tag color={website.status === 'analyzed' ? C.posBg : C.tagBg}>{website.status}</Tag>
                  )}
                </div>

                {website.designQuality && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: C.mid, fontSize: 12 }}>Tasarım Kalitesi</span>
                    <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{website.designQuality}</span>
                  </div>
                )}

                {/* SEO basics */}
                {website.seoBasics && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: C.faint, fontSize: 10, marginBottom: 5 }}>SEO TEMEL</div>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6,
                    }}>
                      {[
                        { key: 'hasTitle', label: 'Title' },
                        { key: 'hasDescription', label: 'Meta Desc' },
                        { key: 'hasOGTags', label: 'OG Tags' },
                        { key: 'mobileOptimized', label: 'Mobile' },
                      ].map(({ key, label }) => (
                        <div key={key} style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          background: C.tagBg, borderRadius: 6, padding: '4px 8px',
                        }}>
                          <span style={{ color: website.seoBasics?.[key] || website[key] ? C.pos : C.neg, fontSize: 11 }}>
                            {website.seoBasics?.[key] || website[key] ? '✓' : '✗'}
                          </span>
                          <span style={{ color: C.mid, fontSize: 11 }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {website.overallImpression && (
                  <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.55, marginBottom: 8 }}>{website.overallImpression}</p>
                )}

                {website.strengths?.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    {website.strengths.map((s: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 4, color: C.mid, fontSize: 11 }}>
                        <span style={{ color: C.pos }}>✓</span><span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {website.weaknesses?.length > 0 && (
                  <div>
                    {website.weaknesses.map((w: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 4, color: C.mid, fontSize: 11 }}>
                        <span style={{ color: C.neg }}>✗</span><span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}

            {/* Instagram */}
            {instagram && instagram.status !== 'not_provided' && (
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <SectionTitle>Instagram</SectionTitle>
                  {instagram.engagementLevel && (
                    <Tag color={C.tagBg}>{instagram.engagementLevel}</Tag>
                  )}
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8, marginBottom: 12,
                }}>
                  {[
                    { label: 'Takipçi', value: instagram.followerRange },
                    { label: 'Yayın Sıklığı', value: instagram.postingFrequency },
                    { label: 'Görsel Stil', value: instagram.visualStyle },
                  ].filter(i => i.value).map(({ label, value }) => (
                    <div key={label} style={{ background: C.tagBg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ color: C.faint, fontSize: 9, marginBottom: 3 }}>{label}</div>
                      <div style={{ color: C.text, fontSize: 11, fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {instagram.contentThemes?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                    {instagram.contentThemes.map((t: string) => (
                      <Tag key={t} color={C.tagBg}>{t}</Tag>
                    ))}
                  </div>
                )}

                {instagram.strengths?.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    {instagram.strengths.map((s: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 4, color: C.mid, fontSize: 11 }}>
                        <span style={{ color: C.pos }}>✓</span><span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {instagram.weaknesses?.length > 0 && (
                  <div>
                    {instagram.weaknesses.map((w: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 4, color: C.mid, fontSize: 11 }}>
                        <span style={{ color: C.neg }}>✗</span><span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}

            {/* Other platforms */}
            {digitalPresence?.platforms?.filter((p: any) => !['website', 'instagram'].includes(p.platform)).map((p: any, i: number) => (
              <GlassCard key={i} style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <SectionTitle>{p.platform}</SectionTitle>
                  {p.score !== undefined && <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{p.score}/10</span>}
                </div>
                {p.notes && <p style={{ color: C.mid, fontSize: 12 }}>{p.notes}</p>}
              </GlassCard>
            ))}
          </div>

          {/* Right column: gaps, wins, visual world */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Critical gaps */}
            {digitalPresence?.criticalGaps?.length > 0 && (
              <GlassCard style={{ background: C.negBg, border: `1px solid ${C.neg}25` }}>
                <SectionTitle>Kritik Eksikler</SectionTitle>
                {digitalPresence.criticalGaps.map((g: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, color: C.mid, fontSize: 12, lineHeight: 1.5 }}>
                    <span style={{ color: C.neg, fontWeight: 700 }}>!</span><span>{g}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Quick wins */}
            {digitalPresence?.quickWins?.length > 0 && (
              <GlassCard style={{ background: C.posBg, border: `1px solid ${C.pos}25` }}>
                <SectionTitle>Hızlı Kazanımlar</SectionTitle>
                {digitalPresence.quickWins.map((w: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, color: C.mid, fontSize: 12, lineHeight: 1.5 }}>
                    <span style={{ color: C.pos, fontWeight: 700 }}>→</span><span>{w}</span>
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Priority actions */}
            {digitalPresence?.priorityActions?.length > 0 && (
              <GlassCard>
                <SectionTitle>Öncelikli Aksiyonlar</SectionTitle>
                {digitalPresence.priorityActions.map((a: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                    <span style={{
                      minWidth: 20, height: 20, borderRadius: '50%',
                      background: C.tagBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: C.faint, fontSize: 10, fontFamily: 'monospace',
                    }}>{i + 1}</span>
                    <p style={{ color: C.mid, fontSize: 12, lineHeight: 1.5 }}>{a.action || a}</p>
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Visual World */}
            {visualWorld && (
              <>
                {palette.length > 0 && (
                  <GlassCard>
                    <SectionTitle>Renk Paleti</SectionTitle>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {palette.map((c: any, i: number) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 10,
                            background: c.hex || '#ccc',
                            border: `1px solid ${C.cardBorder}`, marginBottom: 5,
                          }} />
                          <div style={{ color: C.faint, fontSize: 9, fontFamily: 'monospace' }}>{c.hex}</div>
                          {c.name && <div style={{ color: C.mid, fontSize: 9, maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>}
                          {c.usage && <div style={{ color: C.xfaint, fontSize: 9 }}>{c.usage.slice(0, 12)}</div>}
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}

                {(keywords.length > 0 || visualWorld.typographyStyle || visualWorld.imageryStyle) && (
                  <GlassCard>
                    <SectionTitle>Görsel Dünya</SectionTitle>
                    {keywords.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                        {keywords.map((k: string) => <Tag key={k}>{k}</Tag>)}
                      </div>
                    )}
                    {visualWorld.typographyStyle && (
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ color: C.faint, fontSize: 10 }}>Tipografi: </span>
                        <span style={{ color: C.mid, fontSize: 12, fontStyle: 'italic' }}>{visualWorld.typographyStyle}</span>
                      </div>
                    )}
                    {visualWorld.imageryStyle && (
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ color: C.faint, fontSize: 10 }}>Görsel Stili: </span>
                        <span style={{ color: C.mid, fontSize: 12, fontStyle: 'italic' }}>{visualWorld.imageryStyle}</span>
                      </div>
                    )}
                    {visualWorld.styleDirectives?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ color: C.faint, fontSize: 10, marginBottom: 5 }}>STİL YÖNERGELERİ</div>
                        {visualWorld.styleDirectives.map((d: string, i: number) => (
                          <div key={i} style={{ color: C.mid, fontSize: 12, marginBottom: 4 }}>· {d}</div>
                        ))}
                      </div>
                    )}
                  </GlassCard>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </SectionBase>
  );
}
