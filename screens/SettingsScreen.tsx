import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView, AppState } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNotificationStyle, NotificationStyle } from '../hooks/useNotificationStyle';
import { useAuth } from '../hooks/AuthProvider';
import { useDevicesContext } from '../hooks/DevicesContext';
import { PhoneDeviceList } from '../components/PhoneDeviceList';
import { PhonecallNotification } from '../modules/PhonecallNotification';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { email, signOut } = useAuth();
  const [style, setStyle] = useNotificationStyle(email);
  const devices = useDevicesContext();

  // Reliability extras (overlay, battery exemption) are optional and never
  // gate Phone Call style — only full-screen-intent does. These rows are
  // shown only while missing, and re-checked whenever the user returns to the
  // app (e.g. from the system settings screen these rows link to).
  const [overlayGranted, setOverlayGranted] = useState(true);
  const [batteryIgnored, setBatteryIgnored] = useState(true);

  const refreshReliabilityState = useCallback(() => {
    PhonecallNotification.canDrawOverlays().then(setOverlayGranted);
    PhonecallNotification.canIgnoreBatteryOptimizations().then(setBatteryIgnored);
  }, []);

  useEffect(() => {
    refreshReliabilityState();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshReliabilityState();
    });
    return () => sub.remove();
  }, [refreshReliabilityState]);

  const selectPhonecall = () => {
    setStyle('phonecall');
    // Only full-screen-intent gates Phone Call style; explains why and offers
    // to open settings if missing. Overlay and battery exemption are surfaced
    // separately below as skippable reliability improvements.
    PhonecallNotification.ensurePhonecallPermissions();
  };

  const handleSignOut = async () => {
    await signOut();
    navigation.popToTop();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
        onPress={selectPhonecall}
      />

      {style === 'phonecall' && (!overlayGranted || !batteryIgnored) ? (
        <>
          <Text style={styles.section}>Improve Reliability (Optional)</Text>
          {!overlayGranted ? (
            <ReliabilityRow
              label="Display over other apps"
              description="Recommended on Xiaomi, realme, vivo & OPPO phones — helps the call screen appear reliably in the background"
              onPress={() => PhonecallNotification.requestOverlayForReliability()}
            />
          ) : null}
          {!batteryIgnored ? (
            <ReliabilityRow
              label="Exempt from battery optimization"
              description="Prevents Android from delaying lead alerts to save battery"
              onPress={() => PhonecallNotification.requestIgnoreBatteryOptimizations()}
            />
          ) : null}
        </>
      ) : null}

      <Text style={styles.section}>
        My Phones ({devices.phoneCount}/{devices.maxPhones})
      </Text>
      <PhoneDeviceList
        phones={devices.phones}
        onRename={devices.renamePhone}
        onRemove={devices.removePhone}
      />

      <Text style={styles.section}>Account</Text>
      <View style={styles.accountRow}>
        <Text style={styles.accountEmail}>{email ?? '—'}</Text>
      </View>
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
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

function ReliabilityRow({
  label,
  description,
  onPress,
}: {
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.reliabilityRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.reliabilityLabel}>{label}</Text>
      <Text style={styles.reliabilityDesc}>{description}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8faff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
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
  reliabilityRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reliabilityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  reliabilityDesc: {
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
