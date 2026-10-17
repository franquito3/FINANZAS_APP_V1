import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PowerSyncContext } from '@powersync/react-native';
import { AuthProvider } from '../context/AuthContext';
import { db } from '../db/powersync';
import { validateEnv } from '../config/env';

export default function RootLayout() {
  useEffect(() => {
    validateEnv();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PowerSyncContext.Provider value={db}>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="auth/callback" />
            </Stack>
            <StatusBar style="light" />
          </AuthProvider>
        </PowerSyncContext.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
