/**
 * FitTrack AI — SQLite 資料庫初始化
 * 建立資料表、執行 Migration
 * 使用 expo-sqlite（Expo Go 兼容）
 */

import * as SQLite from 'expo-sqlite';

const DB_VERSION = 4;

let db: SQLite.SQLiteDatabase | null = null;
let activeUserId: string | null = null;

// ─────────────────────────────────────────────
// 取得資料庫實例（Singleton）
// ─────────────────────────────────────────────

export const getDatabase = (): SQLite.SQLiteDatabase => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
};

// ─────────────────────────────────────────────
// 資料庫初始化（App 啟動時呼叫一次）
// ─────────────────────────────────────────────

export const initDatabase = async (userId: string): Promise<void> => {
  if (activeUserId === userId && db !== null) return;

  if (db !== null) {
    try { await db.closeAsync(); } catch {}
    db = null;
  }

  try {
    db = await SQLite.openDatabaseAsync(`fittrack_${userId}.db`);
    activeUserId = userId;

    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');

    await runMigrations(db);
    console.log('[DB] Initialized fittrack_' + userId + '.db (v' + DB_VERSION + ')');
  } catch (error) {
    console.error('[DB] Initialization failed:', error);
    throw new Error('資料庫初始化失敗，請重啟 App。');
  }
};

export const closeDatabase = async (): Promise<void> => {
  if (db) {
    try { await db.closeAsync(); } catch {}
    db = null;
    activeUserId = null;
  }
};

// ─────────────────────────────────────────────
// Migration 管理
// ─────────────────────────────────────────────

const runMigrations = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  // 建立版本追蹤表
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS db_migrations (
      version   INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const currentVersion = await getCurrentVersion(database);

  if (currentVersion < 1) {
    await migration_v1(database);
    await setVersion(database, 1);
    console.log('[DB] Migration v1 applied');
  }

  if (currentVersion < 2) {
    await migration_v2(database);
    await setVersion(database, 2);
    console.log('[DB] Migration v2 applied');
  }

  if (currentVersion < 3) {
    await migration_v3(database);
    await setVersion(database, 3);
    console.log('[DB] Migration v3 applied');
  }

  if (currentVersion < 4) {
    await migration_v4(database);
    await setVersion(database, 4);
    console.log('[DB] Migration v4 applied');
  }
};

const getCurrentVersion = async (database: SQLite.SQLiteDatabase): Promise<number> => {
  const result = await database.getFirstAsync<{ version: number }>(
    'SELECT MAX(version) as version FROM db_migrations;'
  );
  return result?.version ?? 0;
};

const setVersion = async (database: SQLite.SQLiteDatabase, version: number): Promise<void> => {
  await database.runAsync(
    'INSERT INTO db_migrations (version, applied_at) VALUES (?, ?);',
    [version, Date.now()]
  );
};

// ─────────────────────────────────────────────
// Migration v1：建立核心資料表
// ─────────────────────────────────────────────

const migration_v1 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await database.execAsync(`
    -- 體重紀錄表
    CREATE TABLE IF NOT EXISTS weight_logs (
      date        TEXT    PRIMARY KEY,   -- "YYYY-MM-DD"（本地日期字串）
      weight      REAL    NOT NULL,      -- 20.0 ~ 200.0
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    -- 體態照片紀錄表（支援每日多張；照片可獨立於體重紀錄存在）
    CREATE TABLE IF NOT EXISTS photo_logs (
      id          TEXT    PRIMARY KEY,   -- 唯一 ID
      date        TEXT    NOT NULL,      -- "YYYY-MM-DD"（本地日期字串）
      file_uri    TEXT    NOT NULL,      -- 沙盒目錄完整路徑
      file_name   TEXT    NOT NULL,      -- "YYYY-MM-DD.jpg" 或 "YYYY-MM-DD-1.jpg"
      sort_index  INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    );

    -- 索引：按日期查詢照片（高頻操作）
    CREATE INDEX IF NOT EXISTS idx_photo_logs_date ON photo_logs(date);

    -- AI 建議紀錄表
    CREATE TABLE IF NOT EXISTS ai_insights (
      id          TEXT    PRIMARY KEY,
      date        TEXT    NOT NULL,
      insight     TEXT    NOT NULL,
      model_id    TEXT    NOT NULL,
      created_at  INTEGER NOT NULL
    );
  `);
};

// ─────────────────────────────────────────────
// Migration v2：移除照片對體重紀錄的外鍵限制，補 AI insight 表
// ─────────────────────────────────────────────

const migration_v2 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS photo_logs_v2 (
      id          TEXT    PRIMARY KEY,
      date        TEXT    NOT NULL,
      file_uri    TEXT    NOT NULL,
      file_name   TEXT    NOT NULL,
      sort_index  INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    );

    INSERT OR IGNORE INTO photo_logs_v2 (id, date, file_uri, file_name, sort_index, created_at)
      SELECT id, date, file_uri, file_name, sort_index, created_at FROM photo_logs;

    DROP TABLE IF EXISTS photo_logs;
    ALTER TABLE photo_logs_v2 RENAME TO photo_logs;
    CREATE INDEX IF NOT EXISTS idx_photo_logs_date ON photo_logs(date);

    CREATE TABLE IF NOT EXISTS ai_insights (
      id          TEXT    PRIMARY KEY,
      date        TEXT    NOT NULL,
      insight     TEXT    NOT NULL,
      model_id    TEXT    NOT NULL,
      created_at  INTEGER NOT NULL
    );
  `);
};

// ─────────────────────────────────────────────
// Migration v3：新增訓練記錄表
// ─────────────────────────────────────────────

const migration_v3 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id            TEXT    PRIMARY KEY,
      date          TEXT    NOT NULL,
      name          TEXT,
      started_at    INTEGER NOT NULL,
      completed_at  INTEGER,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_sets (
      id            TEXT    PRIMARY KEY,
      session_id    TEXT    NOT NULL,
      exercise_id   TEXT    NOT NULL,
      exercise_name TEXT    NOT NULL,
      set_number    INTEGER NOT NULL,
      reps          INTEGER,
      weight        REAL,
      duration      INTEGER,
      created_at    INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_workout_sets_session ON workout_sets(session_id);
    CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(date);
  `);
};

// ─────────────────────────────────────────────
// Migration v4：新增飲食紀錄表（飲食模組）
// ─────────────────────────────────────────────

const migration_v4 = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS diet_entries (
      id          TEXT    PRIMARY KEY,
      date        TEXT    NOT NULL,      -- "YYYY-MM-DD"
      meal        TEXT    NOT NULL,      -- breakfast | lunch | dinner | snack
      name        TEXT    NOT NULL,
      kcal        REAL    NOT NULL,
      protein_g   REAL    NOT NULL DEFAULT 0,
      carbs_g     REAL    NOT NULL DEFAULT 0,
      fat_g       REAL    NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_diet_entries_date ON diet_entries(date);
  `);
};

// ─────────────────────────────────────────────
// 本地資料生命週期
// ─────────────────────────────────────────────

export const clearLocalDatabase = async (): Promise<void> => {
  const database = getDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM ai_insights;');
    await database.runAsync('DELETE FROM diet_entries;');
    await database.runAsync('DELETE FROM workout_sets;');
    await database.runAsync('DELETE FROM workout_sessions;');
    await database.runAsync('DELETE FROM photo_logs;');
    await database.runAsync('DELETE FROM weight_logs;');
  });
};
