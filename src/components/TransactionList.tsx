import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { Transaction } from '../types';
import { THEME } from '../constants';
import { formatCurrency } from '../utils';

interface Props {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
}

export const TransactionList: React.FC<Props> = ({ transactions, onDeleteTransaction }) => {
  const confirmDelete = (tx: Transaction) => {
    Alert.alert(
      'Eliminar Transacción',
      `¿Deseas eliminar "${tx.notes || tx.category_name || 'Transacción'}" por ${formatCurrency(tx.amount)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => onDeleteTransaction(tx.id) },
      ]
    );
  };

  if (transactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📝</Text>
        <Text style={styles.emptyTitle}>Sin movimientos</Text>
        <Text style={styles.emptySubtitle}>
          Toca el botón (+) para registrar tu primer gasto o ingreso rápidamente.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Movimientos Recientes</Text>
      <View style={styles.listCard}>
        {transactions.map((tx, index) => {
          const isIncome = tx.category_type === 'INGRESO';
          const isLast = index === transactions.length - 1;

          return (
            <TouchableOpacity
              key={tx.id}
              style={[styles.itemRow, !isLast && styles.borderBottom]}
              onLongPress={() => confirmDelete(tx)}
              activeOpacity={0.7}
            >
              {/* Category Icon */}
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: (tx.category_color || '#3B82F6') + '20' },
                ]}
              >
                <Text style={styles.iconText}>{tx.category_icon || '🏷️'}</Text>
              </View>

              {/* Transaction details */}
              <View style={styles.detailsBox}>
                <Text style={styles.categoryName}>
                  {tx.category_name || 'Sin Categoría'}
                </Text>
                <Text style={styles.notesText} numberOfLines={1}>
                  {tx.notes ? `${tx.notes} • ` : ''}
                  {tx.wallet_name || 'Billetera'}
                </Text>
              </View>

              {/* Amount & Time */}
              <View style={styles.amountBox}>
                <Text
                  style={[
                    styles.amountText,
                    isIncome ? styles.incomeColor : styles.expenseColor,
                  ]}
                >
                  {isIncome ? '+' : '-'}
                  {formatCurrency(tx.amount)}
                </Text>
                <Text style={styles.timeText}>
                  {new Date(tx.transaction_date).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 80, // Space for the floating FAB
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 10,
  },
  listCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  detailsBox: {
    flex: 1,
    gap: 2,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  notesText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  amountBox: {
    alignItems: 'flex-end',
    gap: 2,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
  },
  incomeColor: {
    color: THEME.colors.success,
  },
  expenseColor: {
    color: THEME.colors.textPrimary,
  },
  timeText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    backgroundColor: THEME.colors.card,
    borderRadius: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
