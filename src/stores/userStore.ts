/**
 * FitTrack AI — User Profile Store
 * 每個 authUserId 使用獨立的 AsyncStorage key，帳號切換時不互相覆蓋
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, ExperienceLevel, FitnessGoal, Gender, ThemeMode, NotificationSettings } from '../types';
import { apiSyncProfile } from '../services/api/profileApi';
import { rescheduleAll } from '../services/notifications/NotificationService';

// ─────────────────────────────────────────────
// 每個 authUserId 的 AsyncStorage key
// ─────────────────────────────────────────────

const profileKey = (authUserId: string) => `user-profile-v2-${authUserId}`;
const notifKey = (authUserId: string) => `notification-settings-${authUserId}`;

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  weightReminderEnabled: false,
  weightReminderHour: 8,
  weightReminderMinute: 0,
  workoutReminderEnabled: false,
  workoutReminderDays: [],
  workoutReminderHour: 9,
  workoutReminderMinute: 0,
};

// ─────────────────────────────────────────────
// 預設空白 Profile
// ─────────────────────────────────────────────

const createDefaultProfile = (authUserId?: string): UserProfile => ({
  id: `user_${Date.now()}`,
  authUserId,
  experienceLevel: null,
  goal: null,
  themeMode: 'auto',
  gender: null,
  age: null,
  heightCm: null,
  initialWeightKg: null,
  goalWeightKg: null,
  aiConsentGiven: false,
  photoCloudSyncEnabled: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

// ─────────────────────────────────────────────
// Store State & Actions
// ─────────────────────────────────────────────

interface UserState {
  profile: UserProfile;
  isOnboardingCompleted: boolean;
  notificationSettings: NotificationSettings;

  // Actions
  updateProfile: (updates: Partial<UserProfile>) => void;
  completeOnboarding: () => void;
  giveAIConsent: () => void;
  setAIConsent: (enabled: boolean) => void;
  setPhotoCloudSync: (enabled: boolean) => void;
  resetProfile: () => void;
  initForUser: (authUserId: string) => Promise<void>;
  deleteUserData: (authUserId: string) => Promise<void>;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => Promise<void>;

  // Computed
  isProfileComplete: () => boolean;
}

export const useUserStore = create<UserState>()((set, get) => ({
  profile: createDefaultProfile(),
  isOnboardingCompleted: false,
  notificationSettings: { ...DEFAULT_NOTIFICATION_SETTINGS },

  updateProfile: (updates) => {
    set((state) => {
      const next = { ...state.profile, ...updates, updatedAt: Date.now() };
      if (next.authUserId) {
        AsyncStorage.setItem(profileKey(next.authUserId), JSON.stringify({
          profile: next,
          isOnboardingCompleted: state.isOnboardingCompleted,
        })).catch(console.error);
        apiSyncProfile(next, state.isOnboardingCompleted).catch(() => {});
      }
      return { profile: next };
    });
  },

  completeOnboarding: () => {
    set((state) => {
      if (state.profile.authUserId) {
        AsyncStorage.setItem(profileKey(state.profile.authUserId), JSON.stringify({
          profile: state.profile,
          isOnboardingCompleted: true,
        })).catch(console.error);
        apiSyncProfile(state.profile, true).catch(() => {});
      }
      return { isOnboardingCompleted: true };
    });
  },

  giveAIConsent: () => {
    set((state) => {
      const next = { ...state.profile, aiConsentGiven: true, updatedAt: Date.now() };
      if (next.authUserId) {
        AsyncStorage.setItem(profileKey(next.authUserId), JSON.stringify({
          profile: next,
          isOnboardingCompleted: state.isOnboardingCompleted,
        })).catch(console.error);
        apiSyncProfile(next, state.isOnboardingCompleted).catch(() => {});
      }
      return { profile: next };
    });
  },

  setAIConsent: (enabled) => {
    set((state) => {
      const next = { ...state.profile, aiConsentGiven: enabled, updatedAt: Date.now() };
      if (next.authUserId) {
        AsyncStorage.setItem(profileKey(next.authUserId), JSON.stringify({
          profile: next,
          isOnboardingCompleted: state.isOnboardingCompleted,
        })).catch(console.error);
        apiSyncProfile(next, state.isOnboardingCompleted).catch(() => {});
      }
      return { profile: next };
    });
  },

  setPhotoCloudSync: (enabled) => {
    set((state) => {
      const next = { ...state.profile, photoCloudSyncEnabled: enabled, updatedAt: Date.now() };
      if (next.authUserId) {
        AsyncStorage.setItem(profileKey(next.authUserId), JSON.stringify({
          profile: next,
          isOnboardingCompleted: state.isOnboardingCompleted,
        })).catch(console.error);
        apiSyncProfile(next, state.isOnboardingCompleted).catch(() => {});
      }
      return { profile: next };
    });
  },

  resetProfile: () =>
    set({
      profile: createDefaultProfile(),
      isOnboardingCompleted: false,
    }),

  // 切換帳號時：從 AsyncStorage 載入該 userId 的 profile；找不到就開新的
  initForUser: async (authUserId: string) => {
    const { profile } = get();
    if (profile.authUserId === authUserId) return; // 同一個帳號，不需要重置

    try {
      const [saved, savedNotif] = await Promise.all([
        AsyncStorage.getItem(profileKey(authUserId)),
        AsyncStorage.getItem(notifKey(authUserId)),
      ]);
      const notificationSettings = savedNotif
        ? { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(savedNotif) }
        : { ...DEFAULT_NOTIFICATION_SETTINGS };
      if (saved) {
        const { profile: savedProfile, isOnboardingCompleted } = JSON.parse(saved);
        // 先鋪一層預設值，讓舊版存檔缺少的新欄位（如 photoCloudSyncEnabled）取得安全預設
        set({
          profile: { ...createDefaultProfile(authUserId), ...savedProfile, authUserId },
          isOnboardingCompleted,
          notificationSettings,
        });
      } else {
        set({ profile: createDefaultProfile(authUserId), isOnboardingCompleted: false, notificationSettings });
      }
    } catch {
      set({ profile: createDefaultProfile(authUserId), isOnboardingCompleted: false });
    }
  },

  // 刪除帳號時：清除該 userId 的 AsyncStorage 資料
  deleteUserData: async (authUserId: string) => {
    await Promise.all([
      AsyncStorage.removeItem(profileKey(authUserId)),
      AsyncStorage.removeItem(notifKey(authUserId)),
    ]).catch(console.error);
    set({ profile: createDefaultProfile(), isOnboardingCompleted: false, notificationSettings: { ...DEFAULT_NOTIFICATION_SETTINGS } });
  },

  updateNotificationSettings: async (updates: Partial<NotificationSettings>) => {
    const current = get().notificationSettings;
    const next = { ...current, ...updates };
    set({ notificationSettings: next });
    const authUserId = get().profile.authUserId;
    if (authUserId) {
      await AsyncStorage.setItem(notifKey(authUserId), JSON.stringify(next)).catch(console.error);
    }
    await rescheduleAll(next).catch(console.error);
  },

  isProfileComplete: () => {
    const { profile } = get();
    return (
      profile.experienceLevel !== null &&
      profile.goal !== null &&
      profile.gender !== null &&
      profile.age !== null &&
      profile.heightCm !== null &&
      profile.initialWeightKg !== null
    );
  },
}));

// ─────────────────────────────────────────────
// 顯示文字映射（UI 用）
// ─────────────────────────────────────────────

export const ExperienceLevelLabels: Record<ExperienceLevel, string> = {
  beginner: '初學',
  intermediate: '中階',
  advanced: '進階',
};

export const FitnessGoalLabels: Record<FitnessGoal, string> = {
  fat_loss: '減脂',
  muscle_gain: '增肌',
  maintenance: '維持',
};

export const GenderLabels: Record<Gender, string> = {
  male: '男',
  female: '女',
  prefer_not_to_say: '不透露',
};

export const ThemeModeLabels: Record<ThemeMode, string> = {
  auto: '🌓 自動（依時間切換）',
  light: '☀️ 永久淺色',
  dark: '🌙 永久深色',
};

// ─────────────────────────────────────────────
// AI 建議生成時，Goal 對應的中文文字
// ─────────────────────────────────────────────

export const FitnessGoalForAI: Record<FitnessGoal, string> = {
  fat_loss: '降低體脂肪',
  muscle_gain: '增肌',
  maintenance: '維持目前體態',
};
