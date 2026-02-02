import { Timestamp } from 'firebase/firestore';

// ============================================
// UYARI SEVIYELERI
// ============================================

export type AlertSeverity = 'info' | 'warning' | 'critical';

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  info: 'Bilgi',
  warning: 'Uyari',
  critical: 'Kritik',
};

export const ALERT_SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: 'text-blue-600 bg-blue-50',
  warning: 'text-amber-600 bg-amber-50',
  critical: 'text-red-600 bg-red-50',
};

// ============================================
// UYARI KATEGORILERI
// ============================================

export type AlertCategory = 'budget' | 'performance' | 'delivery' | 'approval' | 'system';

export const ALERT_CATEGORY_LABELS: Record<AlertCategory, string> = {
  budget: 'Butce',
  performance: 'Performans',
  delivery: 'Teslimat',
  approval: 'Onay',
  system: 'Sistem',
};

export const ALERT_CATEGORY_ICONS: Record<AlertCategory, string> = {
  budget: 'Wallet',
  performance: 'TrendingDown',
  delivery: 'Truck',
  approval: 'ClipboardCheck',
  system: 'Shield',
};

// ============================================
// UYARI DURUMLARI
// ============================================

export type AlertStatus = 'unread' | 'read' | 'dismissed' | 'resolved';

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  unread: 'Okunmadi',
  read: 'Okundu',
  dismissed: 'Kapatildi',
  resolved: 'Cozuldu',
};

// ============================================
// UYARI ENTITY
// ============================================

export interface MarketingAlert {
  id: string;
  projectId?: string;
  campaignId?: string;
  campaignName?: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  metric?: string;
  currentValue?: number;
  thresholdValue?: number;
  status: AlertStatus;
  actionUrl?: string;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
  createdAt: Timestamp;
}

// ============================================
// CRUD TIPLERI
// ============================================

export interface CreateAlertData {
  projectId?: string;
  campaignId?: string;
  campaignName?: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  metric?: string;
  currentValue?: number;
  thresholdValue?: number;
  actionUrl?: string;
}

export interface AlertFilters {
  status?: AlertStatus[];
  severity?: AlertSeverity[];
  category?: AlertCategory[];
  projectId?: string;
}
