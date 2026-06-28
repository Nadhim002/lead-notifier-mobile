import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useGoogleAuth } from '../hooks/useGoogleAuth';

export function SignInScreen() {
  const { signIn, loading, error } = useGoogleAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4285f4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lead Notifier</Text>
      <Text style={styles.subtitle}>
        Sign in with the same Google account on your phone and PC to receive lead alerts instantly.
      </Text>
      <TouchableOpacity style={styles.googleButton} onPress={signIn} activeOpacity={0.85}>
        <Text style={styles.googleButtonText}>Sign in with Google</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8faff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    maxWidth: 300,
  },
  googleButton: {
    backgroundColor: '#4285f4',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    elevation: 2,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    marginTop: 16,
    color: '#dc2626',
    fontSize: 13,
    textAlign: 'center',
  },
});
