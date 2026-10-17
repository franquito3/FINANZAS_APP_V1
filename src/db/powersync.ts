import { PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema } from './schema';
import { connector } from './connector';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'finanzas_local.db',
  },
});

let initPromise: Promise<void> | null = null;

/** Opens the local SQLite database (idempotent). Works fully offline. */
export function initLocalDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = db.init().then(() => {
      console.log('[PowerSync] Base de datos SQLite local inicializada');
    });
  }
  return initPromise;
}

/**
 * Starts background sync for the signed-in user.
 * db.connect() returns immediately and keeps retrying in the background while offline;
 * local reads/writes are never blocked by the network.
 */
export async function connectPowerSync(): Promise<void> {
  await initLocalDatabase();
  try {
    await db.connect(connector);
  } catch (error) {
    console.warn('[PowerSync] No se pudo iniciar la sincronización (se reintentará):', error);
  }
}

/**
 * On sign-out: stop background sync stream while retaining all local SQLite data
 * in @op-engineering/op-sqlite as requested by the user.
 */
export async function disconnectPowerSyncKeepData(): Promise<void> {
  try {
    await initLocalDatabase();
    await db.disconnect();
  } catch (error) {
    console.error('[PowerSync] Error al desconectar sincronización:', error);
  }
}

/**
 * Legacy alias preserved for compatibility — disconnects without deleting SQLite rows.
 */
export async function disconnectAndClearPowerSync(): Promise<void> {
  return disconnectPowerSyncKeepData();
}
