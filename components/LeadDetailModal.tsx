import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Linking, StyleSheet } from 'react-native';
import { LeadPayload } from '../types/lead';
import { isDummyLead } from '../dummyLead';
import { DummyLeadBadge } from './DummyLeadBadge';

type Props = {
  lead: LeadPayload | null;
  onClose: () => void;
};

export function LeadDetailModal({ lead, onClose }: Props) {
  if (!lead) return null;

  const dummy = isDummyLead(lead);

  const handleCall = () => {
    if (!lead.buyerMobile) return;
    Linking.openURL(`tel:${lead.buyerMobile}`);
  };

  const purchasedAt = lead.timestamp ? new Date(lead.timestamp).toLocaleString() : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, dummy && styles.cardDummy]}>
          <View style={styles.header}>
            <View style={styles.titleGroup}>
              <Text style={styles.title} numberOfLines={3}>{lead.title}</Text>
              {dummy ? <DummyLeadBadge /> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.details}>
            {lead.buyerName ? <DetailRow label="Buyer" value={lead.buyerName} /> : null}
            {lead.buyerMobile ? <DetailRow label="Mobile" value={lead.buyerMobile} /> : null}
            {lead.quantity ? <DetailRow label="Quantity" value={lead.quantity} /> : null}
            {lead.price != null ? (
              <DetailRow label="Price" value={`₹${lead.price.toLocaleString()}`} />
            ) : null}
            {lead.city || lead.state ? (
              <DetailRow label="Location" value={[lead.city, lead.state].filter(Boolean).join(', ')} />
            ) : null}
            {purchasedAt ? <DetailRow label="Purchased" value={purchasedAt} /> : null}
          </ScrollView>

          <TouchableOpacity
            style={[styles.callBtn, !lead.buyerMobile && styles.callBtnDisabled]}
            onPress={handleCall}
            disabled={!lead.buyerMobile}
          >
            <Text style={styles.callText}>{lead.buyerMobile ? 'Call Buyer' : 'No Number'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  cardDummy: {
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleGroup: {
    flex: 1,
    marginRight: 12,
    gap: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  closeIcon: {
    fontSize: 20,
    color: '#64748b',
  },
  details: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rowLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    minWidth: 80,
  },
  rowValue: {
    fontSize: 14,
    color: '#0f172a',
    flex: 1,
    textAlign: 'right',
  },
  callBtn: {
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#16a34a',
  },
  callBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  callText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
