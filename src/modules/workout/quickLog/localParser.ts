/**
 * 離線解析：AI 連不上時的備援（demo 現場網路不穩也能用）
 *
 * 支援的說法：
 * - 「臥推 60 公斤 5x5」「深蹲 100kg 5組5下」「硬舉 140 3組 每組 5 下」「臥推 60x8」
 * - 「臥推 60 10/8/6」（每組次數不同）、「5x5@60」
 * - 「最後一組只做 3 下」
 * - 「跟上次一樣，但深蹲加 5 公斤」「深蹲加 5 公斤」（沿用最近一次深蹲）
 * - 「跑步機 20 分鐘」
 * - 中文數字：「五組五下」「兩組十二下」
 *
 * 更複雜的句子交給 AI；這裡寧可看不懂，也不要亂猜。
 */

import { DraftEntry, DraftSet, HistoryEntry, QuickLogContext, QUICK_LOG_LIMITS } from './types';
import { ALIAS_INDEX, exerciseName, isCardio } from './exerciseAliases';
import { sanitizeDraft } from './validateDraft';

// ─────────────────────────────────────────────
// 文字正規化
// ─────────────────────────────────────────────

const CN_DIGIT: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** 「五」→5、「十二」→12、「二十五」→25、「一百二十」→120；無法轉換回傳 null */
export function chineseToNumber(text: string): number | null {
  if (!/^[零〇一二兩三四五六七八九十百]+$/.test(text)) return null;
  let total = 0;
  let current = 0;
  for (const ch of text) {
    if (ch === '百') {
      total += (current || 1) * 100;
      current = 0;
    } else if (ch === '十') {
      total += (current || 1) * 10;
      current = 0;
    } else {
      current = current * 10 + CN_DIGIT[ch];
    }
  }
  return total + current;
}

const UNIT_LOOKAHEAD = '(?=\\s*(?:組|下|次|公斤|kg|分|磅|個))';

export function normalizeText(text: string): string {
  let t = text.normalize('NFKC'); // 全形數字、全形英文 → 半形
  t = t.replace(/[×✕✖＊*]/g, 'x').replace(/(\d)\s*X\s*(\d)/g, '$1x$2');
  t = t.replace(/公斤|kgs?/gi, 'kg');
  t = t.replace(new RegExp(`[零〇一二兩三四五六七八九十百]+${UNIT_LOOKAHEAD}`, 'g'), (m) => {
    const n = chineseToNumber(m);
    return n === null ? m : String(n);
  });
  return t;
}

// ─────────────────────────────────────────────
// 動作比對
// ─────────────────────────────────────────────

interface Match {
  start: number;
  end: number;
  exerciseId: string;
  text: string;
}

/** 由左到右掃描，每個位置優先比對最長的別名，比對到就跳過該別名 */
export function findExerciseMatches(text: string): Match[] {
  const lower = text.toLowerCase();
  const matches: Match[] = [];
  let i = 0;
  while (i < text.length) {
    const hit = ALIAS_INDEX.find(({ alias }) => lower.startsWith(alias.toLowerCase(), i));
    if (hit) {
      const end = i + hit.alias.length;
      matches.push({ start: i, end, exerciseId: hit.exerciseId, text: text.slice(i, end) });
      i = end;
    } else {
      i += 1;
    }
  }
  return matches;
}

// ─────────────────────────────────────────────
// 單一動作片段解析（動作名稱後面、下一個動作名稱前面的文字）
// ─────────────────────────────────────────────

type SegmentResult =
  | { kind: 'sets'; sets: DraftSet[] }
  | { kind: 'modify'; deltaKg: number }
  | { kind: 'empty' };

const NUM = '(\\d+(?:\\.\\d+)?)';
const REPS_UNIT = '(?:下|次|reps?)';

