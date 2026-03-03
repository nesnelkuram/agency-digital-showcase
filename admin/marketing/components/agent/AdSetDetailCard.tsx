import React from 'react';
import { Layers, DollarSign, Target, MapPin, Users, Calendar, Zap } from 'lucide-react';

interface AdSetDetailCardProps {
  data: {
    id: string;
    name: string;
    status: string;
    daily_budget: number;
    lifetime_budget?: number;
    bid_strategy: string;
    bid_amount?: number;
    optimization_goal?: string;
    billing_event?: string;
    targeting: {
      age_min?: number;
      age_max?: number;
      genders?: number[];
      geo_locations?: {
        countries?: string[];
        cities?: Array<{ key: string; name?: string }>;
        regions?: Array<{ key: string; name?: string }>;
      };
      flexible_spec?: Array<{
        interests?: Array<{ id: string; name: string }>;
        behaviors?: Array<{ id: string; name: string }>;
      }>;
      exclusions?: any;
      publisher_platforms?: string[];
      device_platforms?: string[];
    };
    start_time?: string;
    end_time?: string;
    campaign_id?: string;
    destination_type?: string;
    is_dynamic_creative?: boolean;
    learning_stage_info?: { status: string };
  };
}

const GENDER_LABELS: Record<number, string> = { 1: 'Erkek', 2: 'Kadin' };

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-700',
  learning: 'bg-purple-100 text-purple-700',
  with_issues: 'bg-orange-100 text-orange-700',
};

const BID_LABELS: Record<string, string> = {
  lowest_cost: 'En Dusuk Maliyet',
  cost_cap: 'Maliyet Siniri',
  bid_cap: 'Teklif Siniri',
  target_cost: 'Hedef Maliyet',
  lowest_cost_without_cap: 'Sinir Olmadan En Dusuk',
};

const AdSetDetailCard: React.FC<AdSetDetailCardProps> = ({ data }) => {
  const { targeting } = data;

  const interests = targeting.flexible_spec?.flatMap(s => s.interests || []) || [];
  const behaviors = targeting.flexible_spec?.flatMap(s => s.behaviors || []) || [];

  return (
    <div className="my-2 p-4 rounded-xl border border-neutral-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-commons font-bold text-[#171717]">{data.name}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-commons font-medium ${STATUS_COLORS[data.status] || 'bg-neutral-100 text-neutral-600'}`}>
          {data.status}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Budget */}
        <div className="flex flex-col">
          <span className="text-[10px] font-commons text-neutral-400 mb-0.5">Butce</span>
          <span className="text-xs font-commons font-medium text-[#171717] flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-neutral-400" />
            {data.daily_budget > 0 ? `${data.daily_budget.toLocaleString('tr-TR')} TL/gun` : '—'}
          </span>
        </div>

        {/* Bid strategy */}
        <div className="flex flex-col">
          <span className="text-[10px] font-commons text-neutral-400 mb-0.5">Teklif Stratejisi</span>
          <span className="text-xs font-commons font-medium text-[#171717] flex items-center gap-1">
            <Zap className="w-3 h-3 text-neutral-400" />
            {BID_LABELS[data.bid_strategy] || data.bid_strategy}
          </span>
        </div>

        {/* Optimization */}
        {data.optimization_goal && (
          <div className="flex flex-col">
            <span className="text-[10px] font-commons text-neutral-400 mb-0.5">Optimizasyon</span>
            <span className="text-xs font-commons font-medium text-[#171717] flex items-center gap-1">
              <Target className="w-3 h-3 text-neutral-400" />
              {data.optimization_goal}
            </span>
          </div>
        )}

        {/* Schedule */}
        {data.start_time && (
          <div className="flex flex-col">
            <span className="text-[10px] font-commons text-neutral-400 mb-0.5">Zamanlama</span>
            <span className="text-xs font-commons font-medium text-[#171717] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-neutral-400" />
              {new Date(data.start_time).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
              {data.end_time ? ` — ${new Date(data.end_time).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}` : ' — devam'}
            </span>
          </div>
        )}
      </div>

      {/* Targeting tree */}
      <div className="border-t border-neutral-100 pt-2.5">
        <span className="text-[10px] font-commons font-medium text-neutral-500 uppercase tracking-wider mb-2 block">
          Hedefleme
        </span>

        <div className="flex flex-col gap-1.5">
          {/* Age + Gender */}
          {(targeting.age_min || targeting.genders) && (
            <div className="flex items-center gap-1.5 text-xs font-commons text-neutral-600">
              <Users className="w-3 h-3 text-neutral-400" />
              {targeting.age_min && <span>{targeting.age_min}-{targeting.age_max || 65} yas</span>}
              {targeting.genders && targeting.genders.length > 0 && (
                <span className="text-neutral-400">|</span>
              )}
              {targeting.genders?.map(g => GENDER_LABELS[g] || g).join(', ')}
            </div>
          )}

          {/* Locations */}
          {targeting.geo_locations && (
            <div className="flex items-start gap-1.5 text-xs font-commons text-neutral-600">
              <MapPin className="w-3 h-3 text-neutral-400 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {targeting.geo_locations.countries?.map(c => (
                  <span key={c} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px]">{c}</span>
                ))}
                {targeting.geo_locations.cities?.map(c => (
                  <span key={c.key} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px]">{c.name || c.key}</span>
                ))}
                {targeting.geo_locations.regions?.map(r => (
                  <span key={r.key} className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 text-[10px]">{r.name || r.key}</span>
                ))}
              </div>
            </div>
          )}

          {/* Interests */}
          {interests.length > 0 && (
            <div className="flex items-start gap-1.5 text-xs font-commons text-neutral-600">
              <Target className="w-3 h-3 text-neutral-400 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {interests.slice(0, 10).map(item => (
                  <span key={item.id} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px]">
                    {item.name}
                  </span>
                ))}
                {interests.length > 10 && (
                  <span className="text-[10px] text-neutral-400">+{interests.length - 10} daha</span>
                )}
              </div>
            </div>
          )}

          {/* Behaviors */}
          {behaviors.length > 0 && (
            <div className="flex items-start gap-1.5 text-xs font-commons text-neutral-600">
              <Zap className="w-3 h-3 text-neutral-400 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {behaviors.slice(0, 8).map(item => (
                  <span key={item.id} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px]">
                    {item.name}
                  </span>
                ))}
                {behaviors.length > 8 && (
                  <span className="text-[10px] text-neutral-400">+{behaviors.length - 8} daha</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Learning stage info */}
      {data.learning_stage_info && (
        <div className="mt-2 pt-2 border-t border-neutral-100">
          <span className="text-[10px] font-commons px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
            Ogrenme: {data.learning_stage_info.status}
          </span>
        </div>
      )}
    </div>
  );
};

export default AdSetDetailCard;
