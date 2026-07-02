import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
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

  const signOut = async () => {
    try {
      await GoogleSignin.signOut();
      await firebaseSignOut(auth);
    } catch (e: any) {
      setError(e.message ?? 'Sign-out failed');
    }
  };

  return (
    <AuthContext.Provider value={{ uid, email, loading, signIn, signOut, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
