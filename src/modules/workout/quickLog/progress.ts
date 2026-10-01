/**
 * 這次跟上次比，有沒有進步？
 *
 * 「表現很棒」由規則定義，不交給 LLM 判斷：
 * - 負重動作：比較最好的一組 e1RM（Epley，只用 1–10 下的組）；沒有可比的組時比較最大重量，再比次數
 * - 徒手動作：比較單組最多次數
 * - 有氧：比較總時間
 * 差距在 ±1% 以內視為持平，避免四捨五入誤差被當成進步或退步。
 */

import { epley1RM, E1RM_MAX_REPS } from '../workoutMetrics';
import { DraftEntry, DraftSet, QuickLogContext } from './types';
import { isCardio } from './exerciseAliases';

export type ProgressOutcome = 'improved' | 'same' | 'regressed' | 'first_time';

export interface ExerciseProgress {
  exerciseId: string;
  exerciseName: string;
  outcome: ProgressOutcome;
  /** 給台詞用的差距描述，例如「+5 kg」「+2 下」 */
  deltaText?: string;
  /** 相對變化（0.05 = +5%），用來挑最值得講的動作 */
  relativeChange: number;
}

export interface ProgressSummary {
  overall: ProgressOutcome;
  items: ExerciseProgress[];
  /** 台詞要講的那一個動作 */
  highlight: ExerciseProgress | null;
}

export const SAME_TOLERANCE = 0.01;

const round1 = (n: number) => Math.round(n * 10) / 10;
const signed = (n: number, unit: string) => `${n > 0 ? '+' : ''}${round1(n)} ${unit}`;

function bestE1RM(sets: DraftSet[]): number {
  let best = 0;
  for (const s of sets) {
    if (!s.weightKg || !s.reps || s.reps > E1RM_MAX_REPS) continue;
    best = Math.max(best, epley1RM(s.weightKg, s.reps));
  }
  return best;
}

const maxOf = (values: Array<number | undefined>) =>
  values.reduce<number>((m, v) => (v !== undefined && v > m ? v : m), 0);

const totalDuration = (sets: DraftSet[]) => sets.reduce((sum, s) => sum + (s.durationMin ?? 0), 0);

function classify(before: number, after: number): { outcome: ProgressOutcome; relative: number } {
  const relative = before > 0 ? (after - before) / before : 0;
  if (relative > SAME_TOLERANCE) return { outcome: 'improved', relative };
  if (relative < -SAME_TOLERANCE) return { outcome: 'regressed', relative };
  return { outcome: 'same', relative };
}

export function compareExercise(entry: DraftEntry, previous: DraftSet[] | undefined): ExerciseProgress {
  const base = { exerciseId: entry.exerciseId, exerciseName: entry.exerciseName };
  if (!previous || previous.length === 0) return { ...base, outcome: 'first_time', relativeChange: 0 };

  // 有氧：總時間
  if (isCardio(entry.exerciseId)) {
    const before = totalDuration(previous);
    const after = totalDuration(entry.sets);
    if (before === 0 || after === 0) return { ...base, outcome: 'first_time', relativeChange: 0 };
    const { outcome, relative } = classify(before, after);
    return { ...base, outcome, relativeChange: relative, deltaText: signed(after - before, '分鐘') };
  }

  const beforeTop = maxOf(previous.map((s) => s.weightKg));
  const afterTop = maxOf(entry.sets.map((s) => s.weightKg));

  // 徒手：單組最多次數
  if (beforeTop === 0 && afterTop === 0) {
    const before = maxOf(previous.map((s) => s.reps));
    const after = maxOf(entry.sets.map((s) => s.reps));
    if (before === 0 || after === 0) return { ...base, outcome: 'first_time', relativeChange: 0 };
    const { outcome, relative } = classify(before, after);
    return { ...base, outcome, relativeChange: relative, deltaText: signed(after - before, '下') };
  }

  // 負重：e1RM；描述文字優先講重量差，重量一樣時講次數差
  const beforeE1 = bestE1RM(previous);
  const afterE1 = bestE1RM(entry.sets);
  const weightDelta = afterTop - beforeTop;
  const topRepsBefore = maxOf(previous.filter((s) => s.weightKg === beforeTop).map((s) => s.reps));
  const topRepsAfter = maxOf(entry.sets.filter((s) => s.weightKg === afterTop).map((s) => s.reps));
  const deltaText =
    weightDelta !== 0
      ? signed(weightDelta, 'kg')
      : topRepsAfter !== topRepsBefore
        ? signed(topRepsAfter - topRepsBefore, '下')
        : undefined;

  if (beforeE1 > 0 && afterE1 > 0) {
    const { outcome, relative } = classify(beforeE1, afterE1);
    return { ...base, outcome, relativeChange: relative, deltaText };
  }

  const { outcome, relative } = classify(beforeTop, afterTop);
  return { ...base, outcome, relativeChange: relative, deltaText };
}

export function evaluateProgress(entries: DraftEntry[], ctx: QuickLogContext): ProgressSummary {
  const items = entries.map((e) => compareExercise(e, ctx.lastByExercise[e.exerciseId]?.sets));
  if (items.length === 0) return { overall: 'same', items, highlight: null };

  const improved = items.filter((i) => i.outcome === 'improved');
  const regressed = items.filter((i) => i.outcome === 'regressed');
  const same = items.filter((i) => i.outcome === 'same');

  // 有任何一個動作進步就誇；其他情況嗆
  if (improved.length > 0) {
    const highlight = improved.reduce((a, b) => (b.relativeChange > a.relativeChange ? b : a));
    return { overall: 'improved', items, highlight };
  }
  if (regressed.length > 0) {
    const highlight = regressed.reduce((a, b) => (b.relativeChange < a.relativeChange ? b : a));
    return { overall: 'regressed', items, highlight };
  }
  if (same.length > 0) return { overall: 'same', items, highlight: same[0] };
  return { overall: 'first_time', items, highlight: items[0] };
}
