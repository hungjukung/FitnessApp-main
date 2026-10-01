import { Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

export async function getWeightLogs(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const [rows] = await pool.execute(
    'SELECT date, weight, created_at, updated_at FROM weight_logs WHERE user_id = ? ORDER BY date ASC',
    [userId]
  );
  res.json(
    (rows as any[]).map(r => ({
      date:      r.date,
      weight:    r.weight,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  );
}

export async function upsertWeightLog(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { date, weight, createdAt } = req.body as { date?: string; weight?: number; createdAt?: number };

  if (!date || weight == null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ message: '日期（YYYY-MM-DD）與體重為必填' });
    return;
  }
  if (weight < 20 || weight > 200) {
    res.status(400).json({ message: '體重需在 20–200 kg 之間' });
    return;
  }

  const now = Date.now();
  await pool.execute(
    `INSERT INTO weight_logs (user_id, date, weight, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE weight = VALUES(weight), updated_at = VALUES(updated_at)`,
    [userId, date, weight, createdAt ?? now, now]
  );
  res.json({ date, weight, updatedAt: now });
}

export async function deleteWeightLog(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { date } = req.params;
  await pool.execute(
    'DELETE FROM weight_logs WHERE user_id = ? AND date = ?',
    [userId, date]
  );
  res.status(204).send();
}
