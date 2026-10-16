import { PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema } from './schema';
import { connector } from './connector';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'finanzas_local.db',
  },
});

let isInitialized = false;

/**
 * Initializes the local SQLite storage engine and starts PowerSync background sync
 */
export async function initPowerSync(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    await db.init();
    isInitialized = true;
    console.log('[PowerSync] Local SQLite database initialized successfully');

    // Attempt connecting to the cloud backend
    await db.connect(connector);
    console.log('[PowerSync] Connected to PowerSync cloud service');
  } catch (error) {
    console.warn(
      '[PowerSync] Sync connection could not be established immediately (running in offline local-only mode):',
      error
    );
  }
}

/**
 * Disconnects sync (e.g., on sign out or when entering offline mode)
 */
export async function disconnectPowerSync(): Promise<void> {
  try {
    await db.disconnect();
    console.log('[PowerSync] Disconnected from PowerSync cloud service');
  } catch (error) {
    console.error('[PowerSync] Error disconnecting:', error);
  }
}
