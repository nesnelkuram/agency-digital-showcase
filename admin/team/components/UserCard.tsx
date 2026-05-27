import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical, Check, Ban, Pencil } from 'lucide-react';
import { User, UserRole } from '@/shared/types/user';

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  account_manager: 'Hesap Yoneticisi',
  editor: 'Editor',
  staff: 'Calisan',
  client: 'Musteri',
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

const avatarColors: Record<UserRole, string> = {
  super_admin: 'bg-violet-100 text-violet-700',
  admin: 'bg-purple-100 text-purple-700',
  account_manager: 'bg-indigo-100 text-indigo-700',
  editor: 'bg-sky-100 text-sky-700',
  staff: 'bg-blue-100 text-blue-700',
  client: 'bg-green-100 text-green-700',
  freelancer: 'bg-amber-100 text-amber-700',
};

function formatLastLogin(lastLoginAt: unknown): string {
  if (!lastLoginAt) return 'Hic giris yapmadi';
  const date = (lastLoginAt as { toDate?: () => Date }).toDate?.() || new Date(lastLoginAt as string);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Az once';
  if (mins < 60) return `${mins}dk once`;
  if (hours < 24) return `${hours}sa once`;
  if (days === 1) return 'Dun';
  if (days < 30) return `${days}g once`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const inviteRoles: UserRole[] = ['admin', 'account_manager', 'editor', 'staff', 'client', 'freelancer'];

interface UserCardProps {
  user: User;
  onRoleChange: (uid: string, role: UserRole) => Promise<void>;
  onStatusToggle: (uid: string, currentStatus: string) => Promise<void>;
  onEdit?: (user: User) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onRoleChange, onStatusToggle, onEdit }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const initials = (user.displayName || user.email).charAt(0).toUpperCase();

  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-4 hover:shadow-sm transition-shadow relative">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${avatarColors[user.role] || 'bg-neutral-100 text-neutral-600'}`}>
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-11 h-11 rounded-full object-cover"
              />
            ) : (
              <span className="font-grotesk font-bold text-lg">{initials}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-grotesk font-semibold text-[#171717] truncate">
                {user.displayName || user.email}
              </p>
              {user.status === 'suspended' && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-grotesk rounded-full font-medium">
                  Askida
                </span>
              )}
            </div>
            <p className="font-commons text-sm text-neutral-500 truncate">{user.email}</p>
          </div>
        </div>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-neutral-400" />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDropdownOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-20"
                >
                  {onEdit && (
                    <button
                      onClick={() => {
                        onEdit(user);
                        setDropdownOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-left font-grotesk text-sm hover:bg-neutral-50 flex items-center gap-2 text-neutral-700 border-b border-neutral-100"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Profili Düzenle
                    </button>
                  )}
                  <div className="px-3 py-1.5 border-b border-neutral-100">
                    <p className="font-grotesk text-[10px] text-neutral-400 uppercase tracking-wider">
                      Rol Degistir
                    </p>
                  </div>
                  {inviteRoles.map((role) => (
                    <button
                      key={role}
                      onClick={() => {
                        onRoleChange(user.uid, role);
                        setDropdownOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-left font-grotesk text-sm hover:bg-neutral-50 flex items-center justify-between"
                    >
                      {roleLabels[role]}
                      {user.role === role && (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      )}
                    </button>
                  ))}
                  <div className="border-t border-neutral-100 mt-1 pt-1">
                    <button
                      onClick={() => {
                        onStatusToggle(user.uid, user.status);
                        setDropdownOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-left font-grotesk text-sm hover:bg-neutral-50 flex items-center gap-2 text-red-600"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      {user.status === 'active' ? 'Askiya Al' : 'Aktif Et'}
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span
          className={`px-2.5 py-0.5 text-xs font-grotesk font-medium rounded-full ${
            roleColors[user.role] || 'bg-neutral-100 text-neutral-600'
          }`}
        >
          {roleLabels[user.role] || user.role}
        </span>
        <span className="text-xs font-commons text-neutral-400">
          {formatLastLogin(user.metadata?.lastLoginAt)}
        </span>
      </div>
    </div>
  );
};

export default UserCard;
