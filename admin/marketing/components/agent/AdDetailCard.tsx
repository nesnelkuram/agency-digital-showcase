import React from 'react';
import { Image, ExternalLink, AlertTriangle, Lightbulb, CheckCircle } from 'lucide-react';

interface AdDetailCardProps {
  data: {
    id: string;
    name: string;
    status: string;
    creative: {
      id: string;
      name?: string;
      title: string;
      body: string;
      description?: string;
      link_url?: string;
      call_to_action_type?: string;
      image_url?: string;
      thumbnail_url?: string;
    } | null;
    adset_id?: string;
    campaign_id?: string;
    recommendations: Array<{ title: string; message: string; code: string; importance?: string }>;
    review_feedback?: any;
    issues_info?: Array<{ level: string; error_summary: string }> | null;
    preview_url?: string | null;
  };
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-700',
  disapproved: 'bg-red-100 text-red-700',
  pending_review: 'bg-amber-100 text-amber-700',
  with_issues: 'bg-orange-100 text-orange-700',
};

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: 'Daha Fazla',
  SHOP_NOW: 'Simdi Satin Al',
  SIGN_UP: 'Kaydol',
  DOWNLOAD: 'Indir',
  CONTACT_US: 'Iletisim',
  BOOK_NOW: 'Simdi Rezerve Et',
  APPLY_NOW: 'Simdi Basvur',
  GET_OFFER: 'Teklif Al',
  SUBSCRIBE: 'Abone Ol',
  WATCH_MORE: 'Daha Fazla Izle',
};

const AdDetailCard: React.FC<AdDetailCardProps> = ({ data }) => {
  const { creative, recommendations, issues_info } = data;

  return (
    <div className="my-2 p-4 rounded-xl border border-neutral-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-commons font-bold text-[#171717]">{data.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-commons font-medium ${STATUS_COLORS[data.status] || 'bg-neutral-100 text-neutral-600'}`}>
            {data.status}
          </span>
          {data.preview_url && (
            <a
              href={data.preview_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-[10px] font-commons text-indigo-600 hover:text-indigo-800"
            >
              Onizle
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {/* Creative preview */}
      {creative && (
        <div className="border border-neutral-100 rounded-lg overflow-hidden mb-3">
          {/* Image */}
          {(creative.image_url || creative.thumbnail_url) && (
            <div className="relative w-full h-40 bg-neutral-100">
              <img
                src={creative.image_url || creative.thumbnail_url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Text content */}
          <div className="p-3">
            {creative.title && (
              <p className="text-sm font-commons font-semibold text-[#171717] mb-1">
                {creative.title}
              </p>
            )}
            {creative.body && (
              <p className="text-xs font-commons text-neutral-600 mb-1.5 line-clamp-3">
                {creative.body}
              </p>
            )}
            {creative.description && (
              <p className="text-[10px] font-commons text-neutral-400 mb-1.5">
                {creative.description}
              </p>
            )}

            <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100">
              {creative.link_url && (
                <span className="text-[10px] font-commons text-neutral-400 truncate max-w-[60%]">
                  {creative.link_url}
                </span>
              )}
              {creative.call_to_action_type && (
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-commons font-medium">
                  {CTA_LABELS[creative.call_to_action_type] || creative.call_to_action_type}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Issues */}
      {issues_info && issues_info.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] font-commons font-medium text-red-600 uppercase tracking-wider mb-1.5 block">
            Sorunlar
          </span>
          <div className="flex flex-col gap-1">
            {issues_info.map((issue, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs font-commons text-red-600">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>{issue.error_summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="border-t border-neutral-100 pt-2.5">
          <span className="text-[10px] font-commons font-medium text-neutral-500 uppercase tracking-wider mb-1.5 block">
            Meta Onerileri
          </span>
          <div className="flex flex-col gap-1.5">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs font-commons text-neutral-600">
                <Lightbulb className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">{rec.title}</span>
                  {rec.message && <span className="text-neutral-400 ml-1">{rec.message}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review status */}
      {data.status === 'active' && !issues_info?.length && recommendations.length === 0 && (
        <div className="flex items-center gap-1.5 text-xs font-commons text-emerald-600">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Reklam aktif ve sorunsuz calisiyor</span>
        </div>
      )}
    </div>
  );
};

export default AdDetailCard;
