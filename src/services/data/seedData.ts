import { db } from '../../db/powersync';

export const DEFAULT_CATEGORIES = [
  { id: 'cat_food', name: 'Comida', icon_identifier: '🍔', color_hex: '#EF4444', type: 'EGRESO' },
  { id: 'cat_transport', name: 'Transporte', icon_identifier: '🚗', color_hex: '#F59E0B', type: 'EGRESO' },
  { id: 'cat_housing', name: 'Vivienda', icon_identifier: '🏠', color_hex: '#3B82F6', type: 'EGRESO' },
  { id: 'cat_health', name: 'Salud', icon_identifier: '💊', color_hex: '#10B981', type: 'EGRESO' },
  { id: 'cat_fun', name: 'Ocio', icon_identifier: '🎬', color_hex: '#8B5CF6', type: 'EGRESO' },
  { id: 'cat_shopping', name: 'Compras', icon_identifier: '🛍️', color_hex: '#EC4899', type: 'EGRESO' },
  { id: 'cat_salary', name: 'Sueldo', icon_identifier: '💼', color_hex: '#10B981', type: 'INGRESO' },
  { id: 'cat_freelance', name: 'Freelance', icon_identifier: '🚀', color_hex: '#F97316', type: 'INGRESO' },
  { id: 'cat_invest', name: 'Inversión', icon_identifier: '📈', color_hex: '#06B6D4', type: 'INGRESO' },
];

export const DEFAULT_WALLETS = [
  { id: 'wallet_cash', name: 'Efectivo', currency_code: 'USD', is_active: 1 },
  { id: 'wallet_bank', name: 'Cuenta Banco', currency_code: 'USD', is_active: 1 },
];

/**
 * Seeds default categories, wallets and sample budget in local SQLite if empty
 */
export async function seedLocalDefaults(userId: string = 'local_user'): Promise<void> {
  try {
    const existingCats = await db.getAll('SELECT id FROM categories LIMIT 1');
    const now = new Date().toISOString();

    if (existingCats.length === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await db.execute(
          `INSERT INTO categories (id, user_id, name, icon_identifier, color_hex, type, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [cat.id, userId, cat.name, cat.icon_identifier, cat.color_hex, cat.type, now, now]
        );
      }
      console.log('[Seed] Default categories initialized in SQLite');
    }

    const existingWallets = await db.getAll('SELECT id FROM wallets LIMIT 1');
    if (existingWallets.length === 0) {
      for (const w of DEFAULT_WALLETS) {
        await db.execute(
          `INSERT INTO wallets (id, user_id, name, currency_code, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [w.id, userId, w.name, w.currency_code, w.is_active, now, now]
        );
      }
      console.log('[Seed] Default wallets initialized in SQLite');
    }

    const existingBudgets = await db.getAll('SELECT id FROM budgets LIMIT 1');
    if (existingBudgets.length === 0) {
      await db.execute(
        `INSERT INTO budgets (id, user_id, category_id, limit_amount, period, start_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['budget_monthly_food', userId, 'cat_food', 500, 'MONTHLY', now, now, now]
      );
      console.log('[Seed] Default budget initialized in SQLite');
    }
  } catch (error) {
    console.error('[Seed] Error seeding default SQLite data:', error);
  }
}
