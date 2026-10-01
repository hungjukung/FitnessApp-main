/**
 * FitTrack AI — Auth API Client
 * 封裝所有與後端 /auth 端點的通訊
 */

import { AuthTokens } from '../../stores/authStore';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─────────────────────────────────────────────
// 共用 fetch wrapper
// ─────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data.message ?? '伺服器異常，請稍後再試');
  }

  return data as T;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─────────────────────────────────────────────
// 回應型別
// ─────────────────────────────────────────────

interface AuthResponse {
  userId: string;
  email: string;
  isEmailVerified: boolean;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number; // seconds
  refreshTokenExpiresIn: number; // seconds
}

function toAuthTokens(res: AuthResponse): AuthTokens {
  const now = Date.now();
  return {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    accessTokenExpiresAt: now + res.accessTokenExpiresIn * 1000,
    refreshTokenExpiresAt: now + res.refreshTokenExpiresIn * 1000,
  };
}

// ─────────────────────────────────────────────
// API 呼叫
// ─────────────────────────────────────────────

export async function apiRegister(
  email: string,
  password: string
): Promise<{ userId: string; email: string }> {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function apiLogin(
  email: string,
  password: string
): Promise<{ userId: string; email: string; isEmailVerified: boolean; tokens: AuthTokens }> {
  const res = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return {
    userId: res.userId,
    email: res.email,
    isEmailVerified: res.isEmailVerified,
    tokens: toAuthTokens(res),
  };
}

export async function apiRefreshToken(
  refreshToken: string
): Promise<AuthTokens> {
  const res = await apiFetch<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  return toAuthTokens(res);
}

export async function apiLogout(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await apiFetch('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function apiForgotPassword(email: string): Promise<void> {
  await apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function apiDeleteAccount(accessToken: string): Promise<void> {
  await apiFetch('/users/me', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
