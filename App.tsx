import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';
import { PairingScreen } from './screens/PairingScreen';
import { setupNotifications } from './notifications';

export default function App() {
  const { uid, loading } = useFirebaseAuth();

  useEffect(() => {
    setupNotifications();
  }, []);

  if (loading || !uid) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>{loading ? 'Loading...' : 'Firebase connection error. Check config.'}</Text>
      </View>
    );
  }
  return <PairingScreen uid={uid} />;
}
