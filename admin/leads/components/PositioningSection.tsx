import React from 'react';
import { Compass, Users, Gem, Trophy, Route, Globe } from 'lucide-react';
import type { AIAnalysis } from '@/shared/types/brandLead';

interface Props {
  positioning: NonNullable<AIAnalysis['positioning']>;
}

const PositioningSection: React.FC<Props> = ({ positioning }) => {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Compass className="w-5 h-5 text-cyan-600" />
        <h4 className="font-ramillas text-lg font-bold text-[#171717]">
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
            "{positioning.statement}"
          </p>
        </div>

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

        {/* Target Personas */}
        {positioning.targetPersonas && positioning.targetPersonas.length > 0 && (
          <div className="bg-pink-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-pink-600" />
              <p className="font-grotesk text-xs text-pink-600 uppercase tracking-wider font-medium">
                Hedef Kitle Personalari
              </p>
            </div>
            <div className="space-y-2">
              {positioning.targetPersonas.map((persona, i) => (
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
