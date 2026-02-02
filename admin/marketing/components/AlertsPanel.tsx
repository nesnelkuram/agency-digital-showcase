import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellRing,
  AlertTriangle,
  Info,
  Shield,
  Eye,
  EyeOff,
  X,
  Check,
  ExternalLink,
  Wallet,
  TrendingDown,
  Truck,
  ClipboardCheck,
  RefreshCw,
} from 'lucide-react';
import type {
  MarketingAlert,
  AlertCategory,
  AlertSeverity,
  AlertStatus,
} from '@/shared/types/marketingAlert';
import {
  ALERT_SEVERITY_LABELS,
  ALERT_SEVERITY_COLORS,
  ALERT_CATEGORY_LABELS,
  ALERT_STATUS_LABELS,
} from '@/shared/types/marketingAlert';
import {
  getAlerts,
  getUnreadAlertCount,
  markAsRead,
  markAllAsRead,
  dismissAlert,
  resolveAlert,
} from '@/shared/services/alertService';
import { useAuth } from '@/contexts/AuthContext';

// ============================================
// PROPS
// ============================================

interface AlertsPanelProps {
  projectId?: string;
  maxAlerts?: number;
  compact?: boolean;
}

// ============================================
// FILTER TAB TYPES
// ============================================

type FilterTab = 'all' | 'budget' | 'performance' | 'delivery' | 'critical';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Tumu' },
  { key: 'budget', label: 'Butce' },
  { key: 'performance', label: 'Performans' },
  { key: 'delivery', label: 'Teslimat' },
  { key: 'critical', label: 'Kritik' },
];

// ============================================
// ICON HELPERS
// ============================================

function getSeverityIcon(severity: AlertSeverity): React.ReactNode {
  switch (severity) {
    case 'critical':
      return <AlertTriangle className="w-4 h-4 text-red-600" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    case 'info':
    default:
      return <Info className="w-4 h-4 text-blue-600" />;
  }
}

function getCategoryIcon(category: AlertCategory): React.ReactNode {
  switch (category) {
    case 'budget':
      return <Wallet className="w-3.5 h-3.5" />;
    case 'performance':
      return <TrendingDown className="w-3.5 h-3.5" />;
    case 'delivery':
      return <Truck className="w-3.5 h-3.5" />;
    case 'approval':
      return <ClipboardCheck className="w-3.5 h-3.5" />;
    case 'system':
      return <Shield className="w-3.5 h-3.5" />;
    default:
      return <Info className="w-3.5 h-3.5" />;
  }
}

// ============================================
// RELATIVE TIME HELPER
// ============================================

