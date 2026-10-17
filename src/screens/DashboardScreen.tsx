import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { CompactBudgetSemaphore } from '../components/DashboardMetrics';
import { TransactionList } from '../components/TransactionList';
import { useFinanceShell } from '../context/FinanceShellContext';
import { THEME } from '../constants';

export const DashboardScreen: React.FC = () => {
  const { summary, transactions, isLoading, deleteTransaction } = useFinanceShell();

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
      {/* Compact Budget Semaphore */}
      <CompactBudgetSemaphore summary={summary} />

      {/* Recent Transactions Feed */}
      <TransactionList
        transactions={transactions}
        onDeleteTransaction={deleteTransaction}
      />
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
});
