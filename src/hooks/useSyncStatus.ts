import { useCallback, useEffect, useState } from 'react';
import { db } from '../db/powersync';
import { onAuthExpired } from '../db/connector';
import { getUnresolvedConflicts } from '../db/conflictResolution';
import { useTableChanges } from './useTableChanges';

export interface DetailedSyncStatus {
  connected: boolean;
  connecting: boolean;
  downloading: boolean;
  uploading: boolean;
  lastSyncedAt: Date | null;
  hasUnresolvedConflicts: boolean;
  conflictCount: number;
  authExpired: boolean;
  pendingUploadCount: number;
}

export function useSyncStatus() {
  const [status, setStatus] = useState<DetailedSyncStatus>(() => {
    const s = db.currentStatus;
    return {
      connected: Boolean(s?.connected),
      connecting: Boolean(s?.connecting),
      downloading: Boolean(s?.dataFlowStatus?.downloading),
      uploading: Boolean(s?.dataFlowStatus?.uploading),
      lastSyncedAt: s?.lastSyncedAt ?? null,
      hasUnresolvedConflicts: false,
      conflictCount: 0,
      authExpired: false,
      pendingUploadCount: 0,
    };
  });

  const refreshCounters = useCallback(async () => {
    try {
      const [conflicts, stats] = await Promise.all([
        getUnresolvedConflicts(db),
        db.getUploadQueueStats(),
      ]);
      setStatus((prev) => ({
        ...prev,
        conflictCount: conflicts.length,
        hasUnresolvedConflicts: conflicts.length > 0,
        pendingUploadCount: stats.count ?? 0,
      }));
    } catch {
      // Database may not be ready yet
    }
  }, []);

  // Re-count when local data or conflicts change (each write adds to the queue)
  useTableChanges(['transactions', 'wallets', 'categories', 'budgets', 'sync_conflicts'], refreshCounters, 300);

  useEffect(() => {
    const offAuth = onAuthExpired(() => setStatus((prev) => ({ ...prev, authExpired: true })));

    const offStatus = db.registerListener({
      statusChanged: (s) => {
        setStatus((prev) => ({
          ...prev,
          connected: Boolean(s.connected),
          connecting: Boolean(s.connecting),
          downloading: Boolean(s.dataFlowStatus?.downloading),
          uploading: Boolean(s.dataFlowStatus?.uploading),
          lastSyncedAt: s.lastSyncedAt ?? prev.lastSyncedAt,
          authExpired: s.connected ? false : prev.authExpired,
        }));
        refreshCounters();
      },
    });

    return () => {
      offAuth();
      offStatus?.();
    };
  }, [refreshCounters]);

  return status;
}
