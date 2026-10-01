import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
  useState,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { randomUUID as uuidv4 } from 'expo-crypto';
import { WorkoutSession, WorkoutSet, Exercise } from '../../types';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { Spacing, Radius, Typography, OkabeIto } from '../../constants/theme';
import { SetInputRow } from './SetInputRow';
import { ExercisePickerSheet, ExercisePickerSheetRef } from './ExercisePickerSheet';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface WorkoutSessionSheetRef {
  open: (session?: WorkoutSession | null) => void;
  close: () => void;
}

interface WorkoutSessionSheetProps {
  onSessionComplete?: () => void;
}

export const WorkoutSessionSheet = forwardRef<WorkoutSessionSheetRef, WorkoutSessionSheetProps>(
  ({ onSessionComplete }, ref) => {
    const theme = useTimeBasedTheme();
    const sheetRef = useRef<BottomSheet>(null);
    const pickerRef = useRef<ExercisePickerSheetRef>(null);
    const startSession = useWorkoutStore((s) => s.startSession);
    const upsertSet = useWorkoutStore((s) => s.upsertSet);
    const removeSet = useWorkoutStore((s) => s.removeSet);
    const completeSession = useWorkoutStore((s) => s.completeSession);
    const deleteCurrentSession = useWorkoutStore((s) => s.deleteCurrentSession);

    const [localSession, setLocalSession] = useState<WorkoutSession | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const open = useCallback(async (session?: WorkoutSession | null) => {
      if (session) {
        setLocalSession(session);
      } else {
        // Start a new session
        const newSession = await startSession();
        setLocalSession(newSession);
      }
      sheetRef.current?.expand();
    }, [startSession]);

    const close = useCallback(() => {
      sheetRef.current?.close();
    }, []);

    useImperativeHandle(ref, () => ({ open, close }));

    const handleAddExercise = useCallback(() => {
      pickerRef.current?.open();
    }, []);

    const handleExerciseSelected = useCallback(async (exercise: Exercise) => {
      if (!localSession) return;

      const existingSets = localSession.sets.filter((s) => s.exerciseId === exercise.id);
      const lastSet = existingSets[existingSets.length - 1];
      const setNumber = existingSets.length + 1;

      const newSet: WorkoutSet = {
        id: uuidv4(),
        sessionId: localSession.id,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        setNumber,
        reps: lastSet?.reps,
        weight: lastSet?.weight,
        createdAt: Date.now(),
      };

      await upsertSet(newSet);
      setLocalSession((prev) =>
        prev ? { ...prev, sets: [...prev.sets, newSet], updatedAt: Date.now() } : prev
      );
    }, [localSession, upsertSet]);

    const handleSetChange = useCallback(async (updated: WorkoutSet) => {
      await upsertSet(updated);
      setLocalSession((prev) =>
        prev
          ? { ...prev, sets: prev.sets.map((s) => (s.id === updated.id ? updated : s)) }
          : prev
      );
    }, [upsertSet]);

    const handleDeleteSet = useCallback(async (setId: string) => {
      if (!localSession) return;
      await removeSet(setId, localSession.id);
      setLocalSession((prev) =>
        prev ? { ...prev, sets: prev.sets.filter((s) => s.id !== setId) } : prev
      );
    }, [localSession, removeSet]);

    const handleAddSetForExercise = useCallback(async (exercise: Exercise) => {
      if (!localSession) return;
      const existingSets = localSession.sets.filter((s) => s.exerciseId === exercise.id);
      const lastSet = existingSets[existingSets.length - 1];
      const newSet: WorkoutSet = {
        id: uuidv4(),
        sessionId: localSession.id,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        setNumber: existingSets.length + 1,
        reps: lastSet?.reps,
        weight: lastSet?.weight,
        createdAt: Date.now(),
      };
      await upsertSet(newSet);
      setLocalSession((prev) =>
        prev ? { ...prev, sets: [...prev.sets, newSet] } : prev
      );
    }, [localSession, upsertSet]);

    const handleComplete = useCallback(async () => {
      if (!localSession) return;
      if (localSession.sets.length === 0) {
        Alert.alert('尚未加入訓練', '請至少加入一個動作和一組紀錄');
        return;
      }
      setIsSaving(true);
      try {
        await completeSession(localSession.id);
        onSessionComplete?.();
        close();
      } finally {
        setIsSaving(false);
      }
    }, [localSession, completeSession, onSessionComplete, close]);

    const handleDelete = useCallback(() => {
      if (!localSession) return;
      Alert.alert('刪除訓練', '確定要刪除今日的訓練紀錄嗎？', [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            await deleteCurrentSession(localSession.id);
            setLocalSession(null);
            onSessionComplete?.();
            close();
          },
        },
      ]);
    }, [localSession, deleteCurrentSession, onSessionComplete, close]);

    // Group sets by exercise
    const exerciseGroups = localSession
      ? (() => {
          const seen = new Set<string>();
          const order: string[] = [];
          for (const s of localSession.sets) {
            if (!seen.has(s.exerciseId)) {
              seen.add(s.exerciseId);
              order.push(s.exerciseId);
            }
          }
          return order.map((exerciseId) => ({
            exerciseId,
            exerciseName: localSession.sets.find((s) => s.exerciseId === exerciseId)!.exerciseName,
            sets: localSession.sets.filter((s) => s.exerciseId === exerciseId),
          }));
        })()
      : [];

    const snapPoint = Math.round(SCREEN_HEIGHT * 0.9);
    const isCompleted = !!localSession?.completedAt;

    return (
      <>
        <BottomSheet
          ref={sheetRef}
          index={-1}
          snapPoints={[snapPoint]}
          enablePanDownToClose={isCompleted}
          backgroundStyle={{
            backgroundColor: theme.sheetBackground,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
          handleIndicatorStyle={{ backgroundColor: theme.sheetHandle, width: 40, height: 5 }}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
        >
          <BottomSheetView style={[styles.container, { backgroundColor: theme.sheetBackground }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {localSession?.name ?? '訓練記錄'}
              </Text>
              <View style={styles.headerActions}>
                {!isCompleted && (
                  <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
                    <Text style={{ color: theme.error, fontSize: Typography.size.sm }}>刪除</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={close} style={styles.closeBtn}>
                  <Text style={{ fontSize: 20, color: theme.textTertiary }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Exercise list */}
            <BottomSheetScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {exerciseGroups.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 40, textAlign: 'center' }}>🏋️</Text>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    點擊「新增動作」開始記錄訓練
                  </Text>
                </View>
              )}

              {exerciseGroups.map((group) => (
                <View key={group.exerciseId} style={styles.exerciseBlock}>
                  <Text style={[styles.exerciseName, { color: theme.textPrimary }]}>
                    {group.exerciseName}
                  </Text>

                  {group.sets.map((set) => (
                    <SetInputRow
                      key={set.id}
                      set={set}
                      onChange={handleSetChange}
                      onDelete={() => handleDeleteSet(set.id)}
                    />
                  ))}

                  {!isCompleted && (
                    <TouchableOpacity
                      onPress={() => handleAddSetForExercise({ id: group.exerciseId, name: group.exerciseName, muscleGroups: [], category: 'compound' })}
                      style={[styles.addSetBtn, { borderColor: theme.border }]}
                    >
                      <Text style={[styles.addSetText, { color: theme.textSecondary }]}>
                        + 新增一組
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <View style={styles.bottomPad} />
            </BottomSheetScrollView>

            {/* Bottom actions */}
            {!isCompleted && (
              <View style={[styles.footer, { borderTopColor: theme.separator, backgroundColor: theme.sheetBackground }]}>
                <TouchableOpacity
                  onPress={handleAddExercise}
                  style={[styles.addExerciseBtn, { borderColor: theme.primary }]}
                >
                  <Text style={[styles.addExerciseText, { color: theme.primary }]}>
                    + 新增動作
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleComplete}
                  disabled={isSaving}
                  style={[styles.completeBtn, { backgroundColor: OkabeIto.green }]}
                >
                  <Text style={styles.completeBtnText}>
                    {isSaving ? '儲存中…' : '✓ 完成訓練'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </BottomSheetView>
        </BottomSheet>

        <ExercisePickerSheet ref={pickerRef} onSelect={handleExerciseSelected} />
      </>
    );
  }
);

WorkoutSessionSheet.displayName = 'WorkoutSessionSheet';

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  deleteBtn: { padding: Spacing.xs },
  closeBtn: { padding: Spacing.xs },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  emptyText: { fontSize: Typography.size.md, textAlign: 'center' },
  exerciseBlock: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  exerciseName: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    marginBottom: Spacing.sm,
  },
  addSetBtn: {
    marginTop: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addSetText: { fontSize: Typography.size.sm },
  bottomPad: { height: Spacing.xxl },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addExerciseBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  addExerciseText: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
  completeBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  completeBtnText: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold, color: '#fff' },
});
