import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  Budget,
  DashboardSummary,
  Transaction,
  TransactionType,
  Wallet,
} from '../types';
import { financeService } from '../services/data/financeService';
import { seedLocalDefaults } from '../services/data/seedData';
import { initLocalDatabase } from '../db/powersync';
import { useTableChanges } from '../hooks/useTableChanges';
import { useAuth } from './AuthContext';

interface FinanceShellContextValue {
  summary: DashboardSummary;
  transactions: Transaction[];
  allTransactions: Transaction[];
  wallets: Wallet[];
  selectedWalletId: string;
  setSelectedWalletId: (id: string) => void;
  isLoading: boolean;
  isRefreshing: boolean;
  refreshData: () => void;
  deleteTransaction: (id: string) => Promise<void>;
  openTransactionModal: (type: TransactionType) => void;
  openEditModal: (tx: Transaction) => void;
  closeTransactionModal: () => void;
  isModalOpen: boolean;
  modalInitialType: TransactionType;
  editingTransaction: Transaction | null;
  bankBalance: number;
  cashBalance: number;
  totalBalance: number;
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
  allTransactions: [],
  wallets: [],
  selectedWalletId: 'all',
  setSelectedWalletId: () => {},
  isLoading: true,
  isRefreshing: false,
  refreshData: () => {},
  deleteTransaction: async () => {},
  openTransactionModal: () => {},
  openEditModal: () => {},
  closeTransactionModal: () => {},
  isModalOpen: false,
  modalInitialType: 'EGRESO',
  editingTransaction: null,
  bankBalance: 0,
  cashBalance: 0,
  totalBalance: 0,
});

