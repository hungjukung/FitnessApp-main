/**
 * 假設判別（不是加權評分）
 *
 * 列出候選假設，每個假設寫明「如果它成立，各訊號應該呈現什麼方向」。
 * 再拿實際訊號逐一比對：只要有一個訊號與預期完全不相容，該假設就被排除，並記錄理由。
 *
 * 好處：每個結論都能回溯到「因為訓練量沒下降，所以排除 H2」，口試被追問時答得出來。
 * 沒寫在 expects 裡的訊號代表「這個假設對該訊號沒有預期」，不會用來排除。
 */

import { Direction, DIRECTION_LABELS, Signal, SignalKey } from './signals';

export type HypothesisId = 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';

export interface Hypothesis {
  id: HypothesisId;
  name: string;
  expects: Partial<Record<SignalKey, Direction[]>>;
}

export const HYPOTHESES: Hypothesis[] = [
  {
    id: 'H1',
    name: '有效增肌',
    expects: {
      weight: ['up', 'flat'],
      volume: ['up', 'flat'],
      strength: ['up', 'flat'],
      energy: ['up', 'flat'],
      muscle: ['up'],
      // 體脂肪重明顯下降 + 骨骼肌重上升屬於 H3，這裡只收「體脂肪未明顯變化」，兩者才區分得開
      fat: ['flat'],
    },
  },
  {
    id: 'H2',
    name: '增脂為主',
    expects: {
      weight: ['up'],
      volume: ['flat', 'down'],
      strength: ['flat', 'down'],
      energy: ['up'],
      muscle: ['flat'],
      fat: ['up'],
    },
  },
  {
    id: 'H3',
    name: '增肌減脂同時發生（Recomposition）',
    expects: {
      weight: ['flat'],
      volume: ['up'],
      energy: ['flat', 'down'],
      muscle: ['up'],
      fat: ['down'],
    },
  },
  {
    id: 'H4',
    name: '有效減脂',
    expects: {
      weight: ['down'],
      strength: ['up', 'flat'],
      energy: ['down'],
      muscle: ['up', 'flat'],
      fat: ['down'],
    },
  },
  {
    id: 'H5',
    name: '肌肉流失',
    expects: {
      weight: ['down'],
      strength: ['down'],
      energy: ['down'],
      muscle: ['down'],
    },
  },
  {
    id: 'H6',
    name: '無顯著變化',
    expects: {
      weight: ['flat'],
      volume: ['flat'],
      strength: ['flat'],
      muscle: ['flat'],
      fat: ['flat'],
    },
  },
];

export interface HypothesisEvaluation {
  hypothesis: Hypothesis;
  eliminated: boolean;
  /** 被排除的理由（每個不相容的訊號一條） */
  reasons: string[];
  /** 與此假設相容、且確實帶有方向資訊的訊號 */
  supportedBy: SignalKey[];
}

const describeExpected = (key: SignalKey, dirs: Direction[]) =>
  dirs.map((d) => DIRECTION_LABELS[key][d]).join('或');

export function evaluateHypotheses(signals: Signal[]): HypothesisEvaluation[] {
  return HYPOTHESES.map((hypothesis) => {
    const reasons: string[] = [];
    const supportedBy: SignalKey[] = [];

    for (const signal of signals) {
      const expected = hypothesis.expects[signal.key];
      if (!expected) continue;

      const overlaps = signal.compatible.some((d) => expected.includes(d));
      if (!overlaps) {
        reasons.push(`${signal.stateLabel}，但「${hypothesis.name}」預期${signal.label}${describeExpected(signal.key, expected)}`);
      } else if (signal.compatible.length < 3) {
        supportedBy.push(signal.key);
      }
    }

    return { hypothesis, eliminated: reasons.length > 0, reasons, supportedBy };
  });
}
