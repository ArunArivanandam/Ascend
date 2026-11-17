import path from 'path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { createRepositories, type Db } from '../repositories';
import { schema } from '../schema';

/**
 * A fresh in-memory database built from the real migrations, with a controllable
 * clock and predictable ids. Used by repository tests and screen tests.
 */
export function createTestDb(startMs = Date.UTC(2026, 10, 17, 4, 0, 0)) {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '..', 'migrations') });

  // The app runs on expo-sqlite, which fails when a transaction is started inside
  // another one. better-sqlite3 quietly allows it, so make that an error here too.
  const runTransaction = db.transaction.bind(db);
  let depth = 0;
  db.transaction = ((...args: Parameters<typeof runTransaction>) => {
    if (depth > 0) {
      throw new Error('Nested db.transaction: this fails on expo-sqlite (see repositories.ts)');
    }
    depth += 1;
    try {
      return runTransaction(...args);
    } finally {
      depth -= 1;
    }
  }) as typeof db.transaction;

  let nowMs = startMs;
  let offsetMs = 0;
  let ids = 0;
  const now = () => nowMs + offsetMs;
  const repos = createRepositories(db as Db, { newId: () => `id-${++ids}`, now });

  return {
    db: db as Db,
    repos,
    now,
    /** Moves the clock forward. */
    advance(seconds: number) {
      nowMs += seconds * 1000;
    },
    /** A development-style clock offset, as used by the "advance one day" tool. */
    offsetMs: () => offsetMs,
    setOffsetMs(next: number) {
      offsetMs = next;
    },
  };
}
