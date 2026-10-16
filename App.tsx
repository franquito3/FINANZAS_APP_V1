import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { validateEnv } from './src/config/env';
import { APP_CONFIG, THEME } from './src/constants';

export default function App() {
  useEffect(() => {
    validateEnv();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Fase 1: Configurado</Text>
      </View>
      <Text style={styles.title}>{APP_CONFIG.NAME}</Text>
      <Text style={styles.subtitle}>Arquitectura Offline-First con React Native & Expo</Text>
      <View style={styles.card}>
        <Text style={styles.cardItem}>⚡ Continuous Native Generation (CNG)</Text>
        <Text style={styles.cardItem}>🔒 Supabase Backend & RLS Preparado</Text>
        <Text style={styles.cardItem}>📱 PowerSync + SQLite Local Engine</Text>
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  badge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
  },
  badgeText: {
    color: THEME.colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: THEME.colors.card,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardItem: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
  },
});
