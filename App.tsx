import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, SafeAreaView, TouchableOpacity, Text } from 'react-native';
import { validateEnv } from './src/config/env';
import { AuthProvider } from './src/context/AuthContext';
import { AuthScreen, DashboardScreen, OfflineSyncScreen } from './src/screens';
import { initPowerSync } from './src/db/powersync';
import { THEME } from './src/constants';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sync' | 'auth'>('dashboard');

  useEffect(() => {
    validateEnv();
    initPowerSync();
  }, []);

  return (
    <AuthProvider>
      <SafeAreaView style={styles.safeArea}>
        {/* Navigation Header Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'dashboard' && styles.tabItemActive]}
            onPress={() => setActiveTab('dashboard')}
          >
            <Text
              style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}
            >
              📊 Finanzas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'sync' && styles.tabItemActive]}
            onPress={() => setActiveTab('sync')}
          >
            <Text
              style={[styles.tabText, activeTab === 'sync' && styles.tabTextActive]}
            >
              ⚡ Offline Sync
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'auth' && styles.tabItemActive]}
            onPress={() => setActiveTab('auth')}
          >
            <Text
              style={[styles.tabText, activeTab === 'auth' && styles.tabTextActive]}
            >
              🔒 Sesión
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.content}>
          {activeTab === 'dashboard' && <DashboardScreen />}
          {activeTab === 'sync' && <OfflineSyncScreen />}
          {activeTab === 'auth' && <AuthScreen />}
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
    paddingHorizontal: 8,
    paddingTop: 6,
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
    fontSize: 12,
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
