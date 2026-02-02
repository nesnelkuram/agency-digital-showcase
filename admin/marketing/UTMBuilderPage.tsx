import React, { useState, useEffect, useCallback } from 'react';
import { Link, Copy, Trash2, Plus, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import {
  createUTMLink,
  getUTMLinks,
  deleteUTMLink,
  buildUTMUrl,
} from '@/shared/services/utmService';
import type { UTMLink } from '@/shared/services/utmService';

// ============================================
// FORM STATE TIPI
// ============================================

interface UTMFormState {
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
}

const INITIAL_FORM: UTMFormState = {
  baseUrl: '',
  source: '',
  medium: '',
  campaign: '',
  term: '',
  content: '',
};

// ============================================
// SAYFA BILESENI
// ============================================

const UTMBuilderPage: React.FC = () => {
  const { user } = useAuth();
  const { projectId } = useProjectScope();

  // Form state
  const [form, setForm] = useState<UTMFormState>(INITIAL_FORM);

  // Link listesi
  const [links, setLinks] = useState<UTMLink[]>([]);
  const [loading, setLoading] = useState(true);

  // Islem durumlari
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ============================================
  // VERI YUKLEME
  // ============================================

  const loadLinks = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getUTMLinks(projectId, 20);
      setLinks(result);
    } catch (err) {
      console.error('[UTMBuilder] Linkler yuklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  // ============================================
  // ONIZLEME URL HESAPLAMA
  // ============================================

  const previewUrl = form.baseUrl && form.source && form.medium && form.campaign
    ? buildUTMUrl(form.baseUrl, {
        source: form.source,
        medium: form.medium,
        campaign: form.campaign,
        term: form.term || undefined,
        content: form.content || undefined,
      })
    : '';

  // ============================================
  // FORM HANDLER'LARI
  // ============================================

  const handleChange = (field: keyof UTMFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid =
    form.baseUrl.trim() !== '' &&
    form.source.trim() !== '' &&
    form.medium.trim() !== '' &&
    form.campaign.trim() !== '';

  // ============================================
  // KAYDET & KOPYALA
  // ============================================

  const handleSaveAndCopy = async () => {
    if (!isFormValid || !user) return;

    setSaving(true);
    try {
      const fullUrl = buildUTMUrl(form.baseUrl.trim(), {
        source: form.source.trim(),
        medium: form.medium.trim(),
        campaign: form.campaign.trim(),
        term: form.term.trim() || undefined,
        content: form.content.trim() || undefined,
      });

      await createUTMLink({
        projectId: projectId || undefined,
        baseUrl: form.baseUrl.trim(),
        source: form.source.trim(),
        medium: form.medium.trim(),
        campaign: form.campaign.trim(),
        term: form.term.trim() || undefined,
        content: form.content.trim() || undefined,
        fullUrl,
        createdBy: user.uid,
      });

      // Panoya kopyala
      await navigator.clipboard.writeText(fullUrl);
      setCopiedPreview(true);
      setTimeout(() => setCopiedPreview(false), 2000);

      // Formu sifirla ve listeyi yenile
      setForm(INITIAL_FORM);
      await loadLinks();
    } catch (err) {
      console.error('[UTMBuilder] Kaydetme hatasi:', err);
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // KOPYALA (ONIZLEME)
  // ============================================

  const handleCopyPreview = async () => {
    if (!previewUrl) return;
    try {
      await navigator.clipboard.writeText(previewUrl);
      setCopiedPreview(true);
      setTimeout(() => setCopiedPreview(false), 2000);
    } catch (err) {
      console.error('[UTMBuilder] Kopyalama hatasi:', err);
    }
  };

  // ============================================
  // KOPYALA (LISTE)
  // ============================================

  const handleCopyLink = async (fullUrl: string, linkId: string) => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(linkId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('[UTMBuilder] Kopyalama hatasi:', err);
    }
  };

  // ============================================
  // SIL
  // ============================================

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteUTMLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      console.error('[UTMBuilder] Silme hatasi:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // ============================================
  // TARIH FORMATLAMA
  // ============================================

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '-';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-commons font-bold text-[#171717]">
          UTM Link Olusturucu
        </h1>
        <p className="text-sm font-commons text-neutral-500 mt-1">
          Kampanya linklerinize UTM parametreleri ekleyin
        </p>
      </div>

      {/* Form Karti */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
            <Link className="w-4 h-4 text-indigo-600" />
          </div>
          <h2 className="text-lg font-commons font-semibold text-[#171717]">
            Yeni UTM Link
          </h2>
        </div>

        <div className="space-y-4">
          {/* Hedef URL */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Hedef URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={form.baseUrl}
              onChange={(e) => handleChange('baseUrl', e.target.value)}
              placeholder="https://ornek.com/sayfa"
              className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
            />
          </div>

          {/* Zorunlu UTM Parametreleri - 3 sutunlu grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* UTM Source */}
            <div>
              <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                UTM Source <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.source}
                onChange={(e) => handleChange('source', e.target.value)}
                placeholder="google, facebook, newsletter"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
              />
            </div>

            {/* UTM Medium */}
            <div>
              <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                UTM Medium <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.medium}
                onChange={(e) => handleChange('medium', e.target.value)}
                placeholder="cpc, social, email"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
              />
            </div>

            {/* UTM Campaign */}
            <div>
              <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                UTM Campaign <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.campaign}
                onChange={(e) => handleChange('campaign', e.target.value)}
                placeholder="kampanya_adi"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
              />
            </div>
          </div>

          {/* Opsiyonel UTM Parametreleri - 2 sutunlu grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* UTM Term */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-600 mb-1.5">
                UTM Term <span className="text-xs text-neutral-400">(opsiyonel)</span>
              </label>
              <input
                type="text"
                value={form.term}
                onChange={(e) => handleChange('term', e.target.value)}
                placeholder="anahtar_kelime"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
              />
            </div>

            {/* UTM Content */}
            <div>
              <label className="block text-sm font-commons font-medium text-neutral-600 mb-1.5">
                UTM Content <span className="text-xs text-neutral-400">(opsiyonel)</span>
              </label>
              <input
                type="text"
                value={form.content}
                onChange={(e) => handleChange('content', e.target.value)}
                placeholder="icerik_varyanti"
                className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-colors"
              />
            </div>
          </div>

          {/* Onizleme */}
          {previewUrl && (
            <div className="mt-2">
              <label className="block text-sm font-commons font-medium text-neutral-600 mb-1.5">
                Olusturulan URL
              </label>
              <div className="flex items-start gap-2">
                <div className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg p-3 font-mono text-xs text-neutral-700 break-all leading-relaxed select-all">
                  {previewUrl}
                </div>
                <button
                  onClick={handleCopyPreview}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors font-commons text-sm text-neutral-600"
                  title="Kopyala"
                >
                  <Copy className="w-4 h-4" />
                  {copiedPreview ? (
                    <span className="text-emerald-600 font-medium">Kopyalandi!</span>
                  ) : (
                    <span>Kopyala</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Kaydet & Kopyala Butonu */}
          <div className="flex items-center justify-end pt-2">
            <button
              onClick={handleSaveAndCopy}
              disabled={!isFormValid || saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-commons text-sm font-medium"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Kaydet & Kopyala
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Son Olusturulan Linkler */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-commons font-semibold text-[#171717]">
            Son Olusturulan Linkler
          </h2>
          <span className="text-xs font-commons text-neutral-400">
            Son 20 link
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-12">
            <Link className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="font-commons text-neutral-500 text-sm">
              Henuz UTM link olusturulmadi
            </p>
            <p className="font-commons text-neutral-400 text-xs mt-1">
              Yukaridaki formu kullanarak ilk linkinizi olusturun
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="pb-3 text-xs font-commons font-semibold text-neutral-500 uppercase tracking-wider">
                    Kampanya
                  </th>
                  <th className="pb-3 text-xs font-commons font-semibold text-neutral-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="pb-3 text-xs font-commons font-semibold text-neutral-500 uppercase tracking-wider">
                    Medium
                  </th>
                  <th className="pb-3 text-xs font-commons font-semibold text-neutral-500 uppercase tracking-wider">
                    Tarih
                  </th>
                  <th className="pb-3 text-xs font-commons font-semibold text-neutral-500 uppercase tracking-wider text-right">
                    Islemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {links.map((link) => (
                  <tr key={link.id} className="group hover:bg-neutral-50/50 transition-colors">
                    {/* Kampanya */}
                    <td className="py-3 pr-4">
                      <p className="font-commons text-sm font-medium text-[#171717]">
                        {link.campaign}
                      </p>
                      <p className="font-commons text-xs text-neutral-400 truncate max-w-[240px]">
                        {link.baseUrl}
                      </p>
                    </td>

                    {/* Source */}
                    <td className="py-3 pr-4">
                      <span className="inline-flex px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-commons text-xs font-medium">
                        {link.source}
                      </span>
                    </td>

                    {/* Medium */}
                    <td className="py-3 pr-4">
                      <span className="inline-flex px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md font-commons text-xs font-medium">
                        {link.medium}
                      </span>
                    </td>

                    {/* Tarih */}
                    <td className="py-3 pr-4">
                      <span className="font-commons text-xs text-neutral-500">
                        {formatDate(link.createdAt)}
                      </span>
                    </td>

                    {/* Islemler */}
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* URL'yi ac */}
                        <a
                          href={link.fullUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-400 hover:text-neutral-600"
                          title="Linki ac"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        {/* Kopyala */}
                        <button
                          onClick={() => handleCopyLink(link.fullUrl, link.id)}
                          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-400 hover:text-neutral-600"
                          title="Kopyala"
                        >
                          {copiedId === link.id ? (
                            <span className="text-xs font-commons font-medium text-emerald-600 px-1">
                              Kopyalandi!
                            </span>
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        {/* Sil */}
                        <button
                          onClick={() => handleDelete(link.id)}
                          disabled={deletingId === link.id}
                          className="p-2 rounded-lg hover:bg-red-50 transition-colors text-neutral-400 hover:text-red-600 disabled:opacity-50"
                          title="Sil"
                        >
                          {deletingId === link.id ? (
                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UTMBuilderPage;
