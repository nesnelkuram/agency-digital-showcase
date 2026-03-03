import React from 'react';
import { Users, UserCheck, Clock, Shield } from 'lucide-react';
import { User, Invitation } from '@/shared/types/user';

interface TeamStatsBarProps {
  users: User[];
  invitations: Invitation[];
}

const TeamStatsBar: React.FC<TeamStatsBarProps> = ({ users, invitations }) => {
  const activeUsers = users.filter((u) => u.status === 'active').length;
  const pendingInvites = invitations.filter((i) => i.status === 'pending').length;
  const uniqueRoles = new Set(users.map((u) => u.role)).size;

  const stats = [
    {
      label: 'Toplam Uye',
      value: users.length,
      icon: Users,
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: 'Aktif Uyeler',
      value: activeUsers,
      icon: UserCheck,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Bekleyen Davet',
      value: pendingInvites,
      icon: Clock,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Roller',
      value: uniqueRoles,
      icon: Shield,
      color: 'bg-violet-50 text-violet-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-neutral-100 p-4 flex items-center gap-3"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-grotesk font-bold text-[#171717]">{stat.value}</p>
              <p className="text-xs font-commons text-neutral-500">{stat.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TeamStatsBar;
