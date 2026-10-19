import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Transaction } from '../types';
import { THEME } from '../constants';
import { formatCurrency } from '../utils';
import { useAlert } from '../context/AlertContext';

interface Props {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
}

function formatFooterDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const TransactionList: React.FC<Props> = ({
  transactions,
  onDeleteTransaction,
  onEditTransaction,
}) => {
  const { showAlert } = useAlert();

  const confirmDelete = (tx: Transaction) => {
    showAlert({
      title: 'Eliminar transacción',
      message: `¿Deseas eliminar esta transacción de ${formatCurrency(tx.amount)}?`,
      type: 'confirm',
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => onDeleteTransaction(tx.id),
        },
      ],
    });
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
          <Image
            source={require('../../assets/images/empty_state.png')}
            style={styles.emptyImage}
            resizeMode="contain"
          />
        </View>
      ) : (
        <View style={styles.listWrapper}>
          {transactions.map((tx, index) => {
            const isIncome = tx.category_type === 'INGRESO';
            const isLast = index === transactions.length - 1;
            const accentColor = tx.category_color || '#8B5CF6';
            const footerDate = formatFooterDate(tx.transaction_date);
            const walletLabel = tx.wallet_name || 'Efectivo';

            return (
              <View
                key={tx.id}
                style={[styles.itemRow, !isLast && styles.borderBottom]}
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

                {/* Category, Notes & Footer */}
                <View style={styles.detailsBox}>
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {tx.category_name || 'Movimiento'}
                  </Text>
                  {Boolean(tx.notes) && (
                    <Text style={styles.notesText} numberOfLines={1}>
                      {tx.notes}
                    </Text>
                  )}
                  <Text style={styles.subtitleText} numberOfLines={1}>
                    {walletLabel} • {footerDate}
                  </Text>
                </View>

                {/* Amount in Soles & Action Buttons */}
                <View style={styles.rightColumn}>
                  <Text
                    style={[
                      styles.amountText,
                      isIncome ? styles.incomeColor : styles.expenseColor,
                    ]}
                  >
                    {isIncome ? '+ ' : '- '}
                    {formatCurrency(tx.amount)}
                  </Text>

                  {/* Actions: Edit (Pencil) & Delete (Trash) */}
                  <View style={styles.actionsRow}>
                    {onEditTransaction && (
                      <TouchableOpacity
                        style={styles.actionIconButton}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onEditTransaction(tx);
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="pencil-outline" size={15} color="#64748B" />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.actionIconButton, styles.deleteIconButton]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        confirmDelete(tx);
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
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
    paddingVertical: 12,
    paddingHorizontal: 2,
    gap: 12,
  },
  borderBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  detailsBox: {
    flex: 1,
    gap: 2,
  },
  categoryName: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  notesText: {
    fontSize: 12,
    color: '#475569',
  },
  subtitleText: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
  rightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIconButton: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyImage: {
    width: '85%',
    aspectRatio: 16 / 9,
    maxHeight: 220,
  },
});
