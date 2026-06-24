import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, onValue } from 'firebase/database';
import { db } from './firebase';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';
import { setupNotifications } from './notifications';
import { PairingScreen } from './screens/PairingScreen';
import { HomeScreen } from './screens/HomeScreen';

export default function App() {
  const { uid, loading } = useFirebaseAuth();
  const [isPaired, setIsPaired] = useState<boolean | null>(null);

  useEffect(() => {
    setupNotifications();
  }, []);

  useEffect(() => {
    if (!uid) return;

    let unsubFirebase: (() => void) | undefined;

    AsyncStorage.getItem('isPaired').then(val => {
      if (val === 'true') {
        setIsPaired(true);
        return;
      }
      const pairedRef = ref(db, `leads/${uid}/paired`);
      unsubFirebase = onValue(pairedRef, (snap) => {
        if (snap.exists()) {
          setIsPaired(true);
          AsyncStorage.setItem('isPaired', 'true');
        } else {
          setIsPaired(false);
        }
      });
    });

    return () => {
      if (unsubFirebase) unsubFirebase();
    };
  }, [uid]);

  if (loading || isPaired === null) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!uid) {
    return (
      <View style={styles.center}>
        <Text>Firebase connection error. Check your config.</Text>
      </View>
    );
  }

  return isPaired ? <HomeScreen uid={uid} /> : <PairingScreen uid={uid} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
