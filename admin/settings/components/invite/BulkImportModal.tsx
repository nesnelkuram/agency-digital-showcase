import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Loader2, CheckCircle, FileText, Download } from 'lucide-react';
import { UserRole } from '@/shared/types/user';
import type { InvitePayload } from './InviteUserWizard';

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payloads: InvitePayload[]) => Promise<{ successes: number; failures: Array<{ email: string; error: string }> }>;
}

const VALID_ROLES: UserRole[] = [
  'admin',
  'account_manager',
  'editor',
  'staff',
  'client',
  'freelancer',
];

interface Row {
  email: string;
  displayName: string;
  role: string;
  department?: string;
  title?: string;
  error?: string;
}

function parseCsv(text: string): Row[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  // Detect header
  const firstCols = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const hasHeader = firstCols.includes('email') || firstCols.includes('e-posta');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const header = hasHeader
    ? firstCols
    : ['email', 'displayname', 'role', 'department', 'title'];

  return dataLines.map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const get = (key: string) => {
      const idx = header.indexOf(key);
      return idx >= 0 ? cols[idx] : '';
    };
    const email = get('email') || cols[0] || '';
    const displayName = get('displayname') || get('displayName') || get('ad soyad') || cols[1] || '';
    const role = (get('role') || cols[2] || '').toLowerCase();
    const department = get('department') || cols[3] || '';
    const title = get('title') || cols[4] || '';

    let error: string | undefined;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) error = 'Geçersiz e-posta';
    else if (!displayName) error = 'Ad soyad eksik';
    else if (!VALID_ROLES.includes(role as UserRole)) error = `Geçersiz rol: ${role}`;

    return { email, displayName, role, department, title, error };
  });
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ open, onClose, onSubmit }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    successes: number;
    failures: Array<{ email: string; error: string }>;
  } | null>(null);

  const reset = () => {
    setRows([]);
    setFileName('');
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    setRows(parseCsv(text));
  };

  const handleSubmit = async () => {
    const valid = rows.filter((r) => !r.error);
    if (valid.length === 0) return;
    setSubmitting(true);
    try {
      const payloads: InvitePayload[] = valid.map((r) => ({
        email: r.email.toLowerCase(),
        displayName: r.displayName,
        role: r.role as UserRole,
        extraFields: {
          department: r.department || undefined,
          title: r.title || undefined,
        },
      }));
      const res = await onSubmit(payloads);
      setResult(res);
    } catch (err: any) {
      setResult({ successes: 0, failures: [{ email: 'bulk', error: err?.message || 'Hata' }] });
    } finally {
      setSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'email,displayName,role,department,title\najans@ornek.com,Ahmet Yılmaz,editor,Kreatif,Video Editör';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'davet-sablonu.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.length - validCount;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="font-grotesk text-xl font-bold text-[#171717]">Toplu Davet</h2>
                <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                  CSV dosyasından birden fazla kullanıcı davet edin
                </p>
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {result ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-grotesk font-semibold text-green-900">
                        {result.successes} davet gönderildi
                      </h3>
                      {result.failures.length > 0 && (
                        <p className="font-grotesk text-sm text-red-700 mt-1">
                          {result.failures.length} davet başarısız oldu.
                        </p>
                      )}
                    </div>
                  </div>
                  {result.failures.length > 0 && (
                    <div className="border border-red-200 rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-red-50 font-grotesk text-xs font-semibold text-red-800">
                        Başarısız davetler
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {result.failures.map((f, i) => (
                          <div key={i} className="px-3 py-2 border-t border-red-100 text-sm font-grotesk">
                            <span className="font-medium">{f.email}</span> — <span className="text-red-700">{f.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : rows.length === 0 ? (
                <div className="space-y-4">
                  <label className="block border-2 border-dashed border-neutral-200 rounded-2xl p-10 text-center cursor-pointer hover:border-neutral-400 transition-colors">
                    <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                    <p className="font-grotesk text-sm font-medium text-[#171717]">
                      CSV dosyasını seçin
                    </p>
                    <p className="font-grotesk text-xs text-neutral-500 mt-1">
                      Başlık satırı: email, displayName, role, department, title
                    </p>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="inline-flex items-center gap-1.5 text-xs font-grotesk text-neutral-500 hover:text-[#171717]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Örnek CSV şablonunu indir
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-neutral-500" />
                      <span className="font-grotesk text-sm text-[#171717]">{fileName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-grotesk">
                        {validCount} geçerli
                      </span>
                      {errorCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-grotesk">
                          {errorCount} hatalı
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={reset}
                        className="p-1.5 hover:bg-neutral-100 rounded-lg"
                      >
                        <X className="w-4 h-4 text-neutral-500" />
                      </button>
                    </div>
                  </div>
                  <div className="border border-neutral-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-grotesk text-xs font-semibold text-neutral-600">E-posta</th>
                          <th className="px-3 py-2 text-left font-grotesk text-xs font-semibold text-neutral-600">Ad Soyad</th>
                          <th className="px-3 py-2 text-left font-grotesk text-xs font-semibold text-neutral-600">Rol</th>
                          <th className="px-3 py-2 text-left font-grotesk text-xs font-semibold text-neutral-600">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i} className={r.error ? 'bg-red-50' : ''}>
                            <td className="px-3 py-2 font-grotesk text-xs text-neutral-700">{r.email}</td>
                            <td className="px-3 py-2 font-grotesk text-xs text-neutral-700">{r.displayName}</td>
                            <td className="px-3 py-2 font-grotesk text-xs text-neutral-700">{r.role}</td>
                            <td className="px-3 py-2 font-grotesk text-xs">
                              {r.error ? (
                                <span className="text-red-600">{r.error}</span>
                              ) : (
                                <span className="text-green-600">Hazır</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 font-grotesk text-sm text-neutral-600 hover:text-[#171717]"
              >
                Kapat
              </button>
              {!result && rows.length > 0 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || validCount === 0}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gönderiliyor...
                    </>
                  ) : (
                    `${validCount} Daveti Gönder`
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BulkImportModal;
