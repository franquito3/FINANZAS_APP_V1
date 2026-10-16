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
 * On sign-out: stop syncing and wipe local data so the next user on this
 * device never sees the previous user's finances.
 */
export async function disconnectAndClearPowerSync(): Promise<void> {
  try {
    await initLocalDatabase();
    await db.disconnectAndClear();
  } catch (error) {
    console.error('[PowerSync] Error al desconectar/limpiar:', error);
  }
}
