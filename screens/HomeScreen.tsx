import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLeadListener } from '../hooks/useLeadListener';
import { HomeLog } from '../logger';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ uid, navigation }: Props & { uid: string }) {
  useLeadListener(uid);

  useEffect(() => {
    HomeLog.log('HomeScreen mounted, listening for leads. uid:', uid);
    return () => HomeLog.log('HomeScreen unmounted');
  }, [uid]);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')}>
        <Text style={styles.settingsIcon}>⚙️</Text>
      </TouchableOpacity>
      <Text style={styles.icon}>✓</Text>
      <Text style={styles.title}>Listening for Leads two</Text>
      <Text style={styles.subtitle}>
        Any leads purchased on your PC will alert this phone.{'\n'}Keep the app in the background.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f8faff' },
  settingsBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
  },
  settingsIcon: { fontSize: 24 },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
  subtitle: { fontSize: 15, textAlign: 'center', color: '#6b7280', lineHeight: 22 },
});
