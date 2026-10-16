import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { THEME } from '../constants';
import { financeService } from '../services/data/financeService';
import { exportTransactionsToCSV } from '../services/reports/csvExporter';
import { generateAndSharePDFReport } from '../services/reports/pdfGenerator';
import { DashboardSummary } from '../types';
import { formatCurrency } from '../utils';
import { initLocalDatabase } from '../db/powersync';
import { useTableChanges } from '../hooks/useTableChanges';

export const ReportsScreen: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary>({
    totalBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    budgetTotalLimit: 0,
    budgetTotalSpent: 0,
    budgetPercentage: 0,
  });
  const [txCount, setTxCount] = useState(0);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [lastReportInfo, setLastReportInfo] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    try {
      await initLocalDatabase();
      const [sum, txs] = await Promise.all([
        financeService.getDashboardSummary('all'),
        financeService.getTransactions(1000, 'all'),
      ]);
      setSummary(sum);
      setTxCount(txs.length);
    } catch (error) {
      console.error('[ReportsScreen] Error loading report stats:', error);
    }
  }, []);

  useTableChanges(['transactions', 'budgets'], loadMetrics);

  const handleExportCSV = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsExportingCsv(true);
    try {
      const result = await exportTransactionsToCSV();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGeneratingPdf(true);
    try {
      await generateAndSharePDFReport();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLastReportInfo(`PDF A4 generado con éxito • ${new Date().toLocaleTimeString()}`);
    } catch (err: any) {
      Alert.alert('Error al generar PDF', err.message || String(err));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Fase 5: Soberanía de Datos Local</Text>
        </View>
        <Text style={styles.title}>Reportes y Exportación</Text>
        <Text style={styles.subtitle}>
          Procesamiento 100% en el dispositivo móvil (Edge Computing) sin costos de servidor
        </Text>
      </View>

      {/* Consolidated Data Preview */}
      <View style={styles.summaryCard}>
        <Text style={styles.cardSectionTitle}>Datos Disponibles en SQLite Local</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Operaciones</Text>
            <Text style={styles.statValue}>{txCount} registros</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Balance Neto</Text>
            <Text style={[styles.statValue, { color: THEME.colors.primary }]}>
              {formatCurrency(summary.totalBalance)}
            </Text>
          </View>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Ingresos</Text>
            <Text style={[styles.statValue, { color: THEME.colors.success }]}>
              +{formatCurrency(summary.totalIncome)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Egresos</Text>
            <Text style={[styles.statValue, { color: THEME.colors.danger }]}>
              -{formatCurrency(summary.totalExpense)}
            </Text>
          </View>
        </View>
      </View>

      {/* CSV Export Card */}
      <View style={styles.exportCard}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.iconBadge, { backgroundColor: '#DCFCE7' }]}>
            <Text style={styles.iconEmoji}>📊</Text>
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.exportTitle}>Exportación Tabular (Excel / CSV)</Text>
            <Text style={styles.exportTech}>Motor PapaParse • Estándar RFC 4180</Text>
          </View>
        </View>

        <Text style={styles.exportDesc}>
          Extrae todas tus transacciones de SQLite y las serializa con escapado automático de comillas dobles, saltos de línea en notas y encabezado UTF-8 BOM para apertura directa en Microsoft Excel o Google Sheets.
        </Text>

        <TouchableOpacity
          style={[styles.exportBtn, styles.csvBtn]}
          onPress={handleExportCSV}
          disabled={isExportingCsv || isGeneratingPdf}
        >
          {isExportingCsv ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.exportBtnText}>⬇ Exportar Libro Contable (.CSV)</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* PDF Export Card */}
      <View style={styles.exportCard}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.iconBadge, { backgroundColor: '#DBEAFE' }]}>
            <Text style={styles.iconEmoji}>📄</Text>
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.exportTitle}>Reporte Ejecutivo Impreso (PDF)</Text>
            <Text style={styles.exportTech}>expo-print • CSS Paged Media A4</Text>
          </View>
        </View>

        <Text style={styles.exportDesc}>
          Compagina un estado de resultados formal en tamaño A4 con gráficos vectoriales SVG embebidos, control de márgenes (@page), inhibición de cortes destructivos (break-inside: avoid) y separación de secciones (break-before: always).
        </Text>

        <TouchableOpacity
          style={[styles.exportBtn, styles.pdfBtn]}
          onPress={handleGeneratePDF}
          disabled={isGeneratingPdf || isExportingCsv}
        >
          {isGeneratingPdf ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.exportBtnText}>🖨️ Generar y Compartir Reporte (.PDF)</Text>
          )}
        </TouchableOpacity>
      </View>

      {lastReportInfo && (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackText}>✓ {lastReportInfo}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: THEME.colors.background,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  badgeText: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  summaryCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
    gap: 12,
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  statLabel: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 4,
  },
  exportCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 22,
  },
  cardTitleWrap: {
    flex: 1,
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  exportTech: {
    fontSize: 12,
    color: THEME.colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  exportDesc: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 19,
    marginBottom: 16,
  },
  exportBtn: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  csvBtn: {
    backgroundColor: THEME.colors.success,
  },
  pdfBtn: {
    backgroundColor: THEME.colors.primary,
  },
  exportBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  feedbackBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  feedbackText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '600',
  },
});
