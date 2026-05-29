import React, { useEffect, useRef, useState } from 'react';
import { Video, Trash2, UploadCloud, Loader2, Plus, X } from 'lucide-react';
import {
  listHomepageVideos,
  createHomepageVideo,
  deleteHomepageVideo,
} from '@/shared/services/homepageVideoService';
import type { HomepageVideo } from '@/shared/types/homepageVideo';
import { HOMEPAGE_CATEGORIES } from '@/shared/types/homepageVideo';
import { compressVideo, type CompressPhase } from '@/shared/lib/videoCompress';
import { uploadToBlob } from '@/shared/lib/blobUpload';

const BLOB_BASE = 'https://ml0qkja5xmbjesrt.public.blob.vercel-storage.com';

interface FormState {
  title: string;
  category: string;
  category2: string;
  location: string;
  description: string;
  tags: string;
  year: string;
  services: string;
}

const emptyForm: FormState = {
  title: '',
  category: HOMEPAGE_CATEGORIES[0],
  category2: '',
  location: '',
  description: '',
  tags: '',
  year: String(new Date().getFullYear()),
  services: '',
};

const PHASE_LABEL: Record<CompressPhase, string> = {
  'loading-engine': 'Sıkıştırma motoru yükleniyor…',
  full: 'Tam sürüm sıkıştırılıyor…',
  preview: 'Önizleme oluşturuluyor…',
  done: 'Tamamlandı',
};

const HomepageVideosPage: React.FC = () => {
  const [videos, setVideos] = useState<HomepageVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setVideos(await listHomepageVideos());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setFile(null);
    setError('');
    setStatusText('');
    setProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!file) {
      setError('Lütfen bir video dosyası seçin.');
      return;
    }
    if (!form.title.trim()) {
      setError('Başlık zorunlu.');
      return;
    }

    setBusy(true);
    try {
      const slug = `custom-${Date.now().toString(36)}`;

      // 1) Compress in the browser (ffmpeg.wasm)
      const { full, preview } = await compressVideo(file, ({ phase, ratio }) => {
        setStatusText(PHASE_LABEL[phase]);
        setProgress(Math.round(ratio * 100));
      });

      // 2) Upload both to Vercel Blob
      setStatusText('Tam sürüm yükleniyor…');
      setProgress(0);
      const fullUrl = await uploadToBlob(
        `videos/full/${slug}.mp4`,
        full,
        'video/mp4',
        (l, t) => setProgress(t ? Math.round((l / t) * 100) : 0),
      );

      setStatusText('Önizleme yükleniyor…');
      setProgress(0);
      const previewUrl = await uploadToBlob(
        `videos/preview/${slug}.mp4`,
        preview,
        'video/mp4',
        (l, t) => setProgress(t ? Math.round((l / t) * 100) : 0),
      );

      // 3) Save metadata
      setStatusText('Kaydediliyor…');
      await createHomepageVideo({
        slug,
        title: form.title.trim(),
        category: form.category,
        category2: form.category2.trim() || undefined,
        location: form.location.trim(),
        description: form.description.trim(),
        tags: form.tags.trim() || undefined,
        year: form.year ? Number(form.year) : undefined,
        services: form.services.trim() || undefined,
        fullUrl,
        previewUrl,
        active: true,
      });

      resetForm();
      setShowForm(false);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Bir hata oluştu.');
    } finally {
      setBusy(false);
      setStatusText('');
      setProgress(0);
    }
  };

  const handleDelete = async (v: HomepageVideo) => {
    if (!confirm(`"${v.title}" silinsin mi? (Yalnızca listeden kaldırılır)`)) return;
    await deleteHomepageVideo(v.id);
    await refresh();
  };

  const sizeBadge = (url: string) => url.replace(BLOB_BASE, '');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Video className="w-6 h-6 text-neutral-700" />
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Anasayfa Videoları</h1>
            <p className="text-sm text-neutral-500">
              Yüklenen videolar tarayıcıda otomatik sıkıştırılıp anasayfa telefon ızgarasında gösterilir.
            </p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <Plus className="w-4 h-4" /> Video Ekle
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 border border-neutral-200 rounded-xl p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-neutral-800">Yeni Video</h2>
            <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="text-neutral-400 hover:text-neutral-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* File picker */}
          <label className="block mb-4">
            <span className="text-sm font-medium text-neutral-700">Video dosyası</span>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={busy}
              className="mt-1 block w-full text-sm text-neutral-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200"
            />
            {file && (
              <span className="text-xs text-neutral-500">
                {file.name} — {(file.size / 1048576).toFixed(1)} MB (sıkıştırıldıktan sonra çok daha küçük olacak)
              </span>
            )}
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Başlık *">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={busy} className="input" />
            </Field>
            <Field label="Konum">
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} disabled={busy} className="input" />
            </Field>
            <Field label="Kategori">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} disabled={busy} className="input">
                {HOMEPAGE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="İkincil Kategori">
              <input value={form.category2} onChange={(e) => setForm({ ...form, category2: e.target.value })} disabled={busy} className="input" placeholder="Opsiyonel" />
            </Field>
            <Field label="Yıl">
              <input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} disabled={busy} className="input" inputMode="numeric" />
            </Field>
            <Field label="Hizmetler">
              <input value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} disabled={busy} className="input" placeholder="Fashion Film, Color Grading" />
            </Field>
            <Field label="Etiketler" full>
              <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} disabled={busy} className="input" placeholder="virgülle ayırın" />
            </Field>
            <Field label="Açıklama" full>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={busy} rows={3} className="input" />
            </Field>
          </div>

          {busy && (
            <div className="mt-4">
              <div className="flex items-center gap-2 text-sm text-neutral-600 mb-1">
                <Loader2 className="w-4 h-4 animate-spin" /> {statusText}
              </div>
              <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-neutral-900 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                İlk sıkıştırma motoru indirme (~30MB) ve sıkıştırma birkaç dakika sürebilir — sekmeyi kapatma.
              </p>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 px-5 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {busy ? 'İşleniyor…' : 'Sıkıştır & Yükle'}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 text-neutral-500"><Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…</div>
      ) : videos.length === 0 ? (
        <p className="text-neutral-500">Henüz eklenen video yok.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((v) => (
            <div key={v.id} className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
              <video src={v.previewUrl} muted loop playsInline className="w-full aspect-[9/16] object-cover bg-neutral-900"
                onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                onMouseLeave={(e) => e.currentTarget.pause()} />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-neutral-900 text-sm">{v.title}</p>
                    <p className="text-xs text-neutral-500">{v.category}{v.location ? ` · ${v.location}` : ''}</p>
                  </div>
                  <button onClick={() => handleDelete(v)} className="text-neutral-400 hover:text-red-600" title="Sil">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400 mt-2 truncate">{sizeBadge(v.fullUrl)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* tiny utility styles */}
      <style>{`
        .input { margin-top: 0.25rem; display:block; width:100%; border:1px solid #e5e5e5; border-radius:0.5rem; padding:0.5rem 0.75rem; font-size:0.875rem; }
        .input:focus { outline:none; border-color:#171717; }
      `}</style>
    </div>
  );
};

const Field: React.FC<{ label: string; full?: boolean; children: React.ReactNode }> = ({ label, full, children }) => (
  <label className={`block ${full ? 'md:col-span-2' : ''}`}>
    <span className="text-sm font-medium text-neutral-700">{label}</span>
    {children}
  </label>
);

export default HomepageVideosPage;
