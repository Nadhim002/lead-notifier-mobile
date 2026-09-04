import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../firebase';
import { AuthLog } from '../logger';

// ─────────────────────────────────────────────────────────────────────────────
// SETUP: In Firebase Console → Authentication → Sign-in method → Google
// Enable Google provider. Under "Web SDK configuration", copy the
// "Web client ID" and paste it below.
// Also add the google-services.json to your Expo project (see AGENTS.md).
// ─────────────────────────────────────────────────────────────────────────────
const WEB_CLIENT_ID = '797004741619-lko4nhlrpj19f5utno4f8721gfeheqto.apps.googleusercontent.com';

GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
  offlineAccess: false,
  scopes: ['openid', 'email', 'profile'],
});

export interface AuthState {
  uid: string | null;
  email: string | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthState | null>(null);

// Owns the one and only auth-state subscription for the app. Previously each of
// App, SignInScreen, and SettingsScreen called useGoogleAuth() and mounted its
// own onAuthStateChanged listener; now a single provider holds it and every
// screen reads the same session via useAuth().
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setEmail(user?.email ?? null);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async () => {
    setError(null);
    try {
      const hasPlay = await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      AuthLog.log('hasPlayServices:', hasPlay);
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error('No ID token from Google');
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (e: any) {
      AuthLog.error('sign-in failed:', e?.code, e?.message);
      if (e.code === statusCodes.SIGN_IN_CANCELLED) return;
      if (e.code === statusCodes.IN_PROGRESS) return;
      setError(e.message ?? 'Sign-in failed');
    }
  };

  // Email/password is a secondary sign-in path. Google's own review
  // infrastructure frequently fails to complete a Google Sign-In (device
  // verification challenges on fresh accounts), so the Play reviewer account
  // uses this instead. Everything downstream keys off auth.token.email, which
  // Firebase populates identically for both providers — so the entitlement
  // check, the accounts/{sanitizedEmail} path, and the database rules all
  // behave exactly as they do for a Google user.
  const signInWithEmail = async (emailAddress: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, emailAddress.trim().toLowerCase(), password);
    } catch (e: any) {
      AuthLog.error('email sign-in failed:', e?.code, e?.message);
      setError('Sign-in failed. Check your email and password.');
    }
  };

  const signOut = async () => {
    // Run independently: a Google-side failure (e.g. already signed out,
    // network hiccup) must not prevent the Firebase session from ending too.
    const results = await Promise.allSettled([GoogleSignin.signOut(), firebaseSignOut(auth)]);
    const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failure) {
      AuthLog.error('sign-out failed:', failure.reason);
      setError(failure.reason?.message ?? 'Sign-out failed');
    } else {
      setError(null);
    }
  };

  return (
    <AuthContext.Provider value={{ uid, email, loading, signIn, signInWithEmail, signOut, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
