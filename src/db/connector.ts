import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
  UpdateType,
} from '@powersync/react-native';
import { supabase } from '../services/supabase/client';
import { ENV, isPowerSyncConfigured } from '../config/env';
import { recordConflict } from './conflictResolution';
import { LOCAL_DEMO_USER_ID } from '../utils/id';

export type AuthExpiredListener = () => void;
const authExpiredListeners = new Set<AuthExpiredListener>();

export function onAuthExpired(listener: AuthExpiredListener): () => void {
  authExpiredListeners.add(listener);
  return () => {
    authExpiredListeners.delete(listener);
  };
}

function notifyAuthExpired() {
  authExpiredListeners.forEach((l) => {
    try {
      l();
    } catch (e) {
      console.error('[Connector] auth-expired listener error', e);
    }
  });
}

/**
 * Postgres error classes that will NEVER succeed on retry:
 *  22xxx data exception (e.g. invalid UUID), 23xxx integrity violation (FK, unique, check),
 *  42501 insufficient privilege (RLS rejection).
 * If these were re-thrown the upload queue would be blocked forever.
 */
const FATAL_PG_CODE = [/^22...$/, /^23...$/, /^42501$/];

function isFatal(code?: string): boolean {
  return !!code && FATAL_PG_CODE.some((re) => re.test(code));
}

function isAuthError(status: number | undefined, error: any): boolean {
  return (
    status === 401 ||
    error?.code === 'PGRST301' ||
    error?.code === 'PGRST303' ||
    /jwt/i.test(error?.message ?? '')
  );
}

/** Converts SQLite representations back to Postgres-friendly values. */
function toRemote(
  table: string,
  data: Record<string, any>,
  authenticatedUserId?: string
): Record<string, any> {
  const out = { ...data };
  if (table === 'wallets' && out.is_active !== undefined && out.is_active !== null) {
    out.is_active = Boolean(out.is_active);
  }
  if (authenticatedUserId && out.user_id === LOCAL_DEMO_USER_ID) {
    out.user_id = authenticatedUserId;
  }
  return out;
}

/**
 * Backend connector linking the local SQLite database with Supabase / PowerSync Service.
 */
export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    if (!isPowerSyncConfigured()) {
      console.warn('[PowerSync] EXPO_PUBLIC_POWERSYNC_URL no configurada: modo solo-local.');
      return null;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error; // temporary error -> PowerSync retries
    const session = data.session;
    if (!session) return null; // not signed in

    return {
      endpoint: ENV.POWERSYNC_URL,
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }

  /**
   * Uploads queued local mutations, one transaction at a time, in order.
   * - Network / auth errors are thrown -> PowerSync keeps the data and retries later.
   * - Fatal data errors and version conflicts are recorded in `sync_conflicts`
   *   and skipped so they never block the rest of the queue.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const authUserId = sessionData.session?.user?.id;

    for (const op of transaction.crud) {
      await this.uploadOperation(database, op, authUserId);
    }

    await transaction.complete();
  }

  private async uploadOperation(
    database: AbstractPowerSyncDatabase,
    op: CrudEntry,
    authUserId?: string
  ): Promise<void> {
    const table = op.table;
    const data = toRemote(table, op.opData ?? {}, authUserId);

    let result: { error: any; status: number };

    switch (op.op) {
      case UpdateType.PUT:
        result = await supabase.from(table).upsert({ ...data, id: op.id });
        break;

      case UpdateType.PATCH: {
        const prevVersion = op.previousValues?.version;
        let query = supabase.from(table).update(data).eq('id', op.id);

        // Optimistic concurrency: only apply if the server still has the version we edited.
        const useVersionCheck = table === 'transactions' && prevVersion !== undefined && prevVersion !== null;
        if (useVersionCheck) {
          query = query.eq('version', prevVersion);
        }

        const res = await query.select('id');
        result = res;

        if (!res.error && useVersionCheck && (res.data?.length ?? 0) === 0) {
          const { data: remote } = await supabase.from(table).select('*').eq('id', op.id).maybeSingle();
          await recordConflict(database, table, op.id, data, remote ?? { deleted_remotely: true });
          return; // skip; server row will be re-downloaded by PowerSync
        }
        break;
      }

      case UpdateType.DELETE:
        result = await supabase.from(table).delete().eq('id', op.id);
        break;

      default:
        return;
    }

    if (!result.error) return;

    const { error, status } = result;

    if (isAuthError(status, error)) {
      notifyAuthExpired();
      throw new Error('AUTH_EXPIRED: se requiere reautenticación para sincronizar');
    }

    if (status === 409 || isFatal(error?.code)) {
      await recordConflict(database, table, op.id, data, {
        rejected_by_server: true,
        code: error?.code,
        message: error?.message,
      });
      return; // skip this op, continue with the rest of the queue
    }

    // Unknown / network / 5xx: keep in queue and retry later
    throw error;
  }
}

export const connector = new SupabaseConnector();
