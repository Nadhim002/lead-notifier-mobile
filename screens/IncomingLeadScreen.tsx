import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  StatusBar,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'IncomingLead'>;

export function IncomingLeadScreen({ route, navigation }: Props) {
  const { lead } = route.params;

  const handleCall = () => {
    if (!lead.buyerMobile) return;
    Linking.openURL(`tel:${lead.buyerMobile}`);
  };

  const handleDismiss = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.incomingLabel}>New Lead</Text>
        <Text style={styles.title} numberOfLines={3}>{lead.title}</Text>

        <View style={styles.detailsCard}>
          {lead.buyerName ? (
            <DetailRow label="Buyer" value={lead.buyerName} />
          ) : null}
          {lead.quantity ? (
            <DetailRow label="Quantity" value={lead.quantity} />
          ) : null}
          {lead.city || lead.state ? (
            <DetailRow
              label="Location"
              value={[lead.city, lead.state].filter(Boolean).join(', ')}
            />
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.dismissBtn]}
          onPress={handleDismiss}
          activeOpacity={0.8}
        >
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.callBtn, !lead.buyerMobile && styles.disabledBtn]}
          onPress={handleCall}
          disabled={!lead.buyerMobile}
          activeOpacity={0.8}
        >
          <Text style={styles.callText}>
            {lead.buyerMobile ? 'Call Buyer' : 'No Number'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 28,
    paddingTop: 60,
  },
  incomingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4ade80',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
    textAlign: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 34,
  },
  detailsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rowLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
    minWidth: 80,
  },
  rowValue: {
    fontSize: 14,
    color: '#e2e8f0',
    flex: 1,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    padding: 24,
    gap: 16,
    paddingBottom: 40,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtn: {
    backgroundColor: '#334155',
  },
  callBtn: {
    backgroundColor: '#16a34a',
    elevation: 4,
  },
  disabledBtn: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  dismissText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  callText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
