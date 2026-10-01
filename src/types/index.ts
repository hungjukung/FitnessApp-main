/**
 * FitTrack AI — 全域 TypeScript 型別定義
 * 所有 Section 共用的 Interface 與 Enum
 */

// ─────────────────────────────────────────────
// Section 1: Onboarding & Profile
// ─────────────────────────────────────────────

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type FitnessGoal =
  | 'muscle_gain'
  | 'maintenance'
  | 'fat_loss';

export type ThemeMode = 'auto' | 'light' | 'dark';

export type Gender = 'male' | 'female' | 'prefer_not_to_say';

export interface UserProfile {
  id: string;
  authUserId?: string;
  nickname?: string;
  experienceLevel: ExperienceLevel | null;
  goal: FitnessGoal | null;
  themeMode: ThemeMode;
  gender: Gender | null;
  age: number | null;              // 歲（10–100）
  heightCm: number | null;         // 公分（50–250）
  initialWeightKg: number | null;  // 公斤（20.0–200.0）
  goalWeightKg: number | null;     // 公斤（20.0–200.0），選填
  aiConsentGiven: boolean;
  /** 體態照片是否上傳至雲端備份。預設 false —— 不開啟就永不離開本機 */
  photoCloudSyncEnabled: boolean;
  createdAt: number;               // Unix Timestamp (ms)
  updatedAt: number;
}

// ─────────────────────────────────────────────
// Section 2: Daily Tracking
// ─────────────────────────────────────────────

export interface WeightLog {
  date: string;       // "YYYY-MM-DD"（本地日期字串，非 UTC）
  weight: number;     // 20.0–200.0，精確至 0.1
  createdAt: number;  // Unix Timestamp (ms)
  updatedAt: number;
}

export interface PhotoLog {
  id: string;          // UUID
  date: string;        // "YYYY-MM-DD"
  fileUri: string;     // file:///...body_records/YYYY-MM-DD.jpg
  fileName: string;    // "YYYY-MM-DD.jpg" | "YYYY-MM-DD-1.jpg"
  sortIndex: number;   // 當日第幾張（0-indexed）
  createdAt: number;
}

/** 日曆 Day Cell 顯示用的聚合數據 */
export interface DayMark {
  date: string;
  hasWeight: boolean;
  weightValue: number | null;
  photoCount: number;
  hasWorkout: boolean;
  workoutVolume?: number;
}

// ─────────────────────────────────────────────
// Section 3: Analytics Dashboard
// ─────────────────────────────────────────────

export type TimeRange = 'week' | 'month' | 'three_months';

export type TrendDirection = 'up' | 'flat' | 'down';

export interface ChartDataPoint {
  timeLabel: string;          // 橫軸顯示文字（"4/21", "W1", "10月"）
  weightValue: number | null; // 左 Y 軸（長條圖，體重平均值）
  weeklyDelta: number | null; // 右 Y 軸（折線圖，週變化量）
}

export interface SummaryStats {
  highestWeight: number;
  lowestWeight: number;
  averageWeight: number;
  totalDelta: number;         // 期間總變化量 (kg)
  avgWeeklyDelta: number;     // 平均週變化 (kg/wk)
  trend: TrendDirection;
  dataPoints: number;         // 有效紀錄天數
  periodLabel: string;        // 顯示用文字，如 "過去 30 天"
}

export interface WeeklyDeltaPoint {
  weekLabel: string;
  weekStart: string;
  currentWeekAvg: number | null;
  prevWeekAvg: number | null;
  delta: number | null;
}

// ─────────────────────────────────────────────
// Section 4: AI Companion
// ─────────────────────────────────────────────

export type TrendStatus = 'on_track' | 'plateau' | 'regression';

export type AITier = 'gemini';

export interface AIAnalysisInput {
  weightLogs: Array<{ date: string; weight: number | null }>;
  latestPhotoBase64: string | null;  // 224×224 縮圖
  userProfile: {
    experienceLevel: ExperienceLevel;
    goal: FitnessGoal;
    gender: Gender;
    age: number;
    heightCm: number;
  };
  question?: string;
  recentWorkouts?: WorkoutSession[];
}

export interface AIAnalysisOutput {
  summary: string;
  suggestions: string[];
  trendStatus: TrendStatus;
  chatReply?: string;
  generatedAt: number;
  tier: AITier;
}

export interface IAIService {
  analyze(input: AIAnalysisInput): Promise<AIAnalysisOutput>;
  isAvailable(): Promise<boolean>;
}

export type AIExtractedFieldName =
  | 'weight_kg'
  | 'bmi'
  | 'muscle_mass_kg'
  | 'skeletal_muscle_kg'
  | 'body_water_percent'
  | 'body_fat_percent';

export interface AIExtractedField {
  name: AIExtractedFieldName;
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

// ─────────────────────────────────────────────
// Section 5: Workout Tracking
// ─────────────────────────────────────────────

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'cardio';

export type ExerciseCategory = 'compound' | 'isolation' | 'cardio';

export interface Exercise {
  id: string;
  name: string;                  // 中文名，如「槓鈴臥推」
  muscleGroups: MuscleGroup[];
  category: ExerciseCategory;
  isCustom?: boolean;
}

export interface WorkoutSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;          // 冗餘存名稱，避免動作庫更名影響歷史
  setNumber: number;
  reps?: number;
  weight?: number;               // kg
  duration?: number;             // 秒，有氧用
  createdAt: number;
}

export interface WorkoutSession {
  id: string;
  date: string;                  // YYYY-MM-DD
  name?: string;
  startedAt: number;
  completedAt?: number;
  sets: WorkoutSet[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkoutChartPoint {
  weekLabel: string;             // "W1", "W2" ...
  volume: number;                // 總訓練量 kg×reps
  sessions: number;              // 該週訓練次數
}

// ─────────────────────────────────────────────
// Section 6: Notification Settings
// ─────────────────────────────────────────────

export interface NotificationSettings {
  weightReminderEnabled: boolean;
  weightReminderHour: number;    // 0-23
  weightReminderMinute: number;  // 0-59
  workoutReminderEnabled: boolean;
  workoutReminderDays: number[]; // 0=日 ... 6=六
  workoutReminderHour: number;
  workoutReminderMinute: number;
}

// ─────────────────────────────────────────────
// 工具型別
// ─────────────────────────────────────────────

export type Nullable<T> = T | null;
