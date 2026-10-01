/**
 * Today Tab — 今日紀錄主畫面
 * 功能：體重記錄、體態照片、今日統計
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeightInputSheet, WeightInputSheetRef } from '../../src/components/tracking/WeightInputSheet';
import { PhotoGallery } from '../../src/components/tracking/PhotoGallery';
import { TodaySummaryCard } from '../../src/components/tracking/TodaySummaryCard';
import { Card } from '../../src/components/common/Card';
import { ThemedText } from '../../src/components/common/ThemedText';
import { useTimeBasedTheme } from '../../src/stores/themeStore';
import { useUserStore } from '../../src/stores/userStore';
import {
  getWeightLogByDate,
  upsertWeightLog,
  toLocalDateString,
  getAllWeightDates,
} from '../../src/db/weightRepository';
import {
  getPhotosByDate,
  captureAndSavePhoto,
  pickAndSavePhoto,
  deletePhoto,
} from '../../src/db/photoRepository';
import { WeightLog, PhotoLog } from '../../src/types';
import { Spacing } from '../../src/constants/theme';
import { AIFloatingChat } from '../../src/components/ai/AIFloatingChat';
import { WorkoutSummaryCard } from '../../src/components/workout/WorkoutSummaryCard';
import { WorkoutSessionSheet, WorkoutSessionSheetRef } from '../../src/components/workout/WorkoutSessionSheet';
import { PhotoComparisonView, PhotoComparisonViewRef } from '../../src/components/tracking/PhotoComparisonView';
import { useWorkoutStore } from '../../src/stores/workoutStore';

// ─────────────────────────────────────────────
// 日期格式化
// ─────────────────────────────────────────────

const formatDate = (dateStr: string): string => {
  return dateStr.replace(/-/g, '/');
};

const TODAY = toLocalDateString();

// ─────────────────────────────────────────────
// 連續天數計算
// ─────────────────────────────────────────────

function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...dates].sort().reverse();
  let streak = 0;
  let expected = toLocalDateString(new Date());
  for (const d of sorted) {
    if (d === expected) {
      streak++;
      const prev = new Date(expected + 'T00:00:00');
      prev.setDate(prev.getDate() - 1);
      expected = toLocalDateString(prev);
    } else break;
  }
  return streak;
}

// ─────────────────────────────────────────────
// 主畫面
// ─────────────────────────────────────────────

export default function TodayScreen() {
  const theme = useTimeBasedTheme();
  const { profile } = useUserStore();
  const sheetRef = useRef<WeightInputSheetRef>(null);
  const workoutSheetRef = useRef<WorkoutSessionSheetRef>(null);
  const comparisonRef = useRef<PhotoComparisonViewRef>(null);
  const todaySession = useWorkoutStore((s) => s.todaySession);
  const loadTodaySession = useWorkoutStore((s) => s.loadTodaySession);

  const [todayLog, setTodayLog] = useState<WeightLog | null>(null);
  const [photos, setPhotos] = useState<PhotoLog[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [log, photoList, allDates] = await Promise.all([
      getWeightLogByDate(TODAY),
      getPhotosByDate(TODAY),
      getAllWeightDates(),
    ]);
    setTodayLog(log);
    setPhotos(photoList);
    setStreakDays(calcStreak(allDates));
    await loadTodaySession();
  }, [loadTodaySession]);

  // 每次畫面聚焦時刷新
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSaveWeight = async (weight: number) => {
    await upsertWeightLog(TODAY, weight);
    await loadData();
  };

  const handleAddPhoto = async () => {
    const showPhotoError = (error: unknown) => {
      const message = error instanceof Error ? error.message : '請稍後再試';
      if (message.includes('權限')) {
        Alert.alert('需要權限', `${message}，請到系統設定開啟後再試。`, [
          { text: '取消', style: 'cancel' },
          { text: '前往設定', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      Alert.alert('無法新增照片', message);
    };

    Alert.alert('新增體態照片', '選擇照片來源', [
      { text: '取消', style: 'cancel' },
      {
        text: '拍照',
        onPress: async () => {
          try {
            const saved = await captureAndSavePhoto(TODAY);
            if (saved) await loadData();
          } catch (e) {
            showPhotoError(e);
          }
        },
      },
      {
        text: '從相簿選取',
        onPress: async () => {
          try {
            const saved = await pickAndSavePhoto(TODAY);
            if (saved) await loadData();
          } catch (e) {
            showPhotoError(e);
          }
        },
      },
    ]);
  };

  const handleDeletePhoto = async (photoId: string) => {
    await deletePhoto(photoId);
    await loadData();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        <View>
          {profile.nickname ? (
            <ThemedText variant="label" color="secondary">
              你好，{profile.nickname}
            </ThemedText>
          ) : (
            <ThemedText variant="label" color="secondary">今日</ThemedText>
          )}
          <ThemedText variant="title" bold>
            {formatDate(TODAY)}
          </ThemedText>
        </View>
        <View
          style={[styles.streakBadge, { backgroundColor: theme.warning + '22', borderColor: theme.warning }]}
        >
          <Text style={{ fontSize: 16 }}>🔥</Text>
          <ThemedText variant="caption" bold style={{ color: theme.warning }}>
            {streakDays}天
          </ThemedText>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* 今日統計 */}
        <TodaySummaryCard todayLog={todayLog} profile={profile} streakDays={streakDays} />

        {/* 訓練記錄卡 */}
        <WorkoutSummaryCard
          session={todaySession}
          onPress={() => workoutSheetRef.current?.open(todaySession)}
        />

        {/* 體重記錄卡 */}
        <Card variant="default" padding="lg">
          <View style={styles.sectionHeader}>
            <ThemedText variant="label" color="secondary">體重記錄</ThemedText>
            {todayLog && (
              <TouchableOpacity onPress={() => sheetRef.current?.open()}>
                <ThemedText variant="caption" style={{ color: theme.primary }}>
                  編輯
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>

          {todayLog ? (
            <View style={styles.weightDisplay}>
              <Text style={[styles.weightValue, { color: theme.textPrimary }]}>
                {todayLog.weight.toFixed(1)}
              </Text>
              <ThemedText variant="subtitle" color="secondary">kg</ThemedText>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addWeightBtn, { borderColor: theme.primary, backgroundColor: theme.primary + '10' }]}
              onPress={() => sheetRef.current?.open()}
            >
              <Text style={{ fontSize: 28 }}>⚖️</Text>
              <ThemedText variant="body" style={{ color: theme.primary }} bold>
                記錄今日體重
              </ThemedText>
            </TouchableOpacity>
          )}
        </Card>

        {/* 體態照片卡 */}
        <Card variant="default" padding="lg">
          <View style={[styles.sectionHeader, { marginBottom: Spacing.sm }]}>
            <ThemedText variant="label" color="secondary">體態照片</ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <TouchableOpacity onPress={() => comparisonRef.current?.open()}>
                <ThemedText variant="caption" style={{ color: theme.primary }}>對比</ThemedText>
              </TouchableOpacity>
              <ThemedText variant="caption" color="tertiary">
                {photos.length > 0 ? `${photos.length} 張` : '尚無照片'}
              </ThemedText>
            </View>
          </View>
          <PhotoGallery
            photos={photos}
            onDelete={handleDeletePhoto}
            onAddPhoto={handleAddPhoto}
          />
        </Card>

        {/* 底部間距（讓內容不被 Tab Bar 遮住） */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 體重輸入 BottomSheet */}
      <WeightInputSheet
        ref={sheetRef}
        initialWeight={todayLog?.weight}
        onSave={handleSaveWeight}
      />

      {/* 訓練記錄 BottomSheet */}
      <WorkoutSessionSheet
        ref={workoutSheetRef}
        onSessionComplete={loadData}
      />

      {/* 進度照片對比 BottomSheet */}
      <PhotoComparisonView ref={comparisonRef} />

      {/* AI 截圖解析 FAB */}
      <AIFloatingChat />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 9999,
    borderWidth: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  weightDisplay: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  weightValue: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
  },
  addWeightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
});
