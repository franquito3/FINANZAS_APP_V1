import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
    <SafeAreaProvider>
      <PowerSyncContext.Provider value={db}>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth/callback" />
          </Stack>
          <StatusBar style="dark" />
        </AuthProvider>
      </PowerSyncContext.Provider>
    </SafeAreaProvider>
  );
}
