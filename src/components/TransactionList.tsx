import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Transaction } from '../types';
import { THEME } from '../constants';
import { formatCurrency } from '../utils';

interface Props {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
}

export const TransactionList: React.FC<Props> = ({ transactions, onDeleteTransaction }) => {
  const confirmDelete = (tx: Transaction) => {
    Haptics.selectionAsync();
    Alert.alert(
      'Eliminar Transacción',
      `¿Deseas eliminar "${tx.notes || tx.category_name || 'Transacción'}" por ${formatCurrency(tx.amount)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => onDeleteTransaction(tx.id) },
      ]
    );
  };

  // Net sum of displayed transactions for the right header badge
  const netRecent = transactions.reduce(
    (acc, tx) => acc + (tx.category_type === 'INGRESO' ? tx.amount : -tx.amount),
    0
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Transacciones</Text>
        {transactions.length > 0 && (
          <Text style={styles.headerTotal}>{formatCurrency(Math.abs(netRecent))}</Text>
        )}
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✨</Text>
          <Text style={styles.emptyTitle}>Sin movimientos aún</Text>
          <Text style={styles.emptySubtitle}>
            Usa los botones &quot;+ Ingreso&quot; o &quot;- Gasto&quot; en tu tarjeta superior para registrar en segundos.
          </Text>
        </View>
      ) : (
        <View style={styles.listWrapper}>
          {transactions.map((tx, index) => {
            const isIncome = tx.category_type === 'INGRESO';
            const isLast = index === transactions.length - 1;
            const accentColor = tx.category_color || '#8B5CF6';

            return (
              <TouchableOpacity
                key={tx.id}
                style={[styles.itemRow, !isLast && styles.borderBottom]}
                onPress={() => Haptics.selectionAsync()}
                onLongPress={() => confirmDelete(tx)}
                activeOpacity={0.7}
              >
                {/* Circular Category Avatar */}
                <View
                  style={[
                    styles.avatarCircle,
                    { backgroundColor: accentColor + '1E' },
                  ]}
                >
                  <Text style={styles.iconText}>{tx.category_icon || '🏷️'}</Text>
                </View>

                {/* Category & Subtitle */}
                <View style={styles.detailsBox}>
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {tx.category_name || 'Movimiento'}
                  </Text>
                  <Text style={styles.subtitleText} numberOfLines={1}>
                    {tx.notes ? `${tx.notes} • ` : ''}
                    {new Date(tx.transaction_date).toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                </View>

                {/* Formatted Amount in Soles */}
                <View style={styles.amountBox}>
                  <Text
                    style={[
                      styles.amountText,
                      isIncome ? styles.incomeColor : styles.expenseColor,
                    ]}
                  >
                    {isIncome ? '+ ' : '- '}
                    {formatCurrency(tx.amount)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  headerTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  listWrapper: {
    backgroundColor: '#FFFFFF',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 2,
    gap: 12,
  },
  borderBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  detailsBox: {
    flex: 1,
    gap: 1,
  },
  categoryName: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  subtitleText: {
    fontSize: 11.5,
    color: '#64748B',
  },
  amountBox: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  incomeColor: {
    color: THEME.colors.success,
  },
  expenseColor: {
    color: '#1E293B',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
