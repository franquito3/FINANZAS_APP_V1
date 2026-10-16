import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../config/env';
import { ExpoSecureStoreAdapter } from '../storage/secureStoreAdapter';

// Fallback dummy values to avoid runtime crashes during initial setup before credentials are added
const supabaseUrl = ENV.SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = ENV.SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Proactively manage autoRefresh based on application foreground/background state
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
