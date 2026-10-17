import { db } from '../../db/powersync';
import { deterministicId, LOCAL_DEMO_USER_ID } from '../../utils/id';

export const DEFAULT_CATEGORIES = [
  { key: 'food', name: 'Food', icon_identifier: '🍴', color_hex: '#F59E0B', type: 'EGRESO' },
  { key: 'fun', name: 'Ocio', icon_identifier: '🎬', color_hex: '#6366F1', type: 'EGRESO' },
  { key: 'health', name: 'Salud', icon_identifier: '💊', color_hex: '#EC4899', type: 'EGRESO' },
  { key: 'shopping', name: 'Shopping', icon_identifier: '🛒', color_hex: '#8B5CF6', type: 'EGRESO' },
  { key: 'transport', name: 'Transporte', icon_identifier: '🚗', color_hex: '#10B981', type: 'EGRESO' },
  { key: 'housing', name: 'Vivienda', icon_identifier: '🏠', color_hex: '#3B82F6', type: 'EGRESO' },
  { key: 'other_expense', name: 'Otros', icon_identifier: '✨', color_hex: '#64748B', type: 'EGRESO' },
  { key: 'salary', name: 'Sueldo', icon_identifier: '💼', color_hex: '#10B981', type: 'INGRESO' },
  { key: 'freelance', name: 'Freelance', icon_identifier: '🚀', color_hex: '#F97316', type: 'INGRESO' },
  { key: 'invest', name: 'Inversión', icon_identifier: '📈', color_hex: '#06B6D4', type: 'INGRESO' },
  { key: 'other_income', name: 'Otros', icon_identifier: '✨', color_hex: '#64748B', type: 'INGRESO' },
] as const;

export const DEFAULT_WALLETS = [
  { key: 'cash', name: 'Efectivo', currency_code: 'PEN' },
  { key: 'bank', name: 'Cuenta Banco', currency_code: 'PEN' },
] as const;

/**
 * Seeds default categories, wallets and a sample budget in PEN (S/.).
 *
 * Uses deterministic UUIDs (SHA-256 of userId + key) so that if the same user
 * signs in on multiple devices, the seeded rows produce the exact same UUIDs
 * and never duplicate on sync.
 */
export async function seedLocalDefaults(userId: string = LOCAL_DEMO_USER_ID): Promise<void> {
  const effectiveUserId = userId || LOCAL_DEMO_USER_ID;

  try {
    // If the user just signed in and already has local demo data, adopt it under their real userId
    if (effectiveUserId !== LOCAL_DEMO_USER_ID) {
      await db.writeTransaction(async (tx) => {
        await tx.execute('UPDATE categories SET user_id = ? WHERE user_id = ?', [
          effectiveUserId,
          LOCAL_DEMO_USER_ID,
        ]);
        await tx.execute('UPDATE wallets SET user_id = ? WHERE user_id = ?', [
          effectiveUserId,
          LOCAL_DEMO_USER_ID,
        ]);
        await tx.execute('UPDATE budgets SET user_id = ? WHERE user_id = ?', [
          effectiveUserId,
          LOCAL_DEMO_USER_ID,
        ]);
        await tx.execute('UPDATE transactions SET user_id = ? WHERE user_id = ?', [
          effectiveUserId,
          LOCAL_DEMO_USER_ID,
        ]);
      });
    }

    // Ensure any previously seeded USD default wallets use PEN
    await db.execute("UPDATE wallets SET currency_code = 'PEN' WHERE currency_code = 'USD'");

    const existingWallets = await db.getOptional<{ id: string }>(
      'SELECT id FROM wallets LIMIT 1'
    );
    const existingBudgets = await db.getOptional<{ id: string }>(
      'SELECT id FROM budgets LIMIT 1'
    );

    const now = new Date().toISOString();

    const cats = await Promise.all(
      DEFAULT_CATEGORIES.map(async (c) => ({
        ...c,
        id: await deterministicId(`${effectiveUserId}:cat:${c.key}`),
      }))
    );
    const wallets = await Promise.all(
      DEFAULT_WALLETS.map(async (w) => ({
        ...w,
        id: await deterministicId(`${effectiveUserId}:wallet:${w.key}`),
      }))
    );
    const budgetId = await deterministicId(`${effectiveUserId}:budget:food`);
    const foodCatId = cats.find((c) => c.key === 'food')!.id;

    await db.writeTransaction(async (tx) => {
      // Always ensure all default categories (including 'Otros') exist
      for (const c of cats) {
        const existsByName = await tx.getOptional<{ id: string }>(
          'SELECT id FROM categories WHERE name = ? AND type = ? LIMIT 1',
          [c.name, c.type]
        );
        if (!existsByName) {
          await tx.execute(
            `INSERT OR IGNORE INTO categories (id, user_id, name, icon_identifier, color_hex, type, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.id, effectiveUserId, c.name, c.icon_identifier, c.color_hex, c.type, now, now]
          );
        }
      }

      if (!existingWallets) {
        for (const w of wallets) {
          await tx.execute(
            `INSERT OR IGNORE INTO wallets (id, user_id, name, currency_code, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, 1, ?, ?)`,
            [w.id, effectiveUserId, w.name, w.currency_code, now, now]
          );
        }
      }

      if (!existingBudgets) {
        const targetFoodCat =
          (await tx.getOptional<{ id: string }>(
            "SELECT id FROM categories WHERE type = 'EGRESO' LIMIT 1"
          ))?.id ?? foodCatId;

        await tx.execute(
          `INSERT OR IGNORE INTO budgets (id, user_id, category_id, limit_amount, period, start_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'MONTHLY', ?, ?, ?)`,
          [budgetId, effectiveUserId, targetFoodCat, 1500, now, now, now]
        );
      }
    });
  } catch (error) {
    console.error('[Seed] Error seeding default SQLite data:', error);
  }
}
