/**
 * 草稿驗證：不論來源是 AI 或離線解析，進到畫面前都先過這一關
 *
 * AI 的輸出一律當作不可信資料：動作 id 必須在動作庫內、數字必須落在合理範圍，
 * 不合格的欄位直接丟掉，不自動修正或猜測。
 */

import { DraftEntry, DraftSet, QUICK_LOG_LIMITS } from './types';
import { EXERCISE_BY_ID } from './exerciseAliases';

function toFiniteNumber(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

export function sanitizeSet(raw: unknown): DraftSet {
  if (!raw || typeof raw !== 'object') return {};
  const s = raw as Record<string, unknown>;
  const out: DraftSet = {};

  const weight = toFiniteNumber(s.weightKg);
  if (weight !== undefined && weight > 0 && weight <= QUICK_LOG_LIMITS.weightMaxKg) {
    out.weightKg = Math.round(weight * 10) / 10;
  }
  const reps = toFiniteNumber(s.reps);
  if (reps !== undefined && Number.isInteger(reps) && reps >= 1 && reps <= QUICK_LOG_LIMITS.repsMax) {
    out.reps = reps;
  }
  const duration = toFiniteNumber(s.durationMin);
  if (duration !== undefined && duration > 0 && duration <= QUICK_LOG_LIMITS.durationMaxMin) {
    out.durationMin = Math.round(duration * 10) / 10;
  }
  return out;
}

export const hasAnyValue = (s: DraftSet): boolean =>
  s.weightKg !== undefined || s.reps !== undefined || s.durationMin !== undefined;

/**
 * 把任意輸入（後端 JSON 或離線解析結果）整理成合法草稿：
 * - 動作不在動作庫 → 丟掉
 * - 同一個動作出現多次 → 組數合併
 * - 沒有任何數值的組 → 丟掉；沒有任何組的動作 → 丟掉
 */
export function sanitizeDraft(raw: unknown): { entries: DraftEntry[]; unrecognized: string[] } {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const byId = new Map<string, DraftEntry>();

  if (Array.isArray(obj.entries)) {
    for (const e of obj.entries.slice(0, QUICK_LOG_LIMITS.maxEntries)) {
      if (!e || typeof e !== 'object') continue;
      const entry = e as Record<string, unknown>;
      const exercise = typeof entry.exerciseId === 'string' ? EXERCISE_BY_ID.get(entry.exerciseId) : undefined;
      if (!exercise) continue;

      const sets = Array.isArray(entry.sets) ? entry.sets.map(sanitizeSet).filter(hasAnyValue) : [];
      if (sets.length === 0) continue;

      const existing = byId.get(exercise.id);
      if (existing) {
        existing.sets.push(...sets);
      } else {
        byId.set(exercise.id, { exerciseId: exercise.id, exerciseName: exercise.name, sets });
      }
    }
  }

  const entries = Array.from(byId.values()).map((e) => ({
    ...e,
    sets: e.sets.slice(0, QUICK_LOG_LIMITS.maxSetsPerEntry),
  }));

  const unrecognized = Array.isArray(obj.unrecognized)
    ? obj.unrecognized
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .map((u) => u.trim().slice(0, QUICK_LOG_LIMITS.maxUnrecognizedLength))
        .slice(0, QUICK_LOG_LIMITS.maxUnrecognized)
    : [];

  return { entries, unrecognized };
}

export function countSets(entries: DraftEntry[]): number {
  return entries.reduce((sum, e) => sum + e.sets.length, 0);
}