export function parseSegment(segment: string, cardio: boolean): SegmentResult {
  let s = ` ${segment} `;

  // 1. 相對修改：「加 5 公斤」「減 2.5kg」
  const modify = s.match(
    new RegExp(`^[\\s,，、:：]*(?:但是?|不過)?\\s*(?:再|也)?\\s*(加|增加|多|減|減少|少|降)\\s*${NUM}\\s*(?:kg)?`)
  );
  if (modify && !/組|下|次|x/.test(s.slice(modify[0].length))) {
    const sign = ['加', '增加', '多'].includes(modify[1]) ? 1 : -1;
    return { kind: 'modify', deltaKg: sign * Number(modify[2]) };
  }

  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = s.match(re);
    if (m) s = s.replace(m[0], ' ');
    return m;
  };

  let weightKg: number | undefined;
  let setCount: number | undefined;
  let reps: number | undefined;
  let repsList: number[] | undefined;
  let durationMin: number | undefined;

  // 2. 最後一組的例外：「最後一組只做 3 下」
  const lastSetMatch = take(new RegExp(`最後(?:一|1)組\\s*(?:只(?:做|有)?|做了|剩)?\\s*(\\d+)\\s*${REPS_UNIT}`));
  const lastSetReps = lastSetMatch ? Number(lastSetMatch[1]) : undefined;

  // 3. 時間（有氧）
  const hours = take(new RegExp(`${NUM}\\s*(?:小時|hr)`));
  const minutes = take(new RegExp(`${NUM}\\s*(?:分鐘|分|min)`));
  if (hours || minutes) {
    durationMin = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
  }

  // 4. 重量：「@60」「60kg」「135 磅」
  const at = take(new RegExp(`@\\s*${NUM}`));
  if (at) weightKg = Number(at[1]);
  // 「60kg x 8」= 60 公斤 8 下；「60kg x 8 x 3」= 60 公斤 8 下 3 組
  const kgTimes = take(new RegExp(`${NUM}\\s*kg\\s*x\\s*(\\d+)(?:\\s*x\\s*(\\d+))?`, 'i'));
  if (kgTimes) {
    if (weightKg === undefined) weightKg = Number(kgTimes[1]);
    reps = Number(kgTimes[2]);
    if (kgTimes[3]) setCount = Number(kgTimes[3]);
  }
  const kg = take(new RegExp(`${NUM}\\s*kg`, 'i'));
  if (kg && weightKg === undefined) weightKg = Number(kg[1]);
  const lb = take(new RegExp(`${NUM}\\s*(?:磅|lbs?)`, 'i'));
  if (lb && weightKg === undefined) weightKg = Math.round(Number(lb[1]) * 0.4536 * 2) / 2;

  // 5. 組數 × 次數
  const triple = kgTimes ? null : take(new RegExp(`${NUM}\\s*x\\s*(\\d+)\\s*x\\s*(\\d+)`));
  const double = kgTimes || triple ? null : take(new RegExp(`${NUM}\\s*x\\s*(\\d+)`));
  if (triple) {
    // 60x5x5 → 重量 60、5 組、每組 5 下
    if (weightKg === undefined) weightKg = Number(triple[1]);
    setCount = Number(triple[2]);
    reps = Number(triple[3]);
  } else if (double) {
    const a = Number(double[1]);
    const b = Number(double[2]);
    if (weightKg === undefined && a > 10) {
      // 60x8 → 60 公斤做 8 下（組數不可能超過 10 還用這種寫法）
      weightKg = a;
      reps = b;
    } else {
      setCount = a;
      reps = b;
    }
  }

  if (setCount === undefined && reps === undefined) {
    const setsThenReps = take(new RegExp(`(\\d+)\\s*組\\s*(?:每組)?\\s*(\\d+)\\s*${REPS_UNIT}`));
    const repsThenSets = setsThenReps ? null : take(new RegExp(`(\\d+)\\s*${REPS_UNIT}\\s*(\\d+)\\s*組`));
    if (setsThenReps) {
      setCount = Number(setsThenReps[1]);
      reps = Number(setsThenReps[2]);
    } else if (repsThenSets) {
      reps = Number(repsThenSets[1]);
      setCount = Number(repsThenSets[2]);
    }
  }
  if (setCount === undefined) {
    const setsOnly = take(/(\d+)\s*組/);
    if (setsOnly) setCount = Number(setsOnly[1]);
  }

  // 6. 每組次數不同：「10/8/6」「10、8、6 下」
  if (reps === undefined) {
    const list = take(new RegExp(`(\\d+(?:\\s*[/、]\\s*\\d+)+)\\s*${REPS_UNIT}?`));
    if (list) repsList = list[1].split(/[/、]/).map((n) => Number(n.trim()));
  }

  // 7. 只有次數：「8 下」
  if (reps === undefined && repsList === undefined) {
    const repsOnly = take(new RegExp(`(\\d+)\\s*${REPS_UNIT}`));
    if (repsOnly) reps = Number(repsOnly[1]);
  }

  // 8. 剩下沒有單位的數字，視為重量（「臥推 60 5x5」的 60）
  if (weightKg === undefined && !cardio) {
    const bare = s.match(new RegExp(`(?:^|[^\\d.])${NUM}(?![\\d.])`));
    if (bare) weightKg = Number(bare[1]);
  }

  // 組數不合理（0 組或超過上限）就不猜
  if (setCount !== undefined && (setCount < 1 || setCount > QUICK_LOG_LIMITS.maxSetsPerEntry)) return { kind: 'empty' };
  if (repsList && repsList.length > QUICK_LOG_LIMITS.maxSetsPerEntry) return { kind: 'empty' };

  // 組裝
  let sets: DraftSet[];
  if (repsList) {
    sets = repsList.map((r) => ({ weightKg, reps: r }));
  } else if (durationMin !== undefined && cardio) {
    sets = Array.from({ length: setCount ?? 1 }, () => ({ durationMin }));
  } else {
    const count = setCount ?? (reps !== undefined || weightKg !== undefined || durationMin !== undefined ? 1 : 0);
    sets = Array.from({ length: count }, () => ({ weightKg, reps, durationMin }));
  }

  if (lastSetReps !== undefined && sets.length > 0) {
    sets[sets.length - 1] = { ...sets[sets.length - 1], reps: lastSetReps };
  }

  return sets.length > 0 ? { kind: 'sets', sets } : { kind: 'empty' };
}

