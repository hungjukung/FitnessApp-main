/**
 * FitTrack AI — 設計系統常數
 * 色盤（Okabe-Ito 色盲安全）、字型、間距、圓角
 */

// ─────────────────────────────────────────────
// Okabe-Ito 色盲安全色盤
// ─────────────────────────────────────────────
export const OkabeIto = {
  skyBlue: '#56B4E9',    // 主色，長條圖
  orange: '#E69F00',     // 輔色，折線圖（週變化）
  green: '#009E73',      // 趨勢下降（對減脂目標是好事）
  vermillion: '#D55E00', // 警示色（Regression）
  bluishGreen: '#00B0F0',
  yellow: '#F0E442',
  blue: '#0072B2',
  black: '#000000',
} as const;

// ─────────────────────────────────────────────
// 淺色主題
// ─────────────────────────────────────────────
export const LightTheme = {
  // 背景層次
  background: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  // 文字
  textPrimary: '#1C1C1E',
  textSecondary: '#6E6E73',
  textTertiary: '#AEAEB2',
  textOnPrimary: '#FFFFFF',

  // 品牌色
  primary: '#007AFF',       // iOS 風格藍
  primaryDark: '#0056CC',
  accent: OkabeIto.orange,

  // 圖表色
  chartBar: OkabeIto.skyBlue,
  chartLine: OkabeIto.orange,
  chartOnTrack: '#1A7F37',   // 深綠（白字對比通過 WCAG AA）
  chartPlateau: '#9B6200',   // 深橘（白字對比通過）
  chartRegression: '#B91C1C', // 深紅（白字對比通過）

  // 邊框與分隔線
  border: '#E5E5EA',
  separator: '#C6C6C8',

  // 功能色
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#32ADE6',

  // BottomSheet
  sheetBackground: '#FFFFFF',
  sheetHandle: '#C7C7CC',

  // 狀態
  disabled: '#AEAEB2',
  disabledBackground: '#F2F2F7',
} as const;

// ─────────────────────────────────────────────
// 深色主題
// ─────────────────────────────────────────────
export const DarkTheme = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',

  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#48484A',
  textOnPrimary: '#FFFFFF',

  primary: '#0A84FF',       // iOS 深色模式藍
  primaryDark: '#0066CC',
  accent: OkabeIto.orange,

  chartBar: OkabeIto.skyBlue,
  chartLine: OkabeIto.orange,
  chartOnTrack: '#30D158',
  chartPlateau: '#FFD60A',
  chartRegression: '#FF453A',

  border: '#38383A',
  separator: '#38383A',

  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
  info: '#64D2FF',

  sheetBackground: '#1C1C1E',
  sheetHandle: '#48484A',

  disabled: '#48484A',
  disabledBackground: '#2C2C2E',
} as const;

export type AppTheme = {
  [Key in keyof typeof LightTheme]: string;
};

// ─────────────────────────────────────────────
// 字型系統（使用 SF Pro / Roboto 系統字型）
// ─────────────────────────────────────────────
export const Typography = {
  // 字體大小
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    display: 32,
  },
  // 字重
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  // 行高倍率
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// ─────────────────────────────────────────────
// 間距系統（4pt 基準網格）
// ─────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 64,
} as const;

// ─────────────────────────────────────────────
// 圓角
// ─────────────────────────────────────────────
export const Radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ─────────────────────────────────────────────
// 無障礙：最小觸控目標（WCAG 2.1 AA）
// ─────────────────────────────────────────────
export const MinTouchTarget = {
  ios: 44,     // 44×44 pt
  android: 48, // 48×48 dp
} as const;

// ─────────────────────────────────────────────
// 業務邏輯常數
// ─────────────────────────────────────────────
export const BusinessRules = {
  weight: {
    min: 20.0,
    max: 200.0,
    decimalPlaces: 1,
  },
  age: { min: 10, max: 100 },
  height: { min: 50, max: 250 },
  ai: {
    maxWeightLogDays: 30,       // AI 只讀近 30 天
    photoThumbnailSize: 224,    // 224×224 px
    cooldownSeconds: 60,        // 重新分析冷卻時間
    minDaysToUnlock: 7,         // 達到此天數才解鎖 AI
  },
  theme: {
    lightModeStartHour: 6,      // 06:00 起切淺色
    lightModeEndHour: 18,       // 18:00 後切深色
  },
} as const;
