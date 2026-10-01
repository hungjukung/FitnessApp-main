/**
 * FitTrack AI — AI Service 型別轉出
 *
 * Prompt 構建與回應解析都在後端（backend/src/services/gemini.service.ts），
 * 客戶端只負責呼叫 API，不再持有 prompt 邏輯。
 */

import { AIAnalysisInput, AIAnalysisOutput, AIImportDraft, IAIService } from '../../types';

export type { AIAnalysisInput, AIAnalysisOutput, AIImportDraft, IAIService };
