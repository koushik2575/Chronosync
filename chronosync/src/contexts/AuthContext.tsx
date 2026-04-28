import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'employee' | 'user' | 'manager';
  hourlyRate?: number;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  appUser: AppUser | null;
  setAppUser: (user: AppUser | null) => void;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Fetch or create user in Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const data = userSnap.data() as AppUser;
          if (data.email === 'koushik2575@gmail.com' && data.role !== 'admin') {
             await setDoc(userRef, { role: 'admin' }, { merge: true });
             data.role = 'admin';
          }
          setAppUser({ uid: user.uid, ...data });
        } else {
          // Create new user (default role: employee, but admin for koushik)
          const newUser = {
            email: user.email!,
            name: user.displayName || 'Unknown User',
            role: user.email === 'koushik2575@gmail.com' ? 'admin' : 'employee',
            createdAt: Date.now()
          };
          // Try to create it. If it fails due to network, it will throw, but we should handle.
          try {
            await setDoc(userRef, newUser);
            setAppUser({ uid: user.uid, email: newUser.email, name: newUser.name, role: newUser.role as 'employee' });
          } catch (e) {
            console.error("Error creating user profile", e);
            // Sign out aggressively to prevent being stuck in a half-auth state
            await signOut(auth);
            setCurrentUser(null);
            setAppUser(null);
          }
        }
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = () => signOut(auth);

  const value = {
    currentUser,
    appUser,
    setAppUser,
    loading,
    signInWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
