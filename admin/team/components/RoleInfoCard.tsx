import React from 'react';
import {
  ShieldCheck,
  Shield,
  Briefcase,
  Palette,
  UserCheck,
  Users,
  Laptop,
} from 'lucide-react';
import { UserRole, User } from '@/shared/types/user';
import { ROLES } from '@/lib/rbac/roles';

const roleIcons: Record<UserRole, React.ElementType> = {
  super_admin: ShieldCheck,
  admin: Shield,
  account_manager: Briefcase,
  editor: Palette,
  staff: UserCheck,
  client: Users,
  freelancer: Laptop,
};

const roleDescriptions: Record<UserRole, string> = {
  super_admin: 'Tum sistemlere ve kiracilara tam erisim',
  admin: 'Kiraciya ozel tum ozelliklere tam erisim',
  account_manager: 'Musteri iliskileri ve proje yonetimi',
  editor: 'Kreatif icerik uretimi ve duzenleme',
  staff: 'Genel proje ve gorev yonetimi',
  client: 'Proje gorunturleme ve onay islemleri',
  freelancer: 'Atanan gorevlerde sinirli erisim',
};

const roleBgColors: Record<UserRole, string> = {
  super_admin: 'bg-violet-50 border-violet-100',
  admin: 'bg-purple-50 border-purple-100',
  account_manager: 'bg-indigo-50 border-indigo-100',
  editor: 'bg-sky-50 border-sky-100',
  staff: 'bg-blue-50 border-blue-100',
  client: 'bg-green-50 border-green-100',
  freelancer: 'bg-amber-50 border-amber-100',
};

const roleIconColors: Record<UserRole, string> = {
  super_admin: 'text-violet-600',
  admin: 'text-purple-600',
  account_manager: 'text-indigo-600',
  editor: 'text-sky-600',
  staff: 'text-blue-600',
  client: 'text-green-600',
  freelancer: 'text-amber-600',
};

interface RoleInfoCardProps {
  role: UserRole;
  users: User[];
}

const RoleInfoCard: React.FC<RoleInfoCardProps> = ({ role, users }) => {
  const Icon = roleIcons[role];
  const roleConfig = ROLES[role];
  const permissionCount = roleConfig?.permissions.length || 0;
  const userCount = users.filter((u) => u.role === role).length;

  return (
    <div className={`rounded-xl border p-4 ${roleBgColors[role]}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-white/60 ${roleIconColors[role]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-grotesk font-semibold text-[#171717]">
            {roleConfig?.displayName || role}
          </h3>
          <p className="font-commons text-xs text-neutral-500">
            {roleDescriptions[role]}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="px-2.5 py-0.5 text-xs font-grotesk font-medium rounded-full bg-white/60 text-neutral-600">
          {permissionCount} izin
        </span>
        <span className="px-2.5 py-0.5 text-xs font-grotesk font-medium rounded-full bg-white/60 text-neutral-600">
          {userCount} kullanici
        </span>
      </div>
    </div>
  );
};

export default RoleInfoCard;
