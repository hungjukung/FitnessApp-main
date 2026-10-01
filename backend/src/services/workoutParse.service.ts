/**
 * 課表一句話記錄 — 後端解析
 *
 * 流程：使用者的一句話 → Gemini（structured output）→ 伺服器端驗證 → 草稿
 * - LLM 只負責「把話轉成結構化資料」，不給建議、不評論
 * - exerciseId 用 enum 限制在 App 傳來的動作清單內，對不到的片段放進 unrecognized
 * - 回傳的只是草稿，使用者在 App 裡確認後才會寫入資料庫
 */

import { SchemaType, ResponseSchema } from '@google/generative-ai';
import { getClient, GEMINI_MODEL } from './gemini.service';

// ─────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────

export interface CatalogItem {
  id: string;
  name: string;
  aliases?: string[];
}

export interface ParsedSet {
  weightKg?: number;
  reps?: number;
  durationMin?: number;
}

export interface ParsedEntry {
  exerciseId: string;
  sets: ParsedSet[];
}

export interface HistoryEntry {
  exerciseId: string;
  date?: string;
  sets: ParsedSet[];
}

export interface ParseWorkoutInput {
  text: string;
  catalog: CatalogItem[];
  lastSession?: { date: string; entries: HistoryEntry[] } | null;
  lastByExercise?: HistoryEntry[];
}

export interface ParseWorkoutResult {
  entries: ParsedEntry[];
  unrecognized: string[];
  modelId: string;
}

// ─────────────────────────────────────────────
// 限制（前端 validateDraft.ts 使用同一組數字）
// ─────────────────────────────────────────────

export const PARSE_LIMITS = {
  maxTextLength: 300,
  maxCatalogItems: 200,
  maxHistoryEntries: 30,
  maxEntries: 20,
  maxSetsPerEntry: 20,
  repsMax: 100,
  weightMaxKg: 500,
  durationMaxMin: 600,
  maxUnrecognized: 10,
  maxUnrecognizedLength: 50,
} as const;

// ─────────────────────────────────────────────
// 請求驗證
// ─────────────────────────────────────────────

const isNonEmptyString = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;

function readHistorySets(raw: unknown): ParsedSet[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, PARSE_LIMITS.maxSetsPerEntry).map((s) => sanitizeSet(s)).filter(hasAnyValue);
}

function readHistoryEntries(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, PARSE_LIMITS.maxHistoryEntries)
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .filter((e) => isNonEmptyString(e.exerciseId, 64))
    .map((e) => ({
      exerciseId: String(e.exerciseId),
      date: typeof e.date === 'string' ? e.date.slice(0, 10) : undefined,
      sets: readHistorySets(e.sets),
    }));
}

/** 驗證 App 傳來的 body；錯誤時回傳給使用者看的訊息 */
export function validateParseWorkoutBody(
  body: unknown
): { ok: true; input: ParseWorkoutInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: '請求格式錯誤' };
  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.text, PARSE_LIMITS.maxTextLength)) {
    return { ok: false, error: `text 為必要欄位，長度需在 ${PARSE_LIMITS.maxTextLength} 字以內` };
  }
  if (!Array.isArray(b.catalog) || b.catalog.length === 0 || b.catalog.length > PARSE_LIMITS.maxCatalogItems) {
    return { ok: false, error: 'catalog 為必要欄位' };
  }

  const catalog: CatalogItem[] = b.catalog
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .filter((c) => isNonEmptyString(c.id, 64) && isNonEmptyString(c.name, 32))
    .map((c) => ({
      id: String(c.id),
      name: String(c.name),
      aliases: Array.isArray(c.aliases)
        ? c.aliases.filter((a): a is string => isNonEmptyString(a, 20)).slice(0, 10)
        : [],
    }));
  if (catalog.length === 0) return { ok: false, error: 'catalog 內容無效' };

  let lastSession: ParseWorkoutInput['lastSession'] = null;
  if (b.lastSession && typeof b.lastSession === 'object') {
    const ls = b.lastSession as Record<string, unknown>;
    if (typeof ls.date === 'string') {
      lastSession = { date: ls.date.slice(0, 10), entries: readHistoryEntries(ls.entries) };
    }
  }

  return {
    ok: true,
    input: {
      text: b.text.trim(),
      catalog,
      lastSession,
      lastByExercise: readHistoryEntries(b.lastByExercise),
    },
  };
}

// ─────────────────────────────────────────────
// 回應驗證：LLM 的輸出一律當作不可信資料
// ─────────────────────────────────────────────

