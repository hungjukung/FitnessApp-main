/**
 * 訊號萃取：把原始資料轉成「與資料相容的方向集合」
 *
 * 關鍵設計：每個訊號不輸出單一方向，而是輸出一個「相容方向集合」。
 *   - 強證據上升      → ['up']
 *   - 弱證據上升      → ['up', 'flat']       （1~2 SE，不能排除持平）
 *   - 確定持平        → ['flat']             （信賴區間整個落在等價區間內）
 *   - 看不出／資料不足 → ['up', 'flat', 'down']（不排除任何假設）
 *
 * 假設判別時，只有當假設預期的方向與這個集合「完全沒有交集」才排除該假設。
 * 這樣「資料不足」天生就不會誤殺任何假設，而是讓多個假設同時存活 → 系統說「我不知道」。
 */

import { WeightLog, WorkoutSession } from '../../../types';
import { DietDailySummary, InBodyRecord } from '../../contracts';
import { bestE1RMByLift, countEffectiveSets, liftName } from '../../workout';
import { dayIndex, linearRegression } from './regression';
import { Thresholds } from './thresholds';

export type Direction = 'up' | 'flat' | 'down';
export const ALL_DIRECTIONS: Direction[] = ['up', 'flat', 'down'];

export type SignalKey = 'weight' | 'volume' | 'strength' | 'energy' | 'muscle' | 'fat';

export interface Signal {
  key: SignalKey;
  label: string;
  /** 與資料相容的方向集合 */
  compatible: Direction[];
  /** 證據強度：strong = 超過 2 SE（或確定持平）；weak = 1~2 SE；none = 無法判斷 */
  evidence: 'strong' | 'weak' | 'none';
  /** 資料量是否達到計算門檻 */
  sufficient: boolean;
  /** 一句話描述目前狀態，例如「體重上升」「資料不足」 */
  stateLabel: string;
  /** 主要數字，例如「+0.12 ± 0.05 kg/週」 */
  summary: string;
  detail?: string;
}

/** 各訊號的方向用語 */
export const DIRECTION_LABELS: Record<SignalKey, Record<Direction, string>> = {
  weight: { up: '上升', flat: '持平', down: '下降' },
  volume: { up: '增加', flat: '持平', down: '減少' },
  strength: { up: '進步', flat: '持平', down: '退步' },
  energy: { up: '熱量盈餘', flat: '維持熱量', down: '熱量赤字' },
  muscle: { up: '增加', flat: '持平', down: '減少' },
  fat: { up: '增加', flat: '持平', down: '減少' },
};

export const isInformative = (s: Signal): boolean => s.compatible.length < ALL_DIRECTIONS.length;

