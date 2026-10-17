import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../constants';
import { isSupabaseConfigured } from '../config/env';
import { db } from '../db/powersync';

export const AuthScreen: React.FC = () => {
  const { session, user, isLoading, signInWithGoogle, signOut } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      <LinearGradient
        colors={['#070D2D', '#161D65', '#351875']}
        style={styles.center}
      >
        <ActivityIndicator size="large" color="#38BDF8" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#070D2D', '#161D65', '#351875']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 0.55 }}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Hero Area */}
        <View style={styles.heroSection}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brandTitle}>ProyectoX</Text>
              <Text style={styles.brandSubtitle}>Sesión & Seguridad</Text>
            </View>

            <View style={styles.statusPill}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: session && user ? '#10B981' : '#38BDF8' },
                ]}
              />
              <Text style={styles.statusPillText}>
                {session && user ? 'ACTIVA' : 'LOCAL'}
              </Text>
            </View>
          </View>

          {/* Liquid Glass Identity Card */}
          <View style={styles.outerGlowWrapper}>
            <LinearGradient
              colors={[
                'rgba(56, 189, 248, 0.75)',
                'rgba(139, 92, 246, 0.45)',
                'rgba(56, 189, 248, 0.65)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientBorder}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 42 : 65}
                tint="dark"
                style={styles.blurContainer}
              >
                <LinearGradient
                  colors={[
                    'rgba(255, 255, 255, 0.14)',
                    'rgba(30, 41, 59, 0.38)',
                    'rgba(15, 23, 42, 0.52)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.innerGlass}
                >
                  {session && user ? (
                    <View>
                      <Text style={styles.glassLabel}>CUENTA SINCRONIZADA</Text>
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {user.email}
                      </Text>
                      <Text style={styles.userId}>UUID: {user.id}</Text>

                      <TouchableOpacity
                        style={[styles.glassActionBtn, styles.signOutGlassBtn]}
                        onPress={handleSignOut}
                        disabled={isSubmitting}
                        activeOpacity={0.78}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.glassActionText}>Cerrar Sesión Segura</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      <Text style={styles.glassLabel}>IDENTIDAD EN LA NUBE</Text>
                      <Text style={styles.authTitle}>Accede a tus Finanzas</Text>
                      <Text style={styles.authDescription}>
                        Inicia sesión con Google OAuth para respaldar tus billeteras y presupuestos en la nube con cifrado extremo.
                      </Text>

                      <TouchableOpacity
                        style={styles.glassActionBtn}
                        onPress={handleGoogleLogin}
                        disabled={isSubmitting}
                        activeOpacity={0.78}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <View style={styles.buttonContent}>
                            <View style={styles.googleBadge}>
                              <Text style={styles.googleIcon}>G</Text>
                            </View>
                            <Text style={styles.glassActionText}>Continuar con Google</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </LinearGradient>
              </BlurView>
            </LinearGradient>
          </View>
        </View>

        {/* Bottom White Sheet (borderTopRadius: 32) */}
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />

          <Text style={styles.sheetSectionTitle}>Arquitectura de Protección</Text>

          <View style={styles.securityCard}>
            <View style={[styles.secAvatar, { backgroundColor: '#2563EB' }]}>
              <Text style={styles.secEmoji}>🔒</Text>
            </View>
            <View style={styles.secInfo}>
              <Text style={styles.secTitle}>Almacenamiento Cifrado por Hardware</Text>
              <Text style={styles.secDesc}>
                Los tokens JWT se resguardan mediante iOS Keychain y Android Keystore con fragmentación segura en bloques.
              </Text>
            </View>
          </View>

          <View style={styles.securityCard}>
            <View style={[styles.secAvatar, { backgroundColor: '#8B5CF6' }]}>
              <Text style={styles.secEmoji}>🛡️</Text>
            </View>
            <View style={styles.secInfo}>
              <Text style={styles.secTitle}>Row Level Security (RLS PostgreSQL)</Text>
              <Text style={styles.secDesc}>
                Políticas criptográficas por fila en Supabase garantizan que ningún tercero pueda consultar ni alterar tus registros.
              </Text>
            </View>
          </View>

          <View style={styles.securityCard}>
            <View style={[styles.secAvatar, { backgroundColor: '#10B981' }]}>
              <Text style={styles.secEmoji}>⚡</Text>
            </View>
            <View style={styles.secInfo}>
              <Text style={styles.secTitle}>Operación Autónoma Sin Cuenta</Text>
              <Text style={styles.secDesc}>
                Puedes usar toda la aplicación en modo local (SQLite) sin conexión y vincular tu cuenta de Google cuando lo desees.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  brandSubtitle: {
    fontSize: 21,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.88)',
    letterSpacing: -0.2,
    lineHeight: 25,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    marginTop: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  outerGlowWrapper: {
    marginBottom: 18,
    borderRadius: 26,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  gradientBorder: {
    borderRadius: 26,
    padding: 1.5,
  },
  blurContainer: {
    borderRadius: 24.5,
    overflow: 'hidden',
  },
  innerGlass: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    borderRadius: 24.5,
  },
  glassLabel: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  authDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.82)',
    lineHeight: 19,
    marginBottom: 16,
  },
  userEmail: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userId: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.68)',
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  glassActionBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(37, 99, 235, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutGlassBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.65)',
    borderColor: 'rgba(252, 165, 165, 0.5)',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIcon: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '900',
  },
  glassActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    minHeight: 420,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    gap: 12,
  },
  secAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secEmoji: {
    fontSize: 20,
  },
  secInfo: {
    flex: 1,
  },
  secTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  secDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
});
