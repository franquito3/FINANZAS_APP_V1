/**
 * Centralized environment configuration.
 * EXPO_PUBLIC_* variables must be referenced statically so Metro can inline them.
 */
export const ENV = {
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  POWERSYNC_URL: process.env.EXPO_PUBLIC_POWERSYNC_URL || '',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
} as const;

const PLACEHOLDERS = ['your-supabase-project', 'your-supabase-anon-key', 'your-powersync-instance'];

function isReal(value: string): boolean {
  return !!value && !PLACEHOLDERS.some((p) => value.includes(p));
}

export function isSupabaseConfigured(): boolean {
  return isReal(ENV.SUPABASE_URL) && isReal(ENV.SUPABASE_ANON_KEY);
}

export function isPowerSyncConfigured(): boolean {
  return isReal(ENV.POWERSYNC_URL);
}

export function validateEnv() {
  const missing: string[] = [];
  if (!isReal(ENV.SUPABASE_URL)) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!isReal(ENV.SUPABASE_ANON_KEY)) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!isReal(ENV.POWERSYNC_URL)) missing.push('EXPO_PUBLIC_POWERSYNC_URL');

  if (missing.length > 0) {
    console.warn(
      `[Config] Variables de entorno no configuradas o con valores de plantilla:\n  - ${missing.join('\n  - ')}\nActualice el archivo .env con las credenciales de su proyecto.`
    );
  }
}
