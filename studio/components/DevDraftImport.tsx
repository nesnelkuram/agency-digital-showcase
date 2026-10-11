import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, FileUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DIECI_DRAFT_BASE } from '../devDraft/draftPaths';
import { importDieciDraft, ImportConflictError, type ImportResult } from '../devDraft/importDraft';

interface Props {
  projectId: string;
  projectName: string;
  tenantId: string;
  onDone: () => void;
}

/**
 * YALNIZ GELİŞTİRME (import.meta.env.DEV): yerel Dieci taslağını bu projeye, giriş yapmış kullanıcının
 * kendi oturumuyla TASLAK olarak aktarır. Yayın, zamanlama, müşteri bildirimi yok.
 */
const DevDraftImport: React.FC<Props> = ({ projectId, projectName, tenantId, onDone }) => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<{ title: string; frames: number } | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${DIECI_DRAFT_BASE}/plan.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((p) => {
        if (!alive) return;
        setSummary({ title: p.baslik, frames: (p.days || []).reduce((n: number, d: any) => n + (d.items || []).length, 0) });
        setAvailable(true);
      })
      .catch(() => alive && setAvailable(false));
    return () => { alive = false; };
  }, []);

  if (available === false || available === null) return null;
  const isDieci = /dieci/i.test(projectName);

  const run = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    setLog([]);
    try {
      const r = await importDieciDraft({
        tenantId,
        projectId,
        uid: user.uid,
        userName: user.displayName || user.email || 'Studio',
        onProgress: (m) => setLog((l) => [...l, m]),
      });
      setResult(r);
      setConfirming(false);
      onDone();
    } catch (e: any) {
      setError(e instanceof ImportConflictError ? e.message : `İçe aktarma durdu: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card p-4 space-y-3" data-testid="dev-draft-import">
      <div className="flex items-center gap-2">
        <FileUp className="w-4 h-4 text-neutral-500" />
        <p className="font-grotesk text-sm font-semibold text-[#171717]">Yerel taslak (yalnız geliştirme)</p>
        <span className="px-2 py-0.5 rounded-full font-grotesk text-[10px] bg-amber-100 text-amber-800">TASLAK</span>
      </div>
      <p className="font-grotesk text-xs text-neutral-600">
        {summary?.title} · {summary?.frames} kare. Bu proje: <strong>{projectName}</strong>. Aktarım taslak olarak yazılır; yayın, zamanlama ve müşteri bildirimi yoktur.
      </p>
      {!isDieci && <p className="font-grotesk text-xs text-red-600">Bu proje Dieci değil; aktarım kapalı.</p>}
      {result ? (
        <div className="font-grotesk text-xs text-green-700 space-y-1">
          <p>Tamam: plan {result.createdPlan ? 'oluşturuldu' : 'zaten vardı'}, {result.createdPosts.length} taslak post oluşturuldu, {result.alreadyPresent} zaten vardı, {result.uploaded} dosya yüklendi{result.backfilled ? `, ${result.backfilled} postun önizlemesi tamamlandı` : ''}.</p>
          <Link to={`/studio/${projectId}/planlar/${result.planId}`} className="underline">Planı aç</Link>
        </div>
      ) : confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={run} disabled={busy || !isDieci} className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#111] text-white rounded-full font-grotesk text-sm disabled:opacity-50">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Onaylıyorum, taslak olarak aktar
          </button>
          <button onClick={() => setConfirming(false)} disabled={busy} className="px-3 py-2 rounded-full font-grotesk text-sm border border-neutral-300">Vazgeç</button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} disabled={!isDieci || !user} className="px-3 py-2 bg-[#111] text-white rounded-full font-grotesk text-sm disabled:opacity-50">
          Taslağı bu projeye aktar
        </button>
      )}
      {log.length > 0 && <p className="font-grotesk text-[11px] text-neutral-500">{log[log.length - 1]}</p>}
      {error && <p className="font-grotesk text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default DevDraftImport;
