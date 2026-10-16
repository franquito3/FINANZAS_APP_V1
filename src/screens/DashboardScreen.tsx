import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { DashboardMetrics } from '../components/DashboardMetrics';
import { TransactionList } from '../components/TransactionList';
import { TransactionModal } from '../components/TransactionModal';
import { financeService } from '../services/data/financeService';
import { seedLocalDefaults } from '../services/data/seedData';
import { DashboardSummary, Transaction, Wallet } from '../types';
import { THEME } from '../constants';
import { initLocalDatabase } from '../db/powersync';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useTableChanges } from '../hooks/useTableChanges';
import { useAuth } from '../context/AuthContext';

export const DashboardScreen: React.FC = () => {
  const syncStatus = useSyncStatus();
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary>({
    totalBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    budgetTotalLimit: 0,
    budgetTotalSpent: 0,
    budgetPercentage: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await initLocalDatabase();
      await seedLocalDefaults(user?.id);
      const [sum, txs, wts] = await Promise.all([
        financeService.getDashboardSummary(selectedWalletId),
        financeService.getTransactions(30, selectedWalletId),
        financeService.getWallets(),
      ]);

      setSummary(sum);
      setTransactions(txs);
      setWallets(wts);
    } catch (err) {
      console.error('[DashboardScreen] Error loading data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedWalletId, user?.id]);

  // Reload whenever local writes or remote sync updates any financial table
  useTableChanges(['transactions', 'wallets', 'categories', 'budgets'], loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleOpenModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await financeService.deleteTransaction(id);
    loadData();
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Top Header & Connection Pill */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>Panel de Control</Text>
            <Text style={styles.appSubtitle}>Rastreo Transaccional de Alta Velocidad</Text>
          </View>

          <View style={styles.statusPill}>
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
            <Text style={styles.statusPillText}>
              {syncStatus.connected ? 'Nube' : 'SQLite'}
            </Text>
          </View>
        </View>

        {/* Dashboard Financial Metrics Card */}
        <DashboardMetrics
          summary={summary}
          wallets={wallets}
          selectedWalletId={selectedWalletId}
          onSelectWallet={setSelectedWalletId}
        />

        {/* Recent Transactions List */}
        <TransactionList
          transactions={transactions}
          onDeleteTransaction={handleDelete}
        />
      </ScrollView>

      {/* Omnipresent Floating Action Button (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleOpenModal}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Fast Data Entry Transaction Modal */}
      <TransactionModal
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        wallets={wallets}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  appSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '400',
    lineHeight: 38,
    textAlign: 'center',
  },
});
