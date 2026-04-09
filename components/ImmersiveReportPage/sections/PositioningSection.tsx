import React from 'react';
import SectionBase, { FeatureCard, GlassCard, CompactCard, CardStack, TwoCol, SectionTitle, BigText, Tag, C, toStr, type SectionVisual } from '../SectionBase';

interface Props {
  index: number; total?: number; visual: SectionVisual | undefined;
  positioning?: any;
  strategicDepth?: any;
  recommendedScenario?: any;
  perceptualMap?: any;
  businessName?: string;
}

const VALUE_LEVELS = ['commodity', 'product', 'service', 'experience', 'transformation'];
const VALUE_LABELS: Record<string, string> = { commodity: 'Emtia', product: 'Ürün', service: 'Hizmet', experience: 'Deneyim', transformation: 'Dönüşüm' };

export default function PositioningSection({ index, total, visual, positioning, strategicDepth, recommendedScenario, perceptualMap, businessName }: Props) {
  const valueLevelIdx = VALUE_LEVELS.indexOf(strategicDepth?.valueLevel || '');
  const segments = positioning?.targetSegments?.slice(0, 4) || [];

  return (
    <SectionBase id="positioning" index={index} total={total} label="Konumlandırma" visual={visual}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── HERO: Transformation Statement ── */}
        {strategicDepth?.transformationStatement && (
          <div style={{ marginBottom: 36, maxWidth: 860, borderLeft: `4px solid ${C.accent}`, paddingLeft: 24 }}>
            <SectionTitle>Dönüşüm İddiası</SectionTitle>
            <BigText style={{ fontSize: 'clamp(20px, 2.6vw, 38px)', lineHeight: 1.3 }}>
              "{toStr(strategicDepth.transformationStatement)}"
            </BigText>
          </div>
        )}

        {/* ── Positioning Statement (full width) ── */}
        {positioning?.statement && (
          <FeatureCard accent={C.blue} style={{ marginBottom: 28 }}>
            <SectionTitle>Konumlandırma Bildirisi</SectionTitle>
            <p style={{ color: C.text, fontSize: 'clamp(16px, 1.8vw, 22px)', lineHeight: 1.5, fontWeight: 600, margin: 0, fontFamily: C.serif }}>
              {positioning.statement}
            </p>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 14 }}>
              {positioning.differentiator && <CompactCard style={{ padding: '8px 14px' }}><span style={{ color: C.faint, fontSize: 12 }}>Ayrıştırıcı: </span><span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{positioning.differentiator}</span></CompactCard>}
              {positioning.competitiveAdvantage && <CompactCard style={{ padding: '8px 14px' }}><span style={{ color: C.faint, fontSize: 12 }}>Avantaj: </span><span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{positioning.competitiveAdvantage}</span></CompactCard>}
            </div>
          </FeatureCard>
        )}

        <TwoCol>
          {/* ── LEFT: Segments + Customer Problem + Stands ── */}
          <CardStack>
            {/* Target segments */}
            {segments.length > 0 && (
              <>
                <SectionTitle>Hedef Segmentler</SectionTitle>
                {segments.map((seg: any, i: number) => (
                  <GlassCard key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>{seg.segmentLabel || `Segment ${i + 1}`}</div>
                      {seg.estimatedSegmentSize && <Tag>{seg.estimatedSegmentSize}</Tag>}
                    </div>
                    {seg.demographics && <div style={{ color: C.faint, fontSize: 13, marginBottom: 6 }}>{seg.demographics}</div>}
                    {seg.coreNeed && <div style={{ color: C.mid, fontSize: 14, lineHeight: 1.55, marginBottom: 8 }}>{seg.coreNeed}</div>}
                    {(seg.purchaseTriggers || []).length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(seg.purchaseTriggers as any[]).map((t: any, ti: number) => <Tag key={ti}>{toStr(t).slice(0, 28)}</Tag>)}
                      </div>
                    )}
                  </GlassCard>
                ))}
              </>
            )}

            {/* Customer Problem 3 layers */}
            {strategicDepth?.customerProblem && (
              <FeatureCard accent={C.warn}>
                <SectionTitle>Müşteri Sorunu (3 Katman)</SectionTitle>
                {[
                  { label: 'İşlevsel', value: toStr(strategicDepth.customerProblem.functional), color: C.faint },
                  { label: 'Duygusal', value: toStr(strategicDepth.customerProblem.emotional), color: C.warn },
                  { label: 'Kimlik', value: toStr(strategicDepth.customerProblem.identity), color: C.accent },
                ].filter(l => l.value).map(({ label, value, color }, i, arr) => (
                  <div key={label} style={{ marginBottom: i < arr.length - 1 ? 16 : 0, paddingBottom: i < arr.length - 1 ? 16 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                    <div style={{ color, fontSize: 12, marginBottom: 6, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
                    <p style={{ color: C.mid, fontSize: 15, lineHeight: 1.6, margin: 0 }}>{value}</p>
                  </div>
                ))}
              </FeatureCard>
            )}

            {/* Stand for / against */}
            {(strategicDepth?.weStandFor?.length > 0 || strategicDepth?.weStandAgainst?.length > 0) && (
              <GlassCard>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                  <div style={{ paddingRight: 18, borderRight: `1px solid ${C.cardBorder}` }}>
                    <SectionTitle>Savunduklarımız</SectionTitle>
                    {(strategicDepth.weStandFor || []).map((it: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <span style={{ color: C.pos, fontWeight: 700, fontSize: 15, flexShrink: 0 }}>✓</span>
                        <span style={{ color: C.mid, fontSize: 14, lineHeight: 1.5 }}>{toStr(it)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ paddingLeft: 18 }}>
                    <SectionTitle>Karşı Durduklarımız</SectionTitle>
                    {(strategicDepth.weStandAgainst || []).map((it: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <span style={{ color: C.neg, fontWeight: 700, fontSize: 15, flexShrink: 0 }}>✗</span>
                        <span style={{ color: C.mid, fontSize: 14, lineHeight: 1.5 }}>{toStr(it)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            )}
          </CardStack>

          {/* ── RIGHT: Scenario + Value Level + Perceptual Map ── */}
          <CardStack>
            {/* Recommended scenario ONLY */}
            {recommendedScenario && (
              <FeatureCard accent={C.pos}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ color: C.pos, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>★ Önerilen Büyüme Yolu</span>
                  {recommendedScenario.timeframe && <span style={{ color: C.faint, fontSize: 12, fontFamily: C.mono }}>{recommendedScenario.timeframe}</span>}
                </div>
                <p style={{ color: C.text, fontSize: 16, lineHeight: 1.6, margin: '0 0 12px 0', fontWeight: 500 }}>{toStr(recommendedScenario.description)}</p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {recommendedScenario.investmentLevel && <CompactCard style={{ padding: '6px 12px' }}><span style={{ color: C.faint, fontSize: 12 }}>Yatırım: <strong style={{ color: C.text }}>{toStr(recommendedScenario.investmentLevel)}</strong></span></CompactCard>}
                  {recommendedScenario.expectedROI && <CompactCard style={{ padding: '6px 12px' }}><span style={{ color: C.faint, fontSize: 12 }}>ROI: <strong style={{ color: C.text }}>{toStr(recommendedScenario.expectedROI)}</strong></span></CompactCard>}
                </div>
                {recommendedScenario.expectedOutcome && <p style={{ color: C.mid, fontSize: 14, margin: '12px 0 0 0', fontStyle: 'italic' }}>{toStr(recommendedScenario.expectedOutcome)}</p>}
              </FeatureCard>
            )}

            {/* Value Level */}
            {strategicDepth?.valueLevel && (
              <GlassCard>
                <SectionTitle>Değer Seviyesi</SectionTitle>
                <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                  {VALUE_LEVELS.map((level, i) => (
                    <div key={level} style={{ flex: 1, height: 12, borderRadius: 6, background: i <= valueLevelIdx ? C.text : 'rgba(0,0,0,0.06)' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  {VALUE_LEVELS.map((level) => (
                    <span key={level} style={{ fontSize: 10, fontFamily: C.mono, color: level === strategicDepth.valueLevel ? C.text : C.xfaint, fontWeight: level === strategicDepth.valueLevel ? 700 : 400 }}>
                      {VALUE_LABELS[level]}
                    </span>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Core Strategy */}
            {strategicDepth?.coreStrategy && (
              <FeatureCard accent={C.blue}>
                <SectionTitle>Temel Strateji</SectionTitle>
                <p style={{ color: C.mid, fontSize: 15, lineHeight: 1.7, margin: 0 }}>{toStr(strategicDepth.coreStrategy)}</p>
              </FeatureCard>
            )}

            {/* Perceptual Map */}
            {perceptualMap && (
              <GlassCard>
                <SectionTitle>Algısal Harita</SectionTitle>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <PerceptualMapSVG map={perceptualMap} businessName={businessName} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: C.pos }} /><span style={{ color: C.mid, fontSize: 12 }}>{businessName}</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: C.xfaint }} /><span style={{ color: C.mid, fontSize: 12 }}>Rakipler</span></div>
                </div>
              </GlassCard>
            )}
          </CardStack>
        </TwoCol>
      </div>
    </SectionBase>
  );
}

function PerceptualMapSVG({ map, businessName }: { map: any; businessName?: string }) {
  const size = 320; const padding = 48; const plotSize = size - padding * 2;
  const toPixel = (val: number) => padding + ((val + 5) / 10) * plotSize;
  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      <line x1={padding} y1={size / 2} x2={size - padding} y2={size / 2} stroke={C.cardBorder} strokeWidth={1} />
      <line x1={size / 2} y1={padding} x2={size / 2} y2={size - padding} stroke={C.cardBorder} strokeWidth={1} />
      {map.xAxis?.lowEnd && <text x={padding - 6} y={size / 2 + 5} fontSize={11} fill={C.faint} textAnchor="end" fontFamily={C.sans}>{map.xAxis.lowEnd.slice(0, 12)}</text>}
      {map.xAxis?.highEnd && <text x={size - padding + 6} y={size / 2 + 5} fontSize={11} fill={C.faint} textAnchor="start" fontFamily={C.sans}>{map.xAxis.highEnd.slice(0, 12)}</text>}
      {map.yAxis?.highEnd && <text x={size / 2} y={padding - 8} fontSize={11} fill={C.faint} textAnchor="middle" fontFamily={C.sans}>{map.yAxis.highEnd.slice(0, 12)}</text>}
      {map.yAxis?.lowEnd && <text x={size / 2} y={size - padding + 18} fontSize={11} fill={C.faint} textAnchor="middle" fontFamily={C.sans}>{map.yAxis.lowEnd.slice(0, 12)}</text>}
      {map.competitorPositions?.map((c: any) => (<g key={c.name}><circle cx={toPixel(c.x)} cy={toPixel(-c.y)} r={7} fill={C.xfaint} opacity={0.7} /><text x={toPixel(c.x)} y={toPixel(-c.y) - 12} fontSize={11} fill={C.faint} textAnchor="middle" fontFamily={C.sans}>{c.name.slice(0, 14)}</text></g>))}
      {map.brandPosition && (<g><circle cx={toPixel(map.brandPosition.x)} cy={toPixel(-map.brandPosition.y)} r={10} fill={C.pos} /><text x={toPixel(map.brandPosition.x)} y={toPixel(-map.brandPosition.y) - 14} fontSize={12} fill={C.pos} textAnchor="middle" fontWeight="bold" fontFamily={C.sans}>{(businessName || 'Marka').slice(0, 14)}</text></g>)}
    </svg>
  );
}
