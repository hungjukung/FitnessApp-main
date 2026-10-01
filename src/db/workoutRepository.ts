import { getDatabase } from './database';
import { WorkoutSession, WorkoutSet, WorkoutChartPoint } from '../types';

// ─────────────────────────────────────────────
// Session CRUD
// ─────────────────────────────────────────────

export const createSession = async (session: Omit<WorkoutSession, 'sets'>): Promise<void> => {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, date, name, started_at, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       completed_at = excluded.completed_at,
       updated_at = excluded.updated_at;`,
    [
      session.id,
      session.date,
      session.name ?? null,
      session.startedAt,
      session.completedAt ?? null,
      session.createdAt,
      session.updatedAt,
    ]
  );
};

export const updateSession = async (
  id: string,
  fields: Partial<Pick<WorkoutSession, 'name' | 'completedAt'>>
): Promise<void> => {
  const db = getDatabase();
  const now = Date.now();
  await db.runAsync(
    `UPDATE workout_sessions
     SET name = COALESCE(?, name),
         completed_at = COALESCE(?, completed_at),
         updated_at = ?
     WHERE id = ?;`,
    [fields.name ?? null, fields.completedAt ?? null, now, id]
  );
};

export const deleteSession = async (id: string): Promise<void> => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM workout_sessions WHERE id = ?;', [id]);
};

/** 取得某日的訓練 session（含所有 sets） */
export const getSessionByDate = async (date: string): Promise<WorkoutSession | null> => {
  const db = getDatabase();

  const sessionRow = await db.getFirstAsync<{
    id: string; date: string; name: string | null;
    started_at: number; completed_at: number | null;
    created_at: number; updated_at: number;
  }>(
    'SELECT * FROM workout_sessions WHERE date = ? ORDER BY created_at DESC LIMIT 1;',
    [date]
  );

  if (!sessionRow) return null;

  const sets = await getSetsBySessionId(sessionRow.id);

  return {
    id: sessionRow.id,
    date: sessionRow.date,
    name: sessionRow.name ?? undefined,
    startedAt: sessionRow.started_at,
    completedAt: sessionRow.completed_at ?? undefined,
    sets,
    createdAt: sessionRow.created_at,
    updatedAt: sessionRow.updated_at,
  };
};

/** 取得日期範圍內的所有 sessions（用於日曆 dots 和分析） */
export const getSessionsByDateRange = async (
  startDate: string,
  endDate: string
): Promise<WorkoutSession[]> => {
  const db = getDatabase();

  const sessionRows = await db.getAllAsync<{
    id: string; date: string; name: string | null;
    started_at: number; completed_at: number | null;
    created_at: number; updated_at: number;
  }>(
    'SELECT * FROM workout_sessions WHERE date >= ? AND date <= ? ORDER BY date ASC;',
    [startDate, endDate]
  );

  const sessions: WorkoutSession[] = [];
  for (const row of sessionRows) {
    const sets = await getSetsBySessionId(row.id);
    sessions.push({
      id: row.id,
      date: row.date,
      name: row.name ?? undefined,
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
      sets,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  return sessions;
};

/** 取得有訓練的日期清單（日曆標記用） */
export const getWorkoutDates = async (): Promise<string[]> => {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM workout_sessions ORDER BY date DESC;'
  );
  return rows.map((r) => r.date);
};

// ─────────────────────────────────────────────
// Set CRUD
// ─────────────────────────────────────────────

export const upsertSet = async (set: WorkoutSet): Promise<void> => {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO workout_sets (id, session_id, exercise_id, exercise_name, set_number, reps, weight, duration, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       reps = excluded.reps,
       weight = excluded.weight,
       duration = excluded.duration;`,
    [
      set.id,
      set.sessionId,
      set.exerciseId,
      set.exerciseName,
      set.setNumber,
      set.reps ?? null,
      set.weight ?? null,
      set.duration ?? null,
      set.createdAt,
    ]
  );
};

export const deleteSet = async (setId: string): Promise<void> => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM workout_sets WHERE id = ?;', [setId]);
};

const getSetsBySessionId = async (sessionId: string): Promise<WorkoutSet[]> => {
  const db = getDatabase();
  const rows = await db.getAllAsync<{
    id: string; session_id: string; exercise_id: string; exercise_name: string;
    set_number: number; reps: number | null; weight: number | null;
    duration: number | null; created_at: number;
  }>(
    'SELECT * FROM workout_sets WHERE session_id = ? ORDER BY exercise_id, set_number ASC;',
    [sessionId]
  );

  return rows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    exerciseId: r.exercise_id,
    exerciseName: r.exercise_name,
    setNumber: r.set_number,
    reps: r.reps ?? undefined,
    weight: r.weight ?? undefined,
    duration: r.duration ?? undefined,
    createdAt: r.created_at,
  }));
};

// ─────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────

/** 取得週訓練量統計（用於圖表） */
export const getWorkoutChartData = async (
  startDate: string,
  endDate: string
): Promise<WorkoutChartPoint[]> => {
  const db = getDatabase();

  const rows = await db.getAllAsync<{
    week_start: string;
    total_volume: number;
    session_count: number;
  }>(
    `SELECT
       date(date, 'weekday 1', '-6 days') AS week_start,
       SUM(COALESCE(ws.weight, 0) * COALESCE(ws.reps, 1)) AS total_volume,
       COUNT(DISTINCT wss.id) AS session_count
     FROM workout_sessions wss
     LEFT JOIN workout_sets ws ON ws.session_id = wss.id
     WHERE wss.date >= ? AND wss.date <= ?
     GROUP BY week_start
     ORDER BY week_start ASC;`,
    [startDate, endDate]
  );

  return rows.map((r, idx) => ({
    weekLabel: `W${idx + 1}`,
    volume: Math.round(r.total_volume ?? 0),
    sessions: r.session_count ?? 0,
  }));
};
