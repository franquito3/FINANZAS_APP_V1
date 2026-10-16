import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { DashboardSummary, Transaction, Budget } from '../../types';
import { financeService } from '../data/financeService';
import { APP_CONFIG } from '../../constants';
import { formatCurrency } from '../../utils';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Builds the HTML document with strict CSS Paged Media rules (@page, break-inside, break-before)
 * so tables, cards and SVG charts are never mutilated across A4 page breaks.
 */
export function buildReportHtml(params: {
  summary: DashboardSummary;
  transactions: Transaction[];
  budgets: Budget[];
  generatedAt: string;
}): string {
  const { summary, transactions, budgets, generatedAt } = params;

  const incomeTransactions = transactions.filter((t) => t.category_type === 'INGRESO');
  const expenseTransactions = transactions.filter((t) => t.category_type !== 'INGRESO');

  // Group expenses by category for visual breakdown
  const categoryMap = new Map<string, { name: string; color: string; amount: number }>();
  for (const tx of expenseTransactions) {
    const key = tx.category_id || 'other';
    const existing = categoryMap.get(key) || {
      name: tx.category_name || 'Otros',
      color: tx.category_color || '#3B82F6',
      amount: 0,
    };
    existing.amount += Number(tx.amount);
    categoryMap.set(key, existing);
  }
  const categoryBreakdown = Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);

  const budgetRowsHtml =
    budgets.length === 0
      ? `<p class="empty-msg">Sin presupuestos configurados.</p>`
      : budgets
          .map((b) => {
            const pct = b.percentage ?? 0;
            const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981';
            return `
            <div class="card budget-item">
              <div class="budget-header">
                <strong>${escapeHtml(b.category_name || 'Categoría')} (${escapeHtml(b.period)})</strong>
                <span style="color: ${barColor}; font-weight: 700;">${pct}% consumido</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width: ${pct}%; background-color: ${barColor};"></div>
              </div>
              <div class="budget-meta">
                Gastado: ${formatCurrency(b.spent_amount ?? 0)} / Límite: ${formatCurrency(b.limit_amount)}
              </div>
            </div>
          `;
          })
          .join('');

  const categorySvgBarsHtml =
    categoryBreakdown.length === 0
      ? `<p class="empty-msg">No se registran egresos en el período actual.</p>`
      : categoryBreakdown
          .map((cat) => {
            const pct =
              summary.totalExpense > 0
                ? Math.round((cat.amount / summary.totalExpense) * 100)
                : 0;
            return `
            <div class="chart-row">
              <div class="chart-label">
                <span class="dot" style="background-color: ${cat.color};"></span>
                <span>${escapeHtml(cat.name)}</span>
              </div>
              <div class="chart-bar-wrap">
                <svg width="100%" height="14" viewBox="0 0 200 14" preserveAspectRatio="none">
                  <rect x="0" y="0" width="200" height="14" rx="4" fill="#E2E8F0" />
                  <rect x="0" y="0" width="${Math.max(pct * 2, 4)}" height="14" rx="4" fill="${cat.color}" />
                </svg>
              </div>
              <div class="chart-value">${formatCurrency(cat.amount)} (${pct}%)</div>
            </div>
          `;
          })
          .join('');

  const renderTableRows = (list: Transaction[]) => {
    if (list.length === 0) {
      return `<tr><td colspan="5" class="empty-cell">No hay registros en esta sección</td></tr>`;
    }
    return list
      .map(
        (tx) => `
      <tr>
        <td>${new Date(tx.transaction_date).toLocaleDateString('es-PE', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        })}</td>
        <td><strong>${escapeHtml(tx.category_name || 'Sin Categoría')}</strong></td>
        <td>${escapeHtml(tx.wallet_name || 'Efectivo')}</td>
        <td>${escapeHtml(tx.notes || '-')}</td>
        <td class="amount-col ${tx.category_type === 'INGRESO' ? 'text-income' : 'text-expense'}">
          ${tx.category_type === 'INGRESO' ? '+' : '-'}${formatCurrency(tx.amount)}
        </td>
      </tr>
    `
      )
      .join('');
  };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Reporte Financiero - ${escapeHtml(APP_CONFIG.NAME)}</title>
  <style>
    /* =========================================================================
       CSS Paged Media Module Rules for Formal A4 Financial Print
       ========================================================================= */
    @page {
      size: A4 portrait;
      margin: 1in;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      background-color: #FFFFFF;
      line-height: 1.5;
      font-size: 12px;
    }

    /* Prevent destructive fragmentation across page breaks */
    .card,
    .kpi-grid,
    .chart-container,
    .budget-item,
    table,
    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Intentional section page break */
    .page-break-section {
      break-before: always;
      page-break-before: always;
    }

    .report-header {
      border-bottom: 2px solid #1E40AF;
      padding-bottom: 14px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .brand-title {
      font-size: 22px;
      font-weight: 800;
      color: #1E40AF;
    }

    .brand-subtitle {
      font-size: 11px;
      color: #64748B;
      margin-top: 2px;
    }

    .meta-info {
      text-align: right;
      font-size: 11px;
      color: #64748B;
    }

    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #0F172A;
      margin-top: 20px;
      margin-bottom: 10px;
      border-left: 4px solid #1E40AF;
      padding-left: 8px;
    }

    .kpi-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }

    .kpi-box {
      flex: 1;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 14px;
      background-color: #F8FAFC;
    }

    .kpi-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748B;
      font-weight: 700;
    }

    .kpi-value {
      font-size: 18px;
      font-weight: 800;
      margin-top: 4px;
    }

    .text-primary { color: #1E40AF; }
    .text-income { color: #10B981; }
    .text-expense { color: #EF4444; }

    .card {
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 14px;
      background-color: #FFFFFF;
    }

    .chart-row {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      gap: 10px;
    }

    .chart-label {
      width: 120px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 4px;
      display: inline-block;
    }

    .chart-bar-wrap {
      flex: 1;
    }

    .chart-value {
      width: 110px;
      text-align: right;
      font-weight: 600;
      color: #334155;
    }

    .budget-item {
      margin-bottom: 10px;
    }

    .budget-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .progress-track {
      height: 8px;
      background-color: #E2E8F0;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 4px;
    }

    .progress-fill {
      height: 100%;
      border-radius: 4px;
    }

    .budget-meta {
      font-size: 10px;
      color: #64748B;
      text-align: right;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 18px;
    }

    th {
      background-color: #F1F5F9;
      color: #334155;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      padding: 8px 10px;
      border-bottom: 2px solid #CBD5E1;
    }

    td {
      padding: 8px 10px;
      border-bottom: 1px solid #E2E8F0;
      font-size: 11px;
      color: #1E293B;
    }

    .amount-col {
      text-align: right;
      font-weight: 700;
    }

    .empty-cell, .empty-msg {
      text-align: center;
      color: #64748B;
      padding: 12px;
      font-style: italic;
    }

    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #E2E8F0;
      font-size: 10px;
      color: #94A3B8;
      text-align: center;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="report-header">
    <div>
      <div class="brand-title">${escapeHtml(APP_CONFIG.NAME)}</div>
      <div class="brand-subtitle">Estado de Resultados & Auditoría Contable Local (Edge Computing)</div>
    </div>
    <div class="meta-info">
      <div>Fecha de Emisión: ${escapeHtml(generatedAt)}</div>
      <div>Total Operaciones: ${transactions.length}</div>
    </div>
  </div>

  <!-- Executive KPI Summary -->
  <div class="section-title">1. Resumen Ejecutivo de Liquidez</div>
  <div class="kpi-grid">
    <div class="kpi-box">
      <div class="kpi-label">Saldo Operativo Neto</div>
      <div class="kpi-value text-primary">${formatCurrency(summary.totalBalance)}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Ingresos Acumulados</div>
      <div class="kpi-value text-income">+${formatCurrency(summary.totalIncome)}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Egresos Acumulados</div>
      <div class="kpi-value text-expense">-${formatCurrency(summary.totalExpense)}</div>
    </div>
  </div>

  <!-- Visual Category Breakdown -->
  <div class="section-title">2. Distribución Porcentual de Egresos por Categoría</div>
  <div class="card chart-container">
    ${categorySvgBarsHtml}
  </div>

  <!-- Budget Execution -->
  <div class="section-title">3. Estado de Ejecución Presupuestaria</div>
  ${budgetRowsHtml}

  <!-- Summary of Incomes -->
  <div class="section-title">4. Libro de Ingresos (${incomeTransactions.length})</div>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Categoría</th>
        <th>Billetera</th>
        <th>Descripción / Notas</th>
        <th style="text-align: right;">Monto</th>
      </tr>
    </thead>
    <tbody>
      ${renderTableRows(incomeTransactions)}
    </tbody>
  </table>

  <!-- Intentional Page Break for Formal Expense Ledger -->
  <div class="page-break-section">
    <div class="section-title">5. Historial Detallado de Egresos (${expenseTransactions.length})</div>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Categoría</th>
          <th>Billetera</th>
          <th>Descripción / Notas</th>
          <th style="text-align: right;">Monto</th>
        </tr>
      </thead>
      <tbody>
        ${renderTableRows(expenseTransactions)}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Documento generado de forma 100% privada y local en el dispositivo móvil mediante ${escapeHtml(
      APP_CONFIG.NAME
    )} (Motor SQLite + CSS Paged Media).
  </div>
</body>
</html>
  `;
}

/**
 * Renders the stylized HTML report to a local PDF file using expo-print
 * and opens the native Share Sheet.
 */
export async function generateAndSharePDFReport(): Promise<{ uri: string }> {
  const [summary, transactions, budgets] = await Promise.all([
    financeService.getDashboardSummary('all'),
    financeService.getTransactions(500, 'all'),
    financeService.getBudgetsWithProgress(),
  ]);

  const html = buildReportHtml({
    summary,
    transactions,
    budgets,
    generatedAt: new Date().toLocaleString('es-PE'),
  });

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Compartir Reporte Financiero PDF',
      UTI: 'com.adobe.pdf',
    });
  }

  return { uri };
}
