import { Timestamp } from 'firebase/firestore';
import { ServiceCategory } from './services';

// ============================================
// CUSTOMER STATUS (Müşteri Durumu)
// ============================================

export type CustomerStatus = 'active' | 'inactive' | 'pending';

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: 'Aktif',
  inactive: 'Pasif',
  pending: 'Beklemede',
};

// ============================================
// SERVICE ITEM UNIT (Birim)
// ============================================

export type ServiceItemUnit = 'adet' | 'ay' | 'saat' | 'gun';

export const SERVICE_ITEM_UNIT_LABELS: Record<ServiceItemUnit, string> = {
  adet: 'Adet',
  ay: 'Ay',
  saat: 'Saat',
  gun: 'Gun',
};

// ============================================
// CUSTOMER SERVICE ITEM (Müşteriye Verilen Servis Kalemi)
// ============================================

export interface CustomerServiceItem {
  id: string;
  serviceCategory: ServiceCategory;
  serviceName: string;           // Özel servis adı (ör: "Instagram Yönetimi")
  description?: string;
  unitPrice: number;             // Birim fiyat
  quantity: number;              // Miktar (adet/ay)
  unit: ServiceItemUnit;
  totalPrice: number;            // unitPrice × quantity (otomatik)
}

// ============================================
// CUSTOMER (Müşteri)
// ============================================

export interface Customer {
  id: string;
  name: string;                  // Müşteri/Şirket adı
  contactPerson?: string;        // İletişim kişisi
  email?: string;
  phone?: string;

  // Servisler
  services: CustomerServiceItem[];

  // Hesaplanan değerler
  monthlyFee: number;            // Servislerin toplamı (otomatik)

  // Durum
  status: CustomerStatus;
  startDate?: Timestamp;         // Başlangıç tarihi
  notes?: string;

  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================
// CALCULATION HELPERS
// ============================================

/**
 * Servis kalemi toplam fiyatını hesaplar
 */
export function calculateServiceItemTotal(unitPrice: number, quantity: number): number {
  return Number((unitPrice * quantity).toFixed(2));
}

/**
 * Müşteri aylık fee'sini hesaplar (tüm servislerin toplamı)
 */
export function calculateCustomerMonthlyFee(services: CustomerServiceItem[]): number {
  return Number(
    services.reduce((sum, service) => sum + service.totalPrice, 0).toFixed(2)
  );
}

/**
 * Yeni servis kalemi oluşturur
 */
export function createServiceItem(
  serviceCategory: ServiceCategory,
  serviceName: string,
  unitPrice: number,
  quantity: number,
  unit: ServiceItemUnit
): CustomerServiceItem {
  return {
    id: crypto.randomUUID(),
    serviceCategory,
    serviceName,
    unitPrice,
    quantity,
    unit,
    totalPrice: calculateServiceItemTotal(unitPrice, quantity),
  };
}
