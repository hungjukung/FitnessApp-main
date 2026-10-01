/**
 * 嗆教練模組 — 對外公開的 API
 * 其他模組只能 import 這個檔案匯出的東西
 *
 * 目前只有台詞庫挑句子；嗆度設定與 LLM 改寫之後再接上。
 */

import {
  CoachLevel,
  DEFAULT_COACH_LEVEL,
  WORKOUT_FEEDBACK_LINES,
  WorkoutFeedbackEvent,
} from './coachLines';

export type { CoachLevel, WorkoutFeedbackEvent } from './coachLines';
export { COACH_LEVEL_LABELS, DEFAULT_COACH_LEVEL } from './coachLines';

export interface CoachLineVars {
  exercise?: string;
  delta?: string;
}

export function fillTemplate(template: string, vars: CoachLineVars): string {
  return template
    .replace(/\{exercise\}/g, vars.exercise ?? '這個動作')
    .replace(/\{delta\}/g, vars.delta ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** 依事件與嗆度挑一句台詞；random 可注入，方便測試 */
export function pickWorkoutFeedbackLine(
  event: WorkoutFeedbackEvent,
  vars: CoachLineVars,
  level: CoachLevel = DEFAULT_COACH_LEVEL,
  random: () => number = Math.random
): string {
  const lines = WORKOUT_FEEDBACK_LINES[event][level];
  const template = lines[Math.floor(random() * lines.length) % lines.length];
  return fillTemplate(template, vars);
}