export const FinanceShellProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<TransactionType>('EGRESO');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const loadData = useCallback(async () => {
    try {
      await initLocalDatabase();
      await seedLocalDefaults(user?.id);
      const [bdg, txs, wts] = await Promise.all([
        financeService.getBudgetsWithProgress(),
        financeService.getTransactions(150, 'all'),
        financeService.getWallets(),
      ]);

      setBudgets(bdg);
      setAllTransactions(txs);
      setWallets(wts);
    } catch (err) {
      console.error('[FinanceShellContext] Error loading data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  // Reactive SQLite & PowerSync table watcher kept active in the global App Shell
  useTableChanges(['transactions', 'wallets', 'categories', 'budgets'], loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshData = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, [loadData]);

  // Wallet identifiers
  const bankWallet = useMemo(() => {
    return wallets.find(
      (w) =>
        w.name.toLowerCase().includes('banco') ||
        w.id.toLowerCase().includes('bank')
    );
  }, [wallets]);

  const cashWallet = useMemo(() => {
    return wallets.find(
      (w) =>
        w.name.toLowerCase().includes('efectivo') ||
        w.id.toLowerCase().includes('cash')
    );
  }, [wallets]);

  // In-memory zero-latency balance calculator
  const calculateBalance = useCallback(
    (txList: Transaction[], walletTarget?: string) => {
      return txList.reduce((acc, tx) => {
        if (walletTarget && walletTarget !== 'all') {
          const matches =
            tx.wallet_id === walletTarget ||
            (walletTarget === 'bank' &&
              (tx.wallet_name?.toLowerCase().includes('banco') ||
                tx.wallet_id.toLowerCase().includes('bank') ||
                tx.wallet_id === bankWallet?.id)) ||
            (walletTarget === 'cash' &&
              (tx.wallet_name?.toLowerCase().includes('efectivo') ||
                tx.wallet_id.toLowerCase().includes('cash') ||
                tx.wallet_id === cashWallet?.id)) ||
            tx.wallet_name?.toLowerCase() === walletTarget.toLowerCase();

          if (!matches) return acc;
        }
        return acc + (tx.category_type === 'INGRESO' ? tx.amount : -tx.amount);
      }, 0);
    },
    [bankWallet, cashWallet]
  );

  // Precalculated memoized balances for "Cuenta Banco", "Efectivo" and "Todas"
  const bankBalance = useMemo(
    () => calculateBalance(allTransactions, 'bank'),
    [allTransactions, calculateBalance]
  );

  const cashBalance = useMemo(
    () => calculateBalance(allTransactions, 'cash'),
    [allTransactions, calculateBalance]
  );

  const totalBalance = useMemo(
    () => bankBalance + cashBalance,
    [bankBalance, cashBalance]
  );

  // Filtered transactions for the active selected account (0ms latency switch)
  const transactions = useMemo(() => {
    if (!selectedWalletId || selectedWalletId === 'all') return allTransactions;
    return allTransactions.filter((tx) => {
      return (
        tx.wallet_id === selectedWalletId ||
        (selectedWalletId === bankWallet?.id &&
          (tx.wallet_name?.toLowerCase().includes('banco') ||
            tx.wallet_id.toLowerCase().includes('bank'))) ||
        (selectedWalletId === cashWallet?.id &&
          (tx.wallet_name?.toLowerCase().includes('efectivo') ||
            tx.wallet_id.toLowerCase().includes('cash')))
      );
    });
  }, [allTransactions, selectedWalletId, bankWallet, cashWallet]);

  // Compute active income and expense for the selected wallet filter
  const activeIncome = useMemo(() => {
    return allTransactions.reduce((acc, tx) => {
      if (selectedWalletId !== 'all') {
        const matches =
          tx.wallet_id === selectedWalletId ||
          (selectedWalletId === bankWallet?.id &&
            (tx.wallet_name?.toLowerCase().includes('banco') ||
              tx.wallet_id.toLowerCase().includes('bank'))) ||
          (selectedWalletId === cashWallet?.id &&
            (tx.wallet_name?.toLowerCase().includes('efectivo') ||
              tx.wallet_id.toLowerCase().includes('cash')));
        if (!matches) return acc;
      }
      return acc + (tx.category_type === 'INGRESO' ? tx.amount : 0);
    }, 0);
  }, [allTransactions, selectedWalletId, bankWallet, cashWallet]);

  const activeExpense = useMemo(() => {
    return allTransactions.reduce((acc, tx) => {
      if (selectedWalletId !== 'all') {
        const matches =
          tx.wallet_id === selectedWalletId ||
          (selectedWalletId === bankWallet?.id &&
            (tx.wallet_name?.toLowerCase().includes('banco') ||
              tx.wallet_id.toLowerCase().includes('bank'))) ||
          (selectedWalletId === cashWallet?.id &&
            (tx.wallet_name?.toLowerCase().includes('efectivo') ||
              tx.wallet_id.toLowerCase().includes('cash')));
        if (!matches) return acc;
      }
      return acc + (tx.category_type === 'EGRESO' ? tx.amount : 0);
    }, 0);
  }, [allTransactions, selectedWalletId, bankWallet, cashWallet]);

  const activeBalance = useMemo(() => {
    if (selectedWalletId === 'all') return totalBalance;
    if (selectedWalletId === bankWallet?.id || selectedWalletId === 'bank') {
      return bankBalance;
    }
    if (selectedWalletId === cashWallet?.id || selectedWalletId === 'cash') {
      return cashBalance;
    }
    return calculateBalance(allTransactions, selectedWalletId);
  }, [
    selectedWalletId,
    totalBalance,
    bankBalance,
    cashBalance,
    bankWallet,
    cashWallet,
    allTransactions,
    calculateBalance,
  ]);

  const summary = useMemo<DashboardSummary>(() => {
    const budgetTotalLimit = budgets.reduce((acc, b) => acc + b.limit_amount, 0);
    const budgetTotalSpent = budgets.reduce((acc, b) => acc + (b.spent_amount ?? 0), 0);
    const budgetPercentage =
      budgetTotalLimit > 0
        ? Math.min(Math.round((budgetTotalSpent / budgetTotalLimit) * 100), 100)
        : 0;

    return {
      totalBalance: activeBalance,
      totalIncome: activeIncome,
      totalExpense: activeExpense,
      budgetTotalLimit,
      budgetTotalSpent,
      budgetPercentage,
    };
  }, [activeBalance, activeIncome, activeExpense, budgets]);

  const deleteTransaction = useCallback(
    async (id: string) => {
      // Optimistic in-memory update for instant UI response
      setAllTransactions((prev) => prev.filter((tx) => tx.id !== id));
      try {
        await financeService.deleteTransaction(id);
      } catch (err) {
        console.error('[FinanceShellContext] Error deleting transaction:', err);
        await loadData();
      }
    },
    [loadData]
  );

  const openTransactionModal = useCallback((type: TransactionType) => {
    setEditingTransaction(null);
    setModalInitialType(type);
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((tx: Transaction) => {
    setEditingTransaction(tx);
    setModalInitialType(tx.category_type === 'INGRESO' ? 'INGRESO' : 'EGRESO');
    setIsModalOpen(true);
  }, []);

  const closeTransactionModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  }, []);

  return (
    <FinanceShellContext.Provider
      value={{
        summary,
        transactions,
        allTransactions,
        wallets,
        selectedWalletId,
        setSelectedWalletId,
        isLoading,
        isRefreshing,
        refreshData,
        deleteTransaction,
        openTransactionModal,
        openEditModal,
        closeTransactionModal,
        isModalOpen,
        modalInitialType,
        editingTransaction,
        bankBalance,
        cashBalance,
        totalBalance,
      }}
    >
      {children}
    </FinanceShellContext.Provider>
  );
};

export const useFinanceShell = () => useContext(FinanceShellContext);