// ─────────────────────────────────────────────
// 整句解析
// ─────────────────────────────────────────────

const COPY_LAST_RE = /(?:跟|和|同|照)?\s*上次\s*(?:的)?\s*(?:一樣|相同|照舊)|照上次|同上次/;
const FILLER_RE = /[\s,，、。.;；:：!！?？~～]|但是?|不過|然後|還有|接著|另外|今天|練了?|做了?|有|和|跟|以及/g;

const cloneEntry = (e: HistoryEntry): DraftEntry => ({
  exerciseId: e.exerciseId,
  exerciseName: exerciseName(e.exerciseId),
  sets: e.sets.map((s) => ({ ...s })),
});

const applyDelta = (sets: DraftSet[], deltaKg: number): DraftSet[] =>
  sets.map((s) =>
    s.weightKg !== undefined ? { ...s, weightKg: Math.max(0, Math.round((s.weightKg + deltaKg) * 10) / 10) } : s
  );

/** 去掉連接詞與標點後還有內容，才算「看不懂的片段」 */
const hasMeaningfulContent = (text: string): boolean => text.replace(FILLER_RE, '').length > 0;

export function parseLocally(input: string, ctx: QuickLogContext): { entries: DraftEntry[]; unrecognized: string[] } {
  let text = normalizeText(input);
  const unrecognized: string[] = [];
  const entries: DraftEntry[] = [];
  const findEntry = (id: string) => entries.find((e) => e.exerciseId === id);

  /** 從「跟上次一樣」複製來、還沒被使用者明確覆蓋的動作 */
  const copiedIds = new Set<string>();
  /** 「臥推跟上次一樣」：只複製指定動作 */
  const perExerciseCopy = new Set<string>();

  const copyMatch = text.match(COPY_LAST_RE);
  if (copyMatch && copyMatch.index !== undefined) {
    const before = text.slice(0, copyMatch.index).replace(/\s+$/, '');
    const aliasBefore = findExerciseMatches(before).find((m) => m.end === before.length);
    text = `${text.slice(0, copyMatch.index)} ${text.slice(copyMatch.index + copyMatch[0].length)}`;

    if (aliasBefore) {
      perExerciseCopy.add(aliasBefore.exerciseId);
    } else if (ctx.lastSession && ctx.lastSession.entries.length > 0) {
      for (const e of ctx.lastSession.entries) {
        entries.push(cloneEntry(e));
        copiedIds.add(e.exerciseId);
      }
    } else {
      unrecognized.push(`${copyMatch[0].trim()}（找不到上次的紀錄）`);
    }
  }

  const matches = findExerciseMatches(text);

  const prefix = text.slice(0, matches[0]?.start ?? text.length);
  if (matches.length > 0 && hasMeaningfulContent(prefix) && /\d/.test(prefix)) unrecognized.push(prefix.trim());

  matches.forEach((match, idx) => {
    const segment = text.slice(match.end, matches[idx + 1]?.start ?? text.length);
    const result = parseSegment(segment, isCardio(match.exerciseId));
    const original = `${match.text}${segment}`.trim().replace(/[,，、。;；]+$/, '');
    const history = ctx.lastByExercise[match.exerciseId];
    const existing = findEntry(match.exerciseId);

    if (result.kind === 'modify') {
      if (existing) {
        existing.sets = applyDelta(existing.sets, result.deltaKg);
      } else if (history) {
        entries.push({ ...cloneEntry(history), sets: applyDelta(history.sets, result.deltaKg) });
      } else {
        unrecognized.push(`${original}（找不到上次的${match.text}紀錄）`);
      }
      return;
    }

    if (result.kind === 'empty') {
      const wantsCopy = perExerciseCopy.has(match.exerciseId) || /^\s*(?:的)?\s*(?:一樣|相同|照舊)/.test(segment);
      if (wantsCopy && !existing) {
        if (history) entries.push(cloneEntry(history));
        else unrecognized.push(`${original}（找不到上次的${match.text}紀錄）`);
      } else if (!copiedIds.has(match.exerciseId)) {
        // 只講動作名稱沒講數字：看不懂，不猜
        unrecognized.push(original);
      }
      return;
    }

    if (existing && copiedIds.has(match.exerciseId)) {
      // 複製模式下明確講了組數 → 取代上次的內容
      existing.sets = result.sets;
      copiedIds.delete(match.exerciseId);
    } else if (existing) {
      existing.sets.push(...result.sets);
    } else {
      entries.push({ exerciseId: match.exerciseId, exerciseName: exerciseName(match.exerciseId), sets: result.sets });
    }
  });

  if (matches.length === 0 && !copyMatch && hasMeaningfulContent(text)) {
    unrecognized.push(text.trim());
  }

  return sanitizeDraft({ entries, unrecognized });
}
