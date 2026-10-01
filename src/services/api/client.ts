import { useAuthStore } from '../../stores/authStore';
import { ApiError } from './authApi';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function authFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const tokens = useAuthStore.getState().tokens;
  if (!tokens) throw new ApiError(401, '請先登入');

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.accessToken}`,
      ...(options.headers as Record<string, string> ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (data as any).message ?? '伺服器異常，請稍後再試');
  }
  return data as T;
}
