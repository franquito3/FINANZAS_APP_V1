import { db } from '../../db/powersync';
import { newId } from '../../utils/id';
import {
  Budget,
  Category,
  DashboardSummary,
  Transaction,
  TransactionType,
  Wallet,
} from '../../types';

/** Returns [startISO, endISO) of the current budget period. */
function currentPeriodRange(period: string): [string, string] {
  const now = new Date();
  if (period === 'WEEKLY') {
    const start = new Date(now);
    const day = (start.getDay() + 6) % 7; // Monday = 0
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return [start.toISOString(), end.toISOString()];
  }
  // Default: MONTHLY
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return [start.toISOString(), end.toISOString()];
}

/** Builds an optional wallet filter with bound parameters (no string interpolation of values). */
function walletClause(walletId?: string): { sql: string; params: string[] } {
  if (walletId && walletId !== 'all') {
    return { sql: 'AND t.wallet_id = ?', params: [walletId] };
  }
  return { sql: '', params: [] };
}

export const financeService = {
  /**
   * Retrieves dashboard summary metrics computed instantly from local SQLite
   */
  async getDashboardSummary(walletId?: string): Promise<DashboardSummary> {
    const w = walletClause(walletId);

    const row = await db.getOptional<{ income: number; expense: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN c.type = 'INGRESO' THEN t.amount ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN c.type = 'EGRESO'  THEN t.amount ELSE 0 END), 0) AS expense
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE 1 = 1 ${w.sql}`,
      w.params
    );

    const totalIncome = Number(row?.income ?? 0);
    const totalExpense = Number(row?.expense ?? 0);

    const budgets = await this.getBudgetsWithProgress();
    const budgetTotalLimit = budgets.reduce((acc, b) => acc + b.limit_amount, 0);
    const budgetTotalSpent = budgets.reduce((acc, b) => acc + (b.spent_amount ?? 0), 0);
    const budgetPercentage =
      budgetTotalLimit > 0
        ? Math.min(Math.round((budgetTotalSpent / budgetTotalLimit) * 100), 100)
        : 0;

    return {
      totalBalance: totalIncome - totalExpense,
      totalIncome,
      totalExpense,
      budgetTotalLimit,
      budgetTotalSpent,
      budgetPercentage,
    };
  },

  /**
   * Fetches latest transactions joined with category and wallet metadata
   */
  async getTransactions(limit: number = 30, walletId?: string): Promise<Transaction[]> {
    const w = walletClause(walletId);
    const rows = await db.getAll<any>(
      `SELECT
         t.id, t.user_id, t.wallet_id, t.category_id, t.amount, t.transaction_date,
         t.notes, t.version, t.created_at, t.updated_at,
         c.name AS category_name, c.icon_identifier AS category_icon,
         c.color_hex AS category_color, c.type AS category_type,
         wl.name AS wallet_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN wallets wl ON t.wallet_id = wl.id
       WHERE 1 = 1 ${w.sql}
       ORDER BY t.transaction_date DESC
       LIMIT ?`,
      [...w.params, limit]
    );
    return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
  },

  /**
   * Creates a transaction with a real UUID (required by the Postgres UUID column)
   */
  async createTransaction(params: {
    amount: number;
    categoryId: string;
    walletId: string;
    notes?: string;
    userId: string;
    date?: string;
  }): Promise<string> {
    const id = newId();
    const now = new Date().toISOString();
    const txDate = params.date || now;

    await db.execute(
      `INSERT INTO transactions (id, user_id, wallet_id, category_id, amount, transaction_date, notes, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, params.userId, params.walletId, params.categoryId, params.amount, txDate, params.notes?.trim() || '', now, now]
    );
    return id;
  },

  /**
   * Updates a transaction. Increments `version` so the connector can detect
   * concurrent edits made from another device (optimistic concurrency control).
   */
  async updateTransaction(
    id: string,
    changes: Partial<Pick<Transaction, 'amount' | 'category_id' | 'wallet_id' | 'notes' | 'transaction_date'>>
  ): Promise<void> {
    const allowed = ['amount', 'category_id', 'wallet_id', 'notes', 'transaction_date'] as const;
    const cols = allowed.filter((k) => changes[k] !== undefined);
    if (cols.length === 0) return;

    const setSql = cols.map((c) => `${c} = ?`).join(', ');
    const values = cols.map((c) => changes[c] as any);
    await db.execute(
      `UPDATE transactions SET ${setSql}, version = version + 1, updated_at = ? WHERE id = ?`,
      [...values, new Date().toISOString(), id]
    );
  },

  /**
   * Deletes a transaction from local SQLite (the delete is queued for sync)
   */
  async deleteTransaction(id: string): Promise<void> {
    await db.execute('DELETE FROM transactions WHERE id = ?', [id]);
  },

  async getCategories(type?: TransactionType): Promise<Category[]> {
    if (type) {
      return db.getAll<Category>(
        'SELECT id, user_id, name, icon_identifier, color_hex, type FROM categories WHERE type = ? ORDER BY name ASC',
        [type]
      );
    }
    return db.getAll<Category>(
      'SELECT id, user_id, name, icon_identifier, color_hex, type FROM categories ORDER BY name ASC'
    );
  },

  async getWallets(): Promise<Wallet[]> {
    return db.getAll<Wallet>(
      'SELECT id, user_id, name, currency_code, is_active, created_at, updated_at FROM wallets WHERE is_active = 1 ORDER BY name ASC'
    );
  },

  /**
   * Budgets with spent amount computed ONLY for expenses inside the current period
   */
  async getBudgetsWithProgress(): Promise<Budget[]> {
    const budgets = await db.getAll<any>(
      `SELECT b.id, b.user_id, b.category_id, b.limit_amount, b.period, b.start_date, b.end_date,
              b.created_at, b.updated_at, c.name AS category_name, c.color_hex AS category_color
       FROM budgets b
       LEFT JOIN categories c ON b.category_id = c.id`
    );

    const results: Budget[] = [];
    for (const b of budgets) {
      const [start, end] = currentPeriodRange(b.period);
      const row = await db.getOptional<{ total: number }>(
        `SELECT COALESCE(SUM(t.amount), 0) AS total
         FROM transactions t
         JOIN categories c ON t.category_id = c.id
         WHERE t.category_id = ? AND c.type = 'EGRESO'
           AND t.transaction_date >= ? AND t.transaction_date < ?`,
        [b.category_id, start, end]
      );

      const spent = Number(row?.total ?? 0);
      const limit = Number(b.limit_amount);
      results.push({
        ...b,
        limit_amount: limit,
        spent_amount: spent,
        percentage: limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0,
      });
    }
    return results;
  },
};
