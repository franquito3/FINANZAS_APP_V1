import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DashboardSummary, Transaction, TransactionType, Wallet } from '../types';
import { financeService } from '../services/data/financeService';
import { seedLocalDefaults } from '../services/data/seedData';
import { initLocalDatabase } from '../db/powersync';
import { useTableChanges } from '../hooks/useTableChanges';
import { useAuth } from './AuthContext';

interface FinanceShellContextValue {
  summary: DashboardSummary;
  transactions: Transaction[];
  wallets: Wallet[];
  selectedWalletId: string;
  setSelectedWalletId: (id: string) => void;
  isLoading: boolean;
  isRefreshing: boolean;
  refreshData: () => void;
  deleteTransaction: (id: string) => Promise<void>;
  openTransactionModal: (type: TransactionType) => void;
  closeTransactionModal: () => void;
  isModalOpen: boolean;
  modalInitialType: TransactionType;
}

const defaultSummary: DashboardSummary = {
  totalBalance: 0,
  totalIncome: 0,
  totalExpense: 0,
  budgetTotalLimit: 0,
  budgetTotalSpent: 0,
  budgetPercentage: 0,
};

const FinanceShellContext = createContext<FinanceShellContextValue>({
  summary: defaultSummary,
  transactions: [],
  wallets: [],
  selectedWalletId: 'all',
  setSelectedWalletId: () => {},
  isLoading: true,
  isRefreshing: false,
  refreshData: () => {},
  deleteTransaction: async () => {},
  openTransactionModal: () => {},
  closeTransactionModal: () => {},
  isModalOpen: false,
  modalInitialType: 'EGRESO',
});

export const FinanceShellProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary>(defaultSummary);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<TransactionType>('EGRESO');

  const loadData = useCallback(async () => {
    try {
      await initLocalDatabase();
      await seedLocalDefaults(user?.id);
      const [sum, txs, wts] = await Promise.all([
        financeService.getDashboardSummary(selectedWalletId),
        financeService.getTransactions(50, selectedWalletId),
        financeService.getWallets(),
      ]);

      setSummary(sum);
      setTransactions(txs);
      setWallets(wts);
    } catch (err) {
      console.error('[FinanceShellContext] Error loading data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedWalletId, user?.id]);

  // Reactive SQLite & PowerSync table watcher kept active in the global App Shell
  useTableChanges(['transactions', 'wallets', 'categories', 'budgets'], loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshData = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, [loadData]);

  const deleteTransaction = useCallback(
    async (id: string) => {
      await financeService.deleteTransaction(id);
      await loadData();
    },
    [loadData]
  );

  const openTransactionModal = useCallback((type: TransactionType) => {
    setModalInitialType(type);
    setIsModalOpen(true);
  }, []);

  const closeTransactionModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <FinanceShellContext.Provider
      value={{
        summary,
        transactions,
        wallets,
        selectedWalletId,
        setSelectedWalletId,
        isLoading,
        isRefreshing,
        refreshData,
        deleteTransaction,
        openTransactionModal,
        closeTransactionModal,
        isModalOpen,
        modalInitialType,
      }}
    >
      {children}
    </FinanceShellContext.Provider>
  );
};

export const useFinanceShell = () => useContext(FinanceShellContext);
