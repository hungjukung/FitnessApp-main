/**
 * Calendar Tab — 月曆總覽
 * 功能：月曆標記、點選日期展開 BottomSheet（80% 高度）
 */
import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Calendar, DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { PhotoGallery } from '../../src/components/tracking/PhotoGallery';
import { ThemedText } from '../../src/components/common/ThemedText';
import { Card } from '../../src/components/common/Card';
import { useTimeBasedTheme } from '../../src/stores/themeStore';
import { WeightInputSheet, WeightInputSheetRef } from '../../src/components/tracking/WeightInputSheet';
import { PhotoComparisonView, PhotoComparisonViewRef } from '../../src/components/tracking/PhotoComparisonView';
import {
  getWeightLogByDate,
  getAllWeightDates,
  toLocalDateString,
  upsertWeightLog,
} from '../../src/db/weightRepository';
import { getPhotosByDate, deletePhoto, getAllPhotoDates } from '../../src/db/photoRepository';
import { getSessionByDate, getWorkoutDates } from '../../src/db/workoutRepository';
import { WeightLog, PhotoLog, WorkoutSession } from '../../src/types';
import { Spacing, OkabeIto } from '../../src/constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SNAP_POINT = Math.round(SCREEN_HEIGHT * 0.8);

const TODAY = toLocalDateString();

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

