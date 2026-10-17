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
 * Builds a compact, high-density A4 HTML financial report inspired by the
 * ProyectoX Finanzas Liquid Glass design (deep navy-to-violet hero header,
 * compact budget semaphore, category breakdown, and dense transaction feed)
 * with strict CSS Paged Media rules (@page, break-inside: avoid).
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
  const categoryMap = new Map<
    string,
    { name: string; color: string; icon: string; amount: number }
  >();
  for (const tx of expenseTransactions) {
    const key = tx.category_id || 'other';
    const existing = categoryMap.get(key) || {
      name: tx.category_name || 'Otros',
      color: tx.category_color || '#3B82F6',
      icon: tx.category_icon || '💸',
      amount: 0,
    };
    existing.amount += Number(tx.amount);
    categoryMap.set(key, existing);
  }
  const categoryBreakdown = Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);

  const globalPct = Math.min(Math.max(summary.budgetPercentage || 0, 0), 100);
  const globalBarColor =
    globalPct >= 90 ? '#EF4444' : globalPct >= 70 ? '#F59E0B' : '#2563EB';

  const budgetRowsHtml =
    budgets.length === 0
      ? `<div class="empty-msg">Sin presupuestos específicos configurados.</div>`
      : budgets
          .map((b) => {
            const pct = Math.min(Math.max(b.percentage ?? 0, 0), 100);
            const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#2563EB';
            return `
            <div class="budget-item">
              <div class="budget-header">
                <span class="budget-cat">${escapeHtml(b.category_name || 'Categoría')} <small>(${escapeHtml(b.period)})</small></span>
                <span class="budget-pct" style="color: ${barColor};">${pct}% consumido</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width: ${pct}%; background-color: ${barColor};"></div>
              </div>
              <div class="budget-meta">
                Gastado: <strong>${formatCurrency(b.spent_amount ?? 0)}</strong> de ${formatCurrency(b.limit_amount)}
              </div>
            </div>
          `;
          })
          .join('');

  const categorySvgBarsHtml =
    categoryBreakdown.length === 0
      ? `<div class="empty-msg">Sin egresos registrados en el período.</div>`
      : categoryBreakdown
          .map((cat) => {
            const pct =
              summary.totalExpense > 0
                ? Math.round((cat.amount / summary.totalExpense) * 100)
                : 0;
            return `
            <div class="chart-row">
              <div class="chart-label">
                <span class="cat-badge" style="background-color: ${cat.color};">${cat.icon}</span>
                <span class="cat-name">${escapeHtml(cat.name)}</span>
              </div>
              <div class="chart-bar-wrap">
                <svg width="100%" height="8" viewBox="0 0 200 8" preserveAspectRatio="none">
                  <rect x="0" y="0" width="200" height="8" rx="4" fill="#F1F5F9" />
                  <rect x="0" y="0" width="${Math.max(pct * 2, 4)}" height="8" rx="4" fill="${cat.color}" />
                </svg>
              </div>
              <div class="chart-value">${formatCurrency(cat.amount)} <span class="pct-muted">(${pct}%)</span></div>
            </div>
          `;
          })
          .join('');

  const renderTransactionRows = (list: Transaction[]) => {
    if (list.length === 0) {
      return `<tr><td colspan="5" class="empty-cell">No hay movimientos registrados</td></tr>`;
    }
    return list
      .map((tx) => {
        const isIncome = tx.category_type === 'INGRESO';
        const badgeColor = tx.category_color || (isIncome ? '#10B981' : '#3B82F6');
        const icon = tx.category_icon || (isIncome ? '💰' : '💸');
        const title = tx.notes && tx.notes.trim().length > 0 ? tx.notes : tx.category_name || 'Operación';
        const dateStr = new Date(tx.transaction_date).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });

        return `
        <tr>
          <td class="col-cat">
            <div class="tx-cat-cell">
              <span class="tx-avatar" style="background-color: ${badgeColor};">${icon}</span>
              <div>
                <div class="tx-title">${escapeHtml(title)}</div>
                <div class="tx-sub">${escapeHtml(tx.category_name || 'General')}</div>
              </div>
            </div>
          </td>
          <td class="col-date">${dateStr}</td>
          <td class="col-wallet"><span class="wallet-pill">${escapeHtml(tx.wallet_name || 'Principal')}</span></td>
          <td class="col-type">
            <span class="type-pill ${isIncome ? 'pill-income' : 'pill-expense'}">
              ${isIncome ? '+ Ingreso' : '- Gasto'}
            </span>
          </td>
          <td class="col-amount ${isIncome ? 'text-income' : 'text-expense'}">
            ${isIncome ? '+' : '-'} ${formatCurrency(tx.amount)}
          </td>
        </tr>
      `;
      })
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
       Compact A4 Portrait Layout - ProyectoX Finanzas (Liquid Glass Edition)
       ========================================================================= */
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
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
      line-height: 1.38;
      font-size: 10.5px;
    }

    /* Prevent awkward cuts across pages */
    .hero-banner,
    .semaphore-box,
    .panel-card,
    .two-col-grid,
    .budget-item,
    .chart-row,
    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Top Hero Gradient Banner matching DashboardScreen */
    .hero-banner {
      background: linear-gradient(135deg, #070D2D 0%, #161D65 52%, #351875 100%);
      border-radius: 20px;
      padding: 18px 20px;
      color: #FFFFFF;
      margin-bottom: 14px;
      box-shadow: 0 8px 20px rgba(7, 13, 45, 0.18);
    }

    .hero-top-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
    }

    .brand-title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.3px;
      color: #FFFFFF;
      line-height: 1.1;
    }

    .brand-subtitle {
      font-size: 14px;
      font-weight: 400;
      color: rgba(255, 255, 255, 0.85);
      margin-top: 1px;
    }

    .hero-meta-right {
      text-align: right;
    }

    .sqlite-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 999px;
      padding: 3px 10px;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.6px;
      color: #FFFFFF;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .sqlite-dot {
      width: 6px;
      height: 6px;
      border-radius: 3px;
      background-color: #10B981;
      display: inline-block;
    }

    .meta-date {
      font-size: 9.5px;
      color: rgba(255, 255, 255, 0.72);
    }

    /* Liquid Glass Balance Card inside Hero */
    .glass-balance-card {
      background: rgba(255, 255, 255, 0.10);
      border: 1.2px solid rgba(56, 189, 248, 0.45);
      border-radius: 16px;
      padding: 14px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
    }

    .balance-label {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.78);
      margin-bottom: 3px;
    }

    .balance-amount {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.6px;
      color: #FFFFFF;
    }

    .quick-pills-wrap {
      display: flex;
      gap: 10px;
    }

    .quick-pill {
      background: rgba(15, 23, 42, 0.48);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 12px;
      padding: 8px 12px;
      min-width: 125px;
    }

    .quick-pill-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.72);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .quick-pill-value {
      font-size: 13px;
      font-weight: 800;
      margin-top: 2px;
    }

    .val-income { color: #34D399; }
    .val-expense { color: #F87171; }

    /* Compact Budget Semaphore Card */
    .semaphore-box {
      background-color: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 14px;
      padding: 10px 14px;
      margin-bottom: 12px;
    }

    .semaphore-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .semaphore-title {
      font-size: 11.5px;
      font-weight: 800;
      color: #0F172A;
    }

    .semaphore-pct {
      font-size: 10.5px;
      font-weight: 700;
      color: #475569;
    }

    .progress-track {
      height: 7px;
      background-color: #E2E8F0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 4px;
    }

    /* Two-column compact middle section */
    .two-col-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 14px;
    }

    .col-half {
      flex: 1;
      border: 1px solid #E2E8F0;
      border-radius: 14px;
      padding: 11px 13px;
      background-color: #FFFFFF;
    }

    .panel-title {
      font-size: 11px;
      font-weight: 800;
      color: #0F172A;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 8px;
      padding-bottom: 5px;
      border-bottom: 1px solid #F1F5F9;
    }

    .chart-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .chart-label {
      width: 105px;
      display: flex;
      align-items: center;
      gap: 5px;
      font-weight: 700;
      font-size: 10px;
      color: #1E293B;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cat-badge {
      width: 18px;
      height: 18px;
      border-radius: 9px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      color: #FFFFFF;
      flex-shrink: 0;
    }

    .chart-bar-wrap {
      flex: 1;
    }

    .chart-value {
      width: 92px;
      text-align: right;
      font-weight: 700;
      font-size: 9.5px;
      color: #0F172A;
    }

    .pct-muted {
      color: #64748B;
      font-weight: 600;
    }

    .budget-item {
      margin-bottom: 7px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #F1F5F9;
    }

    .budget-item:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }

    .budget-header {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      margin-bottom: 4px;
    }

    .budget-cat {
      font-weight: 700;
      color: #1E293B;
    }

    .budget-cat small {
      color: #64748B;
      font-weight: 600;
    }

    .budget-pct {
      font-weight: 800;
    }

    .budget-meta {
      font-size: 9px;
      color: #64748B;
      text-align: right;
      margin-top: 3px;
    }

    /* Dense Transactions Feed Table */
    .section-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      margin-top: 4px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.2px;
    }

    .section-count {
      font-size: 10px;
      font-weight: 700;
      color: #64748B;
      background-color: #F1F5F9;
      padding: 2px 8px;
      border-radius: 999px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 10px;
    }

    th {
      background-color: #F8FAFC;
      color: #475569;
      text-align: left;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 7px 10px;
      border-bottom: 1px solid #E2E8F0;
    }

    td {
      padding: 6px 10px;
      border-bottom: 1px solid #F1F5F9;
      font-size: 10px;
      color: #1E293B;
      vertical-align: middle;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .tx-cat-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .tx-avatar {
      width: 24px;
      height: 24px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: #FFFFFF;
      flex-shrink: 0;
    }

    .tx-title {
      font-weight: 700;
      color: #0F172A;
      font-size: 10px;
      line-height: 1.2;
    }

    .tx-sub {
      font-size: 8.5px;
      color: #64748B;
    }

    .col-date {
      width: 85px;
      color: #64748B;
      font-weight: 600;
      white-space: nowrap;
    }

    .col-wallet {
      width: 90px;
    }

    .wallet-pill {
      background-color: #F1F5F9;
      color: #334155;
      padding: 2px 7px;
      border-radius: 6px;
      font-size: 9px;
      font-weight: 700;
    }

    .col-type {
      width: 78px;
    }

    .type-pill {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 6px;
      font-size: 8.5px;
      font-weight: 800;
    }

    .pill-income {
      background-color: #DCFCE7;
      color: #15803D;
    }

    .pill-expense {
      background-color: #FEE2E2;
      color: #B91C1C;
    }

    .col-amount {
      width: 105px;
      text-align: right;
      font-weight: 800;
      font-size: 10.5px;
      white-space: nowrap;
    }

    .text-income { color: #10B981; }
    .text-expense { color: #0F172A; }

    .empty-cell, .empty-msg {
      text-align: center;
      color: #94A3B8;
      padding: 10px;
      font-style: italic;
      font-size: 9.5px;
    }

    .footer {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #E2E8F0;
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      color: #94A3B8;
    }
  </style>
</head>
<body>
  <!-- Top Hero Banner (Matching App Dashboard) -->
  <div class="hero-banner">
    <div class="hero-top-row">
      <div>
        <div class="brand-title">ProyectoX</div>
        <div class="brand-subtitle">Finanzas • Reporte Ejecutivo</div>
      </div>
      <div class="hero-meta-right">
        <div class="sqlite-pill">
          <span class="sqlite-dot"></span>
          <span>SQLITE LOCAL</span>
        </div>
        <div class="meta-date">Emitido: ${escapeHtml(generatedAt)}</div>
      </div>
    </div>

    <!-- Liquid Glass Balance Card -->
    <div class="glass-balance-card">
      <div>
        <div class="balance-label">SALDO OPERATIVO DISPONIBLE</div>
        <div class="balance-amount">${formatCurrency(summary.totalBalance)}</div>
      </div>
      <div class="quick-pills-wrap">
        <div class="quick-pill">
          <div class="quick-pill-label"><span style="color:#34D399;">+</span> Ingresos (${incomeTransactions.length})</div>
          <div class="quick-pill-value val-income">+ ${formatCurrency(summary.totalIncome)}</div>
        </div>
        <div class="quick-pill">
          <div class="quick-pill-label"><span style="color:#F87171;">−</span> Gastos (${expenseTransactions.length})</div>
          <div class="quick-pill-value val-expense">- ${formatCurrency(summary.totalExpense)}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Compact Budget Semaphore -->
  <div class="semaphore-box">
    <div class="semaphore-header">
      <span class="semaphore-title">Semáforo de Presupuesto Global</span>
      <span class="semaphore-pct">
        ${
          summary.budgetTotalLimit > 0
            ? `${globalPct}% consumido (${formatCurrency(summary.budgetTotalSpent)} / ${formatCurrency(summary.budgetTotalLimit)})`
            : `${globalPct}% consumido`
        }
      </span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" style="width: ${globalPct}%; background-color: ${globalBarColor};"></div>
    </div>
  </div>

  <!-- Compact 2-Column Breakdown: Categories + Budgets -->
  <div class="two-col-grid">
    <div class="col-half">
      <div class="panel-title">Gastos por Categoría</div>
      ${categorySvgBarsHtml}
    </div>
    <div class="col-half">
      <div class="panel-title">Detalle de Presupuestos</div>
      ${budgetRowsHtml}
    </div>
  </div>

  <!-- Unified Compact Transactions Feed -->
  <div class="section-header-row">
    <div class="section-title">Transacciones Registradas</div>
    <div class="section-count">${transactions.length} movimientos en Soles (S/.)</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Transacción / Categoría</th>
        <th>Fecha</th>
        <th>Billetera</th>
        <th>Tipo</th>
        <th style="text-align: right;">Monto (S/.)</th>
      </tr>
    </thead>
    <tbody>
      ${renderTransactionRows(transactions)}
    </tbody>
  </table>

  <div class="footer">
    <span>${escapeHtml(APP_CONFIG.NAME)} • Motor Offline-First (SQLite + PowerSync)</span>
    <span>Moneda: Soles Peruanos (S/. PEN) • Paginación A4 Compacta</span>
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
