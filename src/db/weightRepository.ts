/**
 * FitTrack AI — 體重紀錄 Repository（本地 SQLite 版）
 * 已移除 Supabase，改用本地 expo-sqlite 儲存
 */

import { getDatabase } from './database';
import { WeightLog } from '../types';
import { BusinessRules } from '../constants/theme';
import { apiUpsertWeightLog, apiDeleteWeightLog } from '../services/api/weightApi';

// ─────────────────────────────────────────────
// 工具：取得本地日期字串（避免時區偏移）
// ─────────────────────────────────────────────

export const toLocalDateString = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// ─────────────────────────────────────────────
// 驗證
// ─────────────────────────────────────────────

export const isValidWeight = (weight: number): boolean =>
  weight >= BusinessRules.weight.min &&
  weight <= BusinessRules.weight.max &&
  Number.isFinite(weight);

// ─────────────────────────────────────────────
// CRUD 操作
// ─────────────────────────────────────────────

/** 新增或更新（Upsert）某日的體重紀錄 */
export const upsertWeightLog = async (date: string, weight: number): Promise<void> => {
  if (!isValidWeight(weight)) {
    throw new Error(`體重值 ${weight} 超出合法範圍（${BusinessRules.weight.min}–${BusinessRules.weight.max} kg）`);
  }

  const db  = getDatabase();
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO weight_logs (date, weight, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET weight = excluded.weight, updated_at = excluded.updated_at;`,
    [date, weight, now, now],
  );

  apiUpsertWeightLog({ date, weight, createdAt: now, updatedAt: now }).catch(() => {});
};

/** 取得某日的體重紀錄 */
export const getWeightLogByDate = async (date: string): Promise<WeightLog | null> => {
  const db = getDatabase();

  const row = await db.getFirstAsync<{
    date: string; weight: number; created_at: number; updated_at: number;
  }>(
    'SELECT date, weight, created_at, updated_at FROM weight_logs WHERE date = ?;',
    [date],
  );

  if (!row) return null;
  return { date: row.date, weight: row.weight, createdAt: row.created_at, updatedAt: row.updated_at };
};

/** 取得近 N 天的體重紀錄（依日期降序） */
export const getRecentWeightLogs = async (
  days: number = BusinessRules.ai.maxWeightLogDays,
): Promise<WeightLog[]> => {
  const db = getDatabase();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = toLocalDateString(cutoff);

  const rows = await db.getAllAsync<{
    date: string; weight: number; created_at: number; updated_at: number;
  }>(
    'SELECT date, weight, created_at, updated_at FROM weight_logs WHERE date >= ? ORDER BY date DESC;',
    [cutoffStr],
  );

  return rows.map((r) => ({ date: r.date, weight: r.weight, createdAt: r.created_at, updatedAt: r.updated_at }));
};

/** 取得指定日期範圍的體重紀錄 */
export const getWeightLogsByRange = async (startDate: string, endDate: string): Promise<WeightLog[]> => {
  const db = getDatabase();

  const rows = await db.getAllAsync<{
    date: string; weight: number; created_at: number; updated_at: number;
  }>(
    'SELECT date, weight, created_at, updated_at FROM weight_logs WHERE date >= ? AND date <= ? ORDER BY date ASC;',
    [startDate, endDate],
  );

  return rows.map((r) => ({ date: r.date, weight: r.weight, createdAt: r.created_at, updatedAt: r.updated_at }));
};

/** 刪除某日的體重紀錄 */
export const deleteWeightLog = async (date: string): Promise<void> => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM weight_logs WHERE date = ?;', [date]);
  apiDeleteWeightLog(date).catch(() => {});
};

/** 取得所有有體重紀錄的日期（Streak 與日曆體重標記使用） */
export const getAllWeightDates = async (): Promise<string[]> => {
  const db = getDatabase();

  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT date FROM weight_logs ORDER BY date DESC;',
  );

  return rows.map((r) => r.date);
};

/** 舊呼叫點相容：僅回傳有體重的日期，不含照片-only 日期 */
export const getAllMarkedDates = getAllWeightDates;