const signed = (v: number, digits = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`;
const percent = (ratio: number) => `${ratio >= 0 ? '+' : '−'}${Math.abs(ratio * 100).toFixed(0)}%`;

function uninformative(key: SignalKey, label: string, stateLabel: string, summary: string, sufficient: boolean, detail?: string): Signal {
  return { key, label, compatible: [...ALL_DIRECTIONS], evidence: 'none', sufficient, stateLabel, summary, detail };
}

/** 以相對變化量與門檻判定方向（訓練量、e1RM 用） */
function directionByRatio(ratio: number, threshold: number): Direction {
  if (ratio >= threshold) return 'up';
  if (ratio <= -threshold) return 'down';
  return 'flat';
}

// ─────────────────────────────────────────────
// 1. 體重趨勢（核心訊號）
// ─────────────────────────────────────────────

export interface WeightTrend {
  n: number;
  spanDays: number;
  slopePerWeek: number;
  sePerWeek: number;
  t: number;
  residualSd: number;
}

export function weightSignal(logs: WeightLog[]): Signal & { trend?: WeightTrend } {
  const label = '體重趨勢';
  const { minPoints, minSpanDays, flatMarginKgPerWeek } = Thresholds.weight;

  const n = logs.length;
  const spanDays = n > 0 ? dayIndex(logs[n - 1].date) - dayIndex(logs[0].date) : 0;
  if (n < minPoints || spanDays < minSpanDays) {
    return uninformative(
      'weight', label, '資料不足',
      `${n} 筆 / 橫跨 ${spanDays} 天`,
      false,
      `需要至少 ${minPoints} 筆、橫跨 ${minSpanDays} 天以上`
    );
  }

  const origin = dayIndex(logs[0].date);
  const reg = linearRegression(logs.map((l) => ({ x: dayIndex(l.date) - origin, y: l.weight })));
  if (!reg) {
    return uninformative('weight', label, '資料不足', `${n} 筆`, false);
  }

  const trend: WeightTrend = {
    n,
    spanDays,
    slopePerWeek: reg.slope * 7,
    sePerWeek: reg.slopeSe * 7,
    t: reg.t,
    residualSd: reg.residualSd,
  };
  const summary = `${signed(trend.slopePerWeek, 2)} ± ${trend.sePerWeek.toFixed(2)} kg/週`;
  const totalChange = reg.slope * spanDays;
  const detail =
    `${n} 筆、${spanDays} 天，期間變化 ${signed(totalChange)} kg（±${(reg.slopeSe * spanDays).toFixed(1)}），` +
    `日間波動 σ ≈ ${reg.residualSd.toFixed(1)} kg`;

  const absT = Math.abs(reg.t);
  const dir: Direction = reg.slope > 0 ? 'up' : 'down';
  const L = DIRECTION_LABELS.weight;

  // 超過 2 SE：有把握的趨勢
  if (absT >= 2) {
    return { key: 'weight', label, compatible: [dir], evidence: 'strong', sufficient: true, stateLabel: `體重${L[dir]}`, summary, detail, trend };
  }
  // 95% 信賴區間整個落在 ±等價區間內：有把握的「持平」
  if (Math.abs(trend.slopePerWeek) + 2 * trend.sePerWeek <= flatMarginKgPerWeek) {
    return { key: 'weight', label, compatible: ['flat'], evidence: 'strong', sufficient: true, stateLabel: '體重持平', summary, detail, trend };
  }
  // 1~2 SE：傾向某方向，但不能排除持平
  if (absT >= 1) {
    return { key: 'weight', label, compatible: [dir, 'flat'], evidence: 'weak', sufficient: true, stateLabel: `體重略為${L[dir]}（證據弱）`, summary, detail, trend };
  }
  return { ...uninformative('weight', label, '看不出方向', summary, true, detail), trend };
}

// ─────────────────────────────────────────────
// 2. 訓練量：每週有效組數
// ─────────────────────────────────────────────

export function volumeSignal(sessions: WorkoutSession[], endDate: string, windowDays: number): Signal {
  const label = '訓練量';
  const { minWeeks, volumeChangeRatio } = Thresholds.training;
  const totalWeeks = Math.floor(windowDays / 7);
  const endIdx = dayIndex(endDate);

  // 從窗口結尾往回切成完整的 7 天週，避免「本週還沒過完」被當成訓練量下降
  const weekly = new Array<number>(totalWeeks).fill(0);
  const weekHasSession = new Array<boolean>(totalWeeks).fill(false);
  for (const session of sessions) {
    const weeksAgo = Math.floor((endIdx - dayIndex(session.date)) / 7);
    if (weeksAgo < 0 || weeksAgo >= totalWeeks) continue;
    const w = totalWeeks - 1 - weeksAgo;
    weekly[w] += countEffectiveSets([session]);
    weekHasSession[w] = true;
  }

  // 從第一週有紀錄開始算，避免「還沒開始用 App 的週」被當成 0 組
  const firstWeek = weekHasSession.indexOf(true);
  const weeks = firstWeek === -1 ? [] : weekly.slice(firstWeek);
  if (weeks.length < minWeeks) {
    return uninformative('volume', label, '資料不足', `${weeks.length} 週紀錄`, false, `需要至少 ${minWeeks} 週`);
  }

  const reg = linearRegression(weeks.map((y, x) => ({ x, y })));
  const mean = weeks.reduce((s, v) => s + v, 0) / weeks.length;
  if (!reg || mean === 0) {
    return uninformative('volume', label, '沒有有效組', '0 組', false, '有效組 = 5–30 下的非有氧組');
  }

  const start = Math.max(0, reg.intercept);
  const end = Math.max(0, reg.intercept + reg.slope * (weeks.length - 1));
  const ratio = (end - start) / mean;
  const dir = directionByRatio(ratio, volumeChangeRatio);

  return {
    key: 'volume',
    label,
    compatible: [dir],
    evidence: 'strong',
    sufficient: true,
    stateLabel: `訓練量${DIRECTION_LABELS.volume[dir]}`,
    summary: `每週有效組數 ${start.toFixed(0)} → ${end.toFixed(0)}（${percent(ratio)}）`,
    detail: `${weeks.length} 週趨勢線；變化超過 ±${volumeChangeRatio * 100}% 才算增減`,
  };
}

// ─────────────────────────────────────────────
// 3. 力量：主要複合動作 e1RM
// ─────────────────────────────────────────────

export function strengthSignal(sessions: WorkoutSession[]): Signal {
  const label = '力量（e1RM）';
  const { minSessionsPerLift, e1rmChangeRatio } = Thresholds.strength;

  const byLift = bestE1RMByLift(sessions);
  const results: Array<{ name: string; dir: Direction; ratio: number }> = [];

  for (const [liftId, points] of Object.entries(byLift)) {
    if (points.length < minSessionsPerLift) continue;
    const origin = dayIndex(points[0].date);
    const reg = linearRegression(points.map((p) => ({ x: dayIndex(p.date) - origin, y: p.e1rm })));
    if (!reg) continue;
    const lastX = dayIndex(points[points.length - 1].date) - origin;
    const start = reg.intercept;
    const end = reg.intercept + reg.slope * lastX;
    if (start <= 0) continue;
    const ratio = (end - start) / start;
    results.push({ name: liftName(liftId), dir: directionByRatio(ratio, e1rmChangeRatio), ratio });
  }

  if (results.length === 0) {
    return uninformative(
      'strength', label, '資料不足', '無足夠的主要動作紀錄', false,
      `深蹲／臥推／硬舉／肩推任一項需 ≥ ${minSessionsPerLift} 次（1–10 下的組）`
    );
  }

  const summary = results.map((r) => `${r.name} ${percent(r.ratio)}`).join('、');
  const dirs = new Set(results.map((r) => r.dir));

  // 有的動作進步、有的退步 → 無法歸納，不拿來排除假設
  if (dirs.has('up') && dirs.has('down')) {
    return uninformative('strength', label, '各動作方向不一致', summary, true);
  }
  const compatible = ALL_DIRECTIONS.filter((d) => dirs.has(d));
  const L = DIRECTION_LABELS.strength;
  return {
    key: 'strength',
    label,
    compatible,
    evidence: 'strong',
    sufficient: true,
    stateLabel: `力量${compatible.map((d) => L[d]).join('或')}`,
    summary,
    detail: `變化超過 ±${(e1rmChangeRatio * 100).toFixed(1)}% 才算進步／退步`,
  };
}

// ─────────────────────────────────────────────
// 4. 熱量盈虧（飲食模組）
// ─────────────────────────────────────────────

export function energySignal(summaries: DietDailySummary[], tdee: number | null, windowDays: number): Signal {
  const label = '熱量攝取';
  const { minLoggedDayRatio, deficitRatio, surplusRatio } = Thresholds.diet;

  if (tdee === null) {
    return uninformative('energy', label, '無法估計消耗', '—', false, '需要在設定填寫年齡與身高');
  }
  const loggedRatio = summaries.length / windowDays;
  if (loggedRatio < minLoggedDayRatio) {
    return uninformative(
      'energy', label, '資料不足', `${summaries.length} / ${windowDays} 天有紀錄`, false,
      `需要至少 ${Math.round(minLoggedDayRatio * 100)}% 的天數有飲食紀錄`
    );
  }

  const avg = summaries.reduce((s, d) => s + d.kcal, 0) / summaries.length;
  const ratio = avg / tdee;
  const summary = `平均 ${Math.round(avg)} kcal / 估計消耗 ${tdee} kcal（${percent(ratio - 1)}）`;
  const detail = `${summaries.length} 天有紀錄；TDEE 為估計值，誤差約 ±10–15%`;

  if (ratio < deficitRatio) {
    return { key: 'energy', label, compatible: ['down'], evidence: 'strong', sufficient: true, stateLabel: '明顯熱量赤字', summary, detail };
  }
  if (ratio > surplusRatio) {
    return { key: 'energy', label, compatible: ['up'], evidence: 'strong', sufficient: true, stateLabel: '明顯熱量盈餘', summary, detail };
  }
  return uninformative('energy', label, '接近維持熱量（在估計誤差內）', summary, true, detail);
}

// ─────────────────────────────────────────────
// 5. InBody 身體組成（骨骼肌重、體脂肪重）
// ─────────────────────────────────────────────

export function inBodySignals(records: InBodyRecord[]): { muscle: Signal; fat: Signal } {
  const { minRecordsForTrend, skeletalMuscleNoiseKg, bodyFatNoiseKg } = Thresholds.inBody;
  const n = records.length;

  const build = (
    key: 'muscle' | 'fat',
    label: string,
    pick: (r: InBodyRecord) => number,
    noiseKg: number
  ): Signal => {
    if (n === 0) return uninformative(key, label, '無 InBody 資料', '—', false);
    if (n === 1) return uninformative(key, label, '僅建立基準', `${pick(records[0]).toFixed(1)} kg`, false, `需要 ${minRecordsForTrend} 份以上才判斷方向`);
    if (n < minRecordsForTrend) {
      const diff = pick(records[n - 1]) - pick(records[0]);
      return uninformative(key, label, '僅供參考', `2 份差值 ${signed(diff)} kg`, false, `需要 ${minRecordsForTrend} 份以上才判斷方向`);
    }

    const origin = dayIndex(records[0].date);
    const reg = linearRegression(records.map((r) => ({ x: dayIndex(r.date) - origin, y: pick(r) })));
    const span = dayIndex(records[n - 1].date) - origin;
    if (!reg) return uninformative(key, label, '資料不足', `${n} 份`, false);

    const change = reg.slope * span;
    const summary = `${n} 份趨勢 ${signed(change)} kg`;
    // 變化在 BIA 測量誤差內：不當成「持平」的證據，因為沒測到 ≠ 沒發生
    if (Math.abs(change) <= noiseKg) {
      return uninformative(key, label, '變化在測量誤差內', summary, true, `誤差門檻 ±${noiseKg} kg`);
    }
    const dir: Direction = change > 0 ? 'up' : 'down';
    return {
      key, label, compatible: [dir], evidence: 'strong', sufficient: true,
      stateLabel: `${label}${DIRECTION_LABELS[key][dir]}`, summary, detail: `誤差門檻 ±${noiseKg} kg`,
    };
  };

  return {
    muscle: build('muscle', '骨骼肌重', (r) => r.skeletalMuscleKg, skeletalMuscleNoiseKg),
    fat: build('fat', '體脂肪重', (r) => r.bodyFatKg, bodyFatNoiseKg),
  };
}
