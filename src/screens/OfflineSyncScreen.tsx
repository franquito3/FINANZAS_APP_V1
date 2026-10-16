import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { db } from '../db/powersync';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useAuth } from '../context/AuthContext';
import { THEME, APP_CONFIG } from '../constants';
import { formatCurrency } from '../utils';

interface TransactionRow {
  id: string;
  notes: string;
  amount: number;
  transaction_date: string;
}

export const OfflineSyncScreen: React.FC = () => {
  const syncStatus = useSyncStatus();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [isInserting, setIsInserting] = useState(false);

  // Load transactions directly from local SQLite with 0ms latency
  const loadLocalTransactions = async () => {
    try {
      const rows = await db.getAll<TransactionRow>(
        'SELECT id, notes, amount, transaction_date FROM transactions ORDER BY transaction_date DESC LIMIT 5'
      );
      setTransactions(rows);
    } catch (err) {
      console.error('[OfflineSyncScreen] Error querying local SQLite:', err);
    }
  };

  useEffect(() => {
    loadLocalTransactions();

    // Watch query changes in local SQLite reactively
    const unsubscribe = db.registerListener({
      schemaChanged: () => {
        loadLocalTransactions();
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  // Simulates registering an expense in total network isolation (e.g., in a subway tunnel or airplane)
  const handleCreateOfflineExpense = async () => {
    setIsInserting(true);
    try {
      const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const amount = parseFloat((Math.random() * 50 + 5).toFixed(2));
      const now = new Date().toISOString();
      const userId = user?.id || 'offline_anonymous_user';

      // Insert directly into local SQLite database
      await db.execute(
        `INSERT INTO transactions (id, user_id, wallet_id, category_id, amount, transaction_date, notes, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          'wallet_default',
          'cat_food',
          amount,
          now,
          `Café / Almuerzo (${new Date().toLocaleTimeString()})`,
          1,
          now,
          now,
        ]
      );

      await loadLocalTransactions();
    } catch (err: any) {
      Alert.alert('Error Local SQLite', err.message);
    } finally {
      setIsInserting(false);
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
            {syncStatus.hasUnresolvedConflicts ? '⚠️ Hay conflictos por revisar' : '✓ Sin conflictos'}
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

      {/* Local SQLite Transactions Feed */}
      <View style={styles.feedCard}>
        <View style={styles.feedHeader}>
          <Text style={styles.cardSectionTitle}>Últimas Transacciones en SQLite Local</Text>
          <TouchableOpacity onPress={loadLocalTransactions}>
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
                <Text style={styles.txNotes}>{tx.notes}</Text>
                <Text style={styles.txDate}>
                  {new Date(tx.transaction_date).toLocaleTimeString()}
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
  },
  txNotes: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  txDate: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.danger,
  },
});
