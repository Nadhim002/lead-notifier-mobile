import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, ScrollView } from 'react-native';
import { useAuth } from '../hooks/AuthProvider';
import { PhoneDeviceList } from '../components/PhoneDeviceList';
import { PhoneView } from '../hooks/usePhoneDevices';

const ADMIN_CONTACT_EMAIL = 'regentbagsown@gmail.com';

interface Props {
  phones: PhoneView[];
  maxPhones: number;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  deviceError?: string | null;
}

// Shown when the user is entitled but this phone has no seat (all phone slots
// are taken). Self-service: remove one of the listed phones — with its last
// active time — and this phone registers automatically.
export function DeviceLimitScreen({ phones, maxPhones, onRename, onRemove, deviceError }: Props) {
  const { signOut, error: signOutError } = useAuth();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.icon}>📵</Text>
      <Text style={styles.title}>Device limit reached ({phones.length}/{maxPhones})</Text>
      <Text style={styles.body}>
        You’ve reached your phone limit. Remove a device below to use this one, or contact the admin
        for more devices.
      </Text>

      <PhoneDeviceList phones={phones} onRename={onRename} onRemove={onRemove} />
      {deviceError ? <Text style={styles.error}>{deviceError}</Text> : null}

      <TouchableOpacity onPress={() => Linking.openURL(`mailto:${ADMIN_CONTACT_EMAIL}`)}>
        <Text style={styles.link}>Need more devices? Contact {ADMIN_CONTACT_EMAIL}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.8}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
      {signOutError ? <Text style={styles.error}>{signOutError}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8faff' },
  icon: { fontSize: 52, marginBottom: 12, textAlign: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 14, textAlign: 'center', color: '#6b7280', lineHeight: 20, marginBottom: 20 },
  link: { fontSize: 13, color: '#2563eb', textAlign: 'center', marginTop: 8 },
  signOutBtn: { backgroundColor: '#ef4444', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 20 },
  signOutText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  error: { marginTop: 8, color: '#dc2626', fontSize: 13, textAlign: 'center' },
});
