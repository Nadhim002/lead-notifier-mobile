import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { useDeviceRegistration } from './hooks/useDeviceRegistration';
import { setupNotifications } from './notifications';
import { SignInScreen } from './screens/SignInScreen';
import { HomeScreen } from './screens/HomeScreen';
import { IncomingLeadScreen } from './screens/IncomingLeadScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { navigationRef, navigateToIncomingLead, RootStackParamList } from './navigation';
import { LeadPayload } from './types/lead';
import { AppLog } from './logger';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { uid, loading } = useGoogleAuth();
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useDeviceRegistration(uid, fcmToken);

  useEffect(() => {
    AppLog.log('App mounted');
    setupNotifications().then((token) => {
      if (token) {
        AppLog.log('FCM token ready');
        setFcmToken(token);
      }
    });
  }, []);

  // Handle notification taps when app is killed or backgrounded
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as unknown as LeadPayload;
      if (data?.title) {
        navigateToIncomingLead(data);
      }
    });
    return () => sub.remove();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {uid ? (
          <>
            <Stack.Screen name="Home">
              {(props) => <HomeScreen {...props} uid={uid} />}
            </Stack.Screen>
            <Stack.Screen
              name="IncomingLead"
              component={IncomingLeadScreen}
              options={{ presentation: 'fullScreenModal', animation: 'fade' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: true, title: 'Settings', headerBackTitle: 'Back' }}
            />
          </>
        ) : (
          <Stack.Screen name="Home" component={SignInScreen as any} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
