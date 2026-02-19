import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCheck, Loader2, BellOff } from 'lucide-react';
import { useNotifications, getNotificationIcon } from '@/shared/hooks/useNotifications';

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

const NotificationDropdown: React.FC = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    setOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-neutral-500 hover:text-neutral-800 hover:bg-white/40 rounded-xl transition-all"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-80 bg-white rounded-2xl border border-neutral-200 shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
              <p className="font-grotesk text-sm font-semibold text-[#171717]">
                Bildirimler
                {unreadCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full font-medium">
                    {unreadCount}
                  </span>
                )}
              </p>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 font-grotesk transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Tümünü okundu işaretle
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                </div>
              )}

              {!loading && notifications.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <BellOff className="w-8 h-8 text-neutral-300" />
                  <p className="font-grotesk text-sm text-neutral-400">Bildirim yok</p>
                </div>
              )}

              {!loading && notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors border-b border-neutral-50 last:border-0 ${
                    !notification.read ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-grotesk text-xs font-semibold ${!notification.read ? 'text-[#171717]' : 'text-neutral-600'}`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="font-grotesk text-xs text-neutral-500 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="font-grotesk text-[10px] text-neutral-400 mt-1">
                        {getTimeAgo(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-neutral-100">
                <button
                  onClick={() => { setOpen(false); navigate('/admin/notifications'); }}
                  className="w-full text-center font-grotesk text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  Tüm bildirimleri gör →
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationDropdown;
