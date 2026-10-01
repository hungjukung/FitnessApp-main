import { GoogleGenerativeAI } from '@google/generative-ai';

export const GEMINI_MODEL = 'gemini-2.5-flash';
const DISCLAIMER = '本建議僅供健身紀錄參考，不能取代醫療診斷或治療。';

const FIELD_META = [
  { name: 'weight_kg', label: '體重', unit: 'kg' },
  { name: 'bmi', label: 'BMI', unit: '' },
  { name: 'muscle_mass_kg', label: '肌肉量', unit: 'kg' },
  { name: 'skeletal_muscle_kg', label: '骨骼肌', unit: 'kg' },
  { name: 'body_water_percent', label: '身體水分', unit: '%' },
  { name: 'body_fat_percent', label: '體脂率', unit: '%' },
];

const GOAL_TEXT: Record<string, string> = {
  fat_loss: '降低體脂肪',
  muscle_gain: '增肌',
  maintenance: '維持目前體態',
};

const EXPERIENCE_TEXT: Record<string, string> = {
  beginner: '初學',
  intermediate: '中階',
  advanced: '進階',
};

export function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY 未設定');
  }
  return new GoogleGenerativeAI(apiKey);
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw) as T;
  } catch {
    return null;
  }
}

export interface AIAnalysisInput {
  weightLogs: Array<{ date: string; weight: number | null }>;
  userProfile: {
    experienceLevel: string;
    goal: string;
    gender?: string;
    age?: number;
    heightCm?: number;
  };
  question?: string;
  recentWorkouts?: Array<{
    date: string;
    sets: Array<{ exerciseName: string; reps?: number; weight?: number }>;
  }>;
}

export interface AIAnalysisOutput {
  summary: string;
  suggestions: string[];
  trendStatus: 'on_track' | 'plateau' | 'regression';
  chatReply?: string;
  generatedAt: number;
  tier: 'gemini';
}

export interface AIExtractedField {
  name: string;
  label: string;
  value: string;
  unit: string;
  confidence: number;
}

export interface AIImportDraft {
  id: string;
  sourceUri: string;
  localDate: string;
  fields: AIExtractedField[];
  insight: string;
  disclaimer: string;
  modelId: string;
  generatedAt: number;
}

function buildRuleBasedOutput(input: AIAnalysisInput): AIAnalysisOutput {
  const validWeights = input.weightLogs.filter((log) => log.weight !== null);
  const first = validWeights[validWeights.length - 1]?.weight ?? null;
  const latest = validWeights[0]?.weight ?? null;
  const delta = first !== null && latest !== null ? latest - first : 0;
  const trendStatus =
    Math.abs(delta) < 0.3 ? 'plateau' : delta < 0 ? 'on_track' : 'regression';

  return {
    summary:
      trendStatus === 'on_track'
        ? '近期體重變化朝目標前進，請維持穩定紀錄與可持續的訓練節奏。'
        : trendStatus === 'plateau'
          ? '近期變化較小，先確認睡眠、飲食與紀錄頻率，再微調訓練。'
          : '近期趨勢需要留意，建議先檢查熱量攝取、壓力與水分波動。',
    suggestions: [
      '每週用固定時段量測，降低水分波動造成的誤判。',
      '以 2 週趨勢觀察，不用因單日數字大幅調整。',
      '若數據異常，先手動確認來源截圖與輸入值。',
    ],
    trendStatus,
    generatedAt: Date.now(),
    tier: 'gemini',
  };
}

