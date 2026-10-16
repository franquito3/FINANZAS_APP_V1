// Financial Application Domain Types
export type CurrencyCode = 'USD' | 'EUR' | 'PEN' | 'MXN' | 'COP' | 'ARS';

export type TransactionType = 'INGRESO' | 'EGRESO';

export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  currency_code: CurrencyCode;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id?: string | null;
  name: string;
  icon_identifier: string;
  color_hex: string;
  type: TransactionType;
  created_at?: string;
  updated_at?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  category_id: string;
  amount: number;
  transaction_date: string;
  notes: string;
  version: number;
  created_at: string;
  updated_at: string;

  // Joined fields for display
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  category_type?: TransactionType;
  wallet_name?: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  limit_amount: number;
  period: string;
  start_date: string;
  end_date?: string | null;
  created_at: string;
  updated_at: string;

  // Computed fields
  spent_amount?: number;
  percentage?: number;
  category_name?: string;
  category_color?: string;
}

export interface DashboardSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  budgetTotalLimit: number;
  budgetTotalSpent: number;
  budgetPercentage: number;
}
