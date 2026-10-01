/**
 * 判讀引擎入口：資料 → 訊號 → 假設判別 → 結論 + 信心等級
 *
 * 輸出規則（改版文件 §三.2）：
 *   - 剩一個假設 → 報告結論
 *   - 剩多個     → 說明無法區分，並指出還需要什麼資料
 *   - 剩零個     → 訊號矛盾，明確拒答
 *
 * 信心分級（改版文件 §三.4）：
 *   - 高：體重、訓練與 InBody 訊號同向，且資料量達門檻
 *   - 中：體重斜率 > 2×SE，且有一個佐證訊號
 *   - 低：斜率落在 1~2×SE，或僅單一訊號可用
 *   - 拒答：訊號互相矛盾，或資料筆數低於門檻
 */

import { WeightLog, WorkoutSession } from '../../../types';
import { DietDailySummary, InBodyRecord } from '../../contracts';
import { evaluateHypotheses, Hypothesis, HypothesisEvaluation } from './hypotheses';
import {
  energySignal,
  inBodySignals,
  isInformative,
  Signal,
  SignalKey,
  strengthSignal,
  volumeSignal,
  WeightTrend,
  weightSignal,
} from './signals';

export type Confidence = 'high' | 'medium' | 'low';

export type Verdict =
  | { state: 'conclusion'; hypothesis: Hypothesis; confidence: Confidence; headline: string }
  | { state: 'ambiguous'; candidates: Hypothesis[]; headline: string }
  | { state: 'refused'; reason: 'insufficient' | 'contradiction'; headline: string };

export interface InterpretationInput {
  windowDays: number;
  endDate: string;
  weightLogs: WeightLog[];
  sessions: WorkoutSession[];
  dietSummaries: DietDailySummary[];
  tdee: number | null;
  inBodyRecords: InBodyRecord[];
}

export interface Interpretation {
  verdict: Verdict;
  signals: Signal[];
  weightTrend?: WeightTrend;
  evaluations: HypothesisEvaluation[];
  /** 要讓結論更明確，還需要補什麼資料 */
  nextSteps: string[];
}

const NEXT_STEP_ADVICE: Record<SignalKey, string> = {
  weight: '持續每天早上空腹量體重，資料越多，趨勢的誤差越小',
  volume: '持續記錄每次訓練（至少 4 週），才能看出訓練量變化',
  strength: '深蹲、臥推、硬舉或肩推任一項至少記錄 3 次（1–10 下的組）',
  energy: '窗口內至少一半的天數記錄飲食',
  muscle: '在相近條件下（同一台機器、空腹、相近時段）累積 3 份以上 InBody',
  fat: '在相近條件下（同一台機器、空腹、相近時段）累積 3 份以上 InBody',
};

/**
 * 找出「能區分存活假設、但目前沒有資訊」的訊號：
 * 存活假設對該訊號的預期不一致，代表補齊這項資料就可能再排除掉一些假設。
 */
function distinguishingNextSteps(candidates: Hypothesis[], signals: Signal[]): string[] {
  const steps = new Set<string>();
  for (const signal of signals) {
    if (isInformative(signal)) continue;
    const expectations = candidates.map((h) => (h.expects[signal.key] ?? ['up', 'flat', 'down']).slice().sort().join(','));
    if (new Set(expectations).size > 1) steps.add(NEXT_STEP_ADVICE[signal.key]);
  }
  return Array.from(steps);
}

/** 只剩一個假設時：補齊該假設有預期、但目前沒資訊的訊號，可以提高信心等級 */
function corroboratingNextSteps(hypothesis: Hypothesis, signals: Signal[]): string[] {
  const steps = new Set<string>();
  for (const signal of signals) {
    if (isInformative(signal) || !hypothesis.expects[signal.key]) continue;
    steps.add(NEXT_STEP_ADVICE[signal.key]);
  }
  return Array.from(steps);
}

function rateConfidence(weight: Signal, evaluation: HypothesisEvaluation): Confidence {
  const corroborating = evaluation.supportedBy.filter((k) => k !== 'weight');
  const hasInBody = corroborating.includes('muscle') || corroborating.includes('fat');
  const hasTraining = corroborating.includes('volume') || corroborating.includes('strength');

  if (weight.evidence === 'strong' && hasTraining && hasInBody) return 'high';
  if (weight.evidence === 'strong' && corroborating.length >= 1) return 'medium';
  return 'low';
}

export function interpret(input: InterpretationInput): Interpretation {
  const weight = weightSignal(input.weightLogs);
  const { muscle, fat } = inBodySignals(input.inBodyRecords);
  const signals: Signal[] = [
    weight,
    volumeSignal(input.sessions, input.endDate, input.windowDays),
    strengthSignal(input.sessions),
    energySignal(input.dietSummaries, input.tdee, input.windowDays),
    muscle,
    fat,
  ];

  const evaluations = evaluateHypotheses(signals);
  const survivors = evaluations.filter((e) => !e.eliminated);
  const base = { signals, weightTrend: weight.trend, evaluations };

  // 體重是高頻基礎訊號：資料不足時直接拒答，不用其他訊號硬湊結論
  if (!weight.sufficient) {
    return {
      ...base,
      verdict: { state: 'refused', reason: 'insufficient', headline: '資料還不夠，先不下結論' },
      nextSteps: [NEXT_STEP_ADVICE.weight],
    };
  }

  if (survivors.length === 0) {
    return {
      ...base,
      verdict: { state: 'refused', reason: 'contradiction', headline: '訊號互相矛盾，暫不判讀' },
      nextSteps: ['再觀察 2–4 週；也請確認量體重的時間與條件是否一致'],
    };
  }

  if (survivors.length === 1) {
    const [only] = survivors;
    const confidence = rateConfidence(weight, only);
    return {
      ...base,
      verdict: { state: 'conclusion', hypothesis: only.hypothesis, confidence, headline: `目前的訊號與「${only.hypothesis.name}」最一致` },
      nextSteps: confidence === 'high' ? [] : corroboratingNextSteps(only.hypothesis, signals),
    };
  }

  const candidates = survivors.map((e) => e.hypothesis);
  return {
    ...base,
    verdict: {
      state: 'ambiguous',
      candidates,
      headline: `目前無法區分 ${candidates.length} 種可能`,
    },
    nextSteps: distinguishingNextSteps(candidates, signals),
  };
}
