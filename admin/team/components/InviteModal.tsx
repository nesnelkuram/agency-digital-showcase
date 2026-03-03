import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2 } from 'lucide-react';
import { UserRole } from '@/shared/types/user';

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  account_manager: 'Hesap Yoneticisi',
  editor: 'Editor',
  staff: 'Calisan',
  client: 'Musteri',
  freelancer: 'Freelancer',
};

const roleDescShort: Record<string, string> = {
  admin: 'Tam yonetim erisimi',
  account_manager: 'Musteri iliskileri',
  editor: 'Icerik uretimi',
  staff: 'Genel gorev yonetimi',
  client: 'Proje goruntuleme ve onay',
  freelancer: 'Sinirli gorev erisimi',
};

const inviteRoles: UserRole[] = ['admin', 'account_manager', 'editor', 'staff', 'client', 'freelancer'];

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (email: string, displayName: string, role: UserRole) => Promise<void>;
}

const InviteModal: React.FC<InviteModalProps> = ({ open, onClose, onInvite }) => {
  const [form, setForm] = useState({ email: '', displayName: '', role: 'staff' as UserRole });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onInvite(form.email, form.displayName, form.role);
      onClose();
      setForm({ email: '', displayName: '', role: 'staff' });
    } catch (err: unknown) {
      setError((err as Error).message || 'Davetiye gonderilemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-grotesk text-xl font-bold text-[#171717]">
                Ekip Uyesi Davet Et
              </h3>
              <button
                onClick={onClose}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-grotesk text-sm text-neutral-700 mb-1">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Ornek: Ahmet Yilmaz"
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl font-grotesk bg-neutral-50 focus:border-[#171717] focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block font-grotesk text-sm text-neutral-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="ornek@email.com"
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl font-grotesk bg-neutral-50 focus:border-[#171717] focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block font-grotesk text-sm text-neutral-700 mb-2">
                  Rol
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {inviteRoles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setForm({ ...form, role })}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        form.role === role
                          ? 'border-[#171717] bg-neutral-50'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <p className="font-grotesk text-sm font-medium text-[#171717]">
                        {roleLabels[role]}
                      </p>
                      <p className="font-commons text-[11px] text-neutral-500 mt-0.5">
                        {roleDescShort[role]}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="font-grotesk text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border-2 border-neutral-200 rounded-full font-grotesk font-medium hover:bg-neutral-50 transition-colors"
                >
                  Iptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-[#171717] text-white rounded-full font-grotesk font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gonderiliyor...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Davet Gonder
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InviteModal;
