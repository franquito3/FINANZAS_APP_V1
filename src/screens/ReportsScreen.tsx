import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { G, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { financeService } from '../services/data/financeService';
import { exportTransactionsToCSV } from '../services/reports/csvExporter';
import { generateAndSharePDFReport } from '../services/reports/pdfGenerator';
import { useFinanceShell } from '../context/FinanceShellContext';
import { useAlert } from '../context/AlertContext';
import { useTableChanges } from '../hooks/useTableChanges';
import { Category, Transaction } from '../types';
import { formatCurrency } from '../utils';
import { initLocalDatabase } from '../db/powersync';

type PeriodMode = 'CURRENT_MONTH' | 'CUSTOM_MONTH' | 'DAY' | 'RANGE_30' | 'ALL';

const NEEDS_KEYWORDS = [
  'alimentación',
  'food',
  'vivienda y servicios',
  'vivienda',
  'salud y farmacia',
  'salud',
  'transporte',
  'educación',
];

const WEEK_DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const CleanCard: React.FC<{
  children: React.ReactNode;
  style?: object;
}> = ({ children, style }) => (
  <View style={[styles.cleanCard, style]}>{children}</View>
);

export const ReportsScreen: React.FC = () => {
  const { selectedWalletId } = useFinanceShell();
  const { showAlert } = useAlert();

  // Date and Calendar states
  const [periodMode, setPeriodMode] = useState<PeriodMode>('CURRENT_MONTH');
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showCalendarGrid, setShowCalendarGrid] = useState<boolean>(false);

  // SQLite data states
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [lastReportInfo, setLastReportInfo] = useState<string | null>(null);

  // Background SQLite loading
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

  useTableChanges(['transactions', 'categories', 'budgets', 'wallets'], loadAnalytics);

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      loadAnalytics();
    });
    return () => cancelAnimationFrame(handle);
  }, [loadAnalytics]);

  // Calendar navigation helpers
  const handlePrevMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDay(null);
    setPeriodMode('CUSTOM_MONTH');
  };

  const handleNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDay(null);
    setPeriodMode('CUSTOM_MONTH');
  };

  const handleQuickPreset = (mode: PeriodMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPeriodMode(mode);
    setSelectedDay(null);
    if (mode === 'CURRENT_MONTH') {
      const now = new Date();
      setSelectedMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    }
  };

  const handleSelectDay = (day: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedDay === day && periodMode === 'DAY') {
      // Toggle off to full month
      setSelectedDay(null);
      setPeriodMode('CUSTOM_MONTH');
    } else {
      setSelectedDay(day);
      setPeriodMode('DAY');
    }
  };

  // Build calendar days matrix for selected month
  const calendarDays = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Map which days have transactions
    const daysWithOps = new Set<number>();
    for (const tx of allTransactions) {
      const d = new Date(tx.transaction_date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        daysWithOps.add(d.getDate());
      }
    }

    const blanks = Array.from({ length: firstDayIndex }, (_, i) => ({
      key: `blank-${i}`,
      day: null,
      hasOps: false,
    }));

    const days = Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      return {
        key: `day-${dayNum}`,
        day: dayNum,
        hasOps: daysWithOps.has(dayNum),
      };
    });

    return [...blanks, ...days];
  }, [selectedMonth, allTransactions]);

  // Strict dynamic date filtering of transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date();

    if (periodMode === 'ALL') {
      return allTransactions;
    }

    if (periodMode === 'RANGE_30') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      return allTransactions.filter((tx) => {
        const d = new Date(tx.transaction_date);
        return d >= thirtyDaysAgo && d <= now;
      });
    }

    if (periodMode === 'DAY' && selectedDay !== null) {
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth();

      return allTransactions.filter((tx) => {
        const d = new Date(tx.transaction_date);
        return (
          d.getFullYear() === year &&
          d.getMonth() === month &&
          d.getDate() === selectedDay
        );
      });
    }

    // Default: MONTH (CURRENT_MONTH or CUSTOM_MONTH)
    const targetYear = selectedMonth.getFullYear();
    const targetMonth = selectedMonth.getMonth();

    return allTransactions.filter((tx) => {
      const d = new Date(tx.transaction_date);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });
  }, [allTransactions, periodMode, selectedMonth, selectedDay]);

  // High performance memoized analytics computation
  const analytics = useMemo(() => {
    let income = 0;
    let expense = 0;
    let needsSpent = 0;
    let wantsSpent = 0;

    const categoryExpenseTotals = new Map<string, number>();

    for (const tx of filteredTransactions) {
      const amt = Number(tx.amount) || 0;
      if (tx.category_type === 'INGRESO') {
        income += amt;
      } else {
        expense += amt;
        const catNameLower = (tx.category_name || '').trim().toLowerCase();
        if (NEEDS_KEYWORDS.some((kw) => catNameLower.includes(kw))) {
          needsSpent += amt;
        } else {
          wantsSpent += amt;
        }
        const key = tx.category_name || 'Otros';
        categoryExpenseTotals.set(key, (categoryExpenseTotals.get(key) || 0) + amt);
      }
    }

    // 50/30/20 Suggested limits
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

    // Strict Filter: ONLY categories with REAL expenses > 0 in this filtered period
    const activeExpenseCategories: Array<{
      id: string;
      name: string;
      icon: string;
      color: string;
      amount: number;
      pct: number;
    }> = [];

    categoryExpenseTotals.forEach((amount, name) => {
      if (amount > 0) {
        const found = expenseCategories.find(
          (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase()
        );
        const pct = expense > 0 ? Math.round((amount / expense) * 100) : 0;
        activeExpenseCategories.push({
          id: found?.id || name,
          name,
          icon: found?.icon_identifier || '✨',
          color: found?.color_hex || '#64748B',
          amount,
          pct,
        });
      }
    });

    // Sort descending by real amount
    activeExpenseCategories.sort((a, b) => b.amount - a.amount);

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
      activeExpenseCategories,
      incomeBarPct,
      expenseBarPct,
    };
  }, [filteredTransactions, expenseCategories]);

  // SVG Donut Chart Calculation
  const donutData = useMemo(() => {
    const size = 180;
    const strokeWidth = 22;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const total = analytics.expense;

    if (total <= 0 || analytics.activeExpenseCategories.length === 0) {
      return {
        size,
        strokeWidth,
        radius,
        circumference,
        hasData: false,
        segments: [],
      };
    }

    let accumulatedLength = 0;
    const segments = analytics.activeExpenseCategories.map((item) => {
      const sliceLength = (item.amount / total) * circumference;
      const strokeDasharray = `${sliceLength} ${circumference - sliceLength}`;
      const strokeDashoffset = -accumulatedLength;
      accumulatedLength += sliceLength;

      return {
        id: item.id,
        color: item.color,
        strokeDasharray,
        strokeDashoffset,
      };
    });

    return {
      size,
      strokeWidth,
      radius,
      circumference,
      hasData: true,
      segments,
    };
  }, [analytics.expense, analytics.activeExpenseCategories]);

  const handleExportCSV = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExportingCsv(true);
    try {
      const result = await exportTransactionsToCSV();
      setLastReportInfo(
        `CSV generado (${result.rowCount} filas) • ${new Date().toLocaleTimeString()}`
      );
    } catch (err: any) {
      showAlert({
        title: 'Error al exportar CSV',
        message: err.message || String(err),
        type: 'error',
      });
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
      showAlert({
        title: 'Error al generar PDF',
        message: err.message || String(err),
        type: 'error',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Month and period labels
  const formattedMonthLabel = selectedMonth.toLocaleDateString('es-PE', {
    month: 'long',
    year: 'numeric',
  });

  const periodSubtitle =
    periodMode === 'DAY' && selectedDay !== null
      ? `Día seleccionado: ${selectedDay} de ${formattedMonthLabel}`
      : periodMode === 'RANGE_30'
      ? 'Últimos 30 días móviles'
      : periodMode === 'ALL'
      ? `Todo el historial acumulado (${filteredTransactions.length} operaciones)`
      : `Mes: ${formattedMonthLabel} (${filteredTransactions.length} operaciones)`;

  return (
    <View style={styles.screenContainer}>
      <BottomSheetScrollView
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        {/* =====================================================================
            CALENDARIO VISUAL E HISTORIAL POR FECHAS
           ===================================================================== */}
        <CleanCard style={styles.calendarCard}>
          {/* Top Title & Period Subtitle */}
          <View style={styles.calendarHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.calendarMainTitle}>Analítica e Historial</Text>
              <Text style={styles.calendarSubtitle}>{periodSubtitle}</Text>
            </View>

            <TouchableOpacity
              style={styles.calendarToggleBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCalendarGrid((prev) => !prev);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.calendarToggleText}>
                {showCalendarGrid ? '▲ Ocultar' : '📅 Calendario'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quick Period Presets */}
          <View style={styles.presetsRow}>
            <TouchableOpacity
              style={[
                styles.presetPill,
                periodMode === 'CURRENT_MONTH' && styles.presetPillActive,
              ]}
              onPress={() => handleQuickPreset('CURRENT_MONTH')}
            >
              <Text
                style={[
                  styles.presetPillText,
                  periodMode === 'CURRENT_MONTH' && styles.presetPillTextActive,
                ]}
              >
                Este Mes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.presetPill,
                periodMode === 'RANGE_30' && styles.presetPillActive,
              ]}
              onPress={() => handleQuickPreset('RANGE_30')}
            >
              <Text
                style={[
                  styles.presetPillText,
                  periodMode === 'RANGE_30' && styles.presetPillTextActive,
                ]}
              >
                30 Días
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.presetPill,
                periodMode === 'ALL' && styles.presetPillActive,
              ]}
              onPress={() => handleQuickPreset('ALL')}
            >
              <Text
                style={[
                  styles.presetPillText,
                  periodMode === 'ALL' && styles.presetPillTextActive,
                ]}
              >
                Todo
              </Text>
            </TouchableOpacity>
          </View>

          {/* Month Navigator Controls */}
          <View style={styles.monthNavRow}>
            <TouchableOpacity
              style={styles.navArrowBtn}
              onPress={handlePrevMonth}
              activeOpacity={0.7}
            >
              <Text style={styles.navArrowText}>‹</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCalendarGrid((prev) => !prev);
              }}
              style={styles.monthLabelWrap}
            >
              <Text style={styles.monthNavTitle}>{formattedMonthLabel}</Text>
              {periodMode === 'DAY' && selectedDay !== null && (
                <Text style={styles.selectedDayBadge}>Día {selectedDay} seleccionado</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navArrowBtn}
              onPress={handleNextMonth}
              activeOpacity={0.7}
            >
              <Text style={styles.navArrowText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Expandable Visual Calendar Grid */}
          {showCalendarGrid && (
            <View style={styles.calendarGridWrap}>
              {/* Day of Week Headers */}
              <View style={styles.weekHeaderRow}>
                {WEEK_DAYS.map((w, idx) => (
                  <Text key={idx} style={styles.weekDayText}>
                    {w}
                  </Text>
                ))}
              </View>

              {/* Day Cells Matrix */}
              <View style={styles.daysMatrix}>
                {calendarDays.map((item) => {
                  if (item.day === null) {
                    return <View key={item.key} style={styles.dayCellEmpty} />;
                  }

                  const isSelected = selectedDay === item.day && periodMode === 'DAY';

                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.dayCell, isSelected && styles.dayCellActive]}
                      onPress={() => handleSelectDay(item.day as number)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayCellText,
                          isSelected && styles.dayCellTextActive,
                        ]}
                      >
                        {item.day}
                      </Text>
                      {item.hasOps && !isSelected && <View style={styles.dayDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {periodMode === 'DAY' && (
                <TouchableOpacity
                  style={styles.resetMonthBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedDay(null);
                    setPeriodMode('CUSTOM_MONTH');
                  }}
                >
                  <Text style={styles.resetMonthBtnText}>
                    ↺ Ver el mes completo ({formattedMonthLabel})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </CleanCard>

        {/* =====================================================================
            1. DISTRIBUCIÓN POR CATEGORÍA CON DONUT CHART Y FILTRADO ESTRICTO
           ===================================================================== */}
        <CleanCard>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTag}>DESGLOSE REAL DE EGRESOS</Text>
              <Text style={styles.cardTitle}>Distribución por Categoría</Text>
            </View>
            <Text style={styles.totalExpenseHighlight}>
              {formatCurrency(analytics.expense)}
            </Text>
          </View>

          {/* Center Donut Chart */}
          <View style={styles.donutContainer}>
            <View style={styles.donutSvgWrap}>
              <Svg
                width={donutData.size}
                height={donutData.size}
                viewBox={`0 0 ${donutData.size} ${donutData.size}`}
              >
                <G
                  rotation="-90"
                  origin={`${donutData.size / 2}, ${donutData.size / 2}`}
                >
                  {/* Background Track */}
                  <Circle
                    cx={donutData.size / 2}
                    cy={donutData.size / 2}
                    r={donutData.radius}
                    stroke="#F1F5F9"
                    strokeWidth={donutData.strokeWidth}
                    fill="none"
                  />

                  {/* Colored Segments: ONLY real categories > 0 */}
                  {donutData.hasData ? (
                    donutData.segments.map((seg) => (
                      <Circle
                        key={seg.id}
                        cx={donutData.size / 2}
                        cy={donutData.size / 2}
                        r={donutData.radius}
                        stroke={seg.color}
                        strokeWidth={donutData.strokeWidth}
                        strokeDasharray={seg.strokeDasharray}
                        strokeDashoffset={seg.strokeDashoffset}
                        strokeLinecap="round"
                        fill="none"
                      />
                    ))
                  ) : (
                    <Circle
                      cx={donutData.size / 2}
                      cy={donutData.size / 2}
                      r={donutData.radius}
                      stroke="#E2E8F0"
                      strokeWidth={donutData.strokeWidth}
                      fill="none"
                    />
                  )}
                </G>
              </Svg>

              {/* Center Donut Label */}
              <View style={styles.donutCenterLabel}>
                <Text style={styles.donutCenterSub}>Total Egresos</Text>
                <Text style={styles.donutCenterAmount} numberOfLines={1}>
                  {formatCurrency(analytics.expense)}
                </Text>
              </View>
            </View>
          </View>

          {/* Minimalist Rows: ONLY categories with amount > 0 */}
          {analytics.activeExpenseCategories.length > 0 ? (
            <View style={styles.categoryList}>
              {analytics.activeExpenseCategories.map((cat) => (
                <View key={cat.id} style={styles.catRow}>
                  <View style={styles.catLeft}>
                    <View
                      style={[
                        styles.catColorDot,
                        { backgroundColor: cat.color },
                      ]}
                    />
                    <Text style={styles.catName} numberOfLines={1}>
                      {cat.name}
                    </Text>
                  </View>

                  <View style={styles.catRight}>
                    <Text style={styles.catPct}>{cat.pct}%</Text>
                    <Text style={styles.catAmount}>{formatCurrency(cat.amount)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCategoriesBox}>
              <Text style={styles.emptyCategoriesIcon}>📊</Text>
              <Text style={styles.emptyCategoriesText}>
                No se registraron egresos en las fechas seleccionadas.
              </Text>
            </View>
          )}
        </CleanCard>

        {/* =====================================================================
            2. REGLA 50/30/20 (PRESUPUESTO INTELIGENTE)
           ===================================================================== */}
        <CleanCard>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTag}>PRESUPUESTO INTELIGENTE</Text>
              <Text style={styles.cardTitle}>Regla 50 / 30 / 20</Text>
            </View>
            <View style={styles.incomeRefBadge}>
              <Text style={styles.incomeRefText}>
                Ingresos: {formatCurrency(analytics.income)}
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
                        ? '#EF4444'
                        : '#0284C7',
                  },
                ]}
              >
                {analytics.needsPct}%
              </Text>
            </View>
            <View style={styles.ruleTrack}>
              <View
                style={[
                  styles.ruleFill,
                  {
                    width: `${Math.max(analytics.needsPct, 4)}%`,
                    backgroundColor:
                      analytics.needsSpent > analytics.needsLimit && analytics.needsLimit > 0
                        ? '#EF4444'
                        : '#0EA5E9',
                  },
                ]}
              />
            </View>
            <View style={styles.ruleMetaRow}>
              <Text style={styles.ruleMetaSub}>Alimentación, Vivienda, Salud, Transporte</Text>
              <Text style={styles.ruleMetaAmounts}>
                Real: <Text style={styles.boldText}>{formatCurrency(analytics.needsSpent)}</Text> / Sug:{' '}
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
                        ? '#EF4444'
                        : '#8B5CF6',
                  },
                ]}
              >
                {analytics.wantsPct}%
              </Text>
            </View>
            <View style={styles.ruleTrack}>
              <View
                style={[
                  styles.ruleFill,
                  {
                    width: `${Math.max(analytics.wantsPct, 4)}%`,
                    backgroundColor:
                      analytics.wantsSpent > analytics.wantsLimit && analytics.wantsLimit > 0
                        ? '#EF4444'
                        : '#8B5CF6',
                  },
                ]}
              />
            </View>
            <View style={styles.ruleMetaRow}>
              <Text style={styles.ruleMetaSub}>Ocio, Compras, Salidas, Otros</Text>
              <Text style={styles.ruleMetaAmounts}>
                Real: <Text style={styles.boldText}>{formatCurrency(analytics.wantsSpent)}</Text> / Sug:{' '}
                {formatCurrency(analytics.wantsLimit)}
              </Text>
            </View>
          </View>

          {/* 20% Futuro / Ahorro */}
          <View style={[styles.ruleBlock, { marginBottom: 0 }]}>
            <View style={styles.ruleLabelRow}>
              <Text style={styles.ruleTitle}>🚀 Futuro / Ahorro (20%)</Text>
              <Text style={[styles.rulePct, { color: '#10B981' }]}>
                {analytics.savingsPct}%
              </Text>
            </View>
            <View style={styles.ruleTrack}>
              <View
                style={[
                  styles.ruleFill,
                  {
                    width: `${Math.max(analytics.savingsPct, 4)}%`,
                    backgroundColor: '#10B981',
                  },
                ]}
              />
            </View>
            <View style={styles.ruleMetaRow}>
              <Text style={styles.ruleMetaSub}>Remanente disponible</Text>
              <Text style={styles.ruleMetaAmounts}>
                Real: <Text style={styles.boldText}>{formatCurrency(analytics.actualSavings)}</Text> / Meta:{' '}
                {formatCurrency(analytics.savingsTarget)}
              </Text>
            </View>
          </View>
        </CleanCard>

        {/* =====================================================================
            3. BALANCE COMPARATIVO: INGRESOS VS EGRESOS
           ===================================================================== */}
        <CleanCard>
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
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'rgba(239, 68, 68, 0.12)',
                },
              ]}
            >
              <Text
                style={[
                  styles.netFlowText,
                  { color: analytics.netFlow >= 0 ? '#10B981' : '#EF4444' },
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
              <Text style={styles.compareLabel}>＋ Ingresos Registrados</Text>
              <Text style={[styles.compareValue, { color: '#10B981' }]}>
                +{formatCurrency(analytics.income)}
              </Text>
            </View>
            <View style={styles.compareTrack}>
              <View
                style={[
                  styles.compareFill,
                  {
                    width: `${analytics.income > 0 ? Math.max(analytics.incomeBarPct, 6) : 0}%`,
                    backgroundColor: '#10B981',
                  },
                ]}
              />
            </View>
          </View>

          {/* Egresos Bar */}
          <View style={[styles.compareBlock, { marginBottom: 0 }]}>
            <View style={styles.compareLabelRow}>
              <Text style={styles.compareLabel}>－ Egresos Registrados</Text>
              <Text style={[styles.compareValue, { color: '#EF4444' }]}>
                -{formatCurrency(analytics.expense)}
              </Text>
            </View>
            <View style={styles.compareTrack}>
              <View
                style={[
                  styles.compareFill,
                  {
                    width: `${analytics.expense > 0 ? Math.max(analytics.expenseBarPct, 6) : 0}%`,
                    backgroundColor: '#EF4444',
                  },
                ]}
              />
            </View>
          </View>
        </CleanCard>

        {/* =====================================================================
            4. SECCIÓN DE DESCARGAS Y EXPORTACIÓN
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

        <CleanCard>
          <Text style={styles.exportIntro}>
            Genera reportes ejecutivos listos para imprimir o respalda tu base de datos local SQLite en formato compatible con Excel.
          </Text>

          {/* Botón PDF */}
          <TouchableOpacity
            style={styles.exportButtonPrimary}
            onPress={handleGeneratePDF}
            disabled={isGeneratingPdf || isExportingCsv}
            activeOpacity={0.82}
          >
            {isGeneratingPdf ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.exportButtonContent}>
                <Text style={styles.exportIcon}>📄</Text>
                <View>
                  <Text style={styles.exportButtonPrimaryText}>
                    Generar y Compartir PDF
                  </Text>
                  <Text style={styles.exportButtonSubText}>
                    Formato A4 profesional con balance y desglose
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {/* Botón CSV */}
          <TouchableOpacity
            style={styles.exportButtonSecondary}
            onPress={handleExportCSV}
            disabled={isGeneratingPdf || isExportingCsv}
            activeOpacity={0.82}
          >
            {isExportingCsv ? (
              <ActivityIndicator color="#4F46E5" />
            ) : (
              <View style={styles.exportButtonContent}>
                <Text style={styles.exportIcon}>📊</Text>
                <View>
                  <Text style={styles.exportButtonSecondaryText}>
                    Exportar Libro Contable (.CSV)
                  </Text>
                  <Text style={styles.exportButtonSubTextSecondary}>
                    Descarga directa de transacciones en SQLite
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </CleanCard>
      </BottomSheetScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  calendarCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  calendarSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  calendarToggleBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  calendarToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetPill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetPillActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4338CA',
  },
  presetPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  presetPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  navArrowText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 22,
  },
  monthLabelWrap: {
    alignItems: 'center',
  },
  monthNavTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'capitalize',
  },
  selectedDayBadge: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#4F46E5',
    marginTop: 1,
  },
  calendarGridWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  weekDayText: {
    width: '13%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  daysMatrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayCellEmpty: {
    width: '13%',
    height: 34,
  },
  dayCell: {
    width: '13%',
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  dayCellActive: {
    backgroundColor: '#4F46E5',
  },
  dayCellText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  dayCellTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
    marginTop: 2,
  },
  resetMonthBtn: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  resetMonthBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4F46E5',
  },
  cleanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  cardTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  incomeRefBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  incomeRefText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  ruleBlock: {
    marginBottom: 14,
  },
  ruleLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ruleTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  rulePct: {
    fontSize: 13,
    fontWeight: '800',
  },
  ruleTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginBottom: 6,
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
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
  ruleMetaAmounts: {
    fontSize: 11,
    color: '#64748B',
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  totalExpenseHighlight: {
    fontSize: 15,
    fontWeight: '800',
    color: '#EF4444',
  },
  donutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  donutSvgWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  donutCenterSub: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  donutCenterAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  categoryList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  catColorDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  catName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  catRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catPct: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    minWidth: 32,
    textAlign: 'right',
  },
  catAmount: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    minWidth: 70,
    textAlign: 'right',
  },
  emptyCategoriesBox: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 6,
  },
  emptyCategoriesIcon: {
    fontSize: 24,
  },
  emptyCategoriesText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
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
    marginBottom: 6,
  },
  compareLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  compareValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  compareTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  compareFill: {
    height: '100%',
    borderRadius: 4,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  feedbackBanner: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  feedbackText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
  },
  exportIntro: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 14,
  },
  exportButtonPrimary: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  exportButtonSecondary: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  exportButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exportIcon: {
    fontSize: 22,
  },
  exportButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  exportButtonSubText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10.5,
    marginTop: 1,
  },
  exportButtonSecondaryText: {
    color: '#1E293B',
    fontSize: 13.5,
    fontWeight: '700',
  },
  exportButtonSubTextSecondary: {
    color: '#64748B',
    fontSize: 10.5,
    marginTop: 1,
  },
});
