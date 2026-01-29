import React from 'react';
import { Swords, MessageCircle, AlertTriangle, Eye, ArrowRight } from 'lucide-react';
import type { AIAnalysis } from '@/shared/types/brandLead';

interface Props {
  debate: NonNullable<AIAnalysis['debate']>;
}

const DebateView: React.FC<Props> = ({ debate }) => {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Swords className="w-5 h-5 text-orange-600" />
        <h4 className="font-ramillas text-lg font-bold text-[#171717]">
          Strateji Tartismasi
        </h4>
        {debate.debateCompleted ? (
          <span className="ml-auto font-grotesk text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
            Tamamlandi
          </span>
        ) : (
          <span className="ml-auto font-grotesk text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
            Atlanmis
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Strategist vs Challenger */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strategist Position */}
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-blue-600" />
              <p className="font-grotesk text-xs text-blue-600 uppercase tracking-wider font-medium">
                Stratejist
              </p>
            </div>
            <p className="font-grotesk text-sm text-neutral-700 leading-relaxed">
              {debate.strategistPosition}
            </p>
          </div>

          {/* Challenger Position */}
          <div className="bg-orange-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <p className="font-grotesk text-xs text-orange-600 uppercase tracking-wider font-medium">
                Muhalif
              </p>
            </div>
            <p className="font-grotesk text-sm text-neutral-700 leading-relaxed">
              {debate.challengerPosition}
            </p>
          </div>
        </div>

        {/* Challenger Alternatives */}
        {debate.challengerAlternatives && debate.challengerAlternatives.length > 0 && (
          <div className="bg-amber-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ArrowRight className="w-4 h-4 text-amber-600" />
              <p className="font-grotesk text-xs text-amber-600 uppercase tracking-wider font-medium">
                Alternatif Konumlandirmalar
              </p>
            </div>
            <div className="space-y-2">
              {debate.challengerAlternatives.map((alt, i) => (
                <div key={i} className="bg-white rounded-lg px-3 py-2 border border-amber-100">
                  <p className="font-grotesk text-sm text-neutral-700">
                    <span className="font-medium text-amber-600 mr-1">{i + 1}.</span>
                    {alt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Synthesis Rationale */}
        {debate.synthesisRationale && (
          <div className="bg-violet-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-violet-600" />
              <p className="font-grotesk text-xs text-violet-600 uppercase tracking-wider font-medium">
                Sentez Karari
              </p>
            </div>
            <p className="font-grotesk text-sm text-neutral-700 leading-relaxed">
              {debate.synthesisRationale}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebateView;