function toFiniteNumber(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

function sanitizeSet(raw: unknown): ParsedSet {
  if (!raw || typeof raw !== 'object') return {};
  const s = raw as Record<string, unknown>;
  const out: ParsedSet = {};

  const weight = toFiniteNumber(s.weightKg);
  if (weight !== undefined && weight > 0 && weight <= PARSE_LIMITS.weightMaxKg) {
    out.weightKg = Math.round(weight * 10) / 10;
  }
  const reps = toFiniteNumber(s.reps);
  if (reps !== undefined && Number.isInteger(reps) && reps >= 1 && reps <= PARSE_LIMITS.repsMax) {
    out.reps = reps;
  }
  const duration = toFiniteNumber(s.durationMin);
  if (duration !== undefined && duration > 0 && duration <= PARSE_LIMITS.durationMaxMin) {
    out.durationMin = Math.round(duration * 10) / 10;
  }
  return out;
}

const hasAnyValue = (s: ParsedSet): boolean =>
  s.weightKg !== undefined || s.reps !== undefined || s.durationMin !== undefined;

export function sanitizeParseResult(
  raw: unknown,
  catalogIds: Set<string>
): Omit<ParseWorkoutResult, 'modelId'> {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const entries: ParsedEntry[] = [];

  if (Array.isArray(obj.entries)) {
    for (const e of obj.entries.slice(0, PARSE_LIMITS.maxEntries)) {
      if (!e || typeof e !== 'object') continue;
      const entry = e as Record<string, unknown>;
      if (typeof entry.exerciseId !== 'string' || !catalogIds.has(entry.exerciseId)) continue;
      const sets = Array.isArray(entry.sets)
        ? entry.sets.slice(0, PARSE_LIMITS.maxSetsPerEntry).map(sanitizeSet).filter(hasAnyValue)
        : [];
      if (sets.length === 0) continue;
      entries.push({ exerciseId: entry.exerciseId, sets });
    }
  }

  const unrecognized = Array.isArray(obj.unrecognized)
    ? obj.unrecognized
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .map((u) => u.trim().slice(0, PARSE_LIMITS.maxUnrecognizedLength))
        .slice(0, PARSE_LIMITS.maxUnrecognized)
    : [];

  return { entries, unrecognized };
}

// ─────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────

function formatSet(s: ParsedSet): string {
  if (s.durationMin !== undefined) return `${s.durationMin}分鐘`;
  const w = s.weightKg !== undefined ? `${s.weightKg}kg` : '徒手';
  return s.reps !== undefined ? `${w}×${s.reps}` : w;
}

function formatHistoryEntry(e: HistoryEntry, nameById: Map<string, string>): string {
  const name = nameById.get(e.exerciseId) ?? e.exerciseId;
  const date = e.date ? `（${e.date}）` : '';
  return `- ${name}［${e.exerciseId}］${date}：${e.sets.map(formatSet).join('、') || '無組數'}`;
}

export function buildParsePrompt(input: ParseWorkoutInput): string {
  const nameById = new Map(input.catalog.map((c) => [c.id, c.name]));

  const catalogText = input.catalog
    .map((c) => `- ${c.id}：${[c.name, ...(c.aliases ?? [])].join('／')}`)
    .join('\n');

  const lastSessionText =
    input.lastSession && input.lastSession.entries.length > 0
      ? `上次訓練（${input.lastSession.date}）：\n${input.lastSession.entries
          .map((e) => formatHistoryEntry(e, nameById))
          .join('\n')}`
      : '上次訓練：沒有紀錄';

  const lastByExerciseText =
    input.lastByExercise && input.lastByExercise.length > 0
      ? `各動作最近一次紀錄：\n${input.lastByExercise.map((e) => formatHistoryEntry(e, nameById)).join('\n')}`
      : '各動作最近一次紀錄：沒有紀錄';

  return `你是健身紀錄解析器。把使用者的一句話轉成結構化的訓練紀錄。只做轉換，不給建議、不評論。

規則：
1. exerciseId 只能從「動作清單」選。對不到的片段原文放進 unrecognized，不要猜。
2. 「5x5」「5組5下」「五組五下」代表 5 組、每組 5 下；每一組都要各自列出。
3. 動作後面緊接的數字若沒有單位，通常是重量（公斤）。「磅」「lb」要換算成公斤（×0.4536，四捨五入到 0.5）。
4. 「最後一組只做 3 下」只改最後一組的次數；「第 2 組 8 下」只改第 2 組。
5. 「跟上次一樣」代表複製「上次訓練」的所有動作與組數，再套用後面的修改。例如「深蹲加 5 公斤」代表深蹲每組重量都 +5。
6. 「上次深蹲」「跟上次臥推一樣」這種指定動作的說法，參考「各動作最近一次紀錄」。
7. 沒講重量就不填 weightKg，沒講次數就不填 reps，不要自己補數字。徒手動作不填 weightKg。
8. 有氧動作用 durationMin（分鐘）。

動作清單（id：名稱／別名）：
${catalogText}

${lastSessionText}

${lastByExerciseText}

使用者輸入：「${input.text}」`;
}

// ─────────────────────────────────────────────
// Gemini 呼叫
// ─────────────────────────────────────────────

function buildResponseSchema(catalogIds: string[]): ResponseSchema {
  return {
    type: SchemaType.OBJECT,
    properties: {
      entries: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            exerciseId: { type: SchemaType.STRING, format: 'enum', enum: catalogIds },
            sets: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  weightKg: { type: SchemaType.NUMBER, nullable: true },
                  reps: { type: SchemaType.INTEGER, nullable: true },
                  durationMin: { type: SchemaType.NUMBER, nullable: true },
                },
              },
            },
          },
          required: ['exerciseId', 'sets'],
        },
      },
      unrecognized: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    },
    required: ['entries', 'unrecognized'],
  };
}

/** Gemini 請求逾時（毫秒）。App 端逾時稍長，逾時後改用離線解析 */
const GEMINI_TIMEOUT_MS = 10_000;

export async function parseWorkoutText(input: ParseWorkoutInput): Promise<ParseWorkoutResult> {
  const catalogIds = input.catalog.map((c) => c.id);
  const model = getClient().getGenerativeModel(
    {
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: buildResponseSchema(catalogIds),
      },
    },
    { timeout: GEMINI_TIMEOUT_MS }
  );

  const result = await model.generateContent(buildParsePrompt(input));
  const parsed: unknown = JSON.parse(result.response.text());

  return {
    ...sanitizeParseResult(parsed, new Set(catalogIds)),
    modelId: GEMINI_MODEL,
  };
}
