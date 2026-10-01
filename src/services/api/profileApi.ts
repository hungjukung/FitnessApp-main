import { authFetch } from './client';
import { UserProfile } from '../../types';

export interface RemoteProfile {
  userId: string;
  nickname?: string;
  gender?: string;
  age?: number;
  heightCm?: number;
  initialWeightKg?: number;
  goalWeightKg?: number;
  goal?: string;
  experienceLevel?: string;
  aiConsentGiven: boolean;
  onboardingCompleted: boolean;
  updatedAt: number;
}

export async function apiFetchProfile(): Promise<RemoteProfile | null> {
  try {
    return await authFetch<RemoteProfile>('/users/me/profile');
  } catch (e: any) {
    if (e?.status === 404) return null;
    throw e;
  }
}

export async function apiSyncProfile(
  profile: UserProfile,
  onboardingCompleted: boolean
): Promise<void> {
  await authFetch('/users/me/profile', {
    method: 'PUT',
    body: JSON.stringify({
      nickname:        profile.nickname,
      gender:          profile.gender,
      age:             profile.age,
      heightCm:        profile.heightCm,
      initialWeightKg: profile.initialWeightKg,
      goalWeightKg:    profile.goalWeightKg,
      goal:            profile.goal,
      experienceLevel: profile.experienceLevel,
      aiConsentGiven:  profile.aiConsentGiven,
      onboardingCompleted,
    }),
  });
}
