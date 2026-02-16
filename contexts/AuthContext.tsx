import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase/config';
import { User } from '@/shared/types/user';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = useCallback(async (uid: string): Promise<User | null> => {
    if (!db) return null;
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          uid,
          ...data,
          tenantId: data.tenantId || data.organizationId || '',
        } as User;
      }
      return null;
    } catch (err) {
      console.error('Error fetching user data:', err);
      return null;
    }
  }, []);

  const updateLastLogin = useCallback(async (uid: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'users', uid), {
        'metadata.lastLoginAt': serverTimestamp(),
      });
    } catch (err) {
      console.error('Error updating last login:', err);
    }
  }, []);

  useEffect(() => {
    // If Firebase isn't configured, skip auth state listener
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        const userData = await fetchUserData(firebaseUser.uid);
        if (userData) {
          // Check if user is suspended
          if (userData.status === 'suspended') {
            await firebaseSignOut(auth);
            setUser(null);
            setError('Hesabınız askıya alınmış. Lütfen yönetici ile iletişime geçin.');
          } else {
            setUser(userData);
            setError(null);
          }
        } else {
          // User exists in Firebase Auth but not in Firestore
          setUser(null);
          setError('Kullanıcı profili bulunamadı.');
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [fetchUserData]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!auth) {
        setError('Firebase yapılandırılmamış. Lütfen yönetici ile iletişime geçin.');
        throw new Error('Firebase yapılandırılmamış.');
      }
      setLoading(true);
      setError(null);
      try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const userData = await fetchUserData(result.user.uid);

        if (!userData) {
          throw new Error('Kullanıcı profili bulunamadı.');
        }

        if (userData.status === 'suspended') {
          await firebaseSignOut(auth);
          throw new Error('Hesabınız askıya alınmış. Lütfen yönetici ile iletişime geçin.');
        }

        await updateLastLogin(result.user.uid);
        setUser(userData);
      } catch (err: any) {
        const errorMessage = getErrorMessage(err.code || err.message);
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [fetchUserData, updateLastLogin]
  );

  const signOut = useCallback(async () => {
    if (!auth) return;
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setError(null);
    } catch (err: any) {
      console.error('Error signing out:', err);
      setError('Çıkış yapılırken bir hata oluştu.');
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!auth) {
      setError('Firebase yapılandırılmamış.');
      throw new Error('Firebase yapılandırılmamış.');
    }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      const errorMessage = getErrorMessage(err.code);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (firebaseUser) {
      const userData = await fetchUserData(firebaseUser.uid);
      setUser(userData);
    }
  }, [firebaseUser, fetchUserData]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        error,
        signIn,
        signOut,
        resetPassword,
        refreshUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper function for error messages
function getErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/invalid-email':
      return 'Geçersiz email adresi.';
    case 'auth/user-disabled':
      return 'Bu hesap devre dışı bırakılmış.';
    case 'auth/user-not-found':
      return 'Bu email adresiyle kayıtlı kullanıcı bulunamadı.';
    case 'auth/wrong-password':
      return 'Yanlış şifre.';
    case 'auth/invalid-credential':
      return 'Geçersiz kimlik bilgileri.';
    case 'auth/too-many-requests':
      return 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.';
    case 'auth/network-request-failed':
      return 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.';
    default:
      return errorCode || 'Bir hata oluştu. Lütfen tekrar deneyin.';
  }
}
