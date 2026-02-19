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

export interface UserProfile {
  phone?: string;
  title?: string;
  department?: string;
  timezone?: string;
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
}
