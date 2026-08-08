import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  variant?: 'light' | 'dark';
};

// Marks a lead as synthetic/test data (see dummyLead.ts). Shown on every
// surface a lead can render on — home list tile, detail modal, and the
// full-screen incoming-call screen — so a test lead is never mistaken for a
// real purchase.
export function DummyLeadBadge({ variant = 'light' }: Props) {
  return (
    <View style={[styles.badge, variant === 'dark' && styles.badgeDark]}>
      <Text style={[styles.text, variant === 'dark' && styles.textDark]}>Test Lead</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f59e0b',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  badgeDark: {
    backgroundColor: '#b45309',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  textDark: {
    color: '#fef3c7',
  },
});
