import { Persistence } from 'firebase/auth';

// getReactNativePersistence exists at runtime in @firebase/auth's RN bundle
// but is absent from the TypeScript declarations in firebase v12.
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: object): Persistence;
}
