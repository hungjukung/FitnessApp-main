/**
 * 訓練指標的定義（課表組負責，分析組透過 index.ts 使用）
 *
 * 1. 每肌群有效組數：比總 tonnage（重量 × 次數）更貼近增肌文獻的劑量指標，
 *    tonnage 會偏袒高次數輕重量。
 * 2. e1RM（估計一次最大反覆重量）：用 Epley 公式追蹤主要複合動作的力量進展。
 */

import { Exercise, MuscleGroup, WorkoutSession, WorkoutSet } from '../../types';
import { BUILT_IN_EXERCISES } from '../../constants/exercises';

const EXERCISE_BY_ID = new Map<string, Exercise>(BUILT_IN_EXERCISES.map((e) => [e.id, e]));

// ─────────────────────────────────────────────
// 有效組數
// ─────────────────────────────────────────────

/**
 * 有效組的判定：5–30 下。
 * 我們沒有記錄 RPE／離力竭幾下，所以用次數範圍當代理指標：
 * < 5 下偏向最大肌力訓練，> 30 下偏向耐力，兩者對增肌的劑量貢獻較不明確。
 */
export const EFFECTIVE_REPS_MIN = 5;
export const EFFECTIVE_REPS_MAX = 30;

/**
 * 分數組（fractional sets）：一組動作算給主要肌群 1 組、次要肌群各 0.5 組。
 * 例如臥推一組 = 胸 1 + 三頭 0.5 + 肩 0.5。
 * exercises.ts 中 muscleGroups 的第一個元素視為主要肌群。
 */
export const SECONDARY_MUSCLE_WEIGHT = 0.5;

export function isEffectiveSet(set: WorkoutSet): boolean {
  const exercise = EXERCISE_BY_ID.get(set.exerciseId);
  if (!exercise || exercise.category === 'cardio') return false;
  return set.reps !== undefined && set.reps >= EFFECTIVE_REPS_MIN && set.reps <= EFFECTIVE_REPS_MAX;
}

export type MuscleSetCounts = Partial<Record<MuscleGroup, number>>;

/** 計算一批 sessions 的每肌群有效組數 */
export function countEffectiveSetsByMuscle(sessions: WorkoutSession[]): MuscleSetCounts {
  const counts: MuscleSetCounts = {};
  for (const session of sessions) {
    for (const set of session.sets) {
      if (!isEffectiveSet(set)) continue;
      const groups = EXERCISE_BY_ID.get(set.exerciseId)!.muscleGroups;
      groups.forEach((group, i) => {
        if (group === 'cardio') return;
        counts[group] = (counts[group] ?? 0) + (i === 0 ? 1 : SECONDARY_MUSCLE_WEIGHT);
      });
    }
  }
  return counts;
}

/** 一批 sessions 的有效組總數（每組只算一次，不做肌群拆分） */
export function countEffectiveSets(sessions: WorkoutSession[]): number {
  let total = 0;
  for (const session of sessions) {
    for (const set of session.sets) {
      if (isEffectiveSet(set)) total += 1;
    }
  }
  return total;
}

// ─────────────────────────────────────────────
// e1RM
// ─────────────────────────────────────────────

/** 追蹤力量進展的主要複合動作 */
export const MAIN_LIFT_IDS = ['squat', 'bench_press', 'deadlift', 'overhead_press'] as const;

/**
 * Epley 公式只在低次數時準確，超過 10 下誤差明顯變大，所以只用 1–10 下的組來估計。
 */
export const E1RM_MAX_REPS = 10;

export function epley1RM(weightKg: number, reps: number): number {
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

export interface LiftE1RMPoint {
  date: string;
  e1rm: number;
}

/** 每個主要動作在每次 session 中最好的 e1RM，依日期升冪 */
export function bestE1RMByLift(sessions: WorkoutSession[]): Record<string, LiftE1RMPoint[]> {
  const result: Record<string, LiftE1RMPoint[]> = {};
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  for (const liftId of MAIN_LIFT_IDS) {
    const points: LiftE1RMPoint[] = [];
    for (const session of sorted) {
      let best = 0;
      for (const set of session.sets) {
        if (set.exerciseId !== liftId || !set.weight || !set.reps) continue;
        if (set.reps > E1RM_MAX_REPS) continue;
        best = Math.max(best, epley1RM(set.weight, set.reps));
      }
      if (best > 0) points.push({ date: session.date, e1rm: best });
    }
    if (points.length > 0) result[liftId] = points;
  }
  return result;
}

export function liftName(liftId: string): string {
  return EXERCISE_BY_ID.get(liftId)?.name ?? liftId;
}
