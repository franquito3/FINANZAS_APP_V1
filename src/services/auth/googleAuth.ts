import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../supabase/client';

WebBrowser.maybeCompleteAuthSession();

/**
 * Extracts URL query and fragment parameters for OAuth callback handling
 */
function extractParamsFromUrl(url: string): { [key: string]: string } {
  const params: { [key: string]: string } = {};

  // Parse query string (?a=b)
  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1) {
    const queryString = url.slice(queryIndex + 1).split('#')[0];
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((val, key) => {
      params[key] = val;
    });
  }

  // Parse hash fragment (#a=b)
  const hashIndex = url.indexOf('#');
  if (hashIndex !== -1) {
    const hashString = url.slice(hashIndex + 1);
    const hashParams = new URLSearchParams(hashString);
    hashParams.forEach((val, key) => {
      params[key] = val;
    });
  }

  return params;
}

/**
 * Initiates the Google OAuth sign-in flow with PKCE and deep linking
 */
export async function signInWithGoogleOAuth(): Promise<{ error: Error | null }> {
  try {
    const redirectUrl = Linking.createURL('auth/callback');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { error };
    }

    if (!data?.url) {
      return { error: new Error('No se pudo obtener la URL de autenticación de Supabase') };
    }

    const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (authResult.type === 'success' && authResult.url) {
      const params = extractParamsFromUrl(authResult.url);

      // Handle PKCE code exchange
      if (params.code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
        if (exchangeError) {
          return { error: exchangeError };
        }
        return { error: null };
      }

      // Handle direct tokens if present in hash fragment
      if (params.access_token && params.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (sessionError) {
          return { error: sessionError };
        }
        return { error: null };
      }

      if (params.error) {
        return { error: new Error(params.error_description || params.error) };
      }
    }

    if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
      return { error: new Error('Inicio de sesión cancelado por el usuario') };
    }

    return { error: null };
  } catch (err: any) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Signs out the current user session
 */
export async function signOutUser(): Promise<{ error: Error | null }> {
  try {
    // scope 'local' clears the session on this device even when offline
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    return { error };
  } catch (err: any) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}
