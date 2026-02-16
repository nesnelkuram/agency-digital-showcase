import { Timestamp } from 'firebase/firestore';

export type TenantStatus = 'active' | 'suspended' | 'trial';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  settings: TenantSettings;
  metadata: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string;
  };
}

export interface TenantSettings {
  maxUsers: number;
  allowedFeatures: string[];
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    companyName?: string;
  };
  timezone?: string;
  currency?: string;
}

export interface CreateTenantData {
  name: string;
  slug: string;
  settings?: Partial<TenantSettings>;
}
