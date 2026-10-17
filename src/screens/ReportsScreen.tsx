import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { financeService } from '../services/data/financeService';
import { exportTransactionsToCSV } from '../services/reports/csvExporter';
import { generateAndSharePDFReport } from '../services/reports/pdfGenerator';
import { useFinanceShell } from '../context/FinanceShellContext';
import { useTableChanges } from '../hooks/useTableChanges';
import { Category, Transaction } from '../types';
import { formatCurrency } from '../utils';
import { initLocalDatabase } from '../db/powersync';

type PeriodFilter = 'MONTH' | 'ALL';

const NEEDS_KEYWORDS = ['food', 'vivienda', 'salud', 'transporte'];

/**
 * Reusable GlassCard component matching the #1E1B4B / #4F46E5 Liquid Glass aesthetic
 */
const GlassCard: React.FC<{
  children: React.ReactNode;
  style?: object;
}> = ({ children, style }) => (
  <View style={[styles.glassOuter, style]}>
    <LinearGradient
      colors={[
        'rgba(79, 70, 229, 0.65)',
        'rgba(56, 189, 248, 0.35)',
        'rgba(139, 92, 246, 0.50)',
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.glassBorder}
    >
      <BlurView intensity={38} tint="dark" style={styles.glassBlur}>
        <LinearGradient
          colors={['rgba(30, 27, 75, 0.86)', 'rgba(15, 23, 42, 0.90)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.glassInner}
        >
          {children}
        </LinearGradient>
      </BlurView>
    </LinearGradient>
  </View>
);

export const ReportsScreen: React.FC = () => {
  const { selectedWalletId } = useFinanceShell();
  const [period, setPeriod] = useState<PeriodFilter>('MONTH');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [lastReportInfo, setLastReportInfo] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      await initLocalDatabase();
      const [txs, cats] = await Promise.all([
        financeService.getTransactions(1000, selectedWalletId),
        financeService.getCategories('EGRESO'),
      ]);
      setAllTransactions(txs);
      setExpenseCategories(cats);
    } catch (error) {
      console.error('[ReportsScreen] Error loading analytics from SQLite:', error);
    }
  }, [selectedWalletId]);

  useTableChanges(['transactions', 'categories', 'budgets'], loadAnalytics);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handlePeriodChange = (nextPeriod: PeriodFilter) => {
    if (nextPeriod === period) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPeriod(nextPeriod);
  };

  // Filter transactions for current month or all history
  const filteredTransactions = useMemo(() => {
    if (period === 'ALL') return allTransactions;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return allTransactions.filter((tx) => {
      const d = new Date(tx.transaction_date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
  }, [allTransactions, period]);

  // Compute Income, Expense, 50/30/20 Rule & Category Breakdown
  const analytics = useMemo(() => {
    let income = 0;
    let expense = 0;
    let needsSpent = 0;
    let wantsSpent = 0;

    const categoryTotals = new Map<string, number>();

    for (const tx of filteredTransactions) {
      const amt = Number(tx.amount) || 0;
      if (tx.category_type === 'INGRESO') {
        income += amt;
      } else {
        expense += amt;
        const catNameLower = (tx.category_name || '').trim().toLowerCase();
        if (NEEDS_KEYWORDS.includes(catNameLower)) {
          needsSpent += amt;
        } else {
          wantsSpent += amt;
        }
        const key = tx.category_name || 'Otros';
        categoryTotals.set(key, (categoryTotals.get(key) || 0) + amt);
      }
    }

    // 50/30/20 suggested limits based on period income
    const needsLimit = income * 0.5;
    const wantsLimit = income * 0.3;
    const savingsTarget = income * 0.2;
    const actualSavings = Math.max(income - expense, 0);

    const needsPct =
      needsLimit > 0
        ? Math.min(Math.round((needsSpent / needsLimit) * 100), 100)
        : needsSpent > 0
        ? 100
        : 0;
    const wantsPct =
      wantsLimit > 0
        ? Math.min(Math.round((wantsSpent / wantsLimit) * 100), 100)
        : wantsSpent > 0
        ? 100
        : 0;
    const savingsPct =
      savingsTarget > 0
        ? Math.min(Math.round((actualSavings / savingsTarget) * 100), 100)
        : 0;

    // Build full category distribution list using SQLite categories
    const knownCategories =
      expenseCategories.length > 0
        ? expenseCategories
        : [
            { id: '1', name: 'Food', icon_identifier: '🍴', color_hex: '#F59E0B', type: 'EGRESO' as const, user_id: '' },
            { id: '2', name: 'Ocio', icon_identifier: '🎬', color_hex: '#6366F1', type: 'EGRESO' as const, user_id: '' },
            { id: '3', name: 'Salud', icon_identifier: '💊', color_hex: '#EC4899', type: 'EGRESO' as const, user_id: '' },
            { id: '4', name: 'Shopping', icon_identifier: '🛒', color_hex: '#8B5CF6', type: 'EGRESO' as const, user_id: '' },
            { id: '5', name: 'Transporte', icon_identifier: '🚗', color_hex: '#10B981', type: 'EGRESO' as const, user_id: '' },
            { id: '6', name: 'Vivienda', icon_identifier: '🏠', color_hex: '#3B82F6', type: 'EGRESO' as const, user_id: '' },
            { id: '7', name: 'Otros', icon_identifier: '✨', color_hex: '#64748B', type: 'EGRESO' as const, user_id: '' },
          ];

    const breakdown = knownCategories
      .map((c) => {
        const amount = categoryTotals.get(c.name) || 0;
        const pct = expense > 0 ? Math.round((amount / expense) * 100) : 0;
        return {
          id: c.id,
          name: c.name,
          icon: c.icon_identifier,
          color: c.color_hex,
          amount,
          pct,
        };
      })
      .sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount;
        if (a.name.toLowerCase() === 'otros') return 1;
        if (b.name.toLowerCase() === 'otros') return -1;
        return a.name.localeCompare(b.name);
      });

    const maxFlow = Math.max(income, expense, 1);
    const incomeBarPct = Math.round((income / maxFlow) * 100);
    const expenseBarPct = Math.round((expense / maxFlow) * 100);

    return {
      income,
      expense,
      netFlow: income - expense,
      needsSpent,
      needsLimit,
      needsPct,
      wantsSpent,
      wantsLimit,
      wantsPct,
      actualSavings,
      savingsTarget,
      savingsPct,
      breakdown,
      incomeBarPct,
      expenseBarPct,
    };
  }, [filteredTransactions, expenseCategories]);

  const handleExportCSV = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExportingCsv(true);
    try {
      const result = await exportTransactionsToCSV();
      setLastReportInfo(
        `CSV generado (${result.rowCount} filas) • ${new Date().toLocaleTimeString()}`
      );
    } catch (err: any) {
      Alert.alert('Error al exportar CSV', err.message || String(err));
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleGeneratePDF = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGeneratingPdf(true);
    try {
      await generateAndSharePDFReport();
      setLastReportInfo(`PDF A4 generado con éxito • ${new Date().toLocaleTimeString()}`);
    } catch (err: any) {
      Alert.alert('Error al generar PDF', err.message || String(err));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const currentMonthLabel = new Date().toLocaleDateString('es-PE', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <LinearGradient
      colors={['#1E1B4B', '#131136', '#090D24']}
      style={styles.screenBackground}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header & Date Filter Pills */}
        <View style={styles.topHeaderRow}>
          <View>
            <Text style={styles.sectionMainTitle}>Analítica Financiera</Text>
            <Text style={styles.sectionSubTitle}>
              {period === 'MONTH'
                ? `Mes en curso (${currentMonthLabel})`
                : ` acumulado (${filteredTransactions.length} ops)`}
            </Text>
          </View>

          <View style={styles.filterPills}>
            <TouchableOpacity
              style={[
                styles.filterPill,
                period === 'MONTH' && styles.filterPillActive,
              ]}
              onPress={() => handlePeriodChange('MONTH')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.filterPillText,
                  period === 'MONTH' && styles.filterPillTextActive,
                ]}
              >
                Mes Actual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterPill,
                period === 'ALL' && styles.filterPillActive,
              ]}
              onPress={() => handlePeriodChange('ALL')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.filterPillText,
                  period === 'ALL' && styles.filterPillTextActive,
                ]}
              >
                Histórico
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* =====================================================================
            1. SECCIÓN ANALÍTICA VISUAL (PARTE SUPERIOR)
           ===================================================================== */}

        {/* A. Regla 50/30/20 (Presupuesto Inteligente) */}
        <GlassCard>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTag}>PRESUPUESTO INTELIGENTE</Text>
              <Text style={styles.cardTitle}>Regla 50 / 30 / 20</Text>
            </View>
            <View style={styles.incomeRefBadge}>
              <Text style={styles.incomeRefText}>
                Base: {formatCurrency(analytics.income)}
              </Text>
            </View>
          </View>

          {/* 50% Necesidades */}
          <View style={styles.ruleBlock}>
            <View style={styles.ruleLabelRow}>
              <Text style={styles.ruleTitle}>🏠 Necesidades (50%)</Text>
              <Text
                style={[
                  styles.rulePct,
                  {
                    color:
                      analytics.needsSpent > analytics.needsLimit && analytics.needsLimit > 0
                        ? '#F87171'
                        : '#38BDF8',
                  },
                ]}
              >
                {analytics.needsPct}%
              </Text>
            </View>
            <View style={styles.ruleTrack}>
              <LinearGradient
                colors={
                  analytics.needsSpent > analytics.needsLimit && analytics.needsLimit > 0
                    ? ['#EF4444', '#F87171']
                    : ['#4F46E5', '#38BDF8']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.ruleFill,
                  { width: `${Math.max(analytics.needsPct, 4)}%` },
                ]}
              />
            </View>
            <View style={styles.ruleMetaRow}>
              <Text style={styles.ruleMetaSub}>Food, Vivienda, Salud, Transporte</Text>
              <Text style={styles.ruleMetaAmounts}>
                Real: <Text style={styles.boldWhite}>{formatCurrency(analytics.needsSpent)}</Text> / Sug:{' '}
                {formatCurrency(analytics.needsLimit)}
              </Text>
            </View>
          </View>

          {/* 30% Deseos */}
          <View style={styles.ruleBlock}>
            <View style={styles.ruleLabelRow}>
              <Text style={styles.ruleTitle}>🎬 Deseos (30%)</Text>
              <Text
                style={[
                  styles.rulePct,
                  {
                    color:
                      analytics.wantsSpent > analytics.wantsLimit && analytics.wantsLimit > 0
                        ? '#F87171'
                        : '#C084FC',
                  },
                ]}
              >
                {analytics.wantsPct}%
              </Text>
            </View>
            <View style={styles.ruleTrack}>
              <LinearGradient
                colors={
                  analytics.wantsSpent > analytics.wantsLimit && analytics.wantsLimit > 0
                    ? ['#EF4444', '#F87171']
                    : ['#6366F1', '#C084FC']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.ruleFill,
                  { width: `${Math.max(analytics.wantsPct, 4)}%` },
                ]}
              />
            </View>
            <View style={styles.ruleMetaRow}>
              <Text style={styles.ruleMetaSub}>Ocio, Shopping, Otros</Text>
              <Text style={styles.ruleMetaAmounts}>
                Real: <Text style={styles.boldWhite}>{formatCurrency(analytics.wantsSpent)}</Text> / Sug:{' '}
                {formatCurrency(analytics.wantsLimit)}
              </Text>
            </View>
          </View>

          {/* 20% Futuro / Ahorro */}
          <View style={[styles.ruleBlock, { marginBottom: 0 }]}>
            <View style={styles.ruleLabelRow}>
              <Text style={styles.ruleTitle}>🚀 Futuro / Ahorro (20%)</Text>
              <Text style={[styles.rulePct, { color: '#34D399' }]}>
                {analytics.savingsPct}%
              </Text>
            </View>
            <View style={styles.ruleTrack}>
              <LinearGradient
                colors={['#059669', '#34D399']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.ruleFill,
                  { width: `${Math.max(analytics.savingsPct, 4)}%` },
                ]}
              />
            </View>
            <View style={styles.ruleMetaRow}>
              <Text style={styles.ruleMetaSub}>Remanente disponible</Text>
              <Text style={styles.ruleMetaAmounts}>
                Real: <Text style={styles.boldWhite}>{formatCurrency(analytics.actualSavings)}</Text> / Meta:{' '}
                {formatCurrency(analytics.savingsTarget)}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* B. Distribución de Gastos por Categoría */}
        <GlassCard>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTag}>DESGLOSE EN SQLITE</Text>
              <Text style={styles.cardTitle}>Distribución por Categoría</Text>
            </View>
            <Text style={styles.totalExpenseHighlight}>
              {formatCurrency(analytics.expense)}
            </Text>
          </View>

          {/* Multi-segment ring/spectrum bar */}
          <View style={styles.spectrumBar}>
            {analytics.expense > 0 ? (
              analytics.breakdown
                .filter((item) => item.amount > 0)
                .map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.spectrumSegment,
                      {
                        flex: Math.max(item.pct, 3),
                        backgroundColor: item.color,
                      },
                    ]}
                  />
                ))
            ) : (
              <View
                style={[
                  styles.spectrumSegment,
                  { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
                ]}
              />
            )}
          </View>

          {/* Category rows */}
          <View style={styles.categoryList}>
            {analytics.breakdown.map((cat) => (
              <View key={cat.id} style={styles.catRow}>
                <View style={styles.catLeft}>
                  <View
                    style={[
                      styles.catIconBadge,
                      { backgroundColor: cat.color + '28', borderColor: cat.color },
                    ]}
                  >
                    <Text style={styles.catEmoji}>{cat.icon}</Text>
                  </View>
                  <Text style={styles.catName} numberOfLines={1}>
                    {cat.name}
                  </Text>
                </View>

                <View style={styles.catBarWrapper}>
                  <View style={styles.catTrack}>
                    <View
                      style={[
                        styles.catFill,
                        {
                          width: `${cat.amount > 0 ? Math.max(cat.pct, 6) : 0}%`,
                          backgroundColor: cat.color,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.catRight}>
                  <Text style={styles.catAmount}>{formatCurrency(cat.amount)}</Text>
                  <Text style={styles.catPct}>{cat.pct}%</Text>
                </View>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* C. Balance Comparativo: Ingresos vs Egresos */}
        <GlassCard>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTag}>FLUJO DE CAJA</Text>
              <Text style={styles.cardTitle}>Balance Comparativo</Text>
            </View>
            <View
              style={[
                styles.netFlowBadge,
                {
                  backgroundColor:
                    analytics.netFlow >= 0
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(239, 68, 68, 0.2)',
                },
              ]}
            >
              <Text
                style={[
                  styles.netFlowText,
                  { color: analytics.netFlow >= 0 ? '#34D399' : '#F87171' },
                ]}
              >
                {analytics.netFlow >= 0 ? '+' : ''}
                {formatCurrency(analytics.netFlow)}
              </Text>
            </View>
          </View>

          {/* Ingresos Bar */}
          <View style={styles.compareBlock}>
            <View style={styles.compareLabelRow}>
              <Text style={styles.compareLabel}>＋ Ingresos Acumulados</Text>
              <Text style={[styles.compareValue, { color: '#34D399' }]}>
                +{formatCurrency(analytics.income)}
              </Text>
            </View>
            <View style={styles.compareTrack}>
              <LinearGradient
                colors={['#059669', '#34D399']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.compareFill,
                  {
                    width: `${
                      analytics.income > 0 ? Math.max(analytics.incomeBarPct, 6) : 0
                    }%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* Egresos Bar */}
          <View style={[styles.compareBlock, { marginBottom: 0 }]}>
            <View style={styles.compareLabelRow}>
              <Text style={styles.compareLabel}>－ Egresos Acumulados</Text>
              <Text style={[styles.compareValue, { color: '#F87171' }]}>
                -{formatCurrency(analytics.expense)}
              </Text>
            </View>
            <View style={styles.compareTrack}>
              <LinearGradient
                colors={['#4F46E5', '#F43F5E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.compareFill,
                  {
                    width: `${
                      analytics.expense > 0 ? Math.max(analytics.expenseBarPct, 6) : 0
                    }%`,
                  },
                ]}
              />
            </View>
          </View>
        </GlassCard>

        {/* =====================================================================
            2. SECCIÓN DE DESCARGAS Y EXPORTACIÓN (PARTE INFERIOR)
           ===================================================================== */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerTitle}>Exportación y Respaldo</Text>
          <View style={styles.dividerLine} />
        </View>

        {lastReportInfo && (
          <View style={styles.feedbackBanner}>
            <Text style={styles.feedbackText}>✓ {lastReportInfo}</Text>
          </View>
        )}

        <GlassCard>
          <Text style={styles.exportIntro}>
            Genera reportes ejecutivos listos para auditoría o respalda tu base de datos local SQLite en formato compatible con Excel.
          </Text>

          {/* Botón PDF */}
          <TouchableOpacity
            style={styles.exportActionWrapper}
            onPress={handleGeneratePDF}
            disabled={isGeneratingPdf || isExportingCsv}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.exportGradientBtn}
            >
              {isGeneratingPdf ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.exportBtnText}>
                  🖨️ Generar y Compartir PDF (A4)
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Botón CSV */}
          <TouchableOpacity
            style={[styles.exportActionWrapper, { marginTop: 10, marginBottom: 0 }]}
            onPress={handleExportCSV}
            disabled={isExportingCsv || isGeneratingPdf}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.exportGradientBtn, styles.csvGlassOutline]}
            >
              {isExportingCsv ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.exportBtnText}>
                  📊 Exportar Libro Contable (.CSV)
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </GlassCard>
      </BottomSheetScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  screenBackground: {
    flex: 1,
  },
  sheetContent: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 40,
  },
  topHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sectionSubTitle: {
    fontSize: 11.5,
    color: 'rgba(226, 232, 240, 0.72)',
    marginTop: 1,
    textTransform: 'capitalize',
  },
  filterPills: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 999,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  filterPillActive: {
    backgroundColor: '#4F46E5',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  glassOuter: {
    marginBottom: 14,
    borderRadius: 22,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  glassBorder: {
    borderRadius: 22,
    padding: 1.2,
  },
  glassBlur: {
    borderRadius: 21,
    overflow: 'hidden',
  },
  glassInner: {
    padding: 16,
    borderRadius: 21,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTag: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#818CF8',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },
  incomeRefBadge: {
    backgroundColor: 'rgba(79, 70, 229, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  incomeRefText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#E0E7FF',
  },
  ruleBlock: {
    marginBottom: 12,
  },
  ruleLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  ruleTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  rulePct: {
    fontSize: 12,
    fontWeight: '800',
  },
  ruleTrack: {
    height: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  ruleFill: {
    height: '100%',
    borderRadius: 4,
  },
  ruleMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ruleMetaSub: {
    fontSize: 10,
    color: 'rgba(226, 232, 240, 0.6)',
  },
  ruleMetaAmounts: {
    fontSize: 10.5,
    color: 'rgba(226, 232, 240, 0.85)',
  },
  boldWhite: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  totalExpenseHighlight: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  spectrumBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    gap: 2,
    marginBottom: 14,
  },
  spectrumSegment: {
    height: '100%',
    borderRadius: 2,
  },
  categoryList: {
    gap: 9,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catLeft: {
    width: 105,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  catIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catEmoji: {
    fontSize: 12,
  },
  catName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F1F5F9',
    flex: 1,
  },
  catBarWrapper: {
    flex: 1,
  },
  catTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  catFill: {
    height: '100%',
    borderRadius: 3,
  },
  catRight: {
    width: 98,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'baseline',
    gap: 4,
  },
  catAmount: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  catPct: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.62)',
    width: 28,
    textAlign: 'right',
  },
  netFlowBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  netFlowText: {
    fontSize: 12,
    fontWeight: '800',
  },
  compareBlock: {
    marginBottom: 12,
  },
  compareLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  compareLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(241, 245, 249, 0.88)',
  },
  compareValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  compareTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  compareFill: {
    height: '100%',
    borderRadius: 4,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(129, 140, 248, 0.28)',
  },
  dividerTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#A5B4FC',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  feedbackBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  feedbackText: {
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '700',
  },
  exportIntro: {
    fontSize: 12,
    color: 'rgba(226, 232, 240, 0.78)',
    lineHeight: 17,
    marginBottom: 12,
  },
  exportActionWrapper: {
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
  },
  exportGradientBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  csvGlassOutline: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 14,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
