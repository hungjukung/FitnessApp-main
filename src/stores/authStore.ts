/**
 * FitTrack AI — Auth Store
 * 管理 JWT Access Token / Refresh Token 與登入狀態
 * Token 以 AsyncStorage 持久化（生產環境建議改用 expo-secure-store）
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number; // Unix ms
  refreshTokenExpiresAt: number; // Unix ms
}

interface AuthState {
  tokens: AuthTokens | null;
  userId: string | null;
  email: string | null;
  isEmailVerified: boolean;
  _hasHydrated: boolean;

  // Actions
  setAuth: (userId: string, email: string, tokens: AuthTokens, isEmailVerified: boolean) => void;
  setTokens: (tokens: AuthTokens) => void;
  setEmailVerified: () => void;
  clearAuth: () => void;

  // Computed
  isAuthenticated: () => boolean;
  isAccessTokenExpired: () => boolean;
  isRefreshTokenExpired: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      tokens: null,
      userId: null,
      email: null,
      isEmailVerified: false,
      _hasHydrated: false,

      setAuth: (userId, email, tokens, isEmailVerified) =>
        set({ userId, email, tokens, isEmailVerified }),

      setTokens: (tokens) => set({ tokens }),

      setEmailVerified: () => set({ isEmailVerified: true }),

      clearAuth: () =>
        set({ tokens: null, userId: null, email: null, isEmailVerified: false }),

      isAuthenticated: () => {
        const { tokens, isEmailVerified } = get();
        return tokens !== null && isEmailVerified;
      },

      isAccessTokenExpired: () => {
        const { tokens } = get();
        if (!tokens) return true;
        return Date.now() >= tokens.accessTokenExpiresAt;
      },

      isRefreshTokenExpired: () => {
        const { tokens } = get();
        if (!tokens) return true;
        return Date.now() >= tokens.refreshTokenExpiresAt;
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        tokens: state.tokens,
        userId: state.userId,
        email: state.email,
        isEmailVerified: state.isEmailVerified,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ _hasHydrated: true });
      },
    }
  )
);
