/**
 * 課表一句話記錄 — 型別
 *
 * 草稿（Draft）只是暫存：使用者確認之前不會寫入資料庫。
 */

export interface DraftSet {
  weightKg?: number;
  reps?: number;
  /** 有氧用，單位分鐘 */
  durationMin?: number;
}

export interface DraftEntry {
  exerciseId: string;
  exerciseName: string;
  sets: DraftSet[];
}

export type DraftSource = 'ai' | 'local';

export interface QuickLogDraft {
  entries: DraftEntry[];
  /** 看不懂、沒有加入草稿的原文片段 */
  unrecognized: string[];
  /** ai = Gemini 解析；local = 離線規則解析（AI 連不上或沒解析出東西時） */
  source: DraftSource;
}

/** 某個動作在過去某一天的紀錄 */
export interface HistoryEntry {
  exerciseId: string;
  date: string;
  sets: DraftSet[];
}

/** 解析「跟上次一樣」「深蹲加 5 公斤」與判斷有沒有進步時需要的歷史紀錄 */
export interface QuickLogContext {
  /** 今天以前最近一次有組數的訓練 */
  lastSession: { date: string; entries: HistoryEntry[] } | null;
  /** 每個動作今天以前最近一次的紀錄 */
  lastByExercise: Record<string, HistoryEntry>;
}

/** 前端與後端共用的上限（後端見 backend/src/services/workoutParse.service.ts） */
export const QUICK_LOG_LIMITS = {
  maxTextLength: 300,
  maxEntries: 20,
  maxSetsPerEntry: 20,
  repsMax: 100,
  weightMaxKg: 500,
  durationMaxMin: 600,
  maxUnrecognized: 10,
  maxUnrecognizedLength: 50,
} as const;