export async function analyzeWeightTrend(input: AIAnalysisInput): Promise<AIAnalysisOutput> {
  try {
    const client = getClient();
    const model = client.getGenerativeModel({ model: GEMINI_MODEL });

    const goalText = GOAL_TEXT[input.userProfile.goal] ?? '未知';
    const expText = EXPERIENCE_TEXT[input.userProfile.experienceLevel] ?? '未知';

    const recentLogs = input.weightLogs.slice(0, 30);
    const weightSummary = recentLogs
      .map((l) => `${l.date}: ${l.weight ?? '無'}kg`)
      .join(', ');

    let workoutSummary = '';
    if (input.recentWorkouts && input.recentWorkouts.length > 0) {
      const recent = input.recentWorkouts.slice(0, 7);
      workoutSummary = `\n近期訓練紀錄（最多7筆）：${recent.map((w) => `${w.date}(${w.sets.length}組)`).join(', ')}`;
    }

    let questionSection = '';
    if (input.question) {
      questionSection = `\n使用者提問：「${input.question}」\n請在 chatReply 欄位作答。`;
    }

    const prompt = `你是一位專業健身數據分析助手，使用溫暖鼓勵的繁體中文。
使用者資訊：健身目標：${goalText}，經驗：${expText}
近30天體重紀錄（由新到舊）：${weightSummary}${workoutSummary}${questionSection}

🚫 禁止：輸出原始數值、醫療診斷建議、Markdown 格式、個人識別資訊
✅ 僅輸出此 JSON 格式（不含其他文字）：
{"summary":"（≤120字總結）","suggestions":["（≤50字建議1）","（≤50字建議2）","（≤50字建議3）"],"trendStatus":"on_track","chatReply":"（若有提問則在此回答，否則空字串）"}
trendStatus 只能是：on_track | plateau | regression`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    const parsed = safeJsonParse<{
      summary?: string;
      suggestions?: string[];
      trendStatus?: string;
      chatReply?: string;
    }>(raw);

    if (!parsed?.summary || !Array.isArray(parsed.suggestions)) {
      return buildRuleBasedOutput(input);
    }

    const validStatuses = ['on_track', 'plateau', 'regression'];
    const trendStatus = validStatuses.includes(parsed.trendStatus ?? '')
      ? (parsed.trendStatus as AIAnalysisOutput['trendStatus'])
      : 'on_track';

    return {
      summary: (parsed.summary ?? '').slice(0, 120),
      suggestions: (parsed.suggestions ?? []).slice(0, 3).map((s: string) => s.slice(0, 100)),
      trendStatus,
      chatReply: parsed.chatReply ? parsed.chatReply.slice(0, 600) : undefined,
      generatedAt: Date.now(),
      tier: 'gemini',
    };
  } catch {
    return buildRuleBasedOutput(input);
  }
}

export async function analyzeScreenshot(
  imageBase64: string,
  localDate: string
): Promise<AIImportDraft> {
  try {
    const client = getClient();
    const model = client.getGenerativeModel({ model: GEMINI_MODEL });

    const prompt = `從這張健康體組成截圖中擷取以下欄位的數值：
體重(weight_kg)、BMI(bmi)、肌肉量(muscle_mass_kg)、骨骼肌(skeletal_muscle_kg)、身體水分%(body_water_percent)、體脂率%(body_fat_percent)

僅輸出此 JSON（不含其他文字）：
{"fields":[{"name":"weight_kg","value":"70.5","confidence":0.95}],"insight":"（≤120字健身建議，不含醫療診斷）"}

找不到的欄位請設 value 為空字串、confidence 為 0。禁止輸出任何醫療診斷或個人識別資訊。`;

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: 'image/jpeg' as const,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const raw = result.response.text();

    const parsed = safeJsonParse<{
      fields?: Array<{ name: string; value: string | number; confidence: number }>;
      insight?: string;
    }>(raw);

    const parsedFields = parsed?.fields ?? [];
    const fields: AIExtractedField[] = FIELD_META.map((meta) => {
      const hit = parsedFields.find((f) => f.name === meta.name);
      return {
        ...meta,
        value: hit?.value !== undefined ? String(hit.value) : '',
        confidence: typeof hit?.confidence === 'number' ? hit.confidence : 0,
      };
    });

    return {
      id: `draft_${Date.now()}`,
      sourceUri: '',
      localDate,
      fields,
      insight: (parsed?.insight ?? '已解析截圖，請確認數值後再保存。').slice(0, 120),
      disclaimer: DISCLAIMER,
      modelId: GEMINI_MODEL,
      generatedAt: Date.now(),
    };
  } catch {
    return {
      id: `draft_${Date.now()}`,
      sourceUri: '',
      localDate,
      fields: FIELD_META.map((meta) => ({ ...meta, value: '', confidence: 0 })),
      insight: 'AI 分析失敗，請手動輸入截圖中的數值。',
      disclaimer: DISCLAIMER,
      modelId: GEMINI_MODEL,
      generatedAt: Date.now(),
    };
  }
}
