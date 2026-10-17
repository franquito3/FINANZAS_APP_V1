import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { DashboardMetrics, CompactBudgetSemaphore } from '../components/DashboardMetrics';
import { TransactionList } from '../components/TransactionList';
import { TransactionModal } from '../components/TransactionModal';
import { financeService } from '../services/data/financeService';
import { seedLocalDefaults } from '../services/data/seedData';
import { DashboardSummary, Transaction, TransactionType, Wallet } from '../types';
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
  const [modalInitialType, setModalInitialType] = useState<TransactionType>('EGRESO');
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
    Haptics.selectionAsync();
    setIsRefreshing(true);
    loadData();
  };

  const handleQuickAction = (type: TransactionType) => {
    setModalInitialType(type);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await financeService.deleteTransaction(id);
    loadData();
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
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#FFFFFF"
            colors={[THEME.colors.primary]}
          />
        }
      >
        {/* Top Hero Area (Dark Gradient + Glass Card) */}
        <View style={styles.heroSection}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brandTitle}>ProyectoX</Text>
              <Text style={styles.brandSubtitle}>Finanzas</Text>
            </View>

            <View style={styles.statusPill}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: syncStatus.connected
                      ? '#10B981'
                      : '#10B981',
                  },
                ]}
              />
              <Text style={styles.statusPillText}>
                {syncStatus.connected ? 'CLOUD' : 'SQLITE'}
              </Text>
            </View>
          </View>

          {/* Liquid Glass Balance Card with + Ingreso & - Gasto */}
          <DashboardMetrics
            summary={summary}
            wallets={wallets}
            selectedWalletId={selectedWalletId}
            onSelectWallet={setSelectedWalletId}
            onQuickAction={handleQuickAction}
          />
        </View>

        {/* Bottom White Sheet (borderTopRadius: 32) */}
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />

          {/* Compact Budget Semaphore */}
          <CompactBudgetSemaphore summary={summary} />

          {/* Recent Transactions Feed */}
          <TransactionList
            transactions={transactions}
            onDeleteTransaction={handleDelete}
          />
        </View>
      </ScrollView>

      {/* Fast Data Entry Transaction Modal */}
      <TransactionModal
        visible={isModalOpen}
        initialType={modalInitialType}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        wallets={wallets}
      />
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
  bottomSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    minHeight: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 14,
  },
});
