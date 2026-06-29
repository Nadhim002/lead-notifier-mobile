import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNotificationStyle, NotificationStyle } from '../hooks/useNotificationStyle';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { uid, email, signOut } = useGoogleAuth();
  const [style, setStyle] = useNotificationStyle(uid);

  const handleSignOut = async () => {
    await signOut();
    navigation.popToTop();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.section}>Notification Style</Text>

      <OptionRow
        label="Banner Notification"
        description="Vibration + sound alert at the top of the screen"
        selected={style === 'headsup'}
        onPress={() => setStyle('headsup')}
      />
      <OptionRow
        label="Phone Call Alert"
        description="Takes over the screen like an incoming call"
        selected={style === 'phonecall'}
        onPress={() => setStyle('phonecall')}
      />

      <Text style={styles.section}>Account</Text>
      <View style={styles.accountRow}>
        <Text style={styles.accountEmail}>{email ?? '—'}</Text>
      </View>
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function OptionRow({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.optionRow, selected && styles.optionSelected]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionDesc}>{description}</Text>
      </View>
      <Switch
        value={selected}
        onValueChange={onPress}
        trackColor={{ true: '#16a34a', false: '#d1d5db' }}
        thumbColor="#fff"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8faff',
    padding: 20,
  },
  section: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  optionText: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
    color: '#6b7280',
  },
  accountRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  accountEmail: {
    fontSize: 14,
    color: '#374151',
  },
  signOutBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
