import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { db, initLocalDatabase } from '../db/powersync';
import {
  getUnresolvedConflicts,
  resolveConflict,
  SyncConflict,
} from '../db/conflictResolution';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useTableChanges } from '../hooks/useTableChanges';
import { useAuth } from '../context/AuthContext';
import { THEME, APP_CONFIG } from '../constants';
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
        financeService.getTransactions(5, 'all'),
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
    try {
      await resolveConflict(db, conflictId, choice);
      await loadLocalData();
    } catch (err: any) {
      Alert.alert('Error al resolver conflicto', err.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Fase 3: Núcleo Offline-First</Text>
        </View>
        <Text style={styles.title}>{APP_CONFIG.NAME}</Text>
        <Text style={styles.subtitle}>
          Motor SQLite + PowerSync (Latencia Cero & Sincronización en Segundo Plano)
        </Text>
      </View>

      {/* Sync Status Card */}
      <View style={styles.statusCard}>
        <Text style={styles.cardSectionTitle}>Estado de Conectividad & Sincronización</Text>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Modo de Operación:</Text>
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: syncStatus.connected
                    ? THEME.colors.success
                    : THEME.colors.primaryLight,
                },
              ]}
            />
            <Text style={styles.statusValue}>
              {syncStatus.connected
                ? 'Conectado a la Nube'
                : '100% Offline (SQLite Local)'}
            </Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Cola de Mutaciones Pendientes:</Text>
          <Text style={[styles.statusValue, styles.bold]}>
            {syncStatus.pendingUploadCount} operaciones encoladas
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Conflictos Concurrentes:</Text>
          <Text
            style={[
              styles.statusValue,
              {
                color: syncStatus.hasUnresolvedConflicts
                  ? THEME.colors.danger
                  : THEME.colors.success,
              },
            ]}
          >
            {syncStatus.hasUnresolvedConflicts
              ? `⚠️ ${syncStatus.conflictCount} conflicto(s) por revisar`
              : '✓ Sin conflictos'}
          </Text>
        </View>

        {syncStatus.authExpired && (
          <View style={styles.alertBox}>
            <Text style={styles.alertText}>
              ⚠️ Tu sesión ha expirado durante el modo offline. Tus mutaciones se mantendrán seguras en SQLite local hasta que inicies sesión nuevamente.
            </Text>
          </View>
        )}
      </View>

      {/* Action Button: High-speed insert */}
      <TouchableOpacity
        style={[styles.button, styles.actionButton]}
        onPress={handleCreateOfflineExpense}
        disabled={isInserting}
      >
        <Text style={styles.actionButtonText}>
          {isInserting ? 'Guardando en SQLite...' : '⚡ Insertar Gasto Offline (Latencia Cero)'}
        </Text>
      </TouchableOpacity>

      {/* Unresolved Conflicts Audit Panel */}
      {conflicts.length > 0 && (
        <View style={styles.conflictCard}>
          <Text style={styles.cardSectionTitle}>Auditoría de Conflictos ({conflicts.length})</Text>
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
      <View style={styles.feedCard}>
        <View style={styles.feedHeader}>
          <Text style={styles.cardSectionTitle}>Últimas Transacciones en SQLite Local</Text>
          <TouchableOpacity onPress={loadLocalData}>
            <Text style={styles.refreshLink}>Actualizar</Text>
          </TouchableOpacity>
        </View>

        {transactions.length === 0 ? (
          <Text style={styles.emptyText}>
            No hay transacciones registradas localmente. Pulsa el botón de arriba para registrar una sin internet.
          </Text>
        ) : (
          transactions.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={styles.txInfo}>
                <Text style={styles.txNotes}>{tx.notes || tx.category_name}</Text>
                <Text style={styles.txDate}>
                  {new Date(tx.transaction_date).toLocaleTimeString()} • UUID: {tx.id.slice(0, 8)}
                </Text>
              </View>
              <Text style={styles.txAmount}>-{formatCurrency(tx.amount)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: THEME.colors.background,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  badge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeText: {
    color: THEME.colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  statusCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
    gap: 12,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusValue: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    fontWeight: '500',
  },
  bold: {
    fontWeight: '700',
  },
  alertBox: {
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginTop: 6,
  },
  alertText: {
    color: '#92400E',
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: THEME.colors.primary,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  conflictCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 16,
    gap: 10,
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
  feedCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 20,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  refreshLink: {
    color: THEME.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
    lineHeight: 18,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  txInfo: {
    gap: 2,
    flex: 1,
    paddingRight: 8,
  },
  txNotes: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  txDate: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.danger,
  },
});
