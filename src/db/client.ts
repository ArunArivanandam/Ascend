import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { randomUUID } from 'expo-crypto';
import { openDatabaseAsync } from 'expo-sqlite';
import { Platform } from 'react-native';

import type { Clock, DevClock } from '@/services/app-context';
import { createDeviceClock, DEV_CLOCK_OFFSET_KEY } from '@/services/clock';

import migrations from './migrations/migrations';
import { createRepositories, type Repositories } from './repositories';
import { schema } from './schema';

export interface OpenedDatabase {
  repos: Repositories;
  clock: Clock;
  devClock: DevClock;
}

let opening: Promise<OpenedDatabase> | undefined;

/**
 * Opens the on-device database, applies pending migrations and returns the repositories
 * with the clock they use. Imported only by DatabaseProvider; tests never load this file.
 *
 * The database MUST be opened with the async API first. On web, SQLite runs in a
 * worker that takes a moment to load, and a synchronous call made before it is ready
 * fails with "Sync operation timeout". Once it is open, synchronous queries are fine.
 */
export function openAppDatabase(): Promise<OpenedDatabase> {
  opening ??= (async () => {
    const sqlite = await openDatabaseAsync('dailyascend.db');
    await sqlite.execAsync('PRAGMA foreign_keys = ON;');
    // Write-ahead logging is a native-only speed-up; the web file system does not support it.
    if (Platform.OS !== 'web') await sqlite.execAsync('PRAGMA journal_mode = WAL;');

    const db = drizzle(sqlite, { schema });
    await migrate(db, migrations);

    const { clock, devClock } = createDeviceClock();
    const repos = createRepositories(db, { newId: () => randomUUID(), now: clock.now });

    if (__DEV__) {
      const savedOffset = Number(repos.settings.get(DEV_CLOCK_OFFSET_KEY) ?? 0);
      if (Number.isFinite(savedOffset)) devClock.setOffsetMs(savedOffset);
    }
    return { repos, clock, devClock };
  })();
  return opening;
}
