import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../constants';
import { isSupabaseConfigured } from '../config/env';

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

  const handleSignOut = async () => {
    setIsSubmitting(true);
    const { error } = await signOut();
    setIsSubmitting(false);
    if (error) {
      Alert.alert('Error al cerrar sesión', error.message);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </View>
    );
  }

  return (
    <BottomSheetScrollView
      contentContainerStyle={styles.sheetContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sheetSectionTitle}>Sesión y Seguridad</Text>
        <View
          style={[
            styles.sessionPill,
            { backgroundColor: session && user ? '#DCFCE7' : '#F1F5F9' },
          ]}
        >
          <Text
            style={[
              styles.sessionPillText,
              { color: session && user ? '#15803D' : '#475569' },
            ]}
          >
            {session && user ? '● Nube Activa' : '● Modo Local'}
          </Text>
        </View>
      </View>

      {/* Main Identity Card inside Bottom Sheet */}
      <View style={styles.identityCard}>
        {session && user ? (
          <View>
            <Text style={styles.identityLabel}>CUENTA VINCULADA</Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user.email}
            </Text>
            <Text style={styles.userId}>UUID: {user.id}</Text>
            <Text style={styles.retentionNote}>
              Al cerrar sesión, tus transacciones y billeteras locales en SQLite se conservan intactas en este dispositivo.
            </Text>

            <TouchableOpacity
              style={[styles.actionBtn, styles.signOutBtn]}
              onPress={handleSignOut}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>Cerrar Sesión (Conservar Datos)</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.identityLabel}>RESPALDO EN LA NUBE</Text>
            <Text style={styles.authTitle}>Sincroniza con Google OAuth</Text>
            <Text style={styles.authDescription}>
              Vincula tu cuenta para respaldar tus movimientos en la nube con Supabase & PowerSync. Tus datos locales nunca se pierden.
            </Text>

            <TouchableOpacity
              style={styles.googleBtnWrapper}
              onPress={handleGoogleLogin}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#1E40AF', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.googleGradientBtn}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.buttonContent}>
                    <View style={styles.googleBadge}>
                      <Text style={styles.googleIcon}>G</Text>
                    </View>
                    <Text style={styles.actionBtnText}>Continuar con Google</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Security Architecture Cards */}
      <Text style={styles.subSectionTitle}>Arquitectura de Protección</Text>

      <View style={styles.securityCard}>
        <View style={[styles.secAvatar, { backgroundColor: '#7C3AED' }]}>
          <Text style={styles.secEmoji}>🔒</Text>
        </View>
        <View style={styles.secInfo}>
          <Text style={styles.secTitle}>Cifrado por Hardware (Keychain / Keystore)</Text>
          <Text style={styles.secDesc}>
            Tokens JWT resguardados mediante hardware seguro sin exposición en texto plano.
          </Text>
        </View>
      </View>

      <View style={styles.securityCard}>
        <View style={[styles.secAvatar, { backgroundColor: '#2563EB' }]}>
          <Text style={styles.secEmoji}>🛡️</Text>
        </View>
        <View style={styles.secInfo}>
          <Text style={styles.secTitle}>Row Level Security (RLS PostgreSQL)</Text>
          <Text style={styles.secDesc}>
            Aislamiento criptográfico por usuario en la nube y sincronización automática en segundo plano.
          </Text>
        </View>
      </View>

      <View style={styles.securityCard}>
        <View style={[styles.secAvatar, { backgroundColor: '#10B981' }]}>
          <Text style={styles.secEmoji}>💾</Text>
        </View>
        <View style={styles.secInfo}>
          <Text style={styles.secTitle}>Persistencia SQLite Permanente</Text>
          <Text style={styles.secDesc}>
            Tus registros permanecen almacenados en SQLite local incluso si cierras sesión o trabajas sin internet.
          </Text>
        </View>
      </View>
    </BottomSheetScrollView>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 36,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sessionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  sessionPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  identityCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  identityLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  authTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  authDescription: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  userEmail: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  userId: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  retentionNote: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 14,
  },
  googleBtnWrapper: {
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
  },
  googleGradientBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtn: {
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutBtn: {
    backgroundColor: '#EF4444',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIcon: {
    color: '#1E40AF',
    fontSize: 13,
    fontWeight: '900',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    gap: 12,
  },
  secAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secEmoji: {
    fontSize: 18,
  },
  secInfo: {
    flex: 1,
  },
  secTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  secDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16.5,
  },
});
