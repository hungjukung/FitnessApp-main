import { authFetch } from './client';
import { WeightLog } from '../../types';

export async function apiFetchWeightLogs(): Promise<WeightLog[]> {
  return authFetch<WeightLog[]>('/users/me/weight-logs');
}

export async function apiUpsertWeightLog(log: WeightLog): Promise<void> {
  await authFetch('/users/me/weight-logs', {
    method: 'POST',
    body: JSON.stringify({ date: log.date, weight: log.weight, createdAt: log.createdAt }),
  });
}

export async function apiDeleteWeightLog(date: string): Promise<void> {
  await authFetch(`/users/me/weight-logs/${date}`, { method: 'DELETE' });
}
