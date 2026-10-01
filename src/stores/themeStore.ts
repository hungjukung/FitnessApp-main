/**
 * FitTrack AI — 主題模式 Store
 * 三選一：auto（依時間）/ light / dark
 * 搭配 useTimeBasedTheme Hook 實現時間感知切換
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeMode } from '../types';
import { LightTheme, DarkTheme, BusinessRules, AppTheme } from '../constants/theme';

// ─────────────────────────────────────────────
// Theme Store
// ─────────────────────────────────────────────

interface ThemeState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeMode: 'auto', // 預設自動模式
      setThemeMode: (mode) => set({ themeMode: mode }),
    }),
    {
      name: 'theme-mode-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ─────────────────────────────────────────────
// 時間判斷：是否應使用淺色模式
// ─────────────────────────────────────────────

const isLightModeTime = (): boolean => {
  const now = new Date();
  const hour = now.getHours(); // 使用本地時間（裝置時區）
  return (
    hour >= BusinessRules.theme.lightModeStartHour &&
    hour < BusinessRules.theme.lightModeEndHour
  );
};

// ─────────────────────────────────────────────
// useTimeBasedTheme Hook
// 每分鐘重新檢查時間（在 auto 模式下）
// 返回當前應使用的主題物件
// ─────────────────────────────────────────────

export const useTimeBasedTheme = (): AppTheme => {
  const { themeMode } = useThemeStore();
  const systemColorScheme = useColorScheme(); // 'dark' | 'light' | null

  // 時間制 fallback 狀態（僅在 auto 且系統無偏好時啟用）
  const [timeBasedIsDark, setTimeBasedIsDark] = useState(!isLightModeTime());

  useEffect(() => {
    // 非 auto 模式或系統已提供偏好：不需要時間輪詢
    if (themeMode !== 'auto' || systemColorScheme != null) return;

    setTimeBasedIsDark(!isLightModeTime());
    const intervalId = setInterval(() => {
      setTimeBasedIsDark(!isLightModeTime());
    }, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [themeMode, systemColorScheme]);

  const isDark = (() => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    // auto：優先跟隨系統深色模式，系統無偏好時退回時間制
    if (systemColorScheme != null) return systemColorScheme === 'dark';
    return timeBasedIsDark;
  })();

  return isDark ? DarkTheme : LightTheme;
};

// ─────────────────────────────────────────────
// 工具函式：取得主題模式顯示文字（UI 用）
// ─────────────────────────────────────────────

export const getThemeModeLabel = (mode: ThemeMode): string => {
  const labels: Record<ThemeMode, string> = {
    auto: '自動（跟隨系統）',
    light: '永久淺色',
    dark: '永久深色',
  };
  return labels[mode];
};
