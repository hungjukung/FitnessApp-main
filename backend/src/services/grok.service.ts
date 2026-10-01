/**
 * xAI Grok — Responses API 呼叫
 *
 * 文件：https://docs.x.ai/docs/guides/image-understanding
 *       https://docs.x.ai/docs/guides/structured-outputs
 * - 用 structured output（json_schema）強制回傳固定格式的 JSON
 * - store: false，不讓 xAI 保存使用者上傳的內容
 */

const XAI_ENDPOINT = 'https://api.x.ai/v1/responses';

/** grok-4.3：支援圖片輸入與 structured output，推理可關閉，價格約 grok-4.7 的一半 */
export const XAI_MODEL = process.env.XAI_MODEL || 'grok-4.3';

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export type GrokContentPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail?: 'low' | 'high' | 'auto' };

export interface GrokStructuredRequest {
  content: GrokContentPart[];
  schemaName: string;
  schema: Record<string, unknown>;
  timeoutMs: number;
  reasoningEffort?: ReasoningEffort;
}

function getApiKey(): string {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey || apiKey === 'your_xai_api_key_here') {
    throw new Error('XAI_API_KEY 未設定');
  }
  return apiKey;
}

/** 從 Responses API 的回應取出模型輸出的文字 */
function extractOutputText(data: unknown): string {
  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) throw new Error('xAI 回應缺少 output');

  for (const item of output) {
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const p = part as { type?: unknown; text?: unknown };
      if (p.type === 'output_text' && typeof p.text === 'string') return p.text;
    }
  }
  throw new Error('xAI 回應缺少 output_text');
}

/** 呼叫 Grok 並回傳解析後的 JSON；呼叫端仍需自行驗證內容 */
export async function grokStructured(req: GrokStructuredRequest): Promise<unknown> {
  const res = await fetch(XAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      input: [{ role: 'user', content: req.content }],
      text: {
        format: { type: 'json_schema', name: req.schemaName, schema: req.schema, strict: true },
      },
      reasoning: { effort: req.reasoningEffort ?? 'none' },
      store: false,
    }),
    signal: AbortSignal.timeout(req.timeoutMs),
  });

  if (!res.ok) {
    // 錯誤內容只記在伺服器 log，不回傳給 App
    const detail = await res.text().catch(() => '');
    throw new Error(`xAI ${res.status}: ${detail.slice(0, 300)}`);
  }

  return JSON.parse(extractOutputText(await res.json()));
}
