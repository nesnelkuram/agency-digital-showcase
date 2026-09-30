import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Instagram, Facebook, Linkedin, Twitter, Music2, Film, Image as ImageIcon } from 'lucide-react';
import type { PostType, SocialMediaPost, SocialPlatform } from '@/shared/types/socialMedia';
import { POST_TYPE_LABELS, SOCIAL_PLATFORM_LABELS } from '@/shared/types/socialMedia';
import { STUDIO_STATUS_COLOR, STUDIO_STATUS_LABEL, postThumb } from '../studioData';

export type CalendarMode = 'week' | 'month';

const PLATFORM_ICON: Record<string, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
  tiktok: Music2,
};

const DAY_SHORT = ['Pzt', 'Sal', 'Çrş', 'Prş', 'Cum', 'Cts', 'Paz'];
const DAY_LONG = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const MONTH_LONG = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Pazartesi başlangıçlı hafta */
const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const postDate = (p: SocialMediaPost): Date | null => (p.scheduledAt as any)?.toDate?.() || null;
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Sürüklenebilir: firmaya gönderilmemiş ya da onaylı (yayınlanmamış) içerikler — kurallar yalnızca tarih değişimine izin verir */
const DRAGGABLE = new Set(['draft', 'internal_review', 'revision_requested_internal', 'revision_requested', 'pending_approval', 'approved']);

interface Props {
  posts: SocialMediaPost[];
  onPostClick: (post: SocialMediaPost) => void;
  onCreate: (date: Date) => void;
  onReschedule: (post: SocialMediaPost, date: Date) => void;
  sidebar?: React.ReactNode;
  toolbarLeft?: React.ReactNode;
}

