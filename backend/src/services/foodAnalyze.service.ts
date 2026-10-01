/**
 * 飲食拍照辨識 — 後端分析
 *
 * 流程：食物照片 → xAI Grok（structured output）→ 伺服器端驗證 → 草稿
 * - LLM 只負責估計照片中食物的份量與營養素，不給建議、不評論
 * - 回傳的只是草稿，使用者在 App 裡確認、修改後才會寫入資料庫
 */

import { grokStructured, XAI_MODEL } from './grok.service';

// ─────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────

export interface FoodItem {
  name: string;
  portion: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FoodAnalysisResult {
  /** 照片裡是否有可辨識的食物 */
  isFood: boolean;
  /** 整份餐點的名稱（存進飲食紀錄的名稱） */
  name: string;
  items: FoodItem[];
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  modelId: string;
}

// ─────────────────────────────────────────────
// 限制（前端 foodPhoto.ts 使用同一組數字）
// ─────────────────────────────────────────────

export const FOOD_LIMITS = {
  /** base64 字串長度上限（約 3MB 圖片） */
  maxImageBase64Length: 4_000_000,
  maxItems: 10,
  maxNameLength: 40,
  maxPortionLength: 30,
  kcalMax: 5000,
  macroMaxG: 500,
} as const;

// ─────────────────────────────────────────────
// 請求驗證
// ─────────────────────────────────────────────

export function validateAnalyzeFoodBody(
  body: unknown
): { ok: true; imageBase64: string } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: '請求格式錯誤' };
  const { imageBase64 } = body as Record<string, unknown>;

  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    return { ok: false, error: 'imageBase64 為必要欄位' };
  }
  if (imageBase64.length > FOOD_LIMITS.maxImageBase64Length) {
    return { ok: false, error: '圖片太大，請重新拍攝' };
  }
  return { ok: true, imageBase64 };
}

// ─────────────────────────────────────────────
// 回應驗證：LLM 的輸出一律當作不可信資料
// ─────────────────────────────────────────────

function clampNumber(v: unknown, max: number): number {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(n, max) * 10) / 10;
}

function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function sanitizeFoodResult(raw: unknown): Omit<FoodAnalysisResult, 'modelId'> {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const items: FoodItem[] = Array.isArray(obj.items)
    ? obj.items
        .slice(0, FOOD_LIMITS.maxItems)
        .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
        .map((i) => ({
          name: cleanText(i.name, FOOD_LIMITS.maxNameLength),
          portion: cleanText(i.portion, FOOD_LIMITS.maxPortionLength),
          kcal: clampNumber(i.kcal, FOOD_LIMITS.kcalMax),
          proteinG: clampNumber(i.proteinG, FOOD_LIMITS.macroMaxG),
          carbsG: clampNumber(i.carbsG, FOOD_LIMITS.macroMaxG),
          fatG: clampNumber(i.fatG, FOOD_LIMITS.macroMaxG),
        }))
        .filter((i) => i.name !== '')
    : [];

  const isFood = obj.isFood === true && items.length > 0;
  if (!isFood) {
    return { isFood: false, name: '', items: [], kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  }

  // 總計由伺服器加總，不採用模型自己算的數字
  const sum = (key: 'kcal' | 'proteinG' | 'carbsG' | 'fatG', max: number) =>
    clampNumber(items.reduce((s, i) => s + i[key], 0), max);

  return {
    isFood: true,
    name: cleanText(obj.name, FOOD_LIMITS.maxNameLength) || items.map((i) => i.name).join('、').slice(0, FOOD_LIMITS.maxNameLength),
    items,
    kcal: Math.round(sum('kcal', FOOD_LIMITS.kcalMax)),
    proteinG: sum('proteinG', FOOD_LIMITS.macroMaxG),
    carbsG: sum('carbsG', FOOD_LIMITS.macroMaxG),
    fatG: sum('fatG', FOOD_LIMITS.macroMaxG),
  };
}

// ─────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────

const FOOD_PROMPT = `你是營養估算器。辨識照片中的食物，估計每一項的份量、熱量與三大營養素。只做估算，不給建議、不評論。

規則：
1. 照片裡沒有食物（例如風景、人像、螢幕截圖）時，isFood 設為 false，items 為空陣列。
2. 每一項食物分開列出（例如便當拆成白飯、主菜、配菜），名稱用台灣常用的繁體中文。
3. portion 寫估計份量，例如「1 碗約 200g」「1 塊約 120g」。
4. 依照片中看得到的份量估算，不要用「一般份量」。看不清楚時以台灣外食常見份量估計。
5. kcal 單位為大卡，proteinG、carbsG、fatG 單位為公克。
6. name 是整份餐點的簡短名稱（例如「雞腿便當」「牛肉麵」），15 字以內。`;

// strict 模式下所有欄位都列為 required
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    isFood: { type: 'boolean' },
    name: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          portion: { type: 'string' },
          kcal: { type: 'number' },
          proteinG: { type: 'number' },
          carbsG: { type: 'number' },
          fatG: { type: 'number' },
        },
        required: ['name', 'portion', 'kcal', 'proteinG', 'carbsG', 'fatG'],
        additionalProperties: false,
      },
    },
  },
  required: ['isFood', 'name', 'items'],
  additionalProperties: false,
};

// ─────────────────────────────────────────────
// Grok 呼叫
// ─────────────────────────────────────────────

/** 圖片分析比文字慢，逾時放寬到 20 秒 */
const XAI_TIMEOUT_MS = 20_000;

export async function analyzeFoodPhoto(imageBase64: string): Promise<FoodAnalysisResult> {
  const parsed = await grokStructured({
    content: [
      { type: 'input_image', image_url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' },
      { type: 'input_text', text: FOOD_PROMPT },
    ],
    schemaName: 'food_analysis',
    schema: RESPONSE_SCHEMA,
    timeoutMs: XAI_TIMEOUT_MS,
  });

  return { ...sanitizeFoodResult(parsed), modelId: XAI_MODEL };
}
