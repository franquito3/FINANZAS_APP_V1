import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, SafeAreaView, TouchableOpacity, Text } from 'react-native';
import { validateEnv } from './src/config/env';
import { AuthProvider } from './src/context/AuthContext';
import { AuthScreen, OfflineSyncScreen } from './src/screens';
import { initPowerSync } from './src/db/powersync';
import { THEME } from './src/constants';

export default function App() {
  const [activeTab, setActiveTab] = useState<'sync' | 'auth'>('sync');

  useEffect(() => {
    validateEnv();
    initPowerSync();
  }, []);

  return (
    <AuthProvider>
      <SafeAreaView style={styles.safeArea}>
        {/* Navigation Tabs for Phase 2 & 3 inspection */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'sync' && styles.tabItemActive]}
            onPress={() => setActiveTab('sync')}
          >
            <Text
              style={[styles.tabText, activeTab === 'sync' && styles.tabTextActive]}
            >
              ⚡ Motor Offline (SQLite)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'auth' && styles.tabItemActive]}
            onPress={() => setActiveTab('auth')}
          >
            <Text
              style={[styles.tabText, activeTab === 'auth' && styles.tabTextActive]}
            >
              🔒 Autenticación
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {activeTab === 'sync' ? <OfflineSyncScreen /> : <AuthScreen />}
        </View>

        <StatusBar style="dark" />
      </SafeAreaView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: THEME.colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  tabTextActive: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
});