/** Filtre açılır menüsü (Meta Business Suite tarzı) */
const FilterMenu: React.FC<{
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label || 'Tümü';
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="glass-chip inline-flex items-center gap-2 px-4 py-2 font-grotesk text-sm text-[#171717]"
      >
        {label}: {current}
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white/90 backdrop-blur-xl border border-white rounded-2xl shadow-lg py-1 z-30">
          {options.map((o) => (
            <button
              key={o.value}
              onMouseDown={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 font-grotesk text-sm hover:bg-neutral-50 ${o.value === value ? 'font-semibold' : ''}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Takvimdeki içerik kartı */
const PostTile: React.FC<{ post: SocialMediaPost; compact?: boolean; onClick: () => void }> = ({ post, compact, onClick }) => {
  const d = postDate(post);
  const thumb = postThumb(post);
  const isVideo = post.media?.[0]?.type === 'video' || post.postType === 'reels' || post.postType === 'video';
  const draggable = DRAGGABLE.has(post.status);
  const icons = (post.platforms || []).map((p) => PLATFORM_ICON[p]).filter(Boolean);

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData('text/post-id', post.id)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`group glass-tile hover:bg-white transition-all cursor-pointer ${
        compact ? 'px-2 py-1 !rounded-xl' : 'p-2.5'
      }`}
    >
      <div className="flex items-center gap-1.5">
        {d && <span className="font-grotesk text-[11px] font-semibold text-[#171717]">{hhmm(d)}</span>}
        <span className="ml-auto flex items-center gap-0.5 text-neutral-500">
          {icons.map((Icon, i) => (
            <Icon key={i} className="w-3.5 h-3.5" />
          ))}
        </span>
      </div>
      {compact ? (
        <p className="font-grotesk text-[11px] text-neutral-700 truncate">{post.title || post.caption || POST_TYPE_LABELS[post.postType]}</p>
      ) : (
        <>
          <div className="mt-1.5 aspect-square rounded-xl bg-slate-200/60 overflow-hidden flex items-center justify-center">
            {thumb ? (
              <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : isVideo ? (
              <Film className="w-6 h-6 text-neutral-400" />
            ) : (
              <ImageIcon className="w-6 h-6 text-neutral-300" />
            )}
          </div>
          <p className="mt-1.5 font-grotesk text-[11px] text-neutral-700 line-clamp-3">{post.caption || post.title || ''}</p>
        </>
      )}
      <span className={`mt-1.5 inline-block px-2 py-px rounded-full font-grotesk text-[10px] ${STUDIO_STATUS_COLOR[post.status] || 'bg-neutral-100'}`}>
        {STUDIO_STATUS_LABEL[post.status] || post.status}
      </span>
    </div>
  );
};

/**
 * Studio takvimi — Meta Business Suite mantığında: hafta/ay görünümü, Bugün ve ileri/geri gezinme,
 * içerik türü ve platform filtreleri, gün sütunlarında saatli içerik kartları, boş güne tıklayınca oluşturma,
 * kartı başka güne sürükleyerek tarih değiştirme ve sağda yan panel.
 */
const CalendarBoard: React.FC<Props> = ({ posts, onPostClick, onCreate, onReschedule, sidebar, toolbarLeft }) => {
  const [mode, setMode] = useState<CalendarMode>(() => {
    try {
      return (localStorage.getItem('studio.calendarMode') as CalendarMode) || 'week';
    } catch {
      return 'week';
    }
  });
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [typeFilter, setTypeFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [dragOver, setDragOver] = useState<string | null>(null);
  const today = startOfDay(new Date());

  const switchMode = (m: CalendarMode) => {
    setMode(m);
    try {
      localStorage.setItem('studio.calendarMode', m);
    } catch {
      // yok say
    }
  };

  const filtered = useMemo(
    () =>
      posts.filter(
        (p) =>
          (typeFilter === 'all' || p.postType === typeFilter) &&
          (platformFilter === 'all' || (p.platforms || []).includes(platformFilter as SocialPlatform))
      ),
    [posts, typeFilter, platformFilter]
  );

  const byDay = useMemo(() => {
    const m = new Map<string, SocialMediaPost[]>();
    for (const p of filtered) {
      const d = postDate(p);
      if (!d) continue;
      const k = dayKey(d);
      m.set(k, [...(m.get(k) || []), p]);
    }
    for (const list of m.values()) list.sort((a, b) => (postDate(a)!.getTime() - postDate(b)!.getTime()));
    return m;
  }, [filtered]);

  const weekStart = startOfWeek(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const monthRows = monthDays[35].getMonth() === anchor.getMonth() ? 6 : 5;

  const title =
    mode === 'month'
      ? `${MONTH_LONG[anchor.getMonth()]} ${anchor.getFullYear()}`
      : weekDays[0].getMonth() === weekDays[6].getMonth()
        ? `${MONTH_LONG[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`
        : `${MONTH_SHORT[weekDays[0].getMonth()]} – ${MONTH_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;

  const shift = (dir: number) =>
    setAnchor((a) => (mode === 'week' ? addDays(a, 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1)));

  /** Boş güne tıklama: o gün 10:00 (bugünse bir sonraki tam saat) */
  const createOn = (day: Date) => {
    const d = new Date(day);
    if (sameDay(day, today)) d.setHours(Math.min(new Date().getHours() + 1, 23), 0, 0, 0);
    else d.setHours(10, 0, 0, 0);
    onCreate(d);
  };

  const dropOn = (day: Date) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/post-id');
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    const old = postDate(post);
    const next = new Date(day);
    next.setHours(old?.getHours() ?? 10, old?.getMinutes() ?? 0, 0, 0);
    if (old && sameDay(old, next)) return;
    onReschedule(post, next);
  };

  const dropProps = (day: Date) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(dayKey(day));
    },
    onDragLeave: () => setDragOver(null),
    onDrop: dropOn(day),
  });

  const typeOptions = [{ value: 'all', label: 'Tümü' }, ...(Object.keys(POST_TYPE_LABELS) as PostType[]).map((t) => ({ value: t, label: POST_TYPE_LABELS[t] }))];
  const platformOptions = [{ value: 'all', label: 'tümü' }, ...Object.entries(SOCIAL_PLATFORM_LABELS).map(([v, l]) => ({ value: v, label: l }))];

  return (
    <div className="glass-card overflow-hidden">
      {/* Araç çubuğu */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/60 flex-wrap">
        <div className="inline-flex glass-chip p-1">
          {(['week', 'month'] as CalendarMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`px-5 py-1.5 rounded-full font-grotesk text-sm transition-colors ${mode === m ? 'bg-[#111] text-white font-medium shadow-sm' : 'text-neutral-600 hover:text-neutral-900'}`}
            >
              {m === 'week' ? 'Hafta' : 'Ay'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => shift(-1)} className="glass-chip p-2" aria-label="Önceki">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setAnchor(startOfDay(new Date()))} className="glass-chip px-4 py-2 font-grotesk text-sm font-medium">
            Bugün
          </button>
          <button onClick={() => shift(1)} className="glass-chip p-2" aria-label="Sonraki">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        {toolbarLeft}
        <h2 className="flex-1 text-center font-grotesk text-xl font-bold text-[#171717] min-w-[160px]">{title}</h2>
        <FilterMenu label="İçerik Türü" value={typeFilter} options={typeOptions} onChange={setTypeFilter} />
        <FilterMenu label="Paylaşıldığı yer" value={platformFilter} options={platformOptions} onChange={setPlatformFilter} />
      </div>

      <div className="flex">
        {/* Takvim gövdesi */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          {mode === 'week' ? (
            <div className="min-w-[840px]">
              <div className="grid grid-cols-7 border-b border-white/60">
                {weekDays.map((d, i) => (
                  <div key={i} className="py-2 flex justify-center">
                    <span
                      className={`px-3.5 py-1 rounded-full font-grotesk text-sm ${
                        sameDay(d, today) ? 'bg-[#111] text-white font-semibold' : 'text-neutral-500'
                      }`}
                    >
                      {DAY_SHORT[i]} {d.getDate()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 min-h-[560px]">
                {weekDays.map((d, i) => {
                  const list = byDay.get(dayKey(d)) || [];
                  const past = d < today;
                  return (
                    <div
                      key={i}
                      {...dropProps(d)}
                      onClick={() => !past && createOn(d)}
                      className={`group/day relative border-r border-white/50 last:border-r-0 p-2 space-y-2 ${
                        sameDay(d, today) ? 'bg-white/35' : ''
                      } ${dragOver === dayKey(d) ? 'bg-amber-100/50' : ''} ${past ? 'bg-slate-300/15' : 'cursor-pointer'}`}
                    >
                      {list.map((p) => (
                        <PostTile key={p.id} post={p} onClick={() => onPostClick(p)} />
                      ))}
                      {!past && (
                        <div className="hidden group-hover/day:flex items-center justify-center gap-1 py-2 rounded-2xl border border-dashed border-slate-400/50 bg-white/30 font-grotesk text-xs text-neutral-600">
                          <Plus className="w-3.5 h-3.5" /> Oluştur
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="min-w-[840px]">
              <div className="grid grid-cols-7 border-b border-white/60">
                {DAY_LONG.map((n) => (
                  <div key={n} className="py-2 text-center font-grotesk text-sm text-neutral-600">
                    {n}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.slice(0, monthRows * 7).map((d, i) => {
                  const list = byDay.get(dayKey(d)) || [];
                  const inMonth = d.getMonth() === anchor.getMonth();
                  const past = d < today;
                  return (
                    <div
                      key={i}
                      {...dropProps(d)}
                      onClick={() => !past && createOn(d)}
                      className={`group/day min-h-[128px] border-r border-b border-white/50 p-1.5 space-y-1 ${
                        inMonth ? '' : 'bg-slate-300/15'
                      } ${dragOver === dayKey(d) ? 'bg-amber-100/50' : ''} ${past ? '' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-grotesk text-sm ${
                            sameDay(d, today)
                              ? 'bg-[#111] text-white rounded-full px-2 font-semibold'
                              : inMonth
                                ? 'text-[#171717]'
                                : 'text-neutral-400'
                          }`}
                        >
                          {d.getDate()}
                        </span>
                        {!past && <Plus className="w-3.5 h-3.5 text-neutral-400 hidden group-hover/day:block" />}
                      </div>
                      {list.slice(0, 3).map((p) => (
                        <PostTile key={p.id} post={p} compact onClick={() => onPostClick(p)} />
                      ))}
                      {list.length > 3 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnchor(d);
                            switchMode('week');
                          }}
                          className="font-grotesk text-[11px] text-neutral-500 hover:underline"
                        >
                          +{list.length - 3} daha
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Yan panel */}
        {sidebar && <aside className="hidden lg:block w-80 shrink-0 border-l border-white/50 bg-white/15">{sidebar}</aside>}
      </div>
    </div>
  );
};

export default CalendarBoard;
