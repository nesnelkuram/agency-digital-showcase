import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Mail,
  Briefcase,
  User as UserIcon,
  RefreshCw,
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useTenantId } from '@/shared/hooks/useTenant';
import type { User } from '@/shared/types/user';
import type { ContentPlan } from '@/shared/types/socialMedia';
import {
  matchPlanForClient,
  CLIENT_VISIBLE_STATUSES,
} from '@/shared/services/contentPlanAccess';

interface DiagnosticRow {
  plan: ContentPlan;
  matches: {
    byUid: boolean;
    byEmail: boolean;
    byProject: boolean;
  };
  visible: boolean;
  statusVisible: boolean;
}

const ClientAccessTestPage: React.FC = () => {
  const tenantId = useTenantId();
  const [clientUsers, setClientUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticRow[]>([]);
  const [running, setRunning] = useState(false);

  const loadClientUsers = async () => {
    if (!db) return;
    setLoadingUsers(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'users'),
          where('tenantId', '==', tenantId),
          where('role', '==', 'client')
        )
      );
      const list: User[] = [];
      snap.forEach((d) => list.push({ uid: d.id, ...d.data() } as User));
      setClientUsers(list);
    } catch (e) {
      console.error('[ClientAccessTest] load users failed', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadClientUsers();
  }, [tenantId]);

  const runDiagnostic = async (user: User) => {
    if (!db) return;
    setSelectedUser(user);
    setRunning(true);
    setDiagnostics([]);
    try {
      const email = (user.email || '').toLowerCase();
      const assignedProjects: string[] = (user.profile as any)?.assignedProjectIds || [];

      const snap = await getDocs(
        query(collection(db, 'content_plans'), where('tenantId', '==', tenantId))
      );

      const rows: DiagnosticRow[] = [];
      const clientCtx = { uid: user.uid, email, assignedProjectIds: assignedProjects };
      snap.forEach((d) => {
        const plan = { id: d.id, ...d.data() } as ContentPlan;
        const match = matchPlanForClient(plan, clientCtx);
        const statusVisible = CLIENT_VISIBLE_STATUSES.has(plan.status);
        rows.push({
          plan,
          matches: {
            byUid: match.details.byUid,
            byEmail: match.details.byEmail,
            byProject: match.details.byProject,
          },
          visible: match.visible,
          statusVisible,
        });
      });

      // Görünür olanlar üstte, en yeni üstte
      rows.sort((a, b) => {
        if (a.visible !== b.visible) return a.visible ? -1 : 1;
        const at = (a.plan.createdAt as any)?.toDate?.()?.getTime?.() || 0;
        const bt = (b.plan.createdAt as any)?.toDate?.()?.getTime?.() || 0;
        return bt - at;
      });

      setDiagnostics(rows);
    } catch (e) {
      console.error('[ClientAccessTest] diagnostic failed', e);
    } finally {
      setRunning(false);
    }
  };

  const filteredUsers = clientUsers.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      ((u.profile as any)?.clientCompany || '').toLowerCase().includes(q)
    );
  });

  const visibleCount = diagnostics.filter((r) => r.visible).length;
  const hiddenCount = diagnostics.filter((r) => !r.visible).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-indigo-500" />
          <h1 className="font-grotesk text-2xl font-bold text-[#171717]">
            Müşteri Erişim Testi
          </h1>
        </div>
        <p className="font-grotesk text-sm text-neutral-500">
          Bir müşteri kullanıcısı seç — portal'da hangi planları görebileceğini ve hangi
          planların neden eşleşmediğini listesin.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sol: Kullanıcı listesi */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-neutral-100 p-3">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İsim, e-posta veya şirket..."
              className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm focus:outline-none focus:border-neutral-400"
            />
          </div>
          {loadingUsers ? (
            <div className="text-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-400 mx-auto" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center py-6 font-grotesk text-xs text-neutral-400">
              Müşteri kullanıcısı bulunamadı
            </p>
          ) : (
            <div className="space-y-1 max-h-[560px] overflow-y-auto">
              {filteredUsers.map((u) => (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => runDiagnostic(u)}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors ${
                    selectedUser?.uid === u.uid
                      ? 'bg-[#171717] text-white'
                      : 'hover:bg-neutral-50'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selectedUser?.uid === u.uid ? 'bg-white/10' : 'bg-[#fffceb]'
                    }`}
                  >
                    <span
                      className={`font-grotesk text-xs font-bold ${
                        selectedUser?.uid === u.uid ? 'text-white' : 'text-[#171717]'
                      }`}
                    >
                      {(u.displayName || u.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`font-grotesk text-xs font-medium truncate ${
                        selectedUser?.uid === u.uid ? 'text-white' : 'text-[#171717]'
                      }`}
                    >
                      {u.displayName || u.email}
                    </p>
                    <p
                      className={`font-grotesk text-[10px] truncate ${
                        selectedUser?.uid === u.uid ? 'text-white/60' : 'text-neutral-500'
                      }`}
                    >
                      {u.email}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={loadClientUsers}
            className="w-full mt-3 inline-flex items-center justify-center gap-1 px-2 py-1.5 border border-neutral-200 rounded-md font-grotesk text-[11px] text-neutral-600 hover:bg-neutral-50"
          >
            <RefreshCw className="w-3 h-3" />
            Yenile
          </button>
        </div>

        {/* Sağ: Teşhis */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedUser ? (
            <div className="bg-white rounded-xl border border-neutral-100 p-10 text-center">
              <UserIcon className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
              <p className="font-grotesk text-sm text-neutral-500">
                Sol taraftan bir müşteri kullanıcısı seçin.
              </p>
            </div>
          ) : (
            <>
              {/* Profil bilgileri */}
              <div className="bg-white rounded-xl border border-neutral-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-grotesk text-sm font-semibold text-[#171717]">
                    Profil Bilgileri
                  </h3>
                  {running && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs font-grotesk">
                  <div>
                    <p className="text-neutral-500">UID</p>
                    <code className="text-[11px] text-[#171717] break-all">{selectedUser.uid}</code>
                  </div>
                  <div>
                    <p className="text-neutral-500">E-posta</p>
                    <code className="text-[11px] text-[#171717]">{selectedUser.email}</code>
                  </div>
                  <div>
                    <p className="text-neutral-500">Tenant</p>
                    <code className="text-[11px] text-[#171717]">{selectedUser.tenantId}</code>
                  </div>
                  <div>
                    <p className="text-neutral-500">Durum</p>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${
                        selectedUser.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {selectedUser.status}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-neutral-500 mb-1">Atanan Projeler</p>
                    {(selectedUser.profile as any)?.assignedProjectIds?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {(selectedUser.profile as any).assignedProjectIds.map((pid: string) => (
                          <code
                            key={pid}
                            className="text-[10px] bg-neutral-100 rounded px-1.5 py-0.5 text-[#171717]"
                          >
                            {pid}
                          </code>
                        ))}
                      </div>
                    ) : (
                      <p className="text-red-500 text-[11px]">❌ Hiç proje atanmamış</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Özet */}
              {!running && diagnostics.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                    <p className="font-grotesk text-2xl font-bold text-green-800">{visibleCount}</p>
                    <p className="font-grotesk text-[11px] text-green-700">Görebildiği plan</p>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center">
                    <AlertCircle className="w-5 h-5 text-neutral-500 mx-auto mb-1" />
                    <p className="font-grotesk text-2xl font-bold text-neutral-700">{hiddenCount}</p>
                    <p className="font-grotesk text-[11px] text-neutral-600">Görmediği plan</p>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                    <Mail className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                    <p className="font-grotesk text-2xl font-bold text-indigo-700">
                      {diagnostics.length}
                    </p>
                    <p className="font-grotesk text-[11px] text-indigo-700">Toplam tenant plan</p>
                  </div>
                </div>
              )}

              {/* Detaylı tablo */}
              <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100">
                  <h3 className="font-grotesk text-sm font-semibold text-[#171717]">
                    Tenant'taki Tüm Planlar — Erişim Analizi
                  </h3>
                </div>
                {running ? (
                  <div className="py-10 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-400 mx-auto" />
                  </div>
                ) : diagnostics.length === 0 ? (
                  <div className="py-10 text-center font-grotesk text-sm text-neutral-500">
                    Bu tenant'ta hiç content_plan yok.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100 max-h-[500px] overflow-y-auto">
                    {diagnostics.map((row) => (
                      <div key={row.plan.id} className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="font-grotesk text-sm font-medium text-[#171717] truncate">
                              {row.plan.title || '(isimsiz)'}
                            </p>
                            <code className="font-grotesk text-[10px] text-neutral-400">
                              {row.plan.id}
                            </code>
                          </div>
                          {row.visible ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-grotesk flex-shrink-0">
                              <CheckCircle className="w-3 h-3" />
                              Görünür
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-[10px] font-grotesk flex-shrink-0">
                              Gizli
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-grotesk">
                          <div className="bg-neutral-50 rounded p-2">
                            <p className="text-neutral-500">Status</p>
                            <p className={row.statusVisible ? 'text-[#171717]' : 'text-red-500'}>
                              {row.plan.status} {!row.statusVisible && '(gizleniyor)'}
                            </p>
                          </div>
                          <div
                            className={`rounded p-2 ${
                              row.matches.byUid ? 'bg-green-50' : 'bg-neutral-50'
                            }`}
                          >
                            <p className="text-neutral-500">UID eşleşme</p>
                            <p className={row.matches.byUid ? 'text-green-700' : 'text-neutral-400'}>
                              {row.matches.byUid ? '✓' : '—'}
                            </p>
                          </div>
                          <div
                            className={`rounded p-2 ${
                              row.matches.byEmail ? 'bg-green-50' : 'bg-neutral-50'
                            }`}
                          >
                            <p className="text-neutral-500">E-posta eşleşme</p>
                            <p className={row.matches.byEmail ? 'text-green-700' : 'text-neutral-400'}>
                              {row.matches.byEmail ? '✓' : '—'}
                            </p>
                          </div>
                          <div
                            className={`rounded p-2 ${
                              row.matches.byProject ? 'bg-green-50' : 'bg-neutral-50'
                            }`}
                          >
                            <p className="text-neutral-500">Proje üyesi</p>
                            <p
                              className={
                                row.matches.byProject ? 'text-green-700' : 'text-neutral-400'
                              }
                            >
                              {row.matches.byProject ? '✓' : '—'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 text-[11px] font-grotesk text-neutral-500 grid grid-cols-1 md:grid-cols-2 gap-1">
                          <span>
                            assignedClientId: <code>{row.plan.assignedClientId || '—'}</code>
                          </span>
                          <span>
                            assignedClientEmail:{' '}
                            <code>{row.plan.assignedClientEmail || '—'}</code>
                          </span>
                          <span>
                            projectId: <code>{row.plan.projectId || '—'}</code>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Öneriler */}
              {!running && diagnostics.length > 0 && visibleCount === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h4 className="font-grotesk text-sm font-semibold text-amber-900 mb-2">
                    <Briefcase className="inline w-4 h-4 mr-1" />
                    Öneri
                  </h4>
                  <ul className="list-disc pl-5 space-y-1 font-grotesk text-xs text-amber-800">
                    {(selectedUser.profile as any)?.assignedProjectIds?.length === 0 && (
                      <li>
                        Bu kullanıcının <code>assignedProjectIds</code> listesi boş. Kullanıcı
                        Yönetimi → Profili Düzenle → Atanan projeler alanından ekle.
                      </li>
                    )}
                    {diagnostics.every((r) => !r.matches.byUid && !r.matches.byEmail) && (
                      <li>
                        Hiçbir plan UID veya e-posta ile bu kullanıcıya atanmamış. Gönderim yaparken{' '}
                        <strong>listeden seçim</strong> yap veya e-postasını doğru gir.
                      </li>
                    )}
                    {diagnostics.every((r) => !r.statusVisible) && (
                      <li>
                        Mevcut planlar hâlâ taslak/iç inceleme aşamasında — müşteriye gönderilmesi
                        gerekiyor.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ClientAccessTestPage;
