import { Timestamp } from 'firebase/firestore';

export type UserRole = 'super_admin' | 'admin' | 'account_manager' | 'editor' | 'staff' | 'client' | 'freelancer';
export type UserStatus = 'active' | 'invited' | 'suspended';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface UserMetadata {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
  invitedBy?: string;
}

export type HourlyCurrency = 'TRY' | 'USD' | 'EUR';

export interface UserProfile {
  phone?: string;
  title?: string;
  department?: string;
  timezone?: string;
  // Davet wizard ek alanlari
  skills?: string[];                     // editor + freelancer
  hourlyRate?: number;                   // freelancer
  hourlyCurrency?: HourlyCurrency;       // freelancer
  clientCompany?: string;                // client
  billingEmail?: string;                 // client (fatura e-postasi ayri ise)
  assignedProjectIds?: string[];         // client, freelancer, editor
  managerId?: string;                    // ic roller icin
}

export interface InvitationExtraFields {
  phone?: string;
  title?: string;
  department?: string;
  skills?: string[];
  hourlyRate?: number;
  hourlyCurrency?: HourlyCurrency;
  clientCompany?: string;
  billingEmail?: string;
  assignedProjectIds?: string[];
  managerId?: string;
  tenantIds?: string[]; // super_admin icin coklu tenant
}

export interface UserSettings {
  notifications: {
    email: boolean;
    push: boolean;
    approvalReminders: boolean;
  };
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  tenantId: string;
  organizationId?: string;
  permissions: string[];
  status: UserStatus;
  metadata: UserMetadata;
  profile: UserProfile;
  settings: UserSettings;
}

export interface CreateUserData {
  email: string;
  displayName: string;
  role: UserRole;
  tenantId: string;
  organizationId?: string;
  extraFields?: InvitationExtraFields;
}

export interface Invitation {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: InvitationStatus;
  invitedBy: string;
  invitedByName: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  extraFields?: InvitationExtraFields;
  forceTwoFactor?: boolean;
  expiresInDays?: number;
}
