import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bell,
  BellOff,
  CheckCheck,
  Loader2,
  Filter,
} from 'lucide-react';
import { useNotifications, getNotificationIcon, NotificationType } from '@/shared/hooks/useNotifications';

function getTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Az önce';
  if (diffMins < 60) return `${diffMins}dk önce`;
  if (diffHours < 24) return `${diffHours}sa önce`;
  if (diffDays === 1) return 'Dün';
  return `${diffDays}g önce`;
}

const typeLabels: Record<NotificationType, string> = {
  approval_pending: 'Onay',
  new_lead: 'Lead',
  workflow_step: 'Workflow',
  mention: 'Mention',
  social_media: 'Sosyal Medya',
  system: 'Sistem',
};

type ReadFilter = 'all' | 'unread' | 'read';
type TypeFilter = NotificationType | 'all';

const NotificationsListPage: React.FC = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      const matchesRead =
        readFilter === 'all' ||
        (readFilter === 'unread' && !n.read) ||
        (readFilter === 'read' && n.read);
      const matchesType = typeFilter === 'all' || n.type === typeFilter;
      return matchesRead && matchesType;
    });
  }, [notifications, readFilter, typeFilter]);

  const handleClick = async (notification: typeof notifications[0]) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const readFilterOptions: { value: ReadFilter; label: string }[] = [
    { value: 'all', label: 'Tümü' },
    { value: 'unread', label: 'Okunmamış' },
    { value: 'read', label: 'Okunmuş' },
  ];

  const typeOptions = (Object.keys(typeLabels) as NotificationType[]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
            Bildirimler
          </h1>
          <p className="font-grotesk text-neutral-500 mt-1 text-sm">
            {unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : 'Tüm bildirimler okunmuş'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-200 text-neutral-700 rounded-full font-grotesk text-sm hover:bg-neutral-50 transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Tümünü Okundu İşaretle
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-neutral-400 flex-shrink-0" />
        {/* Read filter */}
        {readFilterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setReadFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full font-grotesk text-xs font-medium transition-colors ${
              readFilter === opt.value
                ? 'bg-[#171717] text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="text-neutral-300">|</span>
        {/* Type filter */}
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 rounded-full font-grotesk text-xs font-medium transition-colors ${
            typeFilter === 'all'
              ? 'bg-[#171717] text-white'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          Tür: Tümü
        </button>
        {typeOptions.map((type) => {
          const count = notifications.filter((n) => n.type === type).length;
          if (count === 0) return null;
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(type === typeFilter ? 'all' : type)}
              className={`px-3 py-1.5 rounded-full font-grotesk text-xs font-medium transition-colors ${
                typeFilter === type
                  ? 'bg-[#171717] text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {getNotificationIcon(type)} {typeLabels[type]}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <BellOff className="w-10 h-10 text-neutral-300" />
            <p className="font-grotesk text-neutral-500">
              {readFilter !== 'all' || typeFilter !== 'all'
                ? 'Bu filtreyle eşleşen bildirim yok.'
                : 'Henüz bildirim yok.'}
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="divide-y divide-neutral-50">
            {filtered.map((notification, i) => (
              <motion.button
                key={notification.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
                onClick={() => handleClick(notification)}
                className={`w-full text-left px-5 py-4 hover:bg-neutral-50 transition-colors ${
                  !notification.read ? 'bg-blue-50/30' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <span className="text-xl flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className={`font-grotesk text-sm font-semibold ${
                        !notification.read ? 'text-[#171717]' : 'text-neutral-600'
                      }`}>
                        {notification.title}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-grotesk text-xs text-neutral-400">
                          {getTimeAgo(notification.createdAt)}
                        </span>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    <p className="font-grotesk text-sm text-neutral-500 mt-0.5">
                      {notification.message}
                    </p>
                    <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full font-grotesk text-xs ${
                      !notification.read
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}>
                      {typeLabels[notification.type]}
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsListPage;
