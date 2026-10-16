import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { DashboardSummary, Wallet } from '../types';
import { THEME } from '../constants';
import { formatCurrency } from '../utils';

interface Props {
  summary: DashboardSummary;
  wallets: Wallet[];
  selectedWalletId: string;
  onSelectWallet: (id: string) => void;
}

export const DashboardMetrics: React.FC<Props> = ({
  summary,
  wallets,
  selectedWalletId,
  onSelectWallet,
}) => {
  // Budget semaphore: Green (<70%), Yellow (70-90%), Red (>90%)
  const getBudgetStatusColor = (percentage: number) => {
    if (percentage >= 90) return THEME.colors.danger;
    if (percentage >= 70) return '#F59E0B';
    return THEME.colors.success;
  };

  const budgetColor = getBudgetStatusColor(summary.budgetPercentage);

  return (
    <View style={styles.container}>
      {/* Wallet selector pills */}
      <View style={styles.walletPills}>
        <TouchableOpacity
          style={[styles.pill, selectedWalletId === 'all' && styles.pillActive]}
          onPress={() => onSelectWallet('all')}
        >
          <Text style={[styles.pillText, selectedWalletId === 'all' && styles.pillTextActive]}>
            Todas
          </Text>
        </TouchableOpacity>
        {wallets.map((w) => (
          <TouchableOpacity
            key={w.id}
            style={[styles.pill, selectedWalletId === w.id && styles.pillActive]}
            onPress={() => onSelectWallet(w.id)}
          >
            <Text style={[styles.pillText, selectedWalletId === w.id && styles.pillTextActive]}>
              {w.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Saldo Operativo Disponible</Text>
        <Text style={styles.balanceValue}>{formatCurrency(summary.totalBalance)}</Text>

        <View style={styles.incomeExpenseRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Ingresos</Text>
            <Text style={[styles.statValue, styles.incomeText]}>
              +{formatCurrency(summary.totalIncome)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Gastos</Text>
            <Text style={[styles.statValue, styles.expenseText]}>
              -{formatCurrency(summary.totalExpense)}
            </Text>
          </View>
        </View>

        {/* Budget Semaphore Progress Bar */}
        <View style={styles.budgetSection}>
          <View style={styles.budgetHeader}>
            <Text style={styles.budgetLabel}>Semáforo de Presupuesto</Text>
            <Text style={[styles.budgetPercent, { color: budgetColor }]}>
              {summary.budgetPercentage}% consumido
            </Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${summary.budgetPercentage}%`, backgroundColor: budgetColor },
              ]}
            />
          </View>
          <Text style={styles.budgetSubtext}>
            {formatCurrency(summary.budgetTotalSpent)} de {formatCurrency(summary.budgetTotalLimit)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  walletPills: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  pillActive: {
    backgroundColor: THEME.colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  pillTextActive: {
    color: '#fff',
  },
  balanceCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    marginVertical: 8,
  },
  incomeExpenseRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: THEME.colors.border,
  },
  statLabel: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  incomeText: {
    color: THEME.colors.success,
  },
  expenseText: {
    color: THEME.colors.danger,
  },
  budgetSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  budgetLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  budgetPercent: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetSubtext: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 4,
    textAlign: 'right',
  },
});
