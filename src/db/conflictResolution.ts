import { AbstractPowerSyncDatabase } from '@powersync/react-native';
import { newId } from '../utils/id';

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
 * Stores a rejected/conflicting local change in the local-only `sync_conflicts` table,
 * so it is never silently lost (no blind Last-Write-Wins).
 */
export async function recordConflict(
  database: AbstractPowerSyncDatabase,
  table: string,
  recordId: string,
  localData: Record<string, any>,
  remoteData: Record<string, any>
): Promise<void> {
  await database.execute(
    `INSERT INTO sync_conflicts (id, entity_table, record_id, local_data, remote_data, detected_at, resolved)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [newId(), table, recordId, JSON.stringify(localData), JSON.stringify(remoteData), new Date().toISOString()]
  );
  console.warn(`[Sync Conflict] Registrado conflicto en '${table}' para el registro '${recordId}'`);
}

export async function getUnresolvedConflicts(
  database: AbstractPowerSyncDatabase
): Promise<SyncConflict[]> {
  const rows = await database.getAll<any>(
    'SELECT * FROM sync_conflicts WHERE resolved = 0 ORDER BY detected_at DESC'
  );
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

const EDITABLE_COLUMNS: Record<string, string[]> = {
  transactions: ['amount', 'category_id', 'wallet_id', 'notes', 'transaction_date'],
  wallets: ['name', 'currency_code', 'is_active'],
  categories: ['name', 'icon_identifier', 'color_hex', 'type'],
  budgets: ['limit_amount', 'period', 'start_date', 'end_date'],
};

/**
 * Resolves a conflict.
 *
 * - KEEP_REMOTE: the rejected local change was already dropped from the upload queue and
 *   PowerSync re-downloads the authoritative server row, so we only mark it resolved.
 * - KEEP_LOCAL: re-applies the local values as a NEW local edit on top of the current
 *   (server) version. It gets queued again and uploaded with the fresh version.
 */
export async function resolveConflict(
  database: AbstractPowerSyncDatabase,
  conflictId: string,
  resolution: 'KEEP_LOCAL' | 'KEEP_REMOTE'
): Promise<void> {
  const conflict = await database.getOptional<any>('SELECT * FROM sync_conflicts WHERE id = ?', [conflictId]);
  if (!conflict) throw new Error(`Conflicto ${conflictId} no encontrado`);

  if (resolution === 'KEEP_LOCAL') {
    const local = JSON.parse(conflict.local_data || '{}');
    const allowed = EDITABLE_COLUMNS[conflict.entity_table] ?? [];
    const cols = allowed.filter((c) => local[c] !== undefined);

    if (cols.length > 0) {
      const hasVersion = conflict.entity_table === 'transactions';
      const setSql = cols.map((c) => `${c} = ?`).join(', ') + (hasVersion ? ', version = version + 1' : '');
      await database.execute(
        `UPDATE ${conflict.entity_table} SET ${setSql}, updated_at = ? WHERE id = ?`,
        [...cols.map((c) => local[c]), new Date().toISOString(), conflict.record_id]
      );
    }
  }

  await database.execute('UPDATE sync_conflicts SET resolved = 1 WHERE id = ?', [conflictId]);
}