function getRelativeTime(timestamp: any): string {
  if (!timestamp) return '';

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Az once';
  if (diffMin < 60) return `${diffMin} dakika once`;
  if (diffHour < 24) return `${diffHour} saat once`;
  if (diffDay === 1) return 'Dun';
  if (diffDay < 7) return `${diffDay} gun once`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} hafta once`;
  return `${Math.floor(diffDay / 30)} ay once`;
}

// ============================================
// COMPONENT
// ============================================

const AlertsPanel: React.FC<AlertsPanelProps> = ({
  projectId,
  maxAlerts = 20,
  compact = false,
}) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<MarketingAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // ---- Data Loading ----

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const fetchLimit = compact ? 5 : maxAlerts;

      // Build filters based on active tab
      let categoryFilter: AlertCategory[] | undefined;
      let severityFilter: AlertSeverity[] | undefined;

      if (activeTab === 'budget') {
        categoryFilter = ['budget'];
      } else if (activeTab === 'performance') {
        categoryFilter = ['performance'];
      } else if (activeTab === 'delivery') {
        categoryFilter = ['delivery'];
      } else if (activeTab === 'critical') {
        severityFilter = ['critical'];
      }

      const filters = {
        ...(categoryFilter ? { category: categoryFilter } : {}),
        ...(severityFilter ? { severity: severityFilter } : {}),
      };

      const [alertData, count] = await Promise.all([
        getAlerts(projectId, Object.keys(filters).length > 0 ? filters : undefined, fetchLimit),
        getUnreadAlertCount(projectId),
      ]);

      setAlerts(alertData);
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, activeTab, maxAlerts, compact]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // ---- Actions ----

  const handleMarkAsRead = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      await markAsRead(alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status: 'read' as AlertStatus } : a))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      await dismissAlert(alertId);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId ? { ...a, status: 'dismissed' as AlertStatus } : a
        )
      );
      // If it was unread, decrement count
      const alert = alerts.find((a) => a.id === alertId);
      if (alert?.status === 'unread') {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (alertId: string) => {
    if (!user?.uid) return;
    setActionLoading(alertId);
    try {
      await resolveAlert(alertId, user.uid);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId ? { ...a, status: 'resolved' as AlertStatus } : a
        )
      );
      const alert = alerts.find((a) => a.id === alertId);
      if (alert?.status === 'unread') {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAllRead = async () => {
    setActionLoading('all');
    try {
      await markAllAsRead(projectId);
      setAlerts((prev) =>
        prev.map((a) =>
          a.status === 'unread' ? { ...a, status: 'read' as AlertStatus } : a
        )
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // ---- Filter visible alerts (exclude dismissed in compact) ----

  const visibleAlerts = compact
    ? alerts.filter((a) => a.status !== 'dismissed' && a.status !== 'resolved')
    : alerts;

  // ---- Render: Loading ----

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-neutral-400" />
          <div className="h-5 w-24 bg-neutral-100 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 bg-neutral-100 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-neutral-100 rounded w-3/4" />
                <div className="h-3 bg-neutral-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- Render: Main ----

  return (
    <div className="bg-white rounded-xl border border-neutral-200/50">
      {/* Header */}
      <div className="px-5 py-4 border-b border-neutral-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {unreadCount > 0 ? (
              <BellRing className="w-5 h-5 text-indigo-600" />
            ) : (
              <Bell className="w-5 h-5 text-neutral-400" />
            )}
            <h3 className="text-lg font-commons font-semibold text-[#171717]">
              Uyarilar
            </h3>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-commons font-bold rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={actionLoading === 'all'}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-commons text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
              >
                <Eye className="w-3 h-3" />
                Tumunu Okundu Isaretle
              </button>
            )}
            <button
              onClick={loadAlerts}
              className="flex items-center gap-1 px-2 py-1.5 text-xs font-commons text-neutral-500 hover:text-neutral-700 transition-colors"
              title="Yenile"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs - only in non-compact mode */}
      {!compact && (
        <div className="px-5 py-2 border-b border-neutral-100 flex gap-1 overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-commons font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Alert List */}
      <div className={compact ? 'max-h-[360px] overflow-y-auto' : 'max-h-[600px] overflow-y-auto'}>
        {visibleAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Bell className="w-10 h-10 text-neutral-200 mb-3" />
            <p className="text-sm font-commons text-neutral-500">
              Bildirim bulunmuyor
            </p>
            <p className="text-xs font-commons text-neutral-400 mt-1">
              Yeni uyarilar burada gorunecek
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {visibleAlerts.map((alert) => (
              <AlertItem
                key={alert.id}
                alert={alert}
                compact={compact}
                loading={actionLoading === alert.id}
                onMarkAsRead={handleMarkAsRead}
                onDismiss={handleDismiss}
                onResolve={handleResolve}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer: count summary */}
      {!compact && visibleAlerts.length > 0 && (
        <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/50">
          <p className="text-xs font-commons text-neutral-400">
            {visibleAlerts.length} uyari gosteriliyor
            {unreadCount > 0 && ` (${unreadCount} okunmamis)`}
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================
// ALERT ITEM SUB-COMPONENT
// ============================================

interface AlertItemProps {
  alert: MarketingAlert;
  compact: boolean;
  loading: boolean;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onResolve: (id: string) => void;
}

const AlertItem: React.FC<AlertItemProps> = ({
  alert,
  compact,
  loading,
  onMarkAsRead,
  onDismiss,
  onResolve,
}) => {
  const isUnread = alert.status === 'unread';
  const isResolved = alert.status === 'resolved';
  const isDismissed = alert.status === 'dismissed';

  return (
    <div
      className={`px-5 py-3.5 transition-colors ${
        isUnread
          ? 'bg-indigo-50/30 hover:bg-indigo-50/50'
          : isResolved
            ? 'bg-green-50/20 hover:bg-green-50/30'
            : isDismissed
              ? 'opacity-60 hover:opacity-80'
              : 'hover:bg-neutral-50/50'
      }`}
    >
      <div className="flex gap-3">
        {/* Severity Icon */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
            ALERT_SEVERITY_COLORS[alert.severity]
          }`}
        >
          {getSeverityIcon(alert.severity)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h4
                className={`text-sm font-commons leading-tight ${
                  isUnread ? 'font-bold text-[#171717]' : 'font-semibold text-[#171717]'
                }`}
              >
                {alert.title}
              </h4>
              {/* Category badge */}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded text-[10px] font-commons font-medium">
                {getCategoryIcon(alert.category)}
                {ALERT_CATEGORY_LABELS[alert.category]}
              </span>
              {/* Severity badge for critical */}
              {alert.severity === 'critical' && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-commons font-bold uppercase">
                  {ALERT_SEVERITY_LABELS[alert.severity]}
                </span>
              )}
            </div>
            {/* Status indicator */}
            {isResolved && (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-commons font-medium shrink-0">
                {ALERT_STATUS_LABELS.resolved}
              </span>
            )}
          </div>

          {/* Message */}
          <p className="text-xs font-commons text-neutral-600 mt-1 leading-relaxed">
            {alert.message}
          </p>

          {/* Campaign link */}
          {alert.campaignId && alert.campaignName && (
            <Link
              to={alert.actionUrl || `/admin/marketing/campaigns/${alert.campaignId}`}
              className="inline-flex items-center gap-1 text-xs font-commons text-indigo-600 hover:text-indigo-700 mt-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              {alert.campaignName}
            </Link>
          )}

          {/* Metric info */}
          {alert.metric && alert.currentValue !== undefined && alert.thresholdValue !== undefined && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11px] font-commons text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                {alert.metric}:{' '}
                <span className="font-semibold text-neutral-700">
                  {alert.metric.toLowerCase().includes('ctr') || alert.metric.toLowerCase().includes('oran')
                    ? `%${alert.currentValue.toFixed(2)}`
                    : alert.currentValue.toLocaleString()
                  }
                </span>
                {' → '}
                Esik:{' '}
                <span className="font-semibold text-neutral-700">
                  {alert.metric.toLowerCase().includes('ctr') || alert.metric.toLowerCase().includes('oran')
                    ? `%${alert.thresholdValue.toFixed(2)}`
                    : alert.thresholdValue.toLocaleString()
                  }
                </span>
              </span>
            </div>
          )}

          {/* Footer: time + actions */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] font-commons text-neutral-400">
              {getRelativeTime(alert.createdAt)}
            </span>

            {/* Action buttons */}
            {!compact && !isResolved && !isDismissed && (
              <div className="flex items-center gap-1">
                {isUnread && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      onMarkAsRead(alert.id);
                    }}
                    disabled={loading}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-commons text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
                    title="Okundu olarak isaretle"
                  >
                    <Eye className="w-3 h-3" />
                    Okundu
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onDismiss(alert.id);
                  }}
                  disabled={loading}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-commons text-neutral-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors disabled:opacity-50"
                  title="Kapat"
                >
                  <EyeOff className="w-3 h-3" />
                  Kapat
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onResolve(alert.id);
                  }}
                  disabled={loading}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-commons text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                  title="Cozuldu olarak isaretle"
                >
                  <Check className="w-3 h-3" />
                  Coz
                </button>
              </div>
            )}

            {/* Compact: just show a dismiss X */}
            {compact && !isResolved && !isDismissed && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onDismiss(alert.id);
                }}
                disabled={loading}
                className="p-1 text-neutral-400 hover:text-neutral-600 rounded transition-colors disabled:opacity-50"
                title="Kapat"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Unread dot indicator */}
        {isUnread && (
          <div className="shrink-0 mt-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsPanel;
