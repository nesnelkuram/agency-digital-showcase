import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Instagram, Facebook, Linkedin, Twitter, Music2, Film, Image as ImageIcon, Globe } from 'lucide-react';
import type { PostType, SocialMediaPost, SocialPlatform } from '@/shared/types/socialMedia';
import { POST_TYPE_LABELS, SOCIAL_PLATFORM_LABELS } from '@/shared/types/socialMedia';
import { STUDIO_STATUS_COLOR, STUDIO_STATUS_LABEL, postThumb } from '../studioData';
import {
  DEFAULT_STUDIO_TIME_ZONE,
  addCivilDays,
  civilKey,
  civilOf,
  compareCivil,
  sameCivil,
  startOfCivilWeek,
  timeZoneLabel,
  zonedParts,
  zonedToUtc,
  type CivilDate,
} from '@/shared/time/zonedTime';

export type CalendarMode = 'week' | 'month';

/** Sürükle-bırak veri türleri */
export const DND_POST = 'text/post-id';
export const DND_LIBRARY_ASSET = 'text/library-asset-id';

const PLATFORM_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
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
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Sürüklenebilir: yayınlanmamış içerikler. Firmada bekleyen/onaylı içeriğin zamanı onayın parçasıdır;
 * taşıma sunucu 'reschedule' işlemiyle yapılır ve yeniden onay gerektirir (çağıran yönetir).
 */
const DRAGGABLE = new Set(['draft', 'internal_review', 'revision_requested_internal', 'revision_requested', 'pending_approval', 'approved', 'scheduled']);

