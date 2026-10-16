import * as SecureStore from 'expo-secure-store';

/**
 * Storage adapter for Supabase using hardware-backed encryption (iOS Keychain / Android Keystore)
 * Replaces plain-text AsyncStorage to ensure Refresh Tokens and Session keys remain secure.
 */
export const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('[SecureStoreAdapter] Error reading key:', key, error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('[SecureStoreAdapter] Error setting key:', key, error);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('[SecureStoreAdapter] Error removing key:', key, error);
    }
  },
};
