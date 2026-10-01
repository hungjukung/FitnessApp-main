/**
 * 把過去的訓練紀錄整理成解析與進步判斷要用的格式
 */

import { WorkoutSession, WorkoutSet } from '../../../types';
import { DraftSet, HistoryEntry, QuickLogContext } from './types';

export function workoutSetToDraft(set: WorkoutSet): DraftSet {
  const out: DraftSet = {};
  if (set.weight !== undefined && set.weight > 0) out.weightKg = set.weight;
  if (set.reps !== undefined && set.reps > 0) out.reps = set.reps;
  if (set.duration !== undefined && set.duration > 0) out.durationMin = Math.round((set.duration / 60) * 10) / 10;
  return out;
}

/** 依動作分組，保留動作第一次出現的順序，組內依 setNumber 排序 */
export function groupSessionByExercise(session: WorkoutSession): HistoryEntry[] {
  const order: string[] = [];
  const byId = new Map<string, WorkoutSet[]>();
  for (const set of session.sets) {
    if (!byId.has(set.exerciseId)) {
      byId.set(set.exerciseId, []);
      order.push(set.exerciseId);
    }
    byId.get(set.exerciseId)!.push(set);
  }
  return order.map((exerciseId) => ({
    exerciseId,
    date: session.date,
    sets: byId
      .get(exerciseId)!
      .slice()
      .sort((a, b) => a.setNumber - b.setNumber)
      .map(workoutSetToDraft),
  }));
}

/**
 * @param sessions 任意順序的歷史 sessions（可以包含今天，會被排除）
 * @param today 本地日期 "YYYY-MM-DD"
 */
export function buildQuickLogContext(sessions: WorkoutSession[], today: string): QuickLogContext {
  const past = sessions
    .filter((s) => s.date < today && s.sets.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt);

  const lastByExercise: Record<string, HistoryEntry> = {};
  for (const session of past) {
    for (const entry of groupSessionByExercise(session)) {
      lastByExercise[entry.exerciseId] = entry;
    }
  }

  const latest = past[past.length - 1];
  return {
    lastSession: latest ? { date: latest.date, entries: groupSessionByExercise(latest) } : null,
    lastByExercise,
  };
}

/** 送給後端的歷史：各動作最近紀錄只取最新的 20 個動作，避免 prompt 太長 */
export function historyPayload(ctx: QuickLogContext): {
  lastSession: QuickLogContext['lastSession'];
  lastByExercise: HistoryEntry[];
} {
  const lastByExercise = Object.values(ctx.lastByExercise)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);
  return { lastSession: ctx.lastSession, lastByExercise };
}
