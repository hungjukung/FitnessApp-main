/**
 * 一句話記錄的單元測試（純函式，不需要手機或網路）
 *
 * 執行：npx tsx --test src/modules/workout/quickLog/quickLog.test.ts
 */

/// <reference types="node" />
// TypeScript 6 起不再自動載入 @types/*，Node 內建模組的型別要明確引用

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkoutSession } from '../../../types';
import { chineseToNumber, normalizeText, parseLocally } from './localParser';
import { sanitizeDraft } from './validateDraft';
import { buildQuickLogContext } from './history';
import { evaluateProgress } from './progress';
import { QuickLogContext } from './types';
import { pickWorkoutFeedbackLine } from '../../coach';

const EMPTY_CTX: QuickLogContext = { lastSession: null, lastByExercise: {} };

function session(date: string, sets: Array<[string, string, number | undefined, number | undefined]>): WorkoutSession {
  const counts: Record<string, number> = {};
  return {
    id: `s-${date}`,
    date,
    startedAt: Date.parse(`${date}T10:00:00`),
    createdAt: 0,
    updatedAt: 0,
    sets: sets.map(([exerciseId, exerciseName, weight, reps], i) => {
      counts[exerciseId] = (counts[exerciseId] ?? 0) + 1;
      return {
        id: `${date}-${i}`,
        sessionId: `s-${date}`,
        exerciseId,
        exerciseName,
        setNumber: counts[exerciseId],
        weight,
        reps,
        createdAt: i,
      };
    }),
  };
}

const HISTORY = [
  session('2026-09-25', [
    ['squat', '槓鈴深蹲', 95, 5],
    ['squat', '槓鈴深蹲', 95, 5],
  ]),
  session('2026-09-28', [
    ['squat', '槓鈴深蹲', 100, 5],
    ['squat', '槓鈴深蹲', 100, 5],
    ['squat', '槓鈴深蹲', 100, 5],
    ['bench_press', '槓鈴臥推', 60, 5],
    ['bench_press', '槓鈴臥推', 60, 5],
  ]),
  session('2026-09-30', [['pull_up', '引體向上', undefined, 8]]),
];
const CTX = buildQuickLogContext(HISTORY, '2026-10-01');

// ─────────────────────────────────────────────
// 正規化
// ─────────────────────────────────────────────

test('中文數字', () => {
  assert.equal(chineseToNumber('五'), 5);
  assert.equal(chineseToNumber('十二'), 12);
  assert.equal(chineseToNumber('二十五'), 25);
  assert.equal(chineseToNumber('一百二十'), 120);
  assert.equal(chineseToNumber('abc'), null);
});

test('正規化：全形、乘號、公斤、中文數字；「一樣」不被轉換', () => {
  assert.equal(normalizeText('臥推６０公斤５×５'), '臥推60kg5x5');
  assert.equal(normalizeText('五組五下'), '5組5下');
  assert.equal(normalizeText('跟上次一樣'), '跟上次一樣');
});

// ─────────────────────────────────────────────
// 離線解析
// ─────────────────────────────────────────────

test('臥推 60 公斤 5x5，最後一組只做 3 下', () => {
  const { entries, unrecognized } = parseLocally('臥推 60 公斤 5x5，最後一組只做 3 下', EMPTY_CTX);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].exerciseId, 'bench_press');
  assert.deepEqual(
    entries[0].sets.map((s) => [s.weightKg, s.reps]),
    [[60, 5], [60, 5], [60, 5], [60, 5], [60, 3]]
  );
  assert.deepEqual(unrecognized, []);
});

test('多個動作、沒有標點、中文數字', () => {
  const { entries } = parseLocally('深蹲一百公斤五組五下硬舉140kg 3x3', EMPTY_CTX);
  assert.deepEqual(entries.map((e) => e.exerciseId), ['squat', 'deadlift']);
  assert.equal(entries[0].sets.length, 5);
  assert.deepEqual(entries[0].sets[0], { weightKg: 100, reps: 5 });
  assert.deepEqual(entries[1].sets.map((s) => [s.weightKg, s.reps]), [[140, 3], [140, 3], [140, 3]]);
});

