import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  MoreVertical,
  Check,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  Clock,
  Ban,
  Send,
  Search,
  Copy,
  CheckCheck,
} from 'lucide-react';
import { useUserManagement } from '@/shared/hooks/useUserManagement';
import { usePermission } from '@/shared/hooks/usePermission';
import { UserRole } from '@/shared/types/user';

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Süper Admin',
  admin: 'Admin',
  account_manager: 'Hesap Yöneticisi',
  editor: 'Editör',
  staff: 'Çalışan',
  client: 'Müşteri',
  freelancer: 'Freelancer',
};

const roleColors: Record<UserRole, string> = {
  super_admin: 'bg-violet-100 text-violet-700',
  admin: 'bg-purple-100 text-purple-700',
  account_manager: 'bg-indigo-100 text-indigo-700',
  editor: 'bg-sky-100 text-sky-700',
  staff: 'bg-blue-100 text-blue-700',
  client: 'bg-green-100 text-green-700',
  freelancer: 'bg-amber-100 text-amber-700',
};

// Roles available for invitation (super_admin assigned server-side only)
const inviteRoles: UserRole[] = ['admin', 'account_manager', 'editor', 'staff', 'client', 'freelancer'];

function formatLastLogin(lastLoginAt: unknown): string {
  if (!lastLoginAt) return 'Hiç giriş yapmadı';
  const date = (lastLoginAt as { toDate?: () => Date }).toDate?.() || new Date(lastLoginAt as string);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins}dk önce`;
  if (hours < 24) return `${hours}sa önce`;
  if (days === 1) return 'Dün';
  if (days < 30) return `${days}g önce`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const UserManagementPage: React.FC = () => {
  const { isAdmin } = usePermission();
  const {
    users,
    invitations,
    loading,
    error,
    inviteUser,
    updateUserRole,
    updateUserStatus,
    cancelInvitation,
    resendInvitation,
    refetch,
  } = useUserManagement();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    displayName: '',
    role: 'staff' as UserRole,
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !search ||
        u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError(null);
    try {
      await inviteUser(inviteForm.email, inviteForm.displayName, inviteForm.role);
      setShowInviteModal(false);
      setInviteForm({ email: '', displayName: '', role: 'staff' });
    } catch (err: unknown) {
      setInviteError((err as Error).message || 'Davetiye gönderilemedi');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (uid: string, role: UserRole) => {
    try {
      await updateUserRole(uid, role);
      setActiveDropdown(null);
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  const handleStatusToggle = async (uid: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      await updateUserStatus(uid, newStatus);
      setActiveDropdown(null);
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleCopyInviteLink = (invitationId: string) => {
    const link = `${window.location.origin}/join?token=${invitationId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(invitationId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="w-12 h-12 text-neutral-300 mx-auto" />
          <h3 className="font-grotesk text-xl font-bold text-[#171717] mt-4">
            Erişim Engellendi
          </h3>
          <p className="font-grotesk text-neutral-600 mt-2">
            Bu sayfaya erişim için admin yetkisi gereklidir.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mx-auto" />
          <p className="font-grotesk text-neutral-500 mt-3">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h3 className="font-grotesk text-xl font-bold text-[#171717] mt-4">Hata</h3>
          <p className="font-grotesk text-neutral-600 mt-2">{error}</p>
          <button
            onClick={refetch}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <a
            href="/admin/settings"
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </a>
          <div>
            <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
              Kullanıcı Yönetimi
            </h1>
            <p className="font-grotesk text-neutral-500 mt-1">
              Ekip üyelerini davet edin ve yönetin.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refetch}
            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-200 text-neutral-700 rounded-full font-grotesk text-sm hover:bg-neutral-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Yenile
          </button>
          <motion.button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm hover:bg-neutral-800 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <UserPlus className="w-4 h-4" />
            Davet Et
          </motion.button>
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-amber-600" />
            <h3 className="font-grotesk font-semibold text-amber-800">
              Bekleyen Davetiyeler ({invitations.length})
            </h3>
          </div>
          <div className="space-y-2">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-grotesk text-sm font-medium text-[#171717]">
                      {invitation.displayName}
                    </p>
                    <p className="font-grotesk text-xs text-neutral-500">
                      {invitation.email} • {roleLabels[invitation.role]}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopyInviteLink(invitation.id)}
                    className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors"
                    title="Davet linkini kopyala"
                  >
                    {copiedId === invitation.id ? (
                      <CheckCheck className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => resendInvitation(invitation.id)}
                    className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                    title="Tekrar Gönder"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => cancelInvitation(invitation.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="İptal Et"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
        {/* List Header — search + role filter */}
        <div className="p-4 border-b border-neutral-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-neutral-600" />
              <h2 className="font-grotesk text-lg font-bold text-[#171717]">
                Kullanıcılar ({filteredUsers.length}/{users.length})
              </h2>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İsim veya email ile ara..."
              className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm focus:outline-none focus:border-neutral-400 bg-neutral-50 transition-colors"
            />
          </div>

          {/* Role filter chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1 rounded-full font-grotesk text-xs font-medium transition-colors ${
                roleFilter === 'all'
                  ? 'bg-[#171717] text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Tümü
            </button>
            {(Object.keys(roleLabels) as UserRole[]).map((role) => {
              const count = users.filter((u) => u.role === role).length;
              if (count === 0) return null;
              return (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role === roleFilter ? 'all' : role)}
                  className={`px-3 py-1 rounded-full font-grotesk text-xs font-medium transition-colors ${
                    roleFilter === role
                      ? 'bg-[#171717] text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {roleLabels[role]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 text-neutral-300 mx-auto" />
            <p className="font-grotesk text-neutral-500 mt-3">
              {search || roleFilter !== 'all' ? 'Eşleşen kullanıcı bulunamadı' : 'Henüz kullanıcı yok'}
            </p>
            {!search && roleFilter === 'all' && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm"
              >
                <UserPlus className="w-4 h-4" />
                İlk Kullanıcıyı Davet Et
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filteredUsers.map((user) => (
              <div
                key={user.uid}
                className="p-4 hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#fffceb] flex items-center justify-center flex-shrink-0">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="font-grotesk font-bold text-[#171717]">
                          {user.displayName?.charAt(0) || user.email.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-grotesk font-medium text-[#171717]">
                          {user.displayName || user.email}
                        </p>
                        {user.status === 'suspended' && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-grotesk rounded-full">
                            Askıya Alınmış
                          </span>
                        )}
                      </div>
                      <p className="font-grotesk text-sm text-neutral-500">
                        {user.email}
                      </p>
                      <p className="font-grotesk text-xs text-neutral-400 mt-0.5">
                        Son giriş: {formatLastLogin(user.metadata?.lastLoginAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 text-xs font-grotesk font-medium rounded-full ${
                        roleColors[user.role] || 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {roleLabels[user.role] || user.role}
                    </span>

                    <div className="relative">
                      <button
                        onClick={() =>
                          setActiveDropdown(
                            activeDropdown === user.uid ? null : user.uid
                          )
                        }
                        className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4 text-neutral-500" />
                      </button>

                      <AnimatePresence>
                        {activeDropdown === user.uid && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-10"
                          >
                            <div className="px-3 py-2 border-b border-neutral-100">
                              <p className="font-grotesk text-xs text-neutral-500 uppercase tracking-wide">
                                Rol Değiştir
                              </p>
                            </div>
                            {(Object.keys(roleLabels) as UserRole[])
                              .filter((r) => r !== 'super_admin')
                              .map((role) => (
                                <button
                                  key={role}
                                  onClick={() => handleRoleChange(user.uid, role)}
                                  className="w-full px-3 py-2 text-left font-grotesk text-sm hover:bg-neutral-50 flex items-center justify-between"
                                >
                                  {roleLabels[role]}
                                  {user.role === role && (
                                    <Check className="w-4 h-4 text-green-600" />
                                  )}
                                </button>
                              ))}
                            <div className="border-t border-neutral-100 mt-1 pt-1">
                              <button
                                onClick={() =>
                                  handleStatusToggle(user.uid, user.status)
                                }
                                className="w-full px-3 py-2 text-left font-grotesk text-sm hover:bg-neutral-50 flex items-center gap-2 text-red-600"
                              >
                                <Ban className="w-4 h-4" />
                                {user.status === 'active'
                                  ? 'Askıya Al'
                                  : 'Aktif Et'}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowInviteModal(false)}
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
                  Kullanıcı Davet Et
                </h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block font-grotesk text-sm text-neutral-700 mb-1">
                    Ad Soyad
                  </label>
                  <input
                    type="text"
                    value={inviteForm.displayName}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, displayName: e.target.value })
                    }
                    placeholder="Örnek: Ahmet Yılmaz"
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg font-grotesk bg-[#fffceb] focus:border-[#171717] focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block font-grotesk text-sm text-neutral-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, email: e.target.value })
                    }
                    placeholder="ornek@email.com"
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg font-grotesk bg-[#fffceb] focus:border-[#171717] focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block font-grotesk text-sm text-neutral-700 mb-1">
                    Rol
                  </label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        role: e.target.value as UserRole,
                      })
                    }
                    className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg font-grotesk bg-[#fffceb] focus:border-[#171717] focus:outline-none transition-colors"
                  >
                    {inviteRoles.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                </div>

                {inviteError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-grotesk text-sm text-red-600">{inviteError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 px-4 py-3 border-2 border-neutral-200 rounded-full font-grotesk font-medium hover:bg-neutral-50 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="flex-1 px-4 py-3 bg-[#171717] text-white rounded-full font-grotesk font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {inviteLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Davet Gönder
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagementPage;
