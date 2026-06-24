import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLeadListener } from '../hooks/useLeadListener';

interface Props {
  uid: string;
}

export function HomeScreen({ uid }: Props) {
  useLeadListener(uid);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>✓</Text>
      <Text style={styles.title}>Phone Paired</Text>
      <Text style={styles.subtitle}>
        Listening for lead notifications.{'\n'}Keep this app open in the background.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 12 },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#555', lineHeight: 24 },
});
