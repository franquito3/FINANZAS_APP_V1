import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../services/supabase/client';
import { THEME } from '../../constants';

/**
 * Deep-link callback target for `proyectox://auth/callback`.
 * Exchanges the PKCE authorization code if the OS routed the deep link directly into the app,
 * then navigates back to the main tabs.
 */
export default function AuthCallbackRoute() {
  const params = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
  }>();

  useEffect(() => {
    (async () => {
      try {
        if (typeof params.code === 'string' && params.code) {
          await supabase.auth.exchangeCodeForSession(params.code);
        } else if (
          typeof params.access_token === 'string' &&
          typeof params.refresh_token === 'string'
        ) {
          await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
        }
      } catch (e) {
        console.warn('[AuthCallback] Handled by in-app browser session:', e);
      } finally {
        router.replace('/(tabs)/auth');
      }
    })();
  }, [params.code, params.access_token, params.refresh_token]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={THEME.colors.primary} />
      <Text style={styles.text}>Completando inicio de sesión...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
});
