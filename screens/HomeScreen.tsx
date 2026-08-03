import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useLeadListener } from '../hooks/useLeadListener';
import { useLeadHistory } from '../hooks/useLeadHistory';
import { LeadDetailModal } from '../components/LeadDetailModal';
import { LeadPayload } from '../types/lead';
import { HomeLog } from '../logger';
import { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ email, navigation }: Props & { email: string | null }) {
  useLeadListener(email);

  const { groups, loading, loadingMore, error, hasMore, refresh, loadMore } = useLeadHistory(email);
  const [selectedLead, setSelectedLead] = useState<LeadPayload | null>(null);

  useEffect(() => {
    HomeLog.log('HomeScreen mounted, listening for leads. account:', email);
    return () => HomeLog.log('HomeScreen unmounted');
  }, [email]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const sections = groups.map((g) => ({ title: g.label, data: g.leads }));

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>Listening for Leads</Text>
          <Text style={styles.bannerSubtitle}>
            Leads purchased on your PC will alert this phone.
          </Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {loading && sections.length === 0 ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" />
        </View>
      ) : error && sections.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>No leads yet — purchased leads will show up here.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item.id ?? `${item.timestamp}-${index}`}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <LeadTile lead={item} onPress={() => setSelectedLead(item)} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.loadMoreText}>Load more</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </View>
  );
}

function LeadTile({ lead, onPress }: { lead: LeadPayload; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.tileTitle} numberOfLines={1}>{lead.title}</Text>
      <View style={styles.tileRow}>
        <Text style={styles.tileMeta}>{lead.city ?? '—'}</Text>
        <Text style={styles.tileMeta}>{lead.quantity ? `Qty: ${lead.quantity}` : '—'}</Text>
        <Text style={styles.tileMeta}>{lead.price != null ? `₹${lead.price.toLocaleString()}` : '—'}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  bannerText: { flex: 1, marginRight: 12 },
  bannerTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  bannerSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  settingsBtn: { padding: 4 },
  settingsIcon: { fontSize: 22 },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 14, color: '#b91c1c', marginBottom: 12, textAlign: 'center' },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#0f172a', borderRadius: 10 },
  retryText: { color: '#ffffff', fontWeight: '600' },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  listContent: { padding: 16 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 12,
    marginBottom: 6,
  },
  tile: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  tileTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 6 },
  tileRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tileMeta: { fontSize: 13, color: '#475569' },
  loadMoreBtn: { paddingVertical: 14, alignItems: 'center' },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
});
