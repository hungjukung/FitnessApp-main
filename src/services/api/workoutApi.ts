import { authFetch } from './client';
import { WorkoutSession, WorkoutSet } from '../../types';

export async function apiFetchWorkoutSessions(): Promise<WorkoutSession[]> {
  return authFetch<WorkoutSession[]>('/users/me/workout-sessions');
}

export async function apiUpsertWorkoutSession(session: Omit<WorkoutSession, 'sets'>): Promise<void> {
  await authFetch('/users/me/workout-sessions', {
    method: 'POST',
    body: JSON.stringify(session),
  });
}

export async function apiDeleteWorkoutSession(id: string): Promise<void> {
  await authFetch(`/users/me/workout-sessions/${id}`, { method: 'DELETE' });
}

export async function apiUpsertWorkoutSet(set: WorkoutSet): Promise<void> {
  await authFetch('/users/me/workout-sets', {
    method: 'POST',
    body: JSON.stringify(set),
  });
}

export async function apiDeleteWorkoutSet(id: string): Promise<void> {
  await authFetch(`/users/me/workout-sets/${id}`, { method: 'DELETE' });
}