export default function CalendarScreen() {
  const theme = useTimeBasedTheme();
  const isDark = theme.background === '#000000';
  const sheetRef = useRef<BottomSheet>(null);
  const inputSheetRef = useRef<WeightInputSheetRef>(null);
  const comparisonRef = useRef<PhotoComparisonViewRef>(null);

  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayLog, setDayLog] = useState<WeightLog | null>(null);
  const [dayPhotos, setDayPhotos] = useState<PhotoLog[]>([]);
  const [dayWorkout, setDayWorkout] = useState<WorkoutSession | null>(null);

  // 載入所有有記錄的日期
  const loadMarkedDates = useCallback(async () => {
    const [weightDates, photoDates, workoutDateList] = await Promise.all([
      getAllWeightDates(),
      getAllPhotoDates(),
      getWorkoutDates(),
    ]);
    const weightSet = new Set(weightDates);
    const photoSet = new Set(photoDates);
    const workoutSet = new Set(workoutDateList);
    const dates = Array.from(new Set([...weightDates, ...photoDates, ...workoutDateList]));
    const marks: Record<string, any> = {};
    for (const d of dates) {
      marks[d] = {
        dots: [
          ...(weightSet.has(d) ? [{ key: 'weight', color: theme.primary }] : []),
          ...(photoSet.has(d) ? [{ key: 'photo', color: theme.success }] : []),
          ...(workoutSet.has(d) ? [{ key: 'workout', color: OkabeIto.orange }] : []),
        ],
        selected: d === selectedDate,
        selectedColor: d === selectedDate ? theme.primary : undefined,
      };
    }
    if (selectedDate && !marks[selectedDate]) {
      marks[selectedDate] = { selected: true, selectedColor: theme.primary };
    }
    setMarkedDates(marks);
  }, [selectedDate, theme.primary, theme.success]);

  useFocusEffect(
    useCallback(() => {
      loadMarkedDates();
    }, [loadMarkedDates])
  );

  const handleDayPress = async (day: DateData) => {
    const dateStr = day.dateString;
    if (dateStr > TODAY) {
      Alert.alert('尚未到達的日期', '未來日期不可補登。');
      return;
    }
    setSelectedDate(dateStr);

    const [log, photos, workout] = await Promise.all([
      getWeightLogByDate(dateStr),
      getPhotosByDate(dateStr),
      getSessionByDate(dateStr),
    ]);
    setDayLog(log);
    setDayPhotos(photos);
    setDayWorkout(workout);

    sheetRef.current?.expand();

    // 更新選中狀態
    setMarkedDates((prev) => {
      const updated = { ...prev };
      // 清除舊選中
      for (const k of Object.keys(updated)) {
        if (updated[k].selected && k !== dateStr) {
          updated[k] = { ...updated[k], selected: false, selectedColor: undefined };
        }
      }
      updated[dateStr] = {
        ...(updated[dateStr] ?? {}),
        selected: true,
        selectedColor: theme.primary,
      };
      return updated;
    });
  };

  const handleDeletePhoto = async (photoId: string) => {
    await deletePhoto(photoId);
    if (selectedDate) {
      const photos = await getPhotosByDate(selectedDate);
      setDayPhotos(photos);
    }
  };

  const handleSaveWeight = async (weight: number) => {
    if (!selectedDate) return;
    await upsertWeightLog(selectedDate, weight);
    const log = await getWeightLogByDate(selectedDate);
    setDayLog(log);
    loadMarkedDates();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        <ThemedText variant="title" bold>日曆</ThemedText>
        <ThemedText variant="caption" color="tertiary">點選日期查看記錄</ThemedText>
      </View>

      {/* 月曆 */}
      <Calendar
        current={TODAY}
        maxDate={TODAY}
        onDayPress={handleDayPress}
        markedDates={markedDates}
        markingType="multi-dot"
        theme={{
          backgroundColor: theme.background,
          calendarBackground: theme.background,
          textSectionTitleColor: theme.textSecondary,
          selectedDayBackgroundColor: theme.primary,
          selectedDayTextColor: '#FFFFFF',
          todayTextColor: theme.primary,
          todayBackgroundColor: theme.primary + '18',
          dayTextColor: theme.textPrimary,
          textDisabledColor: theme.disabled,
          dotColor: theme.primary,
          selectedDotColor: '#FFFFFF',
          arrowColor: theme.primary,
          disabledArrowColor: theme.disabled,
          monthTextColor: theme.textPrimary,
          indicatorColor: theme.primary,
          textDayFontWeight: '400',
          textMonthFontWeight: '700',
          textDayHeaderFontWeight: '600',
          textDayFontSize: 15,
          textMonthFontSize: 17,
          textDayHeaderFontSize: 12,
        }}
        style={styles.calendar}
      />

      {/* 日期詳情 BottomSheet */}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={[SNAP_POINT]}
        enablePanDownToClose
        backgroundStyle={{
          backgroundColor: theme.sheetBackground,
          borderTopLeftRadius: 50,
          borderTopRightRadius: 50,
        }}
        handleIndicatorStyle={{
          backgroundColor: theme.sheetHandle,
          width: 40,
          height: 5,
        }}
      >
        <BottomSheetView style={styles.sheetContent}>
          {selectedDate && (
            <>
              <ThemedText variant="label" color="secondary" style={{ marginBottom: 4 }}>
                {selectedDate === TODAY ? '今日' : '歷史記錄'}
              </ThemedText>
              <ThemedText variant="subtitle" bold style={{ marginBottom: Spacing.lg }}>
                {formatDateLabel(selectedDate)}
              </ThemedText>

              {/* 體重 */}
              <Card variant="outlined" padding="md" style={{ marginBottom: Spacing.md }}>
                <View style={[styles.sheetRow, { justifyContent: 'space-between' }]}>
                  <View style={styles.sheetRow}>
                    <Text style={{ fontSize: 24 }}>⚖️</Text>
                    <View>
                      <ThemedText variant="label" color="secondary">體重</ThemedText>
                      <ThemedText variant="subtitle" bold style={{ marginTop: 2 }}>
                        {dayLog ? `${dayLog.weight.toFixed(1)} kg` : '未記錄'}
                      </ThemedText>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => inputSheetRef.current?.open()}>
                    <ThemedText variant="body" style={{ color: theme.primary }} bold>
                      {dayLog ? '編輯' : '新增'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </Card>

              {/* 訓練 */}
              {dayWorkout && (
                <Card variant="outlined" padding="md" style={{ marginBottom: Spacing.md }}>
                  <View style={styles.sheetRow}>
                    <Text style={{ fontSize: 24 }}>💪</Text>
                    <View style={{ flex: 1 }}>
                      <ThemedText variant="label" color="secondary">訓練記錄</ThemedText>
                      <View style={[styles.sheetRow, { marginTop: 4, gap: Spacing.sm }]}>
                        <ThemedText variant="caption" color="secondary">
                          {new Set(dayWorkout.sets.map(s => s.exerciseId)).size} 個動作
                        </ThemedText>
                        <ThemedText variant="caption" color="tertiary">·</ThemedText>
                        <ThemedText variant="caption" color="secondary">
                          {dayWorkout.sets.length} 組
                        </ThemedText>
                        <ThemedText variant="caption" color="tertiary">·</ThemedText>
                        <ThemedText variant="caption" color="secondary">
                          {Math.round(dayWorkout.sets.reduce((s, x) => s + (x.weight ?? 0) * (x.reps ?? 1), 0)).toLocaleString()} kg
                        </ThemedText>
                      </View>
                    </View>
                    {dayWorkout.completedAt && (
                      <View style={[styles.doneBadge, { backgroundColor: OkabeIto.green + '22' }]}>
                        <ThemedText variant="caption" style={{ color: OkabeIto.green }}>已完成</ThemedText>
                      </View>
                    )}
                  </View>
                </Card>
              )}

              {/* 照片 */}
              <View style={[styles.sheetRow, { justifyContent: 'space-between', marginBottom: Spacing.sm }]}>
                <ThemedText variant="label" color="secondary">
                  體態照片（{dayPhotos.length} 張）
                </ThemedText>
                <TouchableOpacity onPress={() => comparisonRef.current?.open(selectedDate ?? undefined)}>
                  <ThemedText variant="caption" style={{ color: theme.primary }}>對比</ThemedText>
                </TouchableOpacity>
              </View>
              <PhotoGallery photos={dayPhotos} onDelete={handleDeletePhoto} />

              {dayLog === null && dayPhotos.length === 0 && !dayWorkout && (
                <View style={styles.emptyDay}>
                  <Text style={{ fontSize: 40 }}>📭</Text>
                  <ThemedText variant="body" color="tertiary" center>
                    尚無記錄，點此補登
                  </ThemedText>
                </View>
              )}
            </>
          )}
        </BottomSheetView>
      </BottomSheet>

      {/* 體重編輯 BottomSheet */}
      <WeightInputSheet
        ref={inputSheetRef}
        initialWeight={dayLog?.weight}
        onSave={handleSaveWeight}
      />

      {/* 進度照片對比 BottomSheet */}
      <PhotoComparisonView ref={comparisonRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
  },
  calendar: {
    marginHorizontal: Spacing.sm,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyDay: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  doneBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
  },
});