interface Props {
  posts: SocialMediaPost[];
  onPostClick: (post: SocialMediaPost) => void;
  /** Boş hücre/gün tıklaması veya kütüphane dosyası bırakma (libraryAssetId) — o zamanla yeni içerik */
  onCreate: (date: Date, libraryAssetId?: string) => void;
  onReschedule: (post: SocialMediaPost, date: Date) => void;
  sidebar?: React.ReactNode;
  toolbarLeft?: React.ReactNode;
  /** Markanın saat dilimi; tüm gün/saat hesapları buna göre */
  timeZone?: string;
  /** Saat dilimi tenant ayarından değil varsayılandan geliyorsa etikette belirtilir */
  timeZoneIsDefault?: boolean;
  /** Test için şimdiki zaman */
  now?: Date;
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
const PostTile: React.FC<{ post: SocialMediaPost; timeZone: string; compact?: boolean; onClick: () => void }> = ({ post, timeZone, compact, onClick }) => {
  const d: Date | null = (post.scheduledAt as any)?.toDate?.() || null;
  const parts = d ? zonedParts(d, timeZone) : null;
  const thumb = postThumb(post);
  const isVideo = post.media?.[0]?.type === 'video' || post.postType === 'reels' || post.postType === 'video';
  const draggable = DRAGGABLE.has(post.status);
  const icons = (post.platforms || []).map((p) => PLATFORM_ICON[p]).filter(Boolean);

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData(DND_POST, post.id);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`group glass-tile hover:bg-white transition-all cursor-pointer ${compact ? 'px-2 py-1 !rounded-xl' : 'p-2.5'}`}
    >
      <div className="flex items-center gap-1.5">
        {parts && <span className="font-grotesk text-[11px] font-semibold text-[#171717]">{`${pad(parts.hour)}:${pad(parts.minute)}`}</span>}
        <span className="ml-auto flex items-center gap-0.5 text-neutral-500">
          {icons.map((Icon, i) => (
            <Icon key={i} className="w-3.5 h-3.5" />
          ))}
        </span>
      </div>
      {compact ? (
        <div className="flex items-center gap-1.5">
          {thumb && <img src={thumb} alt="" className="w-6 h-6 rounded object-cover shrink-0" loading="lazy" />}
          <p className="font-grotesk text-[11px] text-neutral-700 truncate">{post.title || post.caption || POST_TYPE_LABELS[post.postType]}</p>
        </div>
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
      <span className={`mt-1 inline-block px-2 py-px rounded-full font-grotesk text-[10px] ${STUDIO_STATUS_COLOR[post.status] || 'bg-neutral-100'}`}>
        {STUDIO_STATUS_LABEL[post.status] || post.status}
      </span>
    </div>
  );
};

/**
 * Studio takvimi — Meta Business Suite mantığında: haftalık GÜN + SAAT ızgarası ve ay görünümü,
 * Bugün ve ileri/geri gezinme, içerik türü ve platform filtreleri.
 * - Boş saat hücresine tıklama → o gün/saatle yeni içerik
 * - Kütüphane dosyasını hücreye bırakma → o gün/saatle, dosya ekli yeni içerik
 * - İçeriği başka gün/saate sürükleme → onReschedule (onaylı içerikte yeniden onay, çağıran yönetir)
 * Tüm hesaplar markanın saat dilimindedir; geçmiş saatlere oluşturma/taşıma yapılmaz.
 */
const CalendarBoard: React.FC<Props> = ({
  posts,
  onPostClick,
  onCreate,
  onReschedule,
  sidebar,
  toolbarLeft,
  timeZone = DEFAULT_STUDIO_TIME_ZONE,
  timeZoneIsDefault = false,
  now: nowProp,
}) => {
  const now = nowProp || new Date();
  const today = civilOf(now, timeZone);
  const [mode, setMode] = useState<CalendarMode>(() => {
    try {
      return (localStorage.getItem('studio.calendarMode') as CalendarMode) || 'week';
    } catch {
      return 'week';
    }
  });
  const [anchor, setAnchor] = useState<CivilDate>(today);
  const [typeFilter, setTypeFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [dragOver, setDragOver] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const switchMode = (m: CalendarMode) => {
    setMode(m);
    try {
      localStorage.setItem('studio.calendarMode', m);
    } catch {
      // yok say
    }
  };

  // Hafta ızgarası sabah 07:00'den görünür başlar
  useEffect(() => {
    if (mode === 'week' && scroller.current) scroller.current.scrollTop = 7 * 64;
  }, [mode]);

  const filtered = useMemo(
    () =>
      posts.filter(
        (p) =>
          (typeFilter === 'all' || p.postType === typeFilter) &&
          (platformFilter === 'all' || (p.platforms || []).includes(platformFilter as SocialPlatform))
      ),
    [posts, typeFilter, platformFilter]
  );

  /** gün → saat → içerikler (markanın saat diliminde) */
  const { byDay, bySlot } = useMemo(() => {
    const day = new Map<string, SocialMediaPost[]>();
    const slot = new Map<string, SocialMediaPost[]>();
    const ms = (p: SocialMediaPost) => (p.scheduledAt as any)?.toDate?.()?.getTime?.() ?? 0;
    for (const p of [...filtered].sort((a, b) => ms(a) - ms(b))) {
      const d: Date | undefined = (p.scheduledAt as any)?.toDate?.();
      if (!d) continue;
      const z = zonedParts(d, timeZone);
      const dk = civilKey(z);
      day.set(dk, [...(day.get(dk) || []), p]);
      const sk = `${dk}@${z.hour}`;
      slot.set(sk, [...(slot.get(sk) || []), p]);
    }
    return { byDay: day, bySlot: slot };
  }, [filtered, timeZone]);

  const weekStart = startOfCivilWeek(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addCivilDays(weekStart, i));
  const monthStart: CivilDate = { year: anchor.year, month: anchor.month, day: 1 };
  const gridStart = startOfCivilWeek(monthStart);
  const monthDays = Array.from({ length: 42 }, (_, i) => addCivilDays(gridStart, i));
  const monthRows = monthDays[35].month === anchor.month ? 6 : 5;

  const title =
    mode === 'month'
      ? `${MONTH_LONG[anchor.month - 1]} ${anchor.year}`
      : weekDays[0].month === weekDays[6].month
        ? `${MONTH_LONG[weekDays[0].month - 1]} ${weekDays[0].year}`
        : `${MONTH_SHORT[weekDays[0].month - 1]} – ${MONTH_SHORT[weekDays[6].month - 1]} ${weekDays[6].year}`;

  const shift = (dir: number) =>
    setAnchor((a) => (mode === 'week' ? addCivilDays(a, 7 * dir) : { year: a.month + dir > 12 ? a.year + 1 : a.month + dir < 1 ? a.year - 1 : a.year, month: ((a.month - 1 + dir + 12) % 12) + 1, day: 1 }));

  /** Hücre başlangıcı; yaz saati geçişinde var olmayan saat → null */
  const slotStart = (day: CivilDate, hour: number) => zonedToUtc(day, hour, 0, timeZone);
  /** Saat hücresi tamamen geçmişte mi (var olmayan saat de kullanılamaz sayılır) */
  const slotPast = (day: CivilDate, hour: number) => {
    const s = slotStart(day, hour);
    return !s || s.getTime() + 3_600_000 <= now.getTime();
  };
  const dayPast = (day: CivilDate) => compareCivil(day, today) < 0;

  /** Gün (ay görünümü) için varsayılan saat: 10:00, bugünse bir sonraki tam saat */
  const defaultTimeOn = (day: CivilDate): Date | null => {
    const first = sameCivil(day, today) ? Math.min(zonedParts(now, timeZone).hour + 1, 23) : 10;
    for (let h = first; h < 24; h++) {
      const s = slotStart(day, h);
      if (s && s.getTime() >= now.getTime()) return s;
    }
    return null;
  };
  /** Geçmiş veya var olmayan zaman kullanılmaz */
  const notPast = (d: Date | null) => (!d || d.getTime() < now.getTime() ? null : d);

  const handleDrop = (e: React.DragEvent, target: { day: CivilDate; hour?: number }) => {
    e.preventDefault();
    setDragOver(null);
    const assetId = e.dataTransfer.getData(DND_LIBRARY_ASSET);
    if (assetId) {
      const at = target.hour === undefined ? defaultTimeOn(target.day) : notPast(slotStart(target.day, target.hour));
      if (at) onCreate(at, assetId);
      return;
    }
    const id = e.dataTransfer.getData(DND_POST);
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    const old: Date | null = (post.scheduledAt as any)?.toDate?.() || null;
    const oldParts = old ? zonedParts(old, timeZone) : null;
    const hour = target.hour ?? oldParts?.hour ?? 10;
    const minute = oldParts?.minute ?? 0;
    const next = zonedToUtc(target.day, hour, minute, timeZone);
    if (!next) return; // yaz saati geçişinde var olmayan saat
    if (old && old.getTime() === next.getTime()) return;
    if (next.getTime() < now.getTime()) return; // geçmişe taşınmaz
    onReschedule(post, next);
  };

  const dropProps = (key: string, target: { day: CivilDate; hour?: number }, past: boolean) => ({
    onDragOver: (e: React.DragEvent) => {
      if (past) return;
      e.preventDefault();
      setDragOver(key);
    },
    onDragLeave: () => setDragOver(null),
    onDrop: (e: React.DragEvent) => (past ? undefined : handleDrop(e, target)),
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
          <button onClick={() => setAnchor(today)} className="glass-chip px-4 py-2 font-grotesk text-sm font-medium">
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
      <p className="px-5 py-1.5 border-b border-white/50 flex items-center gap-1.5 font-grotesk text-[11px] text-neutral-600" data-testid="calendar-timezone">
        <Globe className="w-3.5 h-3.5" /> Saat dilimi: {timeZoneLabel(timeZone, now)}
        {timeZoneIsDefault && ' — varsayılan (marka/ajans ayarında saat dilimi yok)'}
      </p>

      <div className="flex">
        {/* Takvim gövdesi */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          {mode === 'week' ? (
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-white/60">
                <div />
                {weekDays.map((d, i) => (
                  <div key={i} className="py-2 flex justify-center">
                    <span className={`px-3.5 py-1 rounded-full font-grotesk text-sm ${sameCivil(d, today) ? 'bg-[#111] text-white font-semibold' : 'text-neutral-500'}`}>
                      {DAY_SHORT[i]} {d.day}
                    </span>
                  </div>
                ))}
              </div>
              <div ref={scroller} className="max-h-[640px] overflow-y-auto">
                {HOURS.map((h) => (
                  <div key={h} className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-white/40 min-h-[64px]">
                    <div className="pr-2 pt-1 text-right font-grotesk text-[11px] text-neutral-500" title={`${pad(h)}:00`}>
                      {pad(h)}
                    </div>
                    {weekDays.map((d, i) => {
                      const key = `${civilKey(d)}@${h}`;
                      const list = bySlot.get(key) || [];
                      const missing = !slotStart(d, h);
                      const past = slotPast(d, h);
                      return (
                        <div
                          key={i}
                          data-testid={`slot-${d.year}-${pad(d.month)}-${pad(d.day)}-${pad(h)}`}
                          aria-label={`${DAY_LONG[i]} ${d.day} ${MONTH_LONG[d.month - 1]} ${pad(h)}:00`}
                          {...dropProps(key, { day: d, hour: h }, past)}
                          onClick={() => {
                            const at = slotStart(d, h);
                            if (!past && at) onCreate(at);
                          }}
                          title={missing ? 'Bu saat, yaz saati geçişi nedeniyle bu saat diliminde yok' : undefined}
                          data-missing={missing ? 'true' : undefined}
                          className={`group/slot relative border-l border-white/50 p-1 space-y-1 ${sameCivil(d, today) ? 'bg-white/30' : ''} ${
                            dragOver === key ? 'bg-amber-100/60' : ''
                          } ${past ? 'bg-slate-300/15' : 'cursor-pointer hover:bg-white/40'}`}
                        >
                          {list.map((p) => (
                            <PostTile key={p.id} post={p} timeZone={timeZone} compact onClick={() => onPostClick(p)} />
                          ))}
                          {missing && <span className="block text-center font-grotesk text-[10px] text-neutral-400">Bu saat yok (yaz saati)</span>}
                          {!past && list.length === 0 && (
                            <span className="hidden group-hover/slot:flex items-center justify-center h-full min-h-[48px] font-grotesk text-[11px] text-neutral-500">
                              <Plus className="w-3 h-3 mr-0.5" /> Oluştur
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
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
                  const key = civilKey(d);
                  const list = byDay.get(key) || [];
                  const inMonth = d.month === anchor.month;
                  const past = dayPast(d);
                  return (
                    <div
                      key={i}
                      {...dropProps(key, { day: d }, past)}
                      onClick={() => {
                        const at = defaultTimeOn(d);
                        if (!past && at) onCreate(at);
                      }}
                      className={`group/day min-h-[128px] border-r border-b border-white/50 p-1.5 space-y-1 ${inMonth ? '' : 'bg-slate-300/15'} ${
                        dragOver === key ? 'bg-amber-100/50' : ''
                      } ${past ? '' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-grotesk text-sm ${
                            sameCivil(d, today) ? 'bg-[#111] text-white rounded-full px-2 font-semibold' : inMonth ? 'text-[#171717]' : 'text-neutral-400'
                          }`}
                        >
                          {d.day}
                        </span>
                        {!past && <Plus className="w-3.5 h-3.5 text-neutral-400 hidden group-hover/day:block" />}
                      </div>
                      {list.slice(0, 3).map((p) => (
                        <PostTile key={p.id} post={p} timeZone={timeZone} compact onClick={() => onPostClick(p)} />
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
