import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { authFetch } from '../api/client';
import {
  AIAnalysisInput,
  AIAnalysisOutput,
  AIImportDraft,
  IAIService,
  WorkoutSession,
} from '../../types';

export const GEMINI_MODEL_ID = 'gemini-2.5-flash';
const DISCLAIMER = '本建議僅供健身紀錄參考，不能取代醫療診斷或治療。';

const FIELD_META = [
  { name: 'weight_kg' as const, label: '體重', unit: 'kg' },
  { name: 'bmi' as const, label: 'BMI', unit: '' },
  { name: 'muscle_mass_kg' as const, label: '肌肉量', unit: 'kg' },
  { name: 'skeletal_muscle_kg' as const, label: '骨骼肌', unit: 'kg' },
  { name: 'body_water_percent' as const, label: '身體水分', unit: '%' },
  { name: 'body_fat_percent' as const, label: '體脂率', unit: '%' },
];

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

export class GeminiService implements IAIService {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async analyze(input: AIAnalysisInput): Promise<AIAnalysisOutput> {
    try {
      const result = await authFetch<AIAnalysisOutput>('/ai/analyze', {
        method: 'POST',
        body: JSON.stringify({
          weightLogs: input.weightLogs,
          userProfile: input.userProfile,
          question: input.question,
          recentWorkouts: (input as AIAnalysisInput & { recentWorkouts?: WorkoutSession[] }).recentWorkouts,
        }),
      });
      return { ...result, tier: 'gemini' };
    } catch {
      return buildRuleBasedOutput(input);
    }
  }

  async analyzeScreenshot(imageUri: string, localDate: string): Promise<AIImportDraft> {
    try {
      // 壓縮圖片至 512×512，降低傳輸大小
      const compressed = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 512 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const result = await authFetch<AIImportDraft>('/ai/analyze-image', {
        method: 'POST',
        body: JSON.stringify({ imageBase64: base64, localDate }),
      });

      return { ...result, sourceUri: imageUri };
    } catch {
      return {
        id: `draft_${Date.now()}`,
        sourceUri: imageUri,
        localDate,
        fields: FIELD_META.map((meta) => ({ ...meta, value: '', confidence: 0 })),
        insight: 'AI 分析失敗，請手動輸入截圖中的數值。',
        disclaimer: DISCLAIMER,
        modelId: GEMINI_MODEL_ID,
        generatedAt: Date.now(),
      };
    }
  }
}
