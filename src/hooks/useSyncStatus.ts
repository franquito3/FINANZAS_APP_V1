import { useEffect, useState } from 'react';
import { db } from '../db/powersync';
import { onAuthExpired } from '../db/connector';
import { getUnresolvedConflicts } from '../db/conflictResolution';

export interface DetailedSyncStatus {
  connected: boolean;
  connecting: boolean;
  downloading: boolean;
  uploading: boolean;
  lastSyncedAt: Date | null;
  hasUnresolvedConflicts: boolean;
  authExpired: boolean;
  pendingUploadCount: number;
}

export function useSyncStatus() {
  const [status, setStatus] = useState<DetailedSyncStatus>({
    connected: false,
    connecting: false,
    downloading: false,
    uploading: false,
    lastSyncedAt: null,
    hasUnresolvedConflicts: false,
    authExpired: false,
    pendingUploadCount: 0,
  });

  useEffect(() => {
    // Listen for auth expiration events from connector
    const unsubscribeAuthExpired = onAuthExpired(() => {
      setStatus((prev) => ({ ...prev, authExpired: true }));
    });

    // Register listener on PowerSync status updates
    const unsubscribeStatus = db.registerListener({
      statusChanged: async (currentStatus) => {
        let conflictCount = 0;
        let queueCount = 0;

        try {
          const conflicts = await getUnresolvedConflicts(db);
          conflictCount = conflicts.length;
        } catch {
          // In case table is not ready yet
        }

        try {
          const stats = await db.getUploadQueueStats();
          queueCount = stats.count ?? 0;
        } catch {
          // stats error fallback
        }

        setStatus((prev) => ({
          ...prev,
          connected: Boolean(currentStatus.connected),
          connecting: Boolean(currentStatus.connecting),
          downloading: Boolean(currentStatus.downloading),
          uploading: Boolean(currentStatus.uploading),
          lastSyncedAt: currentStatus.lastSyncedAt ?? prev.lastSyncedAt,
          hasUnresolvedConflicts: conflictCount > 0,
          pendingUploadCount: queueCount,
        }));
      },
    });

    return () => {
      unsubscribeAuthExpired();
      unsubscribeStatus?.();
    };
  }, []);

  return status;
}
