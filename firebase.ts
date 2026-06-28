import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB1ynT9OknXikIviuXNL-6xU_u3NbFd1R0",
  authDomain: "indiamart-extension-notifier.firebaseapp.com",
  databaseURL: "https://indiamart-extension-notifier-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "indiamart-extension-notifier",
  storageBucket: "indiamart-extension-notifier.firebasestorage.app",
  messagingSenderId: "797004741619",
  appId: "1:797004741619:web:9733864b41beafb10e3086"
};

const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getDatabase(app);
