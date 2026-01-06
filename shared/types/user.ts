import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'staff' | 'client' | 'freelancer';
export type UserStatus = 'active' | 'invited' | 'suspended';

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
  organizationId?: string;
}
