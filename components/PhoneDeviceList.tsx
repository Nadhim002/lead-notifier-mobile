import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, StyleSheet } from 'react-native';
import { relativeTime } from '../relativeTime';
import { PhoneView } from '../hooks/usePhoneDevices';

interface Props {
  phones: PhoneView[];
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

function Row({ phone, onRename, onRemove }: { phone: PhoneView } & Omit<Props, 'phones'>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(phone.name);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== phone.name) onRename(phone.id, next);
    setEditing(false);
  };

  const confirmRemove = () => {
    Alert.alert('Remove device?', `Remove "${phone.name}" from your account?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onRemove(phone.id) },
    ]);
  };

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        {editing ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={commit}
            onBlur={commit}
            autoFocus
            style={styles.input}
          />
        ) : (
          <>
            <Text style={styles.name}>
              {phone.name}
              {phone.isThisDevice ? ' · this device' : ''}
            </Text>
            <Text style={styles.sub}>Last active {relativeTime(phone.lastSeen)}</Text>
          </>
        )}
      </View>
      {!editing && (
        <>
          <TouchableOpacity onPress={() => { setDraft(phone.name); setEditing(true); }} style={styles.action}>
            <Text style={styles.actionText}>Rename</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={confirmRemove} style={styles.action}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

export function PhoneDeviceList({ phones, onRename, onRemove }: Props) {
  if (phones.length === 0) return <Text style={styles.empty}>No phones yet.</Text>;
  return (
    <View>
      {phones.map((p) => (
        <Row key={p.id} phone={p} onRename={onRename} onRemove={onRemove} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  info: { flex: 1, marginRight: 8 },
  name: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  sub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  input: { fontSize: 15, color: '#1f2937', borderBottomWidth: 1, borderColor: '#16a34a', paddingVertical: 2 },
  action: { paddingHorizontal: 8, paddingVertical: 4 },
  actionText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  removeText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  empty: { fontSize: 13, color: '#6b7280' },
});
