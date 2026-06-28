import { createNavigationContainerRef } from '@react-navigation/native';
import { LeadPayload } from './types/lead';

export type RootStackParamList = {
  Home: undefined;
  IncomingLead: { lead: LeadPayload };
  Settings: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToIncomingLead(lead: LeadPayload) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('IncomingLead', { lead });
  }
}
