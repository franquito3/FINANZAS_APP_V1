import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { TransactionList } from '../components/TransactionList';
import { EmptyTransactions } from '../components/EmptyTransactions';
import { useFinanceShell } from '../context/FinanceShellContext';
import { THEME } from '../constants';

export const DashboardScreen: React.FC = () => {
  const { transactions, isLoading, deleteTransaction, openEditModal } = useFinanceShell();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BottomSheetScrollView
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        {transactions.length === 0 ? (
          <EmptyTransactions />
        ) : (
          <TransactionList
            transactions={transactions}
            onDeleteTransaction={deleteTransaction}
            onEditTransaction={openEditModal}
          />
        )}
      </BottomSheetScrollView>
    </View>
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
    paddingVertical: 40,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 36,
  },
});
