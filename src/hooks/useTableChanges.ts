import { useEffect, useRef } from 'react';
import { db } from '../db/powersync';

/**
 * Runs `callback` immediately and every time any of the given tables changes
 * (local writes OR rows downloaded by PowerSync sync).
 *
 * Replaces the previous `registerListener({ schemaChanged })`, which only fired on
 * schema changes and therefore never refreshed the UI on data changes.
 */
export function useTableChanges(tables: string[], callback: () => void, throttleMs = 100) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const key = tables.join(',');

  useEffect(() => {
    cbRef.current();
    const dispose = db.onChange(
      { onChange: () => cbRef.current() },
      { tables: key.split(','), throttleMs }
    );
    return () => dispose();
  }, [key, throttleMs]);
}
