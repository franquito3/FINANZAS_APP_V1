import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
  UpdateType,
} from '@powersync/react-native';
import { supabase } from '../services/supabase/client';
import { ENV } from '../config/env';
import { recordConflict } from './conflictResolution';

export type AuthExpiredListener = () => void;
const authExpiredListeners = new Set<AuthExpiredListener>();

export function onAuthExpired(listener: AuthExpiredListener): () => void {
  authExpiredListeners.add(listener);
  return () => authExpiredListeners.delete(listener);
}

function notifyAuthExpired() {
  authExpiredListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('[Connector] Error in auth expired listener', e);
    }
  });
}

/**
 * Backend connector linking local SQLite with remote Supabase / PowerSync Service
 */
export class SupabaseConnector implements PowerSyncBackendConnector {
  /**
   * Retrieves fresh credentials from the Supabase session
   */
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      return null;
    }

    if (!ENV.POWERSYNC_URL) {
      console.warn('[PowerSync] EXPO_PUBLIC_POWERSYNC_URL no está configurada en .env');
      return null;
    }

    return {
      endpoint: ENV.POWERSYNC_URL,
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }

  /**
   * Uploads local SQLite mutations sequentially to Supabase
   * Handles offline enqueuing, 401 token expirations and conflict interception.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    try {
      for (const op of transaction.crud) {
        // Skip local-only tables
        if (op.table === 'sync_conflicts') {
          continue;
        }

        const table = op.table;
        const data = op.opData || {};

        switch (op.op) {
          case UpdateType.PUT: {
            const payload = { id: op.id, ...data };
            const { error } = await supabase.from(table).upsert(payload);
            if (error) {
              await this.handleMutationError(database, table, op.id, data, error);
            }
            break;
          }

          case UpdateType.PATCH: {
            const { error } = await supabase.from(table).update(data).eq('id', op.id);
            if (error) {
              await this.handleMutationError(database, table, op.id, data, error);
            }
            break;
          }

          case UpdateType.DELETE: {
            const { error } = await supabase.from(table).delete().eq('id', op.id);
            if (error) {
              await this.handleMutationError(database, table, op.id, { deleted: true }, error);
            }
            break;
          }
        }
      }

      // Mark the entire transaction as uploaded
      await transaction.complete();
    } catch (err: any) {
      console.error('[PowerSync Connector] Error uploading batch:', err);
      throw err;
    }
  }

  /**
   * Error interceptor for offline recovery & conflict handling
   */
  private async handleMutationError(
    database: any,
    table: string,
    id: string,
    localData: any,
    error: any
  ) {
    const statusCode = error.status || (error.code ? parseInt(error.code, 10) : null);

    // Escenario 3: Token expired while offline (HTTP 401)
    if (statusCode === 401 || error.message?.includes('JWT') || error.message?.includes('expired')) {
      console.warn('[PowerSync Connector] 401 Unauthorized detectado. Pausando cola de sincronización.');
      notifyAuthExpired();
      throw new Error('AUTH_EXPIRED: Requiere reautenticación para continuar la sincronización en la nube');
    }

    // Escenario 2: Concurrent conflict / collision (HTTP 409 or constraint mismatch)
    if (statusCode === 409 || error.code === '23505' || error.message?.includes('conflict')) {
      console.warn(`[PowerSync Connector] Conflicto de concurrencia detectado en tabla ${table}:${id}`);
      await recordConflict(database, table, id, localData, { error: error.message });
      // Keep going or re-throw depending on strategy
      return;
    }

    throw error;
  }
}

export const connector = new SupabaseConnector();
