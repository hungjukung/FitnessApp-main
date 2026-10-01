import { Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

// Returns metadata only (no file_data) — keeps response small
export async function getPhotos(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const [rows] = await pool.execute(
    `SELECT id, date, file_name, sort_index, created_at
     FROM photo_logs WHERE user_id = ? ORDER BY date DESC, sort_index ASC`,
    [userId]
  );
  res.json(
    (rows as any[]).map(r => ({
      id:        r.id,
      date:      r.date,
      fileName:  r.file_name,
      sortIndex: r.sort_index,
      createdAt: r.created_at,
    }))
  );
}

// Returns base64 data for a single photo — fetched on demand
export async function getPhotoData(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { id } = req.params;
  const [rows] = await pool.execute(
    'SELECT file_data FROM photo_logs WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  const row = (rows as any[])[0];
  if (!row) {
    res.status(404).json({ message: '照片不存在' });
    return;
  }
  res.json({ data: row.file_data });
}

export async function uploadPhoto(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { id, date, fileName, sortIndex, createdAt, data } = req.body as {
    id?: string; date?: string; fileName?: string;
    sortIndex?: number; createdAt?: number; data?: string;
  };

  if (!id || !date || !fileName || data == null) {
    res.status(400).json({ message: 'id, date, fileName, data 為必填' });
    return;
  }

  // Check if this photo already exists (idempotent upload)
  const [existRows] = await pool.execute(
    'SELECT id FROM photo_logs WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  if ((existRows as any[]).length === 0) {
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM photo_logs WHERE user_id = ? AND date = ?',
      [userId, date]
    );
    if ((countRows as any[])[0].count >= 4) {
      res.status(409).json({ message: '今日照片已達 4 張上限' });
      return;
    }
  }

  await pool.execute(
    `INSERT INTO photo_logs (id, user_id, date, file_name, sort_index, file_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE file_data = VALUES(file_data)`,
    [id, userId, date, fileName, sortIndex ?? 0, data, createdAt ?? Date.now()]
  );
  res.status(201).json({ id, date });
}

export async function deletePhoto(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { id } = req.params;
  await pool.execute(
    'DELETE FROM photo_logs WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  res.status(204).send();
}
