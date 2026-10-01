/**
 * Cloud Sync — 從後端拉取資料合併至本地
 * 策略：Cloud wins（相同 key 以後端資料為準）
 * 僅在登入/App 啟動時呼叫一次，不阻塞 UI
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from '../db/database';
import { useUserStore } from '../stores/userStore';
import { apiFetchProfile } from './api/profileApi';
import { apiFetchWeightLogs } from './api/weightApi';
import { apiFetchPhotoMeta, apiFetchPhotoData } from './api/photoApi';
import { apiFetchWorkoutSessions } from './api/workoutApi';

export async function pullFromCloud(userId: string): Promise<void> {
  await Promise.allSettled([
    pullProfile(userId),
    pullWeightLogs(),
    pullPhotos(userId),
    pullWorkoutSessions(),
  ]);
}

// ─────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────

async function pullProfile(userId: string): Promise<void> {
  const remote = await apiFetchProfile();
  if (!remote) return;

  const key = `user-profile-v2-${userId}`;
  const saved = await AsyncStorage.getItem(key);
  const local = saved ? JSON.parse(saved) : { profile: { updatedAt: 0 }, isOnboardingCompleted: false };

  if (remote.updatedAt <= (local.profile?.updatedAt ?? 0)) return;

  const merged = {
    ...local.profile,
    authUserId:      userId,
    nickname:        remote.nickname        ?? local.profile.nickname,
    gender:          remote.gender          ?? local.profile.gender,
    age:             remote.age             ?? local.profile.age,
    heightCm:        remote.heightCm        ?? local.profile.heightCm,
    initialWeightKg: remote.initialWeightKg ?? local.profile.initialWeightKg,
    goalWeightKg:    remote.goalWeightKg    ?? local.profile.goalWeightKg,
    goal:            remote.goal            ?? local.profile.goal,
    experienceLevel: remote.experienceLevel ?? local.profile.experienceLevel,
    aiConsentGiven:  remote.aiConsentGiven,
    // 裝置本機偏好，刻意不從雲端還原：換新裝置時一律從「不上傳」開始，
    // 由使用者在該裝置上重新決定。
    photoCloudSyncEnabled: local.profile?.photoCloudSyncEnabled ?? false,
    updatedAt:       remote.updatedAt,
  };

  const isOnboardingCompleted = remote.onboardingCompleted || local.isOnboardingCompleted;

  await AsyncStorage.setItem(key, JSON.stringify({ profile: merged, isOnboardingCompleted }));

  // Update in-memory store directly (bypasses the cloud sync trigger in updateProfile)
  useUserStore.setState({ profile: merged, isOnboardingCompleted });
}

// ─────────────────────────────────────────────
// Weight logs
// ─────────────────────────────────────────────

async function pullWeightLogs(): Promise<void> {
  const remote = await apiFetchWeightLogs();
  if (!remote.length) return;

  const db = getDatabase();
  await db.withTransactionAsync(async () => {
    for (const log of remote) {
      await db.runAsync(
        `INSERT INTO weight_logs (date, weight, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           weight     = excluded.weight,
           updated_at = excluded.updated_at;`,
        [log.date, log.weight, log.createdAt, log.updatedAt]
      );
    }
  });
}

// ─────────────────────────────────────────────
// Workout sessions
// ─────────────────────────────────────────────

async function pullWorkoutSessions(): Promise<void> {
  const remote = await apiFetchWorkoutSessions();
  if (!remote.length) return;

  const db = getDatabase();
  await db.withTransactionAsync(async () => {
    for (const session of remote) {
      await db.runAsync(
        `INSERT INTO workout_sessions (id, date, name, started_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           completed_at = excluded.completed_at,
           updated_at = excluded.updated_at;`,
        [session.id, session.date, session.name ?? null, session.startedAt, session.completedAt ?? null, session.createdAt, session.updatedAt]
      );

      for (const set of session.sets) {
        await db.runAsync(
          `INSERT INTO workout_sets (id, session_id, exercise_id, exercise_name, set_number, reps, weight, duration, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             reps = excluded.reps,
             weight = excluded.weight,
             duration = excluded.duration;`,
          [set.id, set.sessionId, set.exerciseId, set.exerciseName, set.setNumber, set.reps ?? null, set.weight ?? null, set.duration ?? null, set.createdAt]
        );
      }
    }
  });
}

// ─────────────────────────────────────────────
// Photos
// ─────────────────────────────────────────────

async function pullPhotos(userId: string): Promise<void> {
  const remoteMeta = await apiFetchPhotoMeta();
  if (!remoteMeta.length) return;

  const photoDir = `${FileSystem.documentDirectory}body-photos/${userId}/`;
  const dirInfo = await FileSystem.getInfoAsync(photoDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(photoDir, { intermediates: true });
  }

  const db = getDatabase();

  for (const photo of remoteMeta) {
    const destUri = `${photoDir}${photo.fileName}`;
    const fileInfo = await FileSystem.getInfoAsync(destUri);

    if (!fileInfo.exists) {
      try {
        const base64 = await apiFetchPhotoData(photo.id);
        await FileSystem.writeAsStringAsync(destUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch {
        continue; // skip this photo if download fails, try next time
      }
    }

    // Upsert metadata into local SQLite
    await db.runAsync(
      `INSERT INTO photo_logs (id, date, file_uri, file_name, sort_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING;`,
      [photo.id, photo.date, destUri, photo.fileName, photo.sortIndex, photo.createdAt]
    );
  }
}
