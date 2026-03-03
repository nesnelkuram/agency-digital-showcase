import React, { useState } from 'react';
import { Mail, RefreshCw, X, Copy, CheckCheck } from 'lucide-react';
import { Invitation, UserRole } from '@/shared/types/user';

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

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Bekliyor', className: 'bg-amber-100 text-amber-700' },
  accepted: { label: 'Kabul Edildi', className: 'bg-green-100 text-green-700' },
  expired: { label: 'Suresi Doldu', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Iptal Edildi', className: 'bg-neutral-100 text-neutral-600' },
};

interface InvitationCardProps {
  invitation: Invitation;
  onResend: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}

const InvitationCard: React.FC<InvitationCardProps> = ({ invitation, onResend, onCancel }) => {
  const [copied, setCopied] = useState(false);
  const status = statusConfig[invitation.status] || statusConfig.pending;

  const handleCopy = () => {
    const link = `${window.location.origin}/join?token=${invitation.id}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sentDate = invitation.createdAt instanceof Date
    ? invitation.createdAt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
    : '';

  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="font-grotesk font-semibold text-[#171717] truncate">
              {invitation.displayName || invitation.email}
            </p>
            <p className="font-commons text-sm text-neutral-500 truncate">{invitation.email}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className={`px-2.5 py-0.5 text-xs font-grotesk font-medium rounded-full ${roleColors[invitation.role]}`}>
          {roleLabels[invitation.role]}
        </span>
        <span className={`px-2.5 py-0.5 text-xs font-grotesk font-medium rounded-full ${status.className}`}>
          {status.label}
        </span>
        {sentDate && (
          <span className="text-xs font-commons text-neutral-400">{sentDate}</span>
        )}
      </div>

      {invitation.status === 'pending' && (
        <div className="mt-3 flex items-center gap-1 border-t border-neutral-50 pt-3">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-grotesk font-medium text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors"
            title="Davet linkini kopyala"
          >
            {copied ? (
              <>
                <CheckCheck className="w-3.5 h-3.5 text-green-600" />
                <span className="text-green-600">Kopyalandi</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Kopyala
              </>
            )}
          </button>
          <button
            onClick={() => onResend(invitation.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-grotesk font-medium text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            title="Tekrar Gonder"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tekrar Gonder
          </button>
          <button
            onClick={() => onCancel(invitation.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-grotesk font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Iptal Et"
          >
            <X className="w-3.5 h-3.5" />
            Iptal
          </button>
        </div>
      )}
    </div>
  );
};

export default InvitationCard;
