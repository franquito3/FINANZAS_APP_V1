import { db } from '../../db/powersync';
import {
  Category,
  DashboardSummary,
  Transaction,
  TransactionType,
  Wallet,
  Budget,
} from '../../types';

export const financeService = {
  /**
   * Retrieves dashboard summary metrics computed instantly from local SQLite
   */
  async getDashboardSummary(walletId?: string): Promise<DashboardSummary> {
    const walletFilter = walletId && walletId !== 'all' ? `AND t.wallet_id = '${walletId}'` : '';

    const incomeRow = await db.getOptional<{ total: number }>(
      `SELECT COALESCE(SUM(t.amount), 0) as total
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE c.type = 'INGRESO' ${walletFilter}`
    );

    const expenseRow = await db.getOptional<{ total: number }>(
      `SELECT COALESCE(SUM(t.amount), 0) as total
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE c.type = 'EGRESO' ${walletFilter}`
    );

    const totalIncome = incomeRow?.total ?? 0;
    const totalExpense = expenseRow?.total ?? 0;
    const totalBalance = totalIncome - totalExpense;

    // Compute budgets status for current month
    const budgets = await this.getBudgetsWithProgress();
    const budgetTotalLimit = budgets.reduce((acc, b) => acc + b.limit_amount, 0);
    const budgetTotalSpent = budgets.reduce((acc, b) => acc + (b.spent_amount ?? 0), 0);
    const budgetPercentage =
      budgetTotalLimit > 0 ? Math.min(Math.round((budgetTotalSpent / budgetTotalLimit) * 100), 100) : 0;

    return {
      totalBalance,
      totalIncome,
      totalExpense,
      budgetTotalLimit,
      budgetTotalSpent,
      budgetPercentage,
    };
  },

  /**
   * Fetches latest transactions joined with category metadata
   */
  async getTransactions(limit: number = 30, walletId?: string): Promise<Transaction[]> {
    const walletFilter = walletId && walletId !== 'all' ? `WHERE t.wallet_id = '${walletId}'` : '';

    const query = `
      SELECT 
        t.id,
        t.user_id,
        t.wallet_id,
        t.category_id,
        t.amount,
        t.transaction_date,
        t.notes,
        t.version,
        t.created_at,
        t.updated_at,
        c.name as category_name,
        c.icon_identifier as category_icon,
        c.color_hex as category_color,
        c.type as category_type,
        w.name as wallet_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN wallets w ON t.wallet_id = w.id
      ${walletFilter}
      ORDER BY t.transaction_date DESC
      LIMIT ${limit}
    `;

    const rows = await db.getAll<any>(query);
    return rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));
  },

  /**
   * Creates a transaction with sub-millisecond local SQLite insertion
   */
  async createTransaction(params: {
    amount: number;
    categoryId: string;
    walletId: string;
    notes?: string;
    userId: string;
    date?: string;
  }): Promise<string> {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = params.date || new Date().toISOString();
    const notes = params.notes?.trim() || '';

    await db.execute(
      `INSERT INTO transactions (id, user_id, wallet_id, category_id, amount, transaction_date, notes, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, params.userId, params.walletId, params.categoryId, params.amount, now, notes, now, now]
    );

    return id;
  },

  /**
   * Deletes a transaction from local SQLite (and enqueues sync delete)
   */
  async deleteTransaction(id: string): Promise<void> {
    await db.execute('DELETE FROM transactions WHERE id = ?', [id]);
  },

  /**
   * Fetches categories filtered by type
   */
  async getCategories(type?: TransactionType): Promise<Category[]> {
    const typeFilter = type ? `WHERE type = '${type}'` : '';
    return await db.getAll<Category>(
      `SELECT id, user_id, name, icon_identifier, color_hex, type FROM categories ${typeFilter} ORDER BY name ASC`
    );
  },

  /**
   * Fetches all active wallets
   */
  async getWallets(): Promise<Wallet[]> {
    return await db.getAll<Wallet>(
      'SELECT id, user_id, name, currency_code, is_active, created_at, updated_at FROM wallets WHERE is_active = 1 ORDER BY name ASC'
    );
  },

  /**
   * Fetches budgets with real-time calculated expenses
   */
  async getBudgetsWithProgress(): Promise<Budget[]> {
    const budgets = await db.getAll<any>(
      `SELECT 
        b.id, b.user_id, b.category_id, b.limit_amount, b.period, b.start_date, b.end_date, b.created_at, b.updated_at,
        c.name as category_name, c.color_hex as category_color
       FROM budgets b
       LEFT JOIN categories c ON b.category_id = c.id`
    );

    const results: Budget[] = [];

    for (const b of budgets) {
      const expenseRow = await db.getOptional<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total 
         FROM transactions 
         WHERE category_id = ?`,
        [b.category_id]
      );

      const spent = Number(expenseRow?.total ?? 0);
      const limit = Number(b.limit_amount);
      const percentage = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;

      results.push({
        ...b,
        limit_amount: limit,
        spent_amount: spent,
        percentage,
      });
    }

    return results;
  },
};
