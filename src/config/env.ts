/**
 * Centralized environment configuration
 * Reads variables exposed via EXPO_PUBLIC_* prefix
 */

export const ENV = {
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  POWERSYNC_URL: process.env.EXPO_PUBLIC_POWERSYNC_URL || '',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
} as const;

export function validateEnv() {
  const missing: string[] = [];
  if (!ENV.SUPABASE_URL || ENV.SUPABASE_URL.includes('your-supabase-project')) {
    missing.push('EXPO_PUBLIC_SUPABASE_URL');
  }
  if (!ENV.SUPABASE_ANON_KEY || ENV.SUPABASE_ANON_KEY.includes('your-supabase-anon-key')) {
    missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (!ENV.POWERSYNC_URL || ENV.POWERSYNC_URL.includes('your-powersync-instance')) {
    missing.push('EXPO_PUBLIC_POWERSYNC_URL');
  }

  if (missing.length > 0) {
    console.warn(
      `[Config] Variables de entorno no configuradas o con valores de plantilla:\n  - ${missing.join('\n  - ')}\nActualice el archivo .env con las credenciales de su proyecto.`
    );
  }
}
