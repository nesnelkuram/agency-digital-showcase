import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { getAuth } from 'firebase/auth';
import { User, UserRole, Invitation, InvitationStatus, InvitationExtraFields } from '@/shared/types/user';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';

export interface InviteUserOptions {
  extraFields?: InvitationExtraFields;
  forceTwoFactor?: boolean;
  expiresInDays?: number;
  useTemporaryPassword?: boolean;
}

export interface InviteUserResult {
  temporaryPassword?: string;
}

interface UseUserManagementReturn {
  users: User[];
  invitations: Invitation[];
  loading: boolean;
  error: string | null;
  inviteUser: (
    email: string,
    displayName: string,
    role: UserRole,
    options?: InviteUserOptions
  ) => Promise<InviteUserResult>;
  updateUserRole: (uid: string, role: UserRole) => Promise<void>;
  updateUserStatus: (uid: string, status: 'active' | 'suspended') => Promise<void>;
  cancelInvitation: (invitationId: string) => Promise<void>;
  resendInvitation: (invitationId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useUserManagement(): UseUserManagementReturn {
  const { user: currentUser } = useAuth();
  const tenantId = useTenantId();
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!db) {
      setError('Firestore baglantisi kurulamadi');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch users and invitations in parallel
      const [usersSnapshot, invitationsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('tenantId', '==', tenantId), orderBy('metadata.createdAt', 'desc'))),
        getDocs(
          query(
            collection(db, 'invitations'),
            where('tenantId', '==', tenantId),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
          )
        ),
      ]);

      const usersList: User[] = [];
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        usersList.push({
          uid: doc.id,
          email: data.email || '',
          displayName: data.displayName || '',
          photoURL: data.photoURL,
          role: data.role || 'staff',
          organizationId: data.organizationId,
          permissions: data.permissions || [],
          status: data.status || 'active',
          metadata: {
            createdAt: data.metadata?.createdAt,
            updatedAt: data.metadata?.updatedAt,
            lastLoginAt: data.metadata?.lastLoginAt,
            invitedBy: data.metadata?.invitedBy,
          },
          profile: data.profile || {},
          settings: data.settings || {
            notifications: { email: true, push: true, approvalReminders: true },
          },
        } as User);
      });

      const invitationsList: Invitation[] = [];
      invitationsSnapshot.forEach((doc) => {
        const data = doc.data();
        invitationsList.push({
          id: doc.id,
          tenantId: data.tenantId || '',
          email: data.email || '',
          displayName: data.displayName || '',
          role: data.role || 'staff',
          status: data.status || 'pending',
          invitedBy: data.invitedBy || '',
          invitedByName: data.invitedByName || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          expiresAt: data.expiresAt?.toDate?.() || new Date(),
          acceptedAt: data.acceptedAt?.toDate?.(),
          extraFields: data.extraFields,
          forceTwoFactor: data.forceTwoFactor,
          expiresInDays: data.expiresInDays,
        });
      });

      setUsers(usersList);
      setInvitations(invitationsList);
    } catch (err) {
      console.error('[UserManagement] Error fetching data:', err);
      setError('Kullanici verileri yuklenirken bir hata olustu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const inviteUser = useCallback(
    async (
      email: string,
      displayName: string,
      role: UserRole,
      options?: InviteUserOptions
    ): Promise<InviteUserResult> => {
      if (!db || !currentUser) {
        throw new Error('Baglanti hatasi');
      }

      // Check if user already exists
      const existingUser = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );
      if (existingUser) {
        throw new Error('Bu email adresi zaten kayitli');
      }

      // Check if invitation already exists
      const existingInvitation = invitations.find(
        (i) => i.email.toLowerCase() === email.toLowerCase()
      );
      if (existingInvitation) {
        throw new Error('Bu email adresine zaten davetiye gonderilmis');
      }

      const expiresInDays = options?.expiresInDays ?? 7;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Strip undefined values from extraFields (Firestore rejects undefined)
      const cleanExtraFields = options?.extraFields
        ? Object.fromEntries(
            Object.entries(options.extraFields).filter(([, v]) => v !== undefined && v !== '')
          )
        : undefined;

      // Create invitation
      const invitationRef = doc(collection(db, 'invitations'));
      const invitationDoc: Record<string, any> = {
        tenantId,
        email: email.toLowerCase(),
        displayName,
        role,
        status: 'pending' as InvitationStatus,
        invitedBy: currentUser.uid,
        invitedByName: currentUser.displayName || currentUser.email,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        expiresInDays,
      };
      if (cleanExtraFields && Object.keys(cleanExtraFields).length > 0) {
        invitationDoc.extraFields = cleanExtraFields;
      }
      if (options?.forceTwoFactor) invitationDoc.forceTwoFactor = true;

      await setDoc(invitationRef, invitationDoc);

      // Send invitation email (or create temporary password) via API
      let temporaryPassword: string | undefined;
      try {
        const token = await getAuth().currentUser?.getIdToken();
        const emailRes = await fetch('/api/invite-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            invitationId: invitationRef.id,
            email: email.toLowerCase(),
            displayName,
            role,
            invitedByName: currentUser.displayName || currentUser.email,
            expiresInDays,
            useTemporaryPassword: options?.useTemporaryPassword === true,
          }),
        });
        if (!emailRes.ok) {
          const errBody = await emailRes.json().catch(() => ({}));
          console.error('[UserManagement] Email API error:', emailRes.status, errBody);
        } else {
          const body = await emailRes.json().catch(() => ({}));
          if (body?.temporaryPassword) temporaryPassword = body.temporaryPassword;
        }
      } catch (emailErr) {
        // Email failure should not block invitation creation
        console.warn('[UserManagement] Email send failed:', emailErr);
      }

      // Refetch to update the list
      await fetchData();
      return { temporaryPassword };
    },
    [db, currentUser, users, invitations, fetchData, tenantId]
  );

  const updateUserRole = useCallback(
    async (uid: string, role: UserRole) => {
      if (!db) throw new Error('Baglanti hatasi');

      await updateDoc(doc(db, 'users', uid), {
        role,
        'metadata.updatedAt': serverTimestamp(),
      });

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, role } : u))
      );
    },
    [db]
  );

  const updateUserStatus = useCallback(
    async (uid: string, status: 'active' | 'suspended') => {
      if (!db) throw new Error('Baglanti hatasi');

      await updateDoc(doc(db, 'users', uid), {
        status,
        'metadata.updatedAt': serverTimestamp(),
      });

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, status } : u))
      );
    },
    [db]
  );

  const cancelInvitation = useCallback(
    async (invitationId: string) => {
      if (!db) throw new Error('Baglanti hatasi');

      await updateDoc(doc(db, 'invitations', invitationId), {
        status: 'cancelled' as InvitationStatus,
      });

      // Update local state
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    },
    [db]
  );

  const resendInvitation = useCallback(
    async (invitationId: string) => {
      if (!db) throw new Error('Baglanti hatasi');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await updateDoc(doc(db, 'invitations', invitationId), {
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: serverTimestamp(),
      });

      // Find the invitation to get email/role details
      const invitation = invitations.find((i) => i.id === invitationId);
      if (invitation) {
        try {
          const token = await getAuth().currentUser?.getIdToken();
          const emailRes = await fetch('/api/invite-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              invitationId,
              email: invitation.email,
              displayName: invitation.displayName,
              role: invitation.role,
              invitedByName: currentUser?.displayName || currentUser?.email,
            }),
          });
          if (!emailRes.ok) {
            const errBody = await emailRes.json().catch(() => ({}));
            console.error('[UserManagement] Resend email API error:', emailRes.status, errBody);
          }
        } catch (emailErr) {
          console.warn('[UserManagement] Resend email failed:', emailErr);
        }
      }

      // Refetch to update the list
      await fetchData();
    },
    [db, invitations, currentUser, fetchData]
  );

  return {
    users,
    invitations,
    loading,
    error,
    inviteUser,
    updateUserRole,
    updateUserStatus,
    cancelInvitation,
    resendInvitation,
    refetch: fetchData,
  };
}
