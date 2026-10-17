import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExportingCsv(true);
    try {
      const result = await exportTransactionsToCSV();
      Haptics.selectionAsync();
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
      Haptics.selectionAsync();
      setLastReportInfo(`PDF A4 generado con éxito • ${new Date().toLocaleTimeString()}`);
    } catch (err: any) {
      Alert.alert('Error al generar PDF', err.message || String(err));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <LinearGradient
      colors={['#070D2D', '#161D65', '#351875']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 0.55 }}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Hero Area */}
        <View style={styles.heroSection}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brandTitle}>ProyectoX</Text>
              <Text style={styles.brandSubtitle}>Reportes</Text>
            </View>

            <View style={styles.statusPill}>
              <View style={styles.dot} />
              <Text style={styles.statusPillText}>EDGE A4</Text>
            </View>
          </View>

          {/* Liquid Glass Summary Card */}
          <View style={styles.outerGlowWrapper}>
            <LinearGradient
              colors={[
                'rgba(56, 189, 248, 0.75)',
                'rgba(139, 92, 246, 0.45)',
                'rgba(56, 189, 248, 0.65)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientBorder}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 42 : 65}
                tint="dark"
                style={styles.blurContainer}
              >
                <LinearGradient
                  colors={[
                    'rgba(255, 255, 255, 0.14)',
                    'rgba(30, 41, 59, 0.38)',
                    'rgba(15, 23, 42, 0.52)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.innerGlass}
                >
                  <View style={styles.glassTopRow}>
                    <Text style={styles.glassLabel}>BALANCE NETO AUDITADO</Text>
                    <View style={styles.opsBadge}>
                      <Text style={styles.opsBadgeText}>{txCount} registros</Text>
                    </View>
                  </View>

                  <Text
                    style={styles.balanceText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatCurrency(summary.totalBalance)}
                  </Text>

                  <View style={styles.metricsRow}>
                    <View style={styles.metricPill}>
                      <Text style={styles.metricPillLabel}>+ Ingresos</Text>
                      <Text style={[styles.metricPillVal, { color: '#34D399' }]}>
                        +{formatCurrency(summary.totalIncome)}
                      </Text>
                    </View>
                    <View style={styles.metricPill}>
                      <Text style={styles.metricPillLabel}>− Egresos</Text>
                      <Text style={[styles.metricPillVal, { color: '#F87171' }]}>
                        -{formatCurrency(summary.totalExpense)}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </BlurView>
            </LinearGradient>
          </View>
        </View>

        {/* Bottom White Sheet (borderTopRadius: 32) */}
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />

          <Text style={styles.sheetSectionTitle}>Exportación Local (Sin Servidor)</Text>

          {lastReportInfo && (
            <View style={styles.feedbackBanner}>
              <Text style={styles.feedbackText}>✓ {lastReportInfo}</Text>
            </View>
          )}

          {/* PDF Export Card */}
          <View style={styles.exportCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconAvatar, { backgroundColor: '#2563EB' }]}>
                <Text style={styles.iconEmoji}>📄</Text>
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.exportTitle}>Reporte Ejecutivo Impreso (.PDF)</Text>
                <Text style={styles.exportTech}>Diseño Liquid Glass • Formato A4 Compacto</Text>
              </View>
            </View>

            <Text style={styles.exportDesc}>
              Genera un documento formal A4 en Soles (S/.) con el resumen ejecutivo, semáforo de presupuesto, gráficos por categoría y tabla detallada de movimientos lista para imprimir o compartir.
            </Text>

            <TouchableOpacity
              style={[styles.exportBtn, styles.pdfBtn]}
              onPress={handleGeneratePDF}
              disabled={isGeneratingPdf || isExportingCsv}
              activeOpacity={0.8}
            >
              {isGeneratingPdf ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.exportBtnText}>🖨️ Generar y Compartir PDF</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* CSV Export Card */}
          <View style={styles.exportCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconAvatar, { backgroundColor: '#10B981' }]}>
                <Text style={styles.iconEmoji}>📊</Text>
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.exportTitle}>Libro Contable Excel (.CSV)</Text>
                <Text style={styles.exportTech}>Motor PapaParse • Estándar RFC 4180 UTF-8</Text>
              </View>
            </View>

            <Text style={styles.exportDesc}>
              Extrae todas tus transacciones de SQLite con codificación UTF-8 BOM para apertura directa en Microsoft Excel o Google Sheets sin pérdida de tildes ni símbolos.
            </Text>

            <TouchableOpacity
              style={[styles.exportBtn, styles.csvBtn]}
              onPress={handleExportCSV}
              disabled={isExportingCsv || isGeneratingPdf}
              activeOpacity={0.8}
            >
              {isExportingCsv ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.exportBtnText}>⬇ Exportar Libro Contable (.CSV)</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  brandSubtitle: {
    fontSize: 21,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.88)',
    letterSpacing: -0.2,
    lineHeight: 25,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    marginTop: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#38BDF8',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  outerGlowWrapper: {
    marginBottom: 18,
    borderRadius: 26,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  gradientBorder: {
    borderRadius: 26,
    padding: 1.5,
  },
  blurContainer: {
    borderRadius: 24.5,
    overflow: 'hidden',
  },
  innerGlass: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    borderRadius: 24.5,
  },
  glassTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  glassLabel: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  opsBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  opsBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  balanceText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricPill: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  metricPillLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '700',
  },
  metricPillVal: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    minHeight: 430,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  feedbackBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  feedbackText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700',
  },
  exportCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 20,
  },
  cardTitleWrap: {
    flex: 1,
  },
  exportTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  exportTech: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  exportDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  exportBtn: {
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfBtn: {
    backgroundColor: THEME.colors.primary,
  },
  csvBtn: {
    backgroundColor: '#0F172A',
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
