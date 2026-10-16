import { PowerSyncDatabase } from '@powersync/react-native';

export interface SyncConflict {
  id: string;
  entity_table: string;
  record_id: string;
  local_data: Record<string, any>;
  remote_data: Record<string, any>;
  detected_at: string;
  resolved: boolean;
}

/**
 * Registers an audited conflict in the local sync_conflicts table
 * to prevent blind data destruction when concurrent edits occur.
 */
export async function recordConflict(
  database: PowerSyncDatabase,
  table: string,
  recordId: string,
  localData: Record<string, any>,
  remoteData: Record<string, any>
): Promise<void> {
  const conflictId = `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  await database.execute(
    `INSERT INTO sync_conflicts (id, entity_table, record_id, local_data, remote_data, detected_at, resolved)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [
      conflictId,
      table,
      recordId,
      JSON.stringify(localData),
      JSON.stringify(remoteData),
      now,
    ]
  );
  console.warn(`[Sync Conflict] Conflict recorded for table '${table}' and record '${recordId}'`);
}

/**
 * Fetches all pending unresolved conflicts
 */
export async function getUnresolvedConflicts(
  database: PowerSyncDatabase
): Promise<SyncConflict[]> {
  const rows = await database.getAll<{
    id: string;
    entity_table: string;
    record_id: string;
    local_data: string;
    remote_data: string;
    detected_at: string;
    resolved: number;
  }>('SELECT * FROM sync_conflicts WHERE resolved = 0 ORDER BY detected_at DESC');

  return rows.map((row) => ({
    id: row.id,
    entity_table: row.entity_table,
    record_id: row.record_id,
    local_data: JSON.parse(row.local_data || '{}'),
    remote_data: JSON.parse(row.remote_data || '{}'),
    detected_at: row.detected_at,
    resolved: Boolean(row.resolved),
  }));
}

/**
 * Resolves an existing conflict by applying either local or remote data
 */
export async function resolveConflict(
  database: PowerSyncDatabase,
  conflictId: string,
  resolution: 'KEEP_LOCAL' | 'KEEP_REMOTE',
  tableUploadFn?: (table: string, data: Record<string, any>) => Promise<void>
): Promise<void> {
  const rows = await database.getAll<{
    id: string;
    entity_table: string;
    record_id: string;
    local_data: string;
    remote_data: string;
  }>('SELECT * FROM sync_conflicts WHERE id = ?', [conflictId]);

  if (rows.length === 0) {
    throw new Error(`Conflict with id ${conflictId} not found`);
  }

  const conflict = rows[0];
  const local = JSON.parse(conflict.local_data || '{}');
  const remote = JSON.parse(conflict.remote_data || '{}');

  if (resolution === 'KEEP_REMOTE') {
    // Overwrite local SQLite row with remote version
    const columns = Object.keys(remote);
    if (columns.length > 0) {
      const setClauses = columns.map((col) => `${col} = ?`).join(', ');
      const values = columns.map((col) => remote[col]);
      await database.execute(
        `UPDATE ${conflict.entity_table} SET ${setClauses} WHERE id = ?`,
        [...values, conflict.record_id]
      );
    }
  } else if (resolution === 'KEEP_LOCAL' && tableUploadFn) {
    // Push local version to backend
    await tableUploadFn(conflict.entity_table, local);
  }

  // Mark conflict as resolved
  await database.execute('UPDATE sync_conflicts SET resolved = 1 WHERE id = ?', [conflictId]);
}
