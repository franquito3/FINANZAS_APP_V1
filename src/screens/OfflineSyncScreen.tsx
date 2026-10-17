import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { db, initLocalDatabase } from '../db/powersync';
import {
  getUnresolvedConflicts,
  resolveConflict,
  SyncConflict,
} from '../db/conflictResolution';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useTableChanges } from '../hooks/useTableChanges';
import { useAuth } from '../context/AuthContext';
import { THEME } from '../constants';
import { formatCurrency, LOCAL_DEMO_USER_ID } from '../utils';
import { financeService } from '../services/data/financeService';
import { seedLocalDefaults } from '../services/data/seedData';
import { Transaction } from '../types';

export const OfflineSyncScreen: React.FC = () => {
  const syncStatus = useSyncStatus();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [isInserting, setIsInserting] = useState(false);

  const loadLocalData = useCallback(async () => {
    try {
      await initLocalDatabase();
      const [rows, pendingConflicts] = await Promise.all([
        financeService.getTransactions(8, 'all'),
        getUnresolvedConflicts(db),
      ]);
      setTransactions(rows);
      setConflicts(pendingConflicts);
    } catch (err) {
      console.error('[OfflineSyncScreen] Error querying local SQLite:', err);
    }
  }, []);

  useTableChanges(['transactions', 'sync_conflicts'], loadLocalData);

  // Registers an expense in network isolation using valid UUIDs so it syncs cleanly when online
  const handleCreateOfflineExpense = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsInserting(true);
    try {
      const userId = user?.id || LOCAL_DEMO_USER_ID;
      await initLocalDatabase();
      await seedLocalDefaults(userId);

      const [wallets, categories] = await Promise.all([
        financeService.getWallets(),
        financeService.getCategories('EGRESO'),
      ]);

      const walletId = wallets[0]?.id;
      const categoryId = categories[0]?.id;

      if (!walletId || !categoryId) {
        throw new Error('No se encontraron billeteras o categorías base en SQLite.');
      }

      const amount = parseFloat((Math.random() * 50 + 5).toFixed(2));
      await financeService.createTransaction({
        amount,
        walletId,
        categoryId,
        userId,
        notes: `Café / Almuerzo (${new Date().toLocaleTimeString()})`,
      });
      Haptics.selectionAsync();
    } catch (err: any) {
      Alert.alert('Error Local SQLite', err.message);
    } finally {
      setIsInserting(false);
    }
  };

  const handleResolveConflict = async (
    conflictId: string,
    choice: 'KEEP_LOCAL' | 'KEEP_REMOTE'
  ) => {
    Haptics.selectionAsync();
    try {
      await resolveConflict(db, conflictId, choice);
      await loadLocalData();
    } catch (err: any) {
      Alert.alert('Error al resolver conflicto', err.message);
    }
  };

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
              <Text style={styles.brandSubtitle}>Motor Offline</Text>
            </View>

            <View style={styles.statusPill}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: syncStatus.connected ? '#10B981' : '#38BDF8',
                  },
                ]}
              />
              <Text style={styles.statusPillText}>
                {syncStatus.connected ? 'CLOUD' : 'SQLITE'}
              </Text>
            </View>
          </View>

          {/* Liquid Glass Sync Engine Card */}
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
                  <Text style={styles.glassLabel}>ESTADO DEL NÚCLEO LOCAL</Text>
                  <Text style={styles.modeTitle}>
                    {syncStatus.connected
                      ? 'Sincronizado con Nube'
                      : '100% Offline • SQLite Local'}
                  </Text>

                  <View style={styles.metricsRow}>
                    <View style={styles.metricPill}>
                      <Text style={styles.metricPillLabel}>Cola de Subida</Text>
                      <Text style={styles.metricPillVal}>
                        {syncStatus.pendingUploadCount} pendientes
                      </Text>
                    </View>
                    <View style={styles.metricPill}>
                      <Text style={styles.metricPillLabel}>Conflictos</Text>
                      <Text
                        style={[
                          styles.metricPillVal,
                          {
                            color: syncStatus.hasUnresolvedConflicts
                              ? '#F87171'
                              : '#34D399',
                          },
                        ]}
                      >
                        {syncStatus.hasUnresolvedConflicts
                          ? `${syncStatus.conflictCount} alerta(s)`
                          : '✓ 0 conflictos'}
                      </Text>
                    </View>
                  </View>

                  {syncStatus.authExpired && (
                    <View style={styles.expiredBanner}>
                      <Text style={styles.expiredText}>
                        ⚠️ Sesión expirada: tus datos siguen seguros en SQLite local.
                      </Text>
                    </View>
                  )}

                  {/* Quick Offline Action Button inside Glass Card */}
                  <TouchableOpacity
                    style={styles.glassActionBtn}
                    onPress={handleCreateOfflineExpense}
                    disabled={isInserting}
                    activeOpacity={0.78}
                  >
                    <Text style={styles.glassActionIcon}>⚡</Text>
                    <Text style={styles.glassActionText}>
                      {isInserting
                        ? 'Guardando en SQLite...'
                        : 'Insertar Gasto Offline (Latencia Cero)'}
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
              </BlurView>
            </LinearGradient>
          </View>
        </View>

        {/* Bottom White Sheet (borderTopRadius: 32) */}
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />

          {/* Unresolved Conflicts Audit Panel */}
          {conflicts.length > 0 && (
            <View style={styles.conflictCard}>
              <Text style={styles.conflictHeaderTitle}>
                Auditoría de Conflictos ({conflicts.length})
              </Text>
              {conflicts.map((c) => (
                <View key={c.id} style={styles.conflictItem}>
                  <Text style={styles.conflictTitle}>
                    Tabla: {c.entity_table} • ID: {c.record_id.slice(0, 8)}...
                  </Text>
                  <Text style={styles.conflictDetail}>
                    Local: {JSON.stringify(c.local_data)}
                  </Text>
                  <Text style={styles.conflictDetail}>
                    Servidor: {JSON.stringify(c.remote_data)}
                  </Text>
                  <View style={styles.conflictActions}>
                    <TouchableOpacity
                      style={[styles.conflictBtn, styles.keepLocalBtn]}
                      onPress={() => handleResolveConflict(c.id, 'KEEP_LOCAL')}
                    >
                      <Text style={styles.conflictBtnText}>Conservar Local</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.conflictBtn, styles.keepRemoteBtn]}
                      onPress={() => handleResolveConflict(c.id, 'KEEP_REMOTE')}
                    >
                      <Text style={styles.conflictBtnText}>Usar Versión Nube</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Local SQLite Transactions Feed */}
          <View style={styles.feedHeader}>
            <Text style={styles.sheetSectionTitle}>Registro en SQLite Local</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                loadLocalData();
              }}
            >
              <Text style={styles.refreshLink}>Actualizar</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>⚡</Text>
              <Text style={styles.emptyTitle}>Base de datos lista</Text>
              <Text style={styles.emptyText}>
                Pulsa el botón superior para registrar un gasto instantáneo en SQLite sin conexión a internet.
              </Text>
            </View>
          ) : (
            <View style={styles.listWrapper}>
              {transactions.map((tx, idx) => {
                const isIncome = tx.category_type === 'INGRESO';
                const avatarBg =
                  tx.category_color || (isIncome ? '#10B981' : '#3B82F6');
                return (
                  <View
                    key={tx.id}
                    style={[
                      styles.txRow,
                      idx === transactions.length - 1 && styles.txRowLast,
                    ]}
                  >
                    <View
                      style={[styles.txAvatar, { backgroundColor: avatarBg }]}
                    >
                      <Text style={styles.txEmoji}>
                        {tx.category_icon || '💸'}
                      </Text>
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txNotes} numberOfLines={1}>
                        {tx.notes || tx.category_name || 'Operación'}
                      </Text>
                      <Text style={styles.txDate}>
                        {new Date(tx.transaction_date).toLocaleTimeString()} • UUID:{' '}
                        {tx.id.slice(0, 8)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.txAmount,
                        { color: isIncome ? '#10B981' : '#0F172A' },
                      ]}
                    >
                      {isIncome ? '+' : '-'} {formatCurrency(tx.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 4,
  },
  modeTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metricPill: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  metricPillLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '700',
  },
  metricPillVal: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  expiredBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  expiredText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '600',
  },
  glassActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.65)',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.45)',
  },
  glassActionIcon: {
    fontSize: 15,
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
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sheetSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  refreshLink: {
    color: THEME.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  conflictCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 16,
    gap: 10,
  },
  conflictHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
  },
  conflictItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 6,
  },
  conflictTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.danger,
  },
  conflictDetail: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontFamily: 'monospace',
  },
  conflictActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  conflictBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  keepLocalBtn: {
    backgroundColor: THEME.colors.primary,
  },
  keepRemoteBtn: {
    backgroundColor: '#64748B',
  },
  conflictBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 6,
  },
  emptyEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  listWrapper: {
    backgroundColor: '#FFFFFF',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  txRowLast: {
    borderBottomWidth: 0,
  },
  txAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txEmoji: {
    fontSize: 18,
  },
  txInfo: {
    flex: 1,
    paddingRight: 8,
  },
  txNotes: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  txDate: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
});
