import React from 'react';
import { Search, Globe, TrendingUp, BarChart3, Users, ExternalLink, Database } from 'lucide-react';
import type { AIAnalysis } from '@/shared/types/brandLead';

interface Props {
  research: NonNullable<AIAnalysis['sectorResearch']>;
}

const ResearchFindings: React.FC<Props> = ({ research }) => {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-5 h-5 text-emerald-600" />
        <h4 className="font-grotesk text-lg font-bold text-[#171717]">
          Sektor Arastirmasi
        </h4>
        <span className="ml-auto font-grotesk text-xs text-neutral-400">
          {research.sourcesUsed} kaynak
        </span>
      </div>

      <div className="space-y-4">
        {/* Market Data */}
        {research.marketData && (
          <div className="bg-blue-50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-blue-600" />
              <p className="font-grotesk text-xs text-blue-600 uppercase tracking-wider font-medium">
                Pazar Verileri
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="font-grotesk text-[10px] text-blue-500 uppercase mb-1">Pazar Buyuklugu</p>
                <p className="font-grotesk text-sm text-[#171717] font-medium">{research.marketData.marketSize}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="font-grotesk text-[10px] text-blue-500 uppercase mb-1">Buyume Hizi</p>
                <p className="font-grotesk text-sm text-[#171717] font-medium">{research.marketData.growthRate}</p>
              </div>
            </div>
            {research.marketData.keyPlayers && research.marketData.keyPlayers.length > 0 && (
              <div className="mt-3">
                <p className="font-grotesk text-[10px] text-blue-500 uppercase mb-1">Anahtar Oyuncular</p>
                <div className="flex flex-wrap gap-1.5">
                  {research.marketData.keyPlayers.map((player, i) => (
                    <span key={i} className="font-grotesk text-xs bg-white text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                      {player}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {research.marketData.consumerTrends && research.marketData.consumerTrends.length > 0 && (
              <div className="mt-3">
                <p className="font-grotesk text-[10px] text-blue-500 uppercase mb-1">Tuketici Trendleri</p>
                <ul className="space-y-1">
                  {research.marketData.consumerTrends.map((trend, i) => (
                    <li key={i} className="font-grotesk text-xs text-neutral-700 flex items-start gap-1.5">
                      <span className="text-blue-400 mt-0.5 flex-shrink-0">&#8226;</span>
                      {trend}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Target Audience Insights */}
        {research.targetAudienceInsights && (
          <div className="bg-purple-50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-purple-600" />
              <p className="font-grotesk text-xs text-purple-600 uppercase tracking-wider font-medium">
                Hedef Kitle Insight'lari
              </p>
            </div>
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <p className="font-grotesk text-[10px] text-purple-500 uppercase mb-1">Demografi</p>
                <p className="font-grotesk text-xs text-neutral-700">{research.targetAudienceInsights.demographics}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <p className="font-grotesk text-[10px] text-purple-500 uppercase mb-1">Psikografi</p>
                <p className="font-grotesk text-xs text-neutral-700">{research.targetAudienceInsights.psychographics}</p>
              </div>
              {research.targetAudienceInsights.painPoints && research.targetAudienceInsights.painPoints.length > 0 && (
                <div className="bg-white rounded-lg p-3 border border-purple-100">
                  <p className="font-grotesk text-[10px] text-purple-500 uppercase mb-1">Acil Ihtiyaclar</p>
                  <ul className="space-y-0.5">
                    {research.targetAudienceInsights.painPoints.map((p, i) => (
                      <li key={i} className="font-grotesk text-xs text-neutral-700">- {p}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <p className="font-grotesk text-[10px] text-purple-500 uppercase mb-1">Satin Alma Davranisi</p>
                <p className="font-grotesk text-xs text-neutral-700">{research.targetAudienceInsights.purchaseBehavior}</p>
              </div>
            </div>
          </div>
        )}

        {/* Competitors */}
        {research.competitors && research.competitors.length > 0 && (
          <div className="bg-emerald-50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-emerald-600" />
              <p className="font-grotesk text-xs text-emerald-600 uppercase tracking-wider font-medium">
                Rakip Analizi ({research.competitors.length} rakip)
              </p>
            </div>
            <div className="space-y-3">
              {research.competitors.map((competitor, i) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-emerald-100">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-grotesk text-sm font-semibold text-[#171717]">
                      {competitor.name}
                    </p>
                    {competitor.website && (
                      <a
                        href={competitor.website.startsWith('http') ? competitor.website : `https://${competitor.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-500 hover:text-emerald-700"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="font-grotesk text-xs text-neutral-600 mb-2">
                    {competitor.positioning}
                  </p>
                  {(competitor.estimatedScale || competitor.socialPresence) && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {competitor.estimatedScale && (
                        <span className="font-grotesk text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          {competitor.estimatedScale}
                        </span>
                      )}
                      {competitor.socialPresence && (
                        <span className="font-grotesk text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {competitor.socialPresence}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="font-grotesk text-[10px] text-green-600 uppercase mb-1">Guclu</p>
                      <ul className="space-y-0.5">
                        {competitor.strengths.map((s, j) => (
                          <li key={j} className="font-grotesk text-xs text-neutral-600">+ {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-grotesk text-[10px] text-red-500 uppercase mb-1">Zayif</p>
                      <ul className="space-y-0.5">
                        {competitor.weaknesses.map((w, j) => (
                          <li key={j} className="font-grotesk text-xs text-neutral-600">- {w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Trends & Benchmarks (backward compat) */}
        <div className="grid grid-cols-2 gap-4">
          {research.marketTrends && research.marketTrends.length > 0 && !research.marketData && (
            <div className="bg-sky-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-sky-600" />
                <p className="font-grotesk text-xs text-sky-600 uppercase tracking-wider font-medium">
                  Pazar Trendleri
                </p>
              </div>
              <ul className="space-y-1">
                {research.marketTrends.map((trend, i) => (
                  <li key={i} className="font-grotesk text-xs text-neutral-700 flex items-start gap-1.5">
                    <span className="text-sky-400 mt-0.5 flex-shrink-0">&#8226;</span>
                    {trend}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {research.sectorBenchmarks && research.sectorBenchmarks.length > 0 && (
            <div className="bg-indigo-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <p className="font-grotesk text-xs text-indigo-600 uppercase tracking-wider font-medium">
                  Sektor Olcutleri
                </p>
              </div>
              <ul className="space-y-1">
                {research.sectorBenchmarks.map((benchmark, i) => (
                  <li key={i} className="font-grotesk text-xs text-neutral-700 flex items-start gap-1.5">
                    <span className="text-indigo-400 mt-0.5 flex-shrink-0">&#8226;</span>
                    {benchmark}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Source URLs */}
        {research.sourceUrls && research.sourceUrls.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer font-grotesk text-xs text-neutral-400 hover:text-neutral-600">
              Kaynaklar ({research.sourceUrls.length})
            </summary>
            <div className="mt-2 space-y-1">
              {research.sourceUrls.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-grotesk text-xs text-blue-600 hover:text-blue-800 bg-neutral-50 px-2 py-1 rounded truncate"
                >
                  {source.title}
                </a>
              ))}
            </div>
          </details>
        )}

        {/* Search Queries (collapsed) */}
        {research.searchQueries && research.searchQueries.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer font-grotesk text-xs text-neutral-400 hover:text-neutral-600">
              Arama sorgulari ({research.searchQueries.length})
            </summary>
            <div className="mt-2 space-y-1">
              {research.searchQueries.map((q, i) => (
                <p key={i} className="font-grotesk text-xs text-neutral-500 bg-neutral-50 px-2 py-1 rounded">
                  {q}
                </p>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

export default ResearchFindings;
