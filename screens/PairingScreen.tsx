import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { usePairingCode } from '../hooks/usePairingCode';

interface Props {
  uid: string;
}

export function PairingScreen({ uid }: Props) {
  const { code, secondsLeft, refresh } = usePairingCode(uid);
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pair Your Phone</Text>
      <Text style={styles.instructions}>
        Type this code into the Chrome extension to connect your phone.
      </Text>
      <View style={styles.codeBox}>
        <Text style={styles.code}>{code ?? '......'}</Text>
      </View>
      <Text style={styles.timer}>
        Expires in {minutes}:{String(seconds).padStart(2, '0')}
      </Text>
      <TouchableOpacity style={styles.button} onPress={refresh}>
        <Text style={styles.buttonText}>Generate New Code</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  instructions: { fontSize: 16, textAlign: 'center', color: '#555', marginBottom: 32 },
  codeBox: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 40,
    marginBottom: 16,
  },
  code: { fontSize: 40, fontWeight: 'bold', letterSpacing: 8, color: '#1a1a1a' },
  timer: { fontSize: 14, color: '#888', marginBottom: 24 },
  button: { backgroundColor: '#007AFF', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
  buttonText: { color: '#fff', fontSize: 16 },
});
