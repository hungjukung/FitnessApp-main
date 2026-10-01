import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { analyzeWeightTrend, analyzeScreenshot } from '../services/gemini.service';
import { parseWorkoutText, validateParseWorkoutBody } from '../services/workoutParse.service';
import { analyzeFoodPhoto, validateAnalyzeFoodBody } from '../services/foodAnalyze.service';

export async function analyzeWeightTrendHandler(req: AuthRequest, res: Response): Promise<void> {
  const { weightLogs, userProfile, question, recentWorkouts } = req.body as {
    weightLogs?: Array<{ date: string; weight: number | null }>;
    userProfile?: { experienceLevel: string; goal: string; gender?: string; age?: number; heightCm?: number };
    question?: string;
    recentWorkouts?: unknown[];
  };

  if (!weightLogs || !userProfile) {
    res.status(400).json({ message: 'weightLogs 和 userProfile 為必要欄位' });
    return;
  }

  const result = await analyzeWeightTrend({ weightLogs, userProfile, question, recentWorkouts: recentWorkouts as never });
  res.json(result);
}

export async function analyzeImageHandler(req: AuthRequest, res: Response): Promise<void> {
  const { imageBase64, localDate } = req.body as {
    imageBase64?: string;
    localDate?: string;
  };

  if (!imageBase64 || !localDate) {
    res.status(400).json({ message: 'imageBase64 和 localDate 為必要欄位' });
    return;
  }

  const result = await analyzeScreenshot(imageBase64, localDate);
  res.json(result);
}

/** 課表一句話記錄：只回傳草稿，不寫入資料庫 */
export async function parseWorkoutHandler(req: AuthRequest, res: Response): Promise<void> {
  const validated = validateParseWorkoutBody(req.body);
  if (!validated.ok) {
    res.status(400).json({ message: validated.error });
    return;
  }

  try {
    const result = await parseWorkoutText(validated.input);
    res.json(result);
  } catch {
    // 金鑰未設定、逾時、模型回傳格式錯誤都走這裡；App 端會改用離線解析
    res.status(502).json({ message: 'AI 解析暫時無法使用' });
  }
}

/** 飲食拍照辨識（xAI Grok）：只回傳草稿，不寫入資料庫 */
export async function analyzeFoodHandler(req: AuthRequest, res: Response): Promise<void> {
  const validated = validateAnalyzeFoodBody(req.body);
  if (!validated.ok) {
    res.status(400).json({ message: validated.error });
    return;
  }

  try {
    const result = await analyzeFoodPhoto(validated.imageBase64);
    res.json(result);
  } catch (err) {
    // 金鑰未設定、逾時、模型回傳格式錯誤都走這裡；App 端會請使用者手動輸入
    console.error('[AI] analyze-food failed:', err instanceof Error ? err.message : err);
    res.status(502).json({ message: 'AI 辨識暫時無法使用' });
  }
}
