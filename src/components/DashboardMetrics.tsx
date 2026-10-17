import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { DashboardSummary, TransactionType, Wallet } from '../types';
import { formatCurrency } from '../utils';

interface Props {
  summary: DashboardSummary;
  wallets: Wallet[];
  selectedWalletId: string;
  onSelectWallet: (id: string) => void;
  onQuickAction: (type: TransactionType) => void;
}

export const DashboardMetrics: React.FC<Props> = ({
  summary,
  wallets,
  selectedWalletId,
  onSelectWallet,
  onQuickAction,
}) => {
  const [hideBalance, setHideBalance] = useState(false);

  const toggleVisibility = () => {
    Haptics.selectionAsync();
    setHideBalance((prev) => !prev);
  };

  const handleWalletPress = (id: string) => {
    Haptics.selectionAsync();
    onSelectWallet(id);
  };

  const handleActionPress = (type: TransactionType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onQuickAction(type);
  };

  return (
    <View style={styles.container}>
      {/* Optional subtle wallet filter pills */}
      {wallets.length > 1 && (
        <View style={styles.walletPills}>
          <TouchableOpacity
            style={[styles.pill, selectedWalletId === 'all' && styles.pillActive]}
            onPress={() => handleWalletPress('all')}
            activeOpacity={0.75}
          >
            <Text style={[styles.pillText, selectedWalletId === 'all' && styles.pillTextActive]}>
              Todas
            </Text>
          </TouchableOpacity>
          {wallets.map((w) => (
            <TouchableOpacity
              key={w.id}
              style={[styles.pill, selectedWalletId === w.id && styles.pillActive]}
              onPress={() => handleWalletPress(w.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.pillText, selectedWalletId === w.id && styles.pillTextActive]}>
                {w.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Liquid Glass Balance Card with Neon Rim */}
      <View style={styles.glowShadowWrap}>
        <LinearGradient
          colors={['rgba(56, 189, 248, 0.85)', 'rgba(139, 92, 246, 0.65)', 'rgba(192, 132, 252, 0.9)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
          <BlurView intensity={48} tint="dark" style={styles.blurCard}>
            <Text style={styles.balanceLabel}>SALDO OPERATIVO DISPONIBLE</Text>

            <View style={styles.balanceRow}>
              <Text
                style={styles.balanceValue}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {hideBalance ? 'S/. ••••••' : formatCurrency(summary.totalBalance)}
              </Text>

              <TouchableOpacity
                onPress={toggleVisibility}
                style={styles.eyeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeIcon}>{hideBalance ? '👁️' : '◡'}</Text>
              </TouchableOpacity>
            </View>

            {/* Dual Action Buttons Inside Glass Card */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.glassBtn}
                onPress={() => handleActionPress('INGRESO')}
                activeOpacity={0.75}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.20)', 'rgba(255, 255, 255, 0.07)']}
                  style={styles.glassBtnInner}
                >
                  <Text style={styles.glassBtnSymbol}>＋</Text>
                  <Text style={styles.glassBtnText}>Ingreso</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.glassBtn}
                onPress={() => handleActionPress('EGRESO')}
                activeOpacity={0.75}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.20)', 'rgba(255, 255, 255, 0.07)']}
                  style={styles.glassBtnInner}
                >
                  <Text style={styles.glassBtnSymbol}>－</Text>
                  <Text style={styles.glassBtnText}>Gasto</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </LinearGradient>
      </View>
    </View>
  );
};

/**
 * Compact Budget Semaphore Card rendered inside the white bottom sheet
 */
export const CompactBudgetSemaphore: React.FC<{ summary: DashboardSummary }> = ({ summary }) => {
  const pct = summary.budgetPercentage;
  const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#4338CA';

  return (
    <View style={styles.semaphoreCard}>
      <View style={styles.semaphoreHeader}>
        <Text style={styles.semaphoreTitle}>Semáforo de Presupuesto</Text>
        <View style={styles.semaphoreRight}>
          <Text style={styles.semaphorePercent}>{pct}%</Text>
          <View style={styles.semaphoreBadge}>
            <View style={[styles.semaphoreSegment, { backgroundColor: '#10B981' }]} />
            <View style={[styles.semaphoreSegment, { backgroundColor: '#F59E0B' }]} />
            <View style={[styles.semaphoreSegment, { backgroundColor: '#EF4444' }]} />
          </View>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <LinearGradient
          colors={pct >= 90 ? ['#EF4444', '#DC2626'] : ['#312E81', barColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${Math.max(pct, 4)}%` }]}
        />
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
    marginBottom: 2,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  pillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.72)',
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  glowShadowWrap: {
    borderRadius: 26,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  gradientBorder: {
    borderRadius: 26,
    padding: 1.5,
  },
  blurCard: {
    borderRadius: 24.5,
    paddingVertical: 22,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(20, 24, 78, 0.58)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(226, 232, 240, 0.85)',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  eyeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  glassBtn: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    overflow: 'hidden',
  },
  glassBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    gap: 6,
  },
  glassBtnSymbol: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  glassBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  semaphoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 18,
  },
  semaphoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  semaphoreTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  semaphoreRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  semaphorePercent: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  semaphoreBadge: {
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
    width: 18,
    height: 11,
  },
  semaphoreSegment: {
    flex: 1,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
