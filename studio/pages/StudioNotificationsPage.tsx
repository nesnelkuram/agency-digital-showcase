import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotificationsContext } from '@/admin/contexts/NotificationsContext';
import { studioLinkFor } from '../studioData';

/** Studio bildirim geçmişi — her bildirim ilgili marka/plana açılır */
const StudioNotificationsPage: React.FC = () => {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotificationsContext();
  const navigate = useNavigate();

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="font-grotesk text-2xl font-bold text-[#171717]">Bildirimler</h1>
        {unreadCount > 0 && (
          <button onClick={() => markAllAsRead()} className="font-grotesk text-sm text-neutral-600 underline">
            Tümünü okundu say
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <Bell className="w-8 h-8 text-neutral-300 mx-auto" />
          <p className="font-grotesk text-sm text-neutral-500 mt-2">Henüz bildirim yok.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={async () => {
                if (!n.read) await markAsRead(n.id);
                navigate(studioLinkFor(n));
              }}
              className={`w-full text-left bg-white border rounded-xl p-3 hover:border-neutral-300 ${n.read ? 'border-neutral-200' : 'border-amber-300'}`}
            >
              <p className="font-grotesk text-sm font-medium text-[#171717]">{n.title}</p>
              <p className="font-grotesk text-xs text-neutral-600 mt-0.5">{n.message}</p>
              <p className="font-grotesk text-[11px] text-neutral-400 mt-1">
                {n.createdAt.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudioNotificationsPage;