test('沒有單位的重量、60x8、60kg x 8 x 3、每組次數不同、@', () => {
  assert.deepEqual(parseLocally('臥推 60 5x5', EMPTY_CTX).entries[0].sets[0], { weightKg: 60, reps: 5 });
  assert.deepEqual(parseLocally('臥推 60x8', EMPTY_CTX).entries[0].sets, [{ weightKg: 60, reps: 8 }]);
  assert.equal(parseLocally('臥推 60kg x 8 x 3', EMPTY_CTX).entries[0].sets.length, 3);
  assert.deepEqual(
    parseLocally('臥推 60kg 10/8/6', EMPTY_CTX).entries[0].sets.map((s) => s.reps),
    [10, 8, 6]
  );
  assert.deepEqual(parseLocally('深蹲 5x5@100', EMPTY_CTX).entries[0].sets[0], { weightKg: 100, reps: 5 });
});

test('最長別名優先：羅馬尼亞硬舉、啞鈴肩推、上斜臥推', () => {
  const { entries } = parseLocally('羅馬尼亞硬舉 80 3x10，啞鈴肩推 20 3x12，上斜臥推 50 3x8', EMPTY_CTX);
  assert.deepEqual(entries.map((e) => e.exerciseId), ['romanian_deadlift', 'dumbbell_shoulder_press', 'incline_bench']);
});

test('有氧用時間，不把數字當重量', () => {
  const { entries } = parseLocally('跑步機 20 分鐘', EMPTY_CTX);
  assert.deepEqual(entries[0].sets, [{ durationMin: 20 }]);
  const bad = parseLocally('跑步 5 公里', EMPTY_CTX);
  assert.equal(bad.entries.length, 0);
  assert.equal(bad.unrecognized.length, 1);
});

test('徒手動作只記次數', () => {
  const { entries } = parseLocally('引體向上 3組10下', EMPTY_CTX);
  assert.deepEqual(entries[0].sets, [{ reps: 10 }, { reps: 10 }, { reps: 10 }]);
});

test('跟上次一樣，但深蹲加 5 公斤', () => {
  // 「上次」= 今天以前最近一次訓練（9/30 的引體向上），深蹲則沿用 9/28 的紀錄
  const { entries, unrecognized } = parseLocally('跟上次一樣，但深蹲加 5 公斤', CTX);
  assert.deepEqual(entries.map((e) => e.exerciseId), ['pull_up', 'squat']);
  assert.deepEqual(entries[1].sets.map((s) => s.weightKg), [105, 105, 105]);
  assert.deepEqual(unrecognized, []);
});

test('跟上次一樣：上次有的動作被明確覆蓋', () => {
  const ctx = buildQuickLogContext(HISTORY.slice(0, 2), '2026-10-01');
  const { entries } = parseLocally('跟上次一樣，臥推改 65 5x5', ctx);
  const bench = entries.find((e) => e.exerciseId === 'bench_press')!;
  assert.equal(bench.sets.length, 5);
  assert.ok(bench.sets.every((s) => s.weightKg === 65));
  assert.equal(entries.find((e) => e.exerciseId === 'squat')!.sets.length, 3);
});

test('臥推跟上次一樣：只複製指定動作', () => {
  const { entries } = parseLocally('臥推跟上次一樣', CTX);
  assert.deepEqual(entries.map((e) => e.exerciseId), ['bench_press']);
  assert.equal(entries[0].sets.length, 2);
});

test('沒有上次紀錄時，不亂猜', () => {
  const { entries, unrecognized } = parseLocally('跟上次一樣，但深蹲加 5 公斤', EMPTY_CTX);
  assert.equal(entries.length, 0);
  assert.equal(unrecognized.length, 2);
});

test('看不懂的動作進 unrecognized，不會被當成深蹲', () => {
  const { entries, unrecognized } = parseLocally('保加利亞分腿蹲 20kg 3x10', EMPTY_CTX);
  assert.equal(entries.length, 0);
  assert.deepEqual(unrecognized, ['保加利亞分腿蹲 20kg 3x10']);
});

test('只講動作沒講數字 → 不猜', () => {
  const { entries, unrecognized } = parseLocally('今天練了臥推', EMPTY_CTX);
  assert.equal(entries.length, 0);
  assert.deepEqual(unrecognized, ['臥推']);
});

// ─────────────────────────────────────────────
// 草稿驗證（AI 輸出一律不可信）
// ─────────────────────────────────────────────

