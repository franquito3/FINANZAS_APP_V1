/**
 * Utility functions for formatting, UUID generation and calculations
 */
export * from './id';

/**
 * Formats an amount in Soles (S/. 15,123.45) by default
 */
export function formatCurrency(amount: number, currency: string = 'PEN'): string {
  const numeric = Number.isFinite(amount) ? amount : 0;
  const absFormatted = Math.abs(numeric).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const prefix = currency === 'PEN' || currency === 'S/.' ? 'S/.' : currency;
  const sign = numeric < 0 ? '- ' : '';
  return `${sign}${prefix} ${absFormatted}`;
}
