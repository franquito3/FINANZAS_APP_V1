import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { THEME } from '../../constants';

export default function TabsLayout() {
  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync();
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME.colors.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F1F5F9',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 9,
          paddingTop: 7,
          elevation: 12,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Finanzas',
          tabBarIcon: ({ size }) => <Text style={{ fontSize: size - 4 }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reportes',
          tabBarIcon: ({ size }) => <Text style={{ fontSize: size - 4 }}>📄</Text>,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Offline',
          tabBarIcon: ({ size }) => <Text style={{ fontSize: size - 4 }}>⚡</Text>,
        }}
      />
      <Tabs.Screen
        name="auth"
        options={{
          title: 'Sesión',
          tabBarIcon: ({ size }) => <Text style={{ fontSize: size - 4 }}>🔒</Text>,
        }}
      />
    </Tabs>
  );
}
