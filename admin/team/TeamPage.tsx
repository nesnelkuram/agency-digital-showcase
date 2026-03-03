import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus,
  Shield,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { useUserManagement } from '@/shared/hooks/useUserManagement';
import { usePermission } from '@/shared/hooks/usePermission';
import { UserRole } from '@/shared/types/user';
import TeamStatsBar from './components/TeamStatsBar';
import UserCard from './components/UserCard';
import InvitationCard from './components/InvitationCard';
import RoleInfoCard from './components/RoleInfoCard';
import InviteModal from './components/InviteModal';

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  account_manager: 'Hesap Yoneticisi',
  editor: 'Editor',
  staff: 'Calisan',
  client: 'Musteri',
  freelancer: 'Freelancer',
};

const allRoles: UserRole[] = ['super_admin', 'admin', 'account_manager', 'editor', 'staff', 'client', 'freelancer'];

type TabKey = 'members' | 'invitations' | 'roles';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'members', label: 'Uyeler' },
  { key: 'invitations', label: 'Davetiyeler' },
  { key: 'roles', label: 'Roller' },
];

const TeamPage: React.FC = () => {
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

  const [activeTab, setActiveTab] = useState<TabKey>('members');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);

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

  const handleRoleChange = async (uid: string, role: UserRole) => {
    try {
      await updateUserRole(uid, role);
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  const handleStatusToggle = async (uid: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      await updateUserStatus(uid, newStatus as 'active' | 'suspended');
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="w-12 h-12 text-neutral-300 mx-auto" />
          <h3 className="font-grotesk text-xl font-bold text-[#171717] mt-4">
            Erisim Engellendi
          </h3>
          <p className="font-grotesk text-neutral-600 mt-2">
            Bu sayfaya erisim icin admin yetkisi gereklidir.
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
          <p className="font-grotesk text-neutral-500 mt-3">Yukleniyor...</p>
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
        <div>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
            Ekip Yonetimi
          </h1>
          <p className="font-commons text-neutral-500 mt-1">
            Ekip uyelerini davet edin, rolleri yonetin.
          </p>
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
            className="inline-flex items-center gap-2 px-5 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm hover:bg-neutral-800 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <UserPlus className="w-4 h-4" />
            Davet Gonder
          </motion.button>
        </div>
      </div>

      {/* Stats */}
      <TeamStatsBar users={users} invitations={invitations} />

      {/* Search + Filter + Tabs */}
      <div className="space-y-3">
        {/* Search & Filter Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Isim veya email ile ara..."
              className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-xl font-grotesk text-sm focus:outline-none focus:border-neutral-400 bg-white transition-colors"
            />
          </div>
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
            Tumu
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

        {/* Tabs */}
        <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-2 rounded-lg font-grotesk text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-[#171717] shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {tab.label}
              {tab.key === 'invitations' && invitations.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-700">
                  {invitations.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'members' && (
        <>
          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-neutral-300 mx-auto" />
              <p className="font-grotesk text-neutral-500 mt-3">
                {search || roleFilter !== 'all' ? 'Eslesen kullanici bulunamadi' : 'Henuz kullanici yok'}
              </p>
              {!search && roleFilter === 'all' && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Ilk Kullaniciyi Davet Et
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredUsers.map((user) => (
                <UserCard
                  key={user.uid}
                  user={user}
                  onRoleChange={handleRoleChange}
                  onStatusToggle={handleStatusToggle}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'invitations' && (
        <>
          {invitations.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-neutral-300 mx-auto" />
              <p className="font-grotesk text-neutral-500 mt-3">Bekleyen davetiye yok</p>
              <button
                onClick={() => setShowInviteModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm"
              >
                <UserPlus className="w-4 h-4" />
                Davet Gonder
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {invitations.map((invitation) => (
                <InvitationCard
                  key={invitation.id}
                  invitation={invitation}
                  onResend={resendInvitation}
                  onCancel={cancelInvitation}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {allRoles.map((role) => (
            <RoleInfoCard key={role} role={role} users={users} />
          ))}
        </div>
      )}

      {/* Invite Modal */}
      <InviteModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={inviteUser}
      />
    </div>
  );
};

export default TeamPage;
