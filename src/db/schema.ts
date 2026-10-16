import { column, Schema, Table } from '@powersync/react-native';

/**
 * PowerSync Local SQLite Schema definition
 * Maps directly to remote PostgreSQL / Supabase tables
 */

// 1. Profiles Table (user settings & currency preferences)
export const profilesTable = new Table(
  {
    email: column.text,
    full_name: column.text,
    avatar_url: column.text,
    default_currency: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { email: ['email'] } }
);

// 2. Wallets Table (Cash, Credit Card, Bank Account, etc.)
export const walletsTable = new Table(
  {
    user_id: column.text,
    name: column.text,
    currency_code: column.text,
    is_active: column.integer, // 1 for true, 0 for false
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { user_id: ['user_id'] } }
);

// 3. Categories Table (Food, Salary, Transport, etc.)
export const categoriesTable = new Table(
  {
    user_id: column.text,
    name: column.text,
    icon_identifier: column.text,
    color_hex: column.text,
    type: column.text, // 'INGRESO' | 'EGRESO'
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { user_and_type: ['user_id', 'type'] } }
);

// 4. Transactions Table (Income, Expenses, Transfers)
export const transactionsTable = new Table(
  {
    user_id: column.text,
    wallet_id: column.text,
    category_id: column.text,
    amount: column.real, // Strict decimal floating/fixed amount
    transaction_date: column.text, // ISO-8601 string
    notes: column.text,
    version: column.integer, // Concurrency control version
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      user_date: ['user_id', 'transaction_date'],
      wallet: ['wallet_id'],
      category: ['category_id'],
    },
  }
);

// 5. Budgets Table (Thresholds and spending limits)
export const budgetsTable = new Table(
  {
    user_id: column.text,
    category_id: column.text,
    limit_amount: column.real,
    period: column.text, // 'MONTHLY', 'WEEKLY', etc.
    start_date: column.text,
    end_date: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { user_category: ['user_id', 'category_id'] } }
);

// 6. Local Conflict Audit Table (Tracks concurrent collisions)
export const syncConflictsTable = new Table({
  entity_table: column.text,
  record_id: column.text,
  local_data: column.text,
  remote_data: column.text,
  detected_at: column.text,
  resolved: column.integer, // 0 for unresolved, 1 for resolved
});

export const AppSchema = new Schema({
  profiles: profilesTable,
  wallets: walletsTable,
  categories: categoriesTable,
  transactions: transactionsTable,
  budgets: budgetsTable,
  sync_conflicts: syncConflictsTable,
});

export type Database = (typeof AppSchema)['types'];
