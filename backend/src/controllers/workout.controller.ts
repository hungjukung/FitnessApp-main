import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ─────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────

export async function getWorkoutSessions(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;

  const [sessionRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, date, name, started_at, completed_at, created_at, updated_at
     FROM workout_sessions WHERE user_id = ? ORDER BY date DESC, created_at DESC;`,
    [userId]
  );

  if (sessionRows.length === 0) {
    res.json([]);
    return;
  }

  const sessionIds = sessionRows.map((s) => s.id);
  const placeholders = sessionIds.map(() => '?').join(',');
  const [setRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, session_id, exercise_id, exercise_name, set_number, reps, weight, duration, created_at
     FROM workout_sets WHERE session_id IN (${placeholders}) ORDER BY session_id, set_number ASC;`,
    sessionIds
  );

  const setsBySession: Record<string, RowDataPacket[]> = {};
  for (const row of setRows) {
    if (!setsBySession[row.session_id]) setsBySession[row.session_id] = [];
    setsBySession[row.session_id].push(row);
  }

  const result = sessionRows.map((s) => ({
    id: s.id,
    date: s.date,
    name: s.name ?? undefined,
    startedAt: s.started_at,
    completedAt: s.completed_at ?? undefined,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    sets: (setsBySession[s.id] ?? []).map((ws) => ({
      id: ws.id,
      sessionId: ws.session_id,
      exerciseId: ws.exercise_id,
      exerciseName: ws.exercise_name,
      setNumber: ws.set_number,
      reps: ws.reps ?? undefined,
      weight: ws.weight ?? undefined,
      duration: ws.duration ?? undefined,
      createdAt: ws.created_at,
    })),
  }));

  res.json(result);
}

export async function upsertWorkoutSession(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { id, date, name, startedAt, completedAt, createdAt, updatedAt } = req.body as {
    id?: string; date?: string; name?: string;
    startedAt?: number; completedAt?: number;
    createdAt?: number; updatedAt?: number;
  };

  if (!id || !date || !startedAt) {
    res.status(400).json({ message: 'id, date, startedAt 為必要欄位' });
    return;
  }

  const now = Date.now();
  await pool.execute(
    `INSERT INTO workout_sessions (id, user_id, date, name, started_at, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       completed_at = VALUES(completed_at),
       updated_at = VALUES(updated_at);`,
    [id, userId, date, name ?? null, startedAt, completedAt ?? null, createdAt ?? now, updatedAt ?? now]
  );

  res.status(201).json({ id, date });
}

export async function deleteWorkoutSession(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { id } = req.params;

  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM workout_sessions WHERE id = ? AND user_id = ?;',
    [id, userId]
  );

  if (result.affectedRows === 0) {
    res.status(404).json({ message: '訓練記錄不存在' });
    return;
  }
  res.status(204).send();
}

// ─────────────────────────────────────────────
// Sets
// ─────────────────────────────────────────────

export async function upsertWorkoutSet(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { id, sessionId, exerciseId, exerciseName, setNumber, reps, weight, duration, createdAt } = req.body as {
    id?: string; sessionId?: string; exerciseId?: string; exerciseName?: string;
    setNumber?: number; reps?: number; weight?: number; duration?: number; createdAt?: number;
  };

  if (!id || !sessionId || !exerciseId || !exerciseName || setNumber === undefined) {
    res.status(400).json({ message: 'id, sessionId, exerciseId, exerciseName, setNumber 為必要欄位' });
    return;
  }

  // 驗證 session 屬於該 user
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM workout_sessions WHERE id = ? AND user_id = ?;',
    [sessionId, userId]
  );
  if (rows.length === 0) {
    res.status(403).json({ message: '無權存取此訓練' });
    return;
  }

  const now = Date.now();
  await pool.execute(
    `INSERT INTO workout_sets (id, session_id, user_id, exercise_id, exercise_name, set_number, reps, weight, duration, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       reps = VALUES(reps),
       weight = VALUES(weight),
       duration = VALUES(duration);`,
    [id, sessionId, userId, exerciseId, exerciseName, setNumber, reps ?? null, weight ?? null, duration ?? null, createdAt ?? now]
  );

  res.status(201).json({ id });
}

export async function deleteWorkoutSet(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { id } = req.params;

  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM workout_sets WHERE id = ? AND user_id = ?;',
    [id, userId]
  );

  if (result.affectedRows === 0) {
    res.status(404).json({ message: '組數記錄不存在' });
    return;
  }
  res.status(204).send();
}
