import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { THEME, APP_CONFIG } from '../constants';
import { isSupabaseConfigured } from '../config/env';
import { db } from '../db/powersync';

export const AuthScreen: React.FC = () => {
  const { session, user, isLoading, signInWithGoogle, signOut } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured()) {
      Alert.alert(
        'Configuración Requerida',
        'Configure EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en el archivo .env y reinicie el servidor de desarrollo.'
      );
      return;
    }

    setIsSubmitting(true);
    const { error } = await signInWithGoogle();
    setIsSubmitting(false);

    if (error) {
      Alert.alert('Error de Autenticación', error.message);
    }
  };

  const doSignOut = async () => {
    setIsSubmitting(true);
    const { error } = await signOut();
    setIsSubmitting(false);
    if (error) {
      Alert.alert('Error al cerrar sesión', error.message);
    }
  };

  const handleSignOut = async () => {
    // Signing out wipes the local database; warn if there are unsynced changes
    let pending = 0;
    try {
      pending = (await db.getUploadQueueStats()).count ?? 0;
    } catch {
      // ignore
    }

    if (pending > 0) {
      Alert.alert(
        'Cambios sin sincronizar',
        `Tienes ${pending} cambio(s) que aún no se han subido a la nube. Si cierras sesión ahora se perderán. Conéctate a internet y espera a que se sincronicen.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cerrar sesión igualmente', style: 'destructive', onPress: doSignOut },
        ]
      );
      return;
    }
    await doSignOut();
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Fase 2: Autenticación</Text>
        </View>
        <Text style={styles.title}>{APP_CONFIG.NAME}</Text>
        <Text style={styles.subtitle}>Gestión Financiera Segura con Google OAuth & RLS</Text>
      </View>

      <View style={styles.card}>
        {session && user ? (
          <View style={styles.sessionBox}>
            <Text style={styles.sessionStatus}>✓ Sesión Activa</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <Text style={styles.userId}>ID: {user.id}</Text>

            <TouchableOpacity
              style={[styles.button, styles.signOutButton]}
              onPress={handleSignOut}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signOutButtonText}>Cerrar Sesión</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.authBox}>
            <Text style={styles.authTitle}>Accede a tus Finanzas</Text>
            <Text style={styles.authDescription}>
              Inicia sesión de forma segura para sincronizar tus transacciones y presupuestos.
            </Text>

            <TouchableOpacity
              style={[styles.button, styles.googleButton]}
              onPress={handleGoogleLogin}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleButtonText}>Continuar con Google</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.securityNotice}>
              <Text style={styles.securityText}>
                🔒 Tokens cifrados con hardware (Keychain / Keystore)
              </Text>
              <Text style={styles.securityText}>
                🛡️ Aislamiento de datos con Row Level Security (RLS)
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  center: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
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
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  authBox: {
    alignItems: 'center',
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  authDescription: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  googleIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: THEME.colors.danger,
    marginTop: 20,
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sessionBox: {
    alignItems: 'center',
    gap: 8,
  },
  sessionStatus: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.success,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  userId: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontFamily: 'monospace',
  },
  securityNotice: {
    marginTop: 24,
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    gap: 8,
  },
  securityText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
});
