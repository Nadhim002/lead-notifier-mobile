import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './hooks/AuthProvider';
import { useEntitlement } from './hooks/useEntitlement';
import { usePhoneDevices } from './hooks/usePhoneDevices';
import { DevicesProvider } from './hooks/DevicesContext';
import { LockoutScreen } from './screens/LockoutScreen';
import { DeviceLimitScreen } from './screens/DeviceLimitScreen';
import { setupNotifications } from './notifications';
import { PhonecallNotification } from './modules/PhonecallNotification';
import { SignInScreen } from './screens/SignInScreen';
import { HomeScreen } from './screens/HomeScreen';
import { IncomingLeadScreen } from './screens/IncomingLeadScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { navigationRef, navigateToIncomingLead, RootStackParamList } from './navigation';
import { LeadPayload } from './types/lead';
import { AppLog } from './logger';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppShell() {
  const { uid, email, loading } = useAuth();
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [navReady, setNavReady] = useState(false);

  const entitlement = useEntitlement(uid ? email : null);
  const devices = usePhoneDevices(uid ? email : null, fcmToken, entitlement);

  useEffect(() => {
    AppLog.log('App mounted');
    setupNotifications().then((token) => {
      if (token) {
        AppLog.log('FCM token ready');
        setFcmToken(token);
      }
    });
  }, []);

  // Handle notification taps when app is backgrounded
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as unknown as LeadPayload;
      if (data?.title) {
        navigateToIncomingLead(data);
      }
    });
    return () => sub.remove();
  }, []);

  // Handle cold-start: app launched by tapping a notification while killed
  useEffect(() => {
    if (!navReady) return;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as unknown as LeadPayload;
      if (data?.title) navigateToIncomingLead(data);
    });
    // Handle cold-start via fullscreen-intent (phonecall mode, killed state)
    // The intent carries lead data set by LeadNotificationService on the native side.
    PhonecallNotification.getInitialLeadData().then((leadJson) => {
      if (!leadJson) return;
      try {
        const lead = JSON.parse(leadJson) as LeadPayload;
        if (lead?.title) navigateToIncomingLead(lead);
      } catch {
        AppLog.warn('Failed to parse phonecall lead data from intent');
      }
    });
  }, [navReady]);

  // Warm tap: app already running and the user taps the phonecall heads-up.
  // MainActivity.onNewIntent refreshes the intent; re-read it when we foreground.
  useEffect(() => {
    if (!navReady) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      PhonecallNotification.getInitialLeadData().then((leadJson) => {
        if (!leadJson) return;
        try {
          const lead = JSON.parse(leadJson) as LeadPayload;
          if (lead?.title) navigateToIncomingLead(lead);
        } catch {
          AppLog.warn('Failed to parse phonecall lead data from intent');
        }
      });
    });
    return () => sub.remove();
  }, [navReady]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  if (!uid) {
    return <SignInScreen />;
  }

  // Signed in — resolve subscription before doing anything else (full lockout).
  if (!entitlement) {
    return (
      <View style={styles.center}>
        <Text>Checking subscription…</Text>
      </View>
    );
  }

  if (!entitlement.valid) {
    return <LockoutScreen reason={entitlement.reason} />;
  }

  // Entitled but this phone has no seat: self-service removal screen.
  if (devices.loaded && !devices.seatAvailable) {
    return (
      <DeviceLimitScreen
        phones={devices.phones}
        maxPhones={devices.maxPhones}
        onRename={devices.renamePhone}
        onRemove={devices.removePhone}
      />
    );
  }

  return (
    <DevicesProvider value={devices}>
      <NavigationContainer ref={navigationRef} onReady={() => setNavReady(true)}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home">
            {(props) => <HomeScreen {...props} email={email} />}
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
        </Stack.Navigator>
      </NavigationContainer>
    </DevicesProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
