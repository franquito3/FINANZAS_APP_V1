import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { THEME } from '../../constants';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME.colors.primary,
        tabBarInactiveTintColor: THEME.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: THEME.colors.card,
          borderTopColor: THEME.colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
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
