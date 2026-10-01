/**
 * 飲食紀錄 Repository（本地 SQLite，資料表於 database.ts migration v4 建立）
 */

import { randomUUID as uuidv4 } from 'expo-crypto';
import { getDatabase } from '../../db/database';
import { DietDailySummary } from '../contracts';
import { DietEntry, DietEntryInput, MealType } from './dietTypes';

interface DietEntryRow {
  id: string;
  date: string;
  meal: MealType;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: number;
}

const fromRow = (r: DietEntryRow): DietEntry => ({
  id: r.id,
  date: r.date,
  meal: r.meal,
  name: r.name,
  kcal: r.kcal,
  proteinG: r.protein_g,
  carbsG: r.carbs_g,
  fatG: r.fat_g,
  createdAt: r.created_at,
});

export const addDietEntry = async (input: DietEntryInput): Promise<DietEntry> => {
  const entry: DietEntry = { ...input, id: uuidv4(), createdAt: Date.now() };
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO diet_entries (id, date, meal, name, kcal, protein_g, carbs_g, fat_g, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [entry.id, entry.date, entry.meal, entry.name, entry.kcal, entry.proteinG, entry.carbsG, entry.fatG, entry.createdAt]
  );
  return entry;
};

export const deleteDietEntry = async (id: string): Promise<void> => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM diet_entries WHERE id = ?;', [id]);
};

export const getDietEntriesByDate = async (date: string): Promise<DietEntry[]> => {
  const db = getDatabase();
  const rows = await db.getAllAsync<DietEntryRow>(
    'SELECT * FROM diet_entries WHERE date = ? ORDER BY created_at ASC;',
    [date]
  );
  return rows.map(fromRow);
};

/** 最近吃過的食物（依名稱去重，最新的在前），用於快速新增 */
export const getRecentFoods = async (limit = 8): Promise<DietEntry[]> => {
  const db = getDatabase();
  // SQLite 的 bare column 規則：搭配 MAX() 時，其他欄位會取自 created_at 最大的那一列
  const rows = await db.getAllAsync<DietEntryRow>(
    `SELECT id, date, meal, name, kcal, protein_g, carbs_g, fat_g, MAX(created_at) AS created_at
     FROM diet_entries
     GROUP BY name
     ORDER BY created_at DESC LIMIT ?;`,
    [limit]
  );
  return rows.map(fromRow);
};

/** 每日彙總（只回傳有紀錄的日期），依日期升冪 */
export const getDailySummaries = async (from: string, to: string): Promise<DietDailySummary[]> => {
  const db = getDatabase();
  const rows = await db.getAllAsync<{
    date: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number;
  }>(
    `SELECT date, SUM(kcal) AS kcal, SUM(protein_g) AS protein_g,
            SUM(carbs_g) AS carbs_g, SUM(fat_g) AS fat_g
     FROM diet_entries
     WHERE date >= ? AND date <= ?
     GROUP BY date ORDER BY date ASC;`,
    [from, to]
  );
  return rows.map((r) => ({
    date: r.date,
    kcal: r.kcal,
    proteinG: r.protein_g,
    carbsG: r.carbs_g,
    fatG: r.fat_g,
  }));
};