test('sanitizeDraft 丟掉不存在的動作與不合理的數字', () => {
  const draft = sanitizeDraft({
    entries: [
      { exerciseId: 'bench_press', sets: [{ weightKg: 60, reps: 5 }, { weightKg: 9999, reps: 5 }, { reps: 0 }] },
      { exerciseId: 'made_up_exercise', sets: [{ weightKg: 60, reps: 5 }] },
      { exerciseId: 'squat', sets: [] },
      { exerciseId: 'bench_press', sets: [{ weightKg: '62.5', reps: 3.5 }] },
    ],
    unrecognized: ['  亂七八糟  ', 42],
  });
  assert.deepEqual(draft.entries.map((e) => e.exerciseId), ['bench_press']);
  assert.deepEqual(draft.entries[0].sets, [{ weightKg: 60, reps: 5 }, { reps: 5 }, { weightKg: 62.5 }]);
  assert.deepEqual(draft.unrecognized, ['亂七八糟']);
});

test('sanitizeDraft 接受任何垃圾輸入都不會丟例外', () => {
  for (const junk of [null, undefined, 42, 'text', [], { entries: 'x' }, { entries: [null, 1, 'a'] }]) {
    assert.deepEqual(sanitizeDraft(junk), { entries: [], unrecognized: [] });
  }
});

// ─────────────────────────────────────────────
// 歷史與進步判斷
// ─────────────────────────────────────────────

test('buildQuickLogContext：排除今天，取各動作最近一次', () => {
  const withToday = [...HISTORY, session('2026-10-01', [['squat', '槓鈴深蹲', 200, 1]])];
  const ctx = buildQuickLogContext(withToday, '2026-10-01');
  assert.equal(ctx.lastSession?.date, '2026-09-30');
  assert.equal(ctx.lastByExercise.squat.date, '2026-09-28');
  assert.equal(ctx.lastByExercise.squat.sets[0].weightKg, 100);
});

test('進步：深蹲加 5 公斤 → improved，差距 +5 kg', () => {
  const { entries } = parseLocally('深蹲 105 3x5', CTX);
  const summary = evaluateProgress(entries, CTX);
  assert.equal(summary.overall, 'improved');
  assert.equal(summary.highlight?.deltaText, '+5 kg');
});

test('同重量多做一下也算進步', () => {
  const { entries } = parseLocally('臥推 60 2x6', CTX);
  const summary = evaluateProgress(entries, CTX);
  assert.equal(summary.overall, 'improved');
  assert.equal(summary.highlight?.deltaText, '+1 下');
});

test('持平、退步、第一次', () => {
  assert.equal(evaluateProgress(parseLocally('臥推 60 2x5', CTX).entries, CTX).overall, 'same');
  const down = evaluateProgress(parseLocally('深蹲 90 3x5', CTX).entries, CTX);
  assert.equal(down.overall, 'regressed');
  assert.equal(down.highlight?.deltaText, '-10 kg');
  assert.equal(evaluateProgress(parseLocally('硬舉 140 3x3', CTX).entries, CTX).overall, 'first_time');
});

test('任何一個動作進步就誇（有進步也有退步時）', () => {
  const { entries } = parseLocally('深蹲 90 3x5，臥推 65 2x5', CTX);
  const summary = evaluateProgress(entries, CTX);
  assert.equal(summary.overall, 'improved');
  assert.equal(summary.highlight?.exerciseId, 'bench_press');
});

test('徒手動作比次數', () => {
  const summary = evaluateProgress(parseLocally('引體向上 3組10下', CTX).entries, CTX);
  assert.equal(summary.overall, 'improved');
  assert.equal(summary.highlight?.deltaText, '+2 下');
});

// ─────────────────────────────────────────────
// 台詞
// ─────────────────────────────────────────────

test('台詞套入動作與差距，沒有殘留的 {變數}', () => {
  for (const event of ['improved', 'same', 'regressed', 'first_time'] as const) {
    for (const level of ['mild', 'savage', 'hell'] as const) {
      for (const r of [0, 0.5, 0.99]) {
        const line = pickWorkoutFeedbackLine(event, { exercise: '槓鈴深蹲', delta: '+5 kg' }, level, () => r);
        assert.ok(!/[{}]/.test(line), line);
        assert.ok(line.length > 0);
      }
    }
  }
});
