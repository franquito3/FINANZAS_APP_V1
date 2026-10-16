import * as Crypto from 'expo-crypto';

/**
 * Valid UUID v4 used only when testing the app locally before signing in with Supabase.
 * Once the user signs in, their real `auth.uid()` UUID is used everywhere.
 */
export const LOCAL_DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Generates a random UUID v4. Required because remote Postgres columns are of type UUID.
 */
export function newId(): string {
  return Crypto.randomUUID();
}

/**
 * Generates a deterministic UUID-formatted id from a seed string (SHA-256 based).
 * Used for default seed rows (categories/wallets) so that seeding the same user on
 * several devices produces the SAME ids and never creates duplicates after sync.
 */
export async function deterministicId(seed: string): Promise<string> {
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, seed);
  const h = hex.slice(0, 32).split('');
  h[12] = '5'; // version nibble
  h[16] = ['8', '9', 'a', 'b'][parseInt(h[16], 16) % 4]; // RFC 4122 variant
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
