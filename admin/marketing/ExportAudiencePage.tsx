import { useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  Users,
  MailCheck,
  Clock3,
  UserMinus,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/firebase/apiClient";
import {
  EXPORT_CONSENT_LABELS,
  EXPORT_PROFILE_LABELS,
} from "@/shared/types/exportAudience";
import type {
  ExportAudiencePage as AudienceResponse,
  ExportContact,
  ExportConsentStatus,
} from "@/shared/types/exportAudience";

const emptyCounts = { total: 0, subscribed: 0, pending: 0, unsubscribed: 0 };
const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("tr-TR") : "—";

export default function ExportAudiencePage() {
  const [contacts, setContacts] = useState<ExportContact[]>([]);
  const [counts, setCounts] = useState(emptyCounts);
  const [status, setStatus] = useState<ExportConsentStatus | "">("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setContacts([]);
    setCursor(null);
    authenticatedFetch(
      `/api/export-research/leads${status ? `?status=${status}` : ""}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Liste yüklenemedi.");
        return body as AudienceResponse;
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        setContacts(body.contacts);
        setCounts(body.counts);
        setCursor(body.nextCursor);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e.message || "Bağlantı kurulamadı.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [status, refresh]);

  async function more() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const params = new URLSearchParams({ cursor });
      if (status) params.set("status", status);
      const response = await authenticatedFetch(
        `/api/export-research/leads?${params}`,
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Diğer kayıtlar yüklenemedi.");
      setContacts((current) => {
        const ids = new Set(current.map((c) => c.id));
        return [
          ...current,
          ...body.contacts.filter((c: ExportContact) => !ids.has(c.id)),
        ];
      });
      setCursor(body.nextCursor);
      setCounts(body.counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setError("");
    try {
      const response = await authenticatedFetch(
        "/api/export-research/leads?format=csv",
      );
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Dışa aktarma tamamlanamadı.",
        );
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `ihracat-izinli-kisiler-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setExporting(false);
    }
  }

  const visible = contacts.filter((c) =>
    [
      c.email,
      c.name,
      c.sector,
      EXPORT_PROFILE_LABELS[c.profile],
      c.source.source,
      c.source.campaign,
    ]
      .join(" ")
      .toLocaleLowerCase("tr-TR")
      .includes(search.toLocaleLowerCase("tr-TR")),
  );
  const stats = [
    { label: "İhracatla ilgilenenler", value: counts.total, icon: Users },
    {
      label: "Pazarlama izni doğrulandı",
      value: counts.subscribed,
      icon: MailCheck,
    },
    { label: "E-posta onayı bekliyor", value: counts.pending, icon: Clock3 },
    { label: "İzin geri çekildi", value: counts.unsubscribed, icon: UserMinus },
  ];

  return (
    <div className="space-y-6 font-grotesk">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-neutral-400 mb-2">
            Araştırma kitlesi / ABD pazarı
          </p>
          <h1 className="text-2xl font-semibold text-neutral-900">
            İhracatla ilgilenenler
          </h1>
          <p className="text-sm text-neutral-500 mt-2 max-w-xl">
            Tekne aksesuarları raporunu isteyen kişiler. Ana ajans kayıtlarından
            ayrı tutulur; pazarlama izni ayrıca doğrulanır.
          </p>
        </div>
        <a
          href="/ihracat"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 border border-neutral-200 bg-white rounded-lg px-4 py-2 text-sm"
        >
          Rapor sayfasını aç <ExternalLink size={15} />
        </a>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white border border-neutral-200 rounded-xl p-5"
          >
            <s.icon size={20} className="text-neutral-400 mb-3" />
            <p className="text-3xl text-neutral-900 font-medium">
              {loading ? "…" : s.value}
            </p>
            <p className="text-xs text-neutral-500 mt-2">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-lime-200 bg-lime-50 px-5 py-4 text-sm text-neutral-700">
        <strong>CSV yalnızca doğrulanmış pazarlama izinlerini içerir.</strong>{" "}
        E-posta doğrulanmamışsa veya izin geri çekilmişse kişi dışa aktarılmaz.
        Yeni gönderim öncesinde güncel listeyi indir; CSV’deki kişiye özel izin
        iptal bağlantısını e-postaya ekle.
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search
            size={17}
            className="absolute left-3 top-3 text-neutral-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Yüklenen kayıtlarda ara"
            placeholder="Yüklenen kayıtlarda e-posta, sektör, kaynak ara…"
            className="w-full border border-neutral-200 bg-white rounded-lg pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <select
          aria-label="İzin durumu"
          value={status}
          disabled={loading || loadingMore}
          onChange={(e) =>
            setStatus(e.target.value as ExportConsentStatus | "")
          }
          className="border border-neutral-200 bg-white rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tüm izin durumları</option>
          {Object.entries(EXPORT_CONSENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setRefresh((n) => n + 1)}
          disabled={loading || loadingMore}
          aria-label="Listeyi yenile"
          className="border border-neutral-200 bg-white rounded-lg p-2.5 disabled:opacity-50"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting || loading || counts.subscribed === 0}
          className="flex items-center gap-2 bg-neutral-900 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          <Download size={16} />
          {exporting ? "Hazırlanıyor…" : "İzinli listeyi indir"}
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="p-4 font-medium">Kişi</th>
                <th className="p-4 font-medium">Profil / sektör</th>
                <th className="p-4 font-medium">İzin durumu</th>
                <th className="p-4 font-medium">Kaynak</th>
                <th className="p-4 font-medium">Kayıt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {visible.map((c) => (
                <tr key={c.id}>
                  <td className="p-4">
                    <p className="font-medium text-neutral-900">
                      {c.name || "Ad belirtilmedi"}
                    </p>
                    <p className="text-neutral-500 text-xs mt-1">{c.email}</p>
                  </td>
                  <td className="p-4">
                    <p>{EXPORT_PROFILE_LABELS[c.profile]}</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {c.sector || "Sektör belirtilmedi"}
                    </p>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs ${c.consentStatus === "subscribed" ? "bg-lime-100 text-lime-900" : c.consentStatus === "pending" ? "bg-amber-50 text-amber-800" : "bg-neutral-100 text-neutral-600"}`}
                    >
                      {EXPORT_CONSENT_LABELS[c.consentStatus]}
                    </span>
                    <p className="text-xs text-neutral-400 mt-1">
                      {c.consentStatus === "subscribed"
                        ? `İzin: ${date(c.confirmedAt)}`
                        : c.verifiedAt
                          ? "Rapor bağlantısı kullanıldı"
                          : "E-posta henüz doğrulanmadı"}
                    </p>
                  </td>
                  <td className="p-4">
                    <p>{c.source.source || "direct"}</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {c.source.campaign || "Kampanya belirtilmedi"}
                    </p>
                  </td>
                  <td className="p-4 whitespace-nowrap text-neutral-500">
                    {date(c.createdAt)}
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-16 px-6 text-center text-neutral-500"
                  >
                    {loading
                      ? "Kayıtlar yükleniyor…"
                      : error
                        ? "Liste görüntülenemedi."
                        : contacts.length
                          ? "Aramana uygun kayıt bulunamadı."
                          : "Henüz bu filtreye uygun kayıt yok. Rapor talepleri burada görünecek."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-neutral-100 p-4 flex items-center justify-between text-xs text-neutral-400">
          <span>
            {visible.length} kayıt gösteriliyor · {contacts.length} kayıt
            yüklendi
          </span>
          {cursor && (
            <button
              disabled={loadingMore}
              onClick={more}
              className="text-neutral-800 underline disabled:opacity-50"
            >
              {loadingMore ? "Yükleniyor…" : "Sonraki 100 kaydı yükle"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
