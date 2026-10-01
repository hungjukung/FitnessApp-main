/**
 * FitTrack AI — 模組間資料契約
 *
 * 三個模組（飲食 / 課表 / 分析）之間唯一的溝通管道。
 * - 飲食組實作 DietDataSource，課表組實作 WorkoutDataSource
 * - 分析組只透過這些介面讀資料，不得直接 import 其他模組的 db / store / components
 *
 * ⚠️ 修改本檔需三人同意：這裡一改，另外兩人的程式碼都會受影響。
 */

import { WeightLog, WorkoutSession } from '../types';

/** 日期一律用本地日期字串 "YYYY-MM-DD"，範圍查詢為閉區間 [from, to] */
export type LocalDate = string;

// ─────────────────────────────────────────────
// 飲食控制（飲食組負責）
// ─────────────────────────────────────────────

/** 單日飲食彙總。分析端只需要每日總量，不需要逐餐明細 */
export interface DietDailySummary {
  date: LocalDate;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface DietDataSource {
  getDailySummaries(from: LocalDate, to: LocalDate): Promise<DietDailySummary[]>;
}

// ─────────────────────────────────────────────
// 記錄課表（課表組負責）
// ─────────────────────────────────────────────

export interface WorkoutDataSource {
  /** 回傳含 sets 的完整 sessions，依日期升冪 */
  getSessions(from: LocalDate, to: LocalDate): Promise<WorkoutSession[]>;
}

// ─────────────────────────────────────────────
// 體重（既有共用功能，modules/core 提供）
// ─────────────────────────────────────────────

export interface WeightDataSource {
  getWeightLogs(from: LocalDate, to: LocalDate): Promise<WeightLog[]>;
}

// ─────────────────────────────────────────────
// InBody（Phase 4 OCR 完成前，modules/core 先回傳空陣列）
// ─────────────────────────────────────────────

/** 使用者確認後的 InBody 數值。分析端只用到身體組成的這幾欄 */
export interface InBodyRecord {
  date: LocalDate;
  weightKg: number;
  skeletalMuscleKg: number;
  bodyFatKg: number;
  bodyFatPercent: number;
}

export interface InBodyDataSource {
  /** 依日期升冪 */
  getRecords(from: LocalDate, to: LocalDate): Promise<InBodyRecord[]>;
}
