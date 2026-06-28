import { useState, useEffect } from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

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

export interface GoogleAuthState {
  uid: string | null;
  email: string | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

export function useGoogleAuth(): GoogleAuthState {
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
      console.log('[GoogleAuth] hasPlayServices:', hasPlay);
      const response = await GoogleSignin.signIn();
      console.log('[GoogleAuth] signIn response:', JSON.stringify(response));
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error('No ID token from Google');
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (e: any) {
      console.log('[GoogleAuth] error code:', e.code);
      console.log('[GoogleAuth] error message:', e.message);
      console.log('[GoogleAuth] full error:', JSON.stringify(e));
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

  return { uid, email, loading, signIn, signOut, error };
}
