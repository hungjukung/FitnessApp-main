/**
 * 一句話記錄的解析入口
 *
 * 1. 先送後端讓 Gemini 解析（看得到的 AI 功能）
 * 2. 逾時、沒登入、後端錯誤、或 AI 沒解析出任何動作 → 改用離線解析
 * 3. 不論哪條路，結果都先經過 sanitizeDraft 再交給畫面，由使用者確認後才存檔
 */

import { authFetch } from '../../../services/api/client';
import { QuickLogContext, QuickLogDraft, QUICK_LOG_LIMITS } from './types';
import { buildCatalogPayload } from './exerciseAliases';
import { historyPayload } from './history';
import { parseLocally } from './localParser';
import { sanitizeDraft } from './validateDraft';

/** 比後端 Gemini 逾時（10 秒）稍長，讓後端有機會先回錯誤 */
export const AI_PARSE_TIMEOUT_MS = 12_000;

async function requestAiParse(text: string, ctx: QuickLogContext): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_PARSE_TIMEOUT_MS);
  try {
    return await authFetch<unknown>('/ai/parse-workout', {
      method: 'POST',
      body: JSON.stringify({ text, catalog: buildCatalogPayload(), ...historyPayload(ctx) }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function parseQuickLog(input: string, ctx: QuickLogContext): Promise<QuickLogDraft> {
  const text = input.trim().slice(0, QUICK_LOG_LIMITS.maxTextLength);
  if (!text) return { entries: [], unrecognized: [], source: 'local' };

  try {
    const ai = sanitizeDraft(await requestAiParse(text, ctx));
    if (ai.entries.length > 0) return { ...ai, source: 'ai' };
  } catch {
    // 走離線解析
  }

  return { ...parseLocally(text, ctx), source: 'local' };
}
