import Papa from 'papaparse';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Transaction } from '../../types';
import { financeService } from '../data/financeService';

export interface CsvExportRow {
  ID: string;
  Fecha_ISO: string;
  Fecha_Local: string;
  Tipo: string;
  Categoria: string;
  Billetera: string;
  Monto: string;
  Notas: string;
  Version: number;
}

/**
 * Generates an RFC 4180 compliant CSV file locally using PapaParse
 * and invokes the native OS Share Sheet.
 */
export async function exportTransactionsToCSV(
  customTransactions?: Transaction[]
): Promise<{ uri: string; rowCount: number }> {
  const transactions =
    customTransactions ?? (await financeService.getTransactions(1000, 'all'));

  const rows: CsvExportRow[] = transactions.map((tx) => ({
    ID: tx.id,
    Fecha_ISO: tx.transaction_date,
    Fecha_Local: new Date(tx.transaction_date).toLocaleString('es-PE'),
    Tipo: tx.category_type || 'EGRESO',
    Categoria: tx.category_name || 'Sin Categoría',
    Billetera: tx.wallet_name || 'Efectivo',
    Monto: Number(tx.amount).toFixed(2),
    // PapaParse automatically escapes internal quotes, commas, and line breaks per RFC 4180
    Notas: tx.notes || '',
    Version: tx.version || 1,
  }));

  // Strict RFC 4180 unparsing
  const csvContent = Papa.unparse(rows, {
    quotes: true,
    quoteChar: '"',
    escapeChar: '"',
    delimiter: ',',
    header: true,
    newline: '\r\n',
  });

  // Add UTF-8 BOM (\uFEFF) so Excel recognizes accents and special characters immediately
  const bomCsv = `\uFEFF${csvContent}`;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `reporte_contable_${timestamp}.csv`;

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(bomCsv);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Exportar Libro Contable (CSV / Excel)',
      UTI: 'public.comma-separated-values-text',
    });
  }

  return { uri: file.uri, rowCount: rows.length };
}
