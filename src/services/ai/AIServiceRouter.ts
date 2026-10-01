import * as FileSystem from 'expo-file-system/legacy';
import { AIAnalysisInput, AIAnalysisOutput, AIImportDraft } from './IAIService';
import { GeminiService, GEMINI_MODEL_ID } from './GeminiService';

const service = new GeminiService();

export { GEMINI_MODEL_ID };

export const clearAITemporaryFiles = async (): Promise<void> => {
  if (!FileSystem.cacheDirectory) return;
  try {
    await FileSystem.deleteAsync(FileSystem.cacheDirectory, { idempotent: true });
    await FileSystem.makeDirectoryAsync(FileSystem.cacheDirectory, { intermediates: true });
  } catch {
    // Some platforms disallow deleting the root cache directory; safe to ignore
  }
};

export const runAIAnalysis = async (input: AIAnalysisInput): Promise<AIAnalysisOutput> =>
  service.analyze(input);

export const analyzeHealthScreenshot = async (
  imageUri: string,
  localDate?: string
): Promise<AIImportDraft> =>
  service.analyzeScreenshot(imageUri, localDate ?? new Date().toISOString().split('T')[0]);

export const TrendStatusConfig = {
  on_track: {
    label: '進度正常',
    emoji: 'OK',
    lightBg: '#D1FAE5',
    lightText: '#1A7F37',
    darkBg: '#064E3B',
    darkText: '#30D158',
  },
  plateau: {
    label: '遇到停滯期',
    emoji: '!',
    lightBg: '#FEF3C7',
    lightText: '#9B6200',
    darkBg: '#4A2C00',
    darkText: '#FFD60A',
  },
  regression: {
    label: '需要調整',
    emoji: '!',
    lightBg: '#FEE2E2',
    lightText: '#B91C1C',
    darkBg: '#4A0000',
    darkText: '#FF453A',
  },
} as const;
