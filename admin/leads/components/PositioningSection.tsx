import React from 'react';
import { Compass, Users, Gem, Trophy, Route, Globe, Lightbulb } from 'lucide-react';
import type { AIAnalysis } from '@/shared/types/brandLead';

interface Props {
  positioning: NonNullable<AIAnalysis['positioning']>;
}

const PositioningSection: React.FC<Props> = ({ positioning }) => {
  const vpr = positioning.valuePropositionReasoning;
  const hasSegments = positioning.targetSegments && positioning.targetSegments.length > 0;
  const hasPersonas = positioning.targetPersonas && positioning.targetPersonas.length > 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Compass className="w-5 h-5 text-cyan-600" />
        <h4 className="font-grotesk text-lg font-bold text-[#171717]">
          Marka Konumlandirmasi
        </h4>
      </div>

      <div className="space-y-4">
        {/* Positioning Statement */}
        <div className="bg-cyan-50 rounded-xl p-5">
          <p className="font-grotesk text-xs text-cyan-600 uppercase tracking-wider mb-2 font-medium">
            Konumlandirma Ifadesi
          </p>
          <p className="font-grotesk text-base text-[#171717] font-medium leading-relaxed">
            &ldquo;{positioning.statement}&rdquo;
          </p>
        </div>

        {/* Value Proposition Reasoning */}
        {vpr && vpr.whatBusinessProduces && (
          <div className="bg-amber-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <p className="font-grotesk text-xs text-amber-600 uppercase tracking-wider font-medium">
                Deger Onerisi Analizi
              </p>
            </div>
            <div className="space-y-2">
              <div className="bg-white rounded-lg p-3 border border-amber-200">
                <p className="font-grotesk text-[10px] text-amber-500 uppercase font-medium mb-0.5">Ne Uretiyor</p>
                <p className="font-grotesk text-sm text-neutral-700">{vpr.whatBusinessProduces}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-amber-200">
                <p className="font-grotesk text-[10px] text-amber-500 uppercase font-medium mb-0.5">Temel Fayda</p>
                <p className="font-grotesk text-sm text-neutral-700">{vpr.coreBenefit}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-amber-200">
                <p className="font-grotesk text-[10px] text-amber-500 uppercase font-medium mb-0.5">Kimin Icin</p>
                <p className="font-grotesk text-sm text-neutral-700">{vpr.whoBenefits}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <p className="font-grotesk text-[10px] text-amber-500 uppercase font-medium mb-0.5">Fiyat Konumu</p>
                  <p className="font-grotesk text-sm text-neutral-700">{vpr.pricePositioning}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <p className="font-grotesk text-[10px] text-amber-500 uppercase font-medium mb-0.5">Odemeye Istekli Profil</p>
                  <p className="font-grotesk text-sm text-neutral-700">{vpr.willingToPayProfile}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Target Audience & Differentiator */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-indigo-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <p className="font-grotesk text-xs text-indigo-600 uppercase tracking-wider font-medium">
                Hedef Kitle
              </p>
            </div>
            <p className="font-grotesk text-sm text-neutral-700 leading-relaxed">
              {positioning.targetAudience}
            </p>
          </div>

          <div className="bg-teal-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gem className="w-4 h-4 text-teal-600" />
              <p className="font-grotesk text-xs text-teal-600 uppercase tracking-wider font-medium">
                Temel Farklilik
              </p>
            </div>
            <p className="font-grotesk text-sm text-neutral-700 leading-relaxed">
              {positioning.differentiator}
            </p>
          </div>
        </div>

        {/* Competitive Advantage */}
        <div className="bg-violet-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-violet-600" />
            <p className="font-grotesk text-xs text-violet-600 uppercase tracking-wider font-medium">
              Rekabet Avantaji
            </p>
          </div>
          <p className="font-grotesk text-sm text-neutral-700 leading-relaxed">
            {positioning.competitiveAdvantage}
          </p>
        </div>

        {/* Competitive Landscape */}
        {positioning.competitiveLandscape && (
          <div className="bg-orange-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-orange-600" />
              <p className="font-grotesk text-xs text-orange-600 uppercase tracking-wider font-medium">
                Rekabet Haritasi
              </p>
            </div>
            <p className="font-grotesk text-sm text-neutral-700 leading-relaxed">
              {positioning.competitiveLandscape}
            </p>
          </div>
        )}

        {/* Target Segments (new behavioral segments) */}
        {hasSegments && (
          <div className="bg-pink-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-pink-600" />
              <p className="font-grotesk text-xs text-pink-600 uppercase tracking-wider font-medium">
                Hedef Kitle Segmentleri
              </p>
            </div>
            <div className="space-y-3">
              {positioning.targetSegments!.map((segment, i) => (
                <div key={i} className="bg-white rounded-lg p-4 border border-pink-200">
                  <p className="font-grotesk text-sm font-semibold text-[#171717] mb-2">{segment.segmentLabel}</p>
                  <div className="space-y-1.5">
                    <div>
                      <p className="font-grotesk text-[10px] text-pink-500 uppercase font-medium">Demografi</p>
                      <p className="font-grotesk text-xs text-neutral-600">{segment.demographics}</p>
                    </div>
                    <div>
                      <p className="font-grotesk text-[10px] text-pink-500 uppercase font-medium">Davranissal Profil</p>
                      <p className="font-grotesk text-xs text-neutral-600">{segment.behavioralProfile}</p>
                    </div>
                    <div>
                      <p className="font-grotesk text-[10px] text-pink-500 uppercase font-medium">Temel Ihtiyac</p>
                      <p className="font-grotesk text-xs text-neutral-700 font-medium">{segment.coreNeed}</p>
                    </div>
                    <div>
                      <p className="font-grotesk text-[10px] text-pink-500 uppercase font-medium">Medya Aliskanliklari</p>
                      <p className="font-grotesk text-xs text-neutral-600">{segment.mediaHabits}</p>
                    </div>
                    {segment.purchaseTriggers && segment.purchaseTriggers.length > 0 && (
                      <div>
                        <p className="font-grotesk text-[10px] text-pink-500 uppercase font-medium">Satin Alma Tetikleyicileri</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {segment.purchaseTriggers.map((trigger, j) => (
                            <span key={j} className="font-grotesk text-[10px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">
                              {trigger}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {segment.estimatedSegmentSize && (
                      <div>
                        <p className="font-grotesk text-[10px] text-pink-500 uppercase font-medium">Tahmini Segment Buyuklugu</p>
                        <p className="font-grotesk text-xs text-neutral-600">{segment.estimatedSegmentSize}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Backward compat: old Target Personas (only if no segments) */}
        {!hasSegments && hasPersonas && (
          <div className="bg-pink-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-pink-600" />
              <p className="font-grotesk text-xs text-pink-600 uppercase tracking-wider font-medium">
                Hedef Kitle Personalari
              </p>
            </div>
            <div className="space-y-2">
              {positioning.targetPersonas!.map((persona, i) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-pink-200">
                  <p className="font-grotesk text-sm font-semibold text-[#171717] mb-1">{persona.name}</p>
                  <p className="font-grotesk text-xs text-neutral-600 mb-1">{persona.profile}</p>
                  <p className="font-grotesk text-xs text-pink-600 font-medium">Temel Ihtiyac: {persona.keyNeed}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alternative Positions */}
        {positioning.alternativePositions && positioning.alternativePositions.length > 0 && (
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Route className="w-4 h-4 text-slate-600" />
              <p className="font-grotesk text-xs text-slate-600 uppercase tracking-wider font-medium">
                Alternatif Konumlandirmalar
              </p>
            </div>
            <div className="space-y-2">
              {positioning.alternativePositions.map((alt, i) => (
                <div key={i} className="bg-white rounded-lg px-3 py-2 border border-slate-200">
                  <p className="font-grotesk text-sm text-neutral-600">
                    <span className="font-medium text-slate-500 mr-1">Plan {String.fromCharCode(66 + i)}:</span>
                    {alt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PositioningSection;
