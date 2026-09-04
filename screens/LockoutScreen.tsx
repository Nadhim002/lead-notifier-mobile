import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useAuth } from '../hooks/AuthProvider';
import { EntitlementReason } from '../entitlement';

const ADMIN_CONTACT_EMAIL = 'regentbagsown@gmail.com';

const COPY: Record<EntitlementReason, { title: string; body: string }> = {
  ok: { title: 'Locked', body: 'This account cannot use the app right now.' },
  'no-account': {
    title: 'No active subscription',
    body: 'This account isn’t activated yet. Contact the admin to get access.',
  },
  expired: {
    title: 'Subscription expired',
    body: 'Your subscription has expired. Contact the admin to renew and continue.',
  },
};

export function LockoutScreen({ reason }: { reason: EntitlementReason }) {
  const { email, signOut, error } = useAuth();
  const copy = COPY[reason] ?? COPY['no-account'];

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>

      <View style={styles.card}>
        {email && <Text style={styles.cardText}>Signed in as {email}</Text>}
        <TouchableOpacity onPress={() => Linking.openURL(`mailto:${ADMIN_CONTACT_EMAIL}`)}>
          <Text style={styles.link}>Contact admin: {ADMIN_CONTACT_EMAIL}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.8}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f8faff' },
  icon: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginBottom: 10, textAlign: 'center' },
  body: { fontSize: 15, textAlign: 'center', color: '#6b7280', lineHeight: 22, marginBottom: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 16,
  },
  cardText: { fontSize: 13, color: '#374151', marginBottom: 6, textAlign: 'center' },
  link: { fontSize: 13, color: '#2563eb', textAlign: 'center' },
  signOutBtn: { backgroundColor: '#ef4444', borderRadius: 12, padding: 14, alignItems: 'center', width: '100%' },
  signOutText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  error: { marginTop: 12, color: '#dc2626', fontSize: 13, textAlign: 'center' },
});
