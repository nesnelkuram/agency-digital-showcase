import React from 'react';
import { motion } from 'framer-motion';
import { Facebook, Globe, Video, Briefcase, Mail } from 'lucide-react';

interface Account {
  id: string;
  platform: string;
  accountName: string;
  accountId: string;
  adAccountId?: string | null;
  pageId?: string | null;
  status: string;
}

interface AccountSelectorProps {
  accounts: Account[];
  onSelect: (account: Account) => void;
}

const PLATFORM_ICONS: Record<string, React.FC<{ className?: string }>> = {
  meta: Facebook,
  google: Globe,
  tiktok: Video,
  linkedin: Briefcase,
  email: Mail,
};

const PLATFORM_COLORS: Record<string, string> = {
  meta: 'bg-blue-50 border-blue-200 hover:border-blue-400',
  google: 'bg-red-50 border-red-200 hover:border-red-400',
  tiktok: 'bg-pink-50 border-pink-200 hover:border-pink-400',
  linkedin: 'bg-sky-50 border-sky-200 hover:border-sky-400',
  email: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
};

const PLATFORM_ICON_COLORS: Record<string, string> = {
  meta: 'text-blue-600',
  google: 'text-red-600',
  tiktok: 'text-pink-600',
  linkedin: 'text-sky-600',
  email: 'text-emerald-600',
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: 'Meta',
  google: 'Google Ads',
  tiktok: 'TikTok Ads',
  linkedin: 'LinkedIn Ads',
  email: 'Email',
};

const AccountSelector: React.FC<AccountSelectorProps> = ({ accounts, onSelect }) => {
  if (!accounts || accounts.length === 0) {
    return (
      <div className="my-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm font-commons text-amber-700">
        Bagli platform hesabi bulunamadi.
      </div>
    );
  }

  return (
    <div className="my-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
      {accounts.map((account, i) => {
        const Icon = PLATFORM_ICONS[account.platform] || Globe;
        const colors = PLATFORM_COLORS[account.platform] || 'bg-neutral-50 border-neutral-200';
        const iconColor = PLATFORM_ICON_COLORS[account.platform] || 'text-neutral-600';

        return (
          <motion.button
            key={account.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelect(account)}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left ${colors}`}
          >
            <div className={`w-9 h-9 rounded-lg bg-white/80 flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-commons font-semibold text-[#171717] truncate">
                {account.accountName || account.accountId}
              </p>
              <p className="text-xs font-commons text-neutral-500">
                {PLATFORM_LABELS[account.platform] || account.platform}
                {account.adAccountId && ` · ${account.adAccountId}`}
              </p>
            </div>
            <div className="flex-shrink-0">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-commons font-medium bg-green-100 text-green-700">
                Bagli
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

export default AccountSelector;
