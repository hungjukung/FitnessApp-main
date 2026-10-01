import { create } from 'zustand';
import { randomUUID as uuidv4 } from 'expo-crypto';
import { WorkoutSession, WorkoutSet, Exercise } from '../types';
import {
  createSession,
  updateSession,
  deleteSession,
  upsertSet,
  deleteSet,
  getSessionByDate,
} from '../db/workoutRepository';
import {
  apiUpsertWorkoutSession,
  apiUpsertWorkoutSet,
  apiDeleteWorkoutSet,
  apiDeleteWorkoutSession,
} from '../services/api/workoutApi';
import { toLocalDateString } from '../db/weightRepository';

interface WorkoutStoreState {
  todaySession: WorkoutSession | null;
  isLoading: boolean;

  loadTodaySession: () => Promise<void>;
  startSession: () => Promise<WorkoutSession>;
  addSetsForExercise: (sessionId: string, exercise: Exercise, count?: number) => Promise<void>;
  upsertSet: (set: WorkoutSet) => Promise<void>;
  removeSet: (setId: string, sessionId: string) => Promise<void>;
  completeSession: (sessionId: string) => Promise<void>;
  deleteCurrentSession: (sessionId: string) => Promise<void>;
  /** 一句話記錄確認後，把草稿的組數一次加進今天的訓練（沒有就先建立） */
  addDraftEntries: (entries: DraftEntryInput[]) => Promise<WorkoutSession>;
  refresh: () => Promise<void>;
}

/** 與 modules/workout/quickLog 的草稿結構相容；duration 單位為秒 */
export interface DraftEntryInput {
  exerciseId: string;
  exerciseName: string;
  sets: Array<{ weight?: number; reps?: number; duration?: number }>;
}

export const useWorkoutStore = create<WorkoutStoreState>((set, get) => ({
  todaySession: null,
  isLoading: false,

  loadTodaySession: async () => {
    set({ isLoading: true });
    try {
      const today = toLocalDateString();
      const session = await getSessionByDate(today);
      set({ todaySession: session });
    } finally {
      set({ isLoading: false });
    }
  },

  startSession: async () => {
    const today = toLocalDateString();
    const now = Date.now();
    const newSession: WorkoutSession = {
      id: uuidv4(),
      date: today,
      startedAt: now,
      sets: [],
      createdAt: now,
      updatedAt: now,
    };

    await createSession(newSession);
    apiUpsertWorkoutSession(newSession).catch(() => {});
    set({ todaySession: newSession });
    return newSession;
  },

  addSetsForExercise: async (sessionId, exercise, count = 1) => {
    const { todaySession } = get();
    if (!todaySession) return;

    const existingSetsForExercise = todaySession.sets.filter(
      (s) => s.exerciseId === exercise.id
    );
    const startSetNumber = existingSetsForExercise.length + 1;

    const lastSet = existingSetsForExercise[existingSetsForExercise.length - 1];
    const newSets: WorkoutSet[] = [];

    for (let i = 0; i < count; i++) {
      const newSet: WorkoutSet = {
        id: uuidv4(),
        sessionId,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        setNumber: startSetNumber + i,
        reps: lastSet?.reps,
        weight: lastSet?.weight,
        createdAt: Date.now(),
      };
      newSets.push(newSet);
      await upsertSet(newSet);
      apiUpsertWorkoutSet(newSet).catch(() => {});
    }

    const updatedSession: WorkoutSession = {
      ...todaySession,
      sets: [...todaySession.sets, ...newSets],
      updatedAt: Date.now(),
    };
    set({ todaySession: updatedSession });
  },

  upsertSet: async (updatedSet) => {
    await upsertSet(updatedSet);
    apiUpsertWorkoutSet(updatedSet).catch(() => {});

    const { todaySession } = get();
    if (!todaySession) return;

    const sets = todaySession.sets.map((s) =>
      s.id === updatedSet.id ? updatedSet : s
    );
    set({ todaySession: { ...todaySession, sets, updatedAt: Date.now() } });
  },

  removeSet: async (setId, sessionId) => {
    await deleteSet(setId);
    apiDeleteWorkoutSet(setId).catch(() => {});

    const { todaySession } = get();
    if (!todaySession || todaySession.id !== sessionId) return;

    set({
      todaySession: {
        ...todaySession,
        sets: todaySession.sets.filter((s) => s.id !== setId),
        updatedAt: Date.now(),
      },
    });
  },

  completeSession: async (sessionId) => {
    const now = Date.now();
    await updateSession(sessionId, { completedAt: now });

    const { todaySession } = get();
    if (!todaySession || todaySession.id !== sessionId) return;

    const completed = { ...todaySession, completedAt: now, updatedAt: now };
    apiUpsertWorkoutSession(completed).catch(() => {});
    set({ todaySession: completed });
  },

  deleteCurrentSession: async (sessionId) => {
    await deleteSession(sessionId);
    apiDeleteWorkoutSession(sessionId).catch(() => {});
    set({ todaySession: null });
  },

  addDraftEntries: async (entries) => {
    // 今天的 session 可能還沒載入：先查資料庫，避免同一天建立兩個 session
    let session = get().todaySession ?? (await getSessionByDate(toLocalDateString()));
    if (!session) session = await get().startSession();

    const lastSetNumber = new Map<string, number>();
    for (const s of session.sets) {
      lastSetNumber.set(s.exerciseId, Math.max(lastSetNumber.get(s.exerciseId) ?? 0, s.setNumber));
    }

    const now = Date.now();
    const newSets: WorkoutSet[] = [];
    for (const entry of entries) {
      for (const draftSet of entry.sets) {
        const setNumber = (lastSetNumber.get(entry.exerciseId) ?? 0) + 1;
        lastSetNumber.set(entry.exerciseId, setNumber);
        const newSet: WorkoutSet = {
          id: uuidv4(),
          sessionId: session.id,
          exerciseId: entry.exerciseId,
          exerciseName: entry.exerciseName,
          setNumber,
          reps: draftSet.reps,
          weight: draftSet.weight,
          duration: draftSet.duration,
          createdAt: now + newSets.length,
        };
        await upsertSet(newSet);
        apiUpsertWorkoutSet(newSet).catch(() => {});
        newSets.push(newSet);
      }
    }

    const updated: WorkoutSession = {
      ...session,
      sets: [...session.sets, ...newSets],
      updatedAt: Date.now(),
    };
    set({ todaySession: updated });
    return updated;
  },

  refresh: async () => {
    await get().loadTodaySession();
  },
}));
