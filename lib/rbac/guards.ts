import { User } from '@/shared/types/user';
import { ROLES } from './roles';
import { Permission } from './permissions';

export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false;

  const roleConfig = ROLES[user.role];
  if (!roleConfig) return false;

  // Check role permissions
  if (roleConfig.permissions.includes(permission)) {
    return true;
  }

  // Check additional custom permissions
  if (user.permissions?.includes(permission)) {
    return true;
  }

  return false;
}

export function hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

export function hasAllPermissions(user: User | null, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(user, p));
}

export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin';
}

export function isStaff(user: User | null): boolean {
  return user?.role === 'staff' || user?.role === 'admin';
}

export function isClient(user: User | null): boolean {
  return user?.role === 'client';
}

export function isFreelancer(user: User | null): boolean {
  return user?.role === 'freelancer';
}

// Resource-level permission checking
export function canAccessProject(
  user: User | null,
  project: { clientId: string; team?: { freelancers?: Array<{ userId: string }> } }
): boolean {
  if (!user) return false;

  // Admins can access all
  if (user.role === 'admin') return true;

  // Staff can access all projects
  if (user.role === 'staff') return true;

  // Clients can only access their own projects
  if (user.role === 'client') {
    return project.clientId === user.uid;
  }

  // Freelancers can only access assigned projects
  if (user.role === 'freelancer') {
    return project.team?.freelancers?.some((f) => f.userId === user.uid) ?? false;
  }

  return false;
}
