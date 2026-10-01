/**
 * 數據分析頁
 * 上半部：統計判讀（體重趨勢 × 訓練 × 飲食 × InBody 交叉驗證），不使用 LLM
 * 下半部：原有的體重／訓練量圖表
 */
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SummaryStatsCard } from '../../components/charts/SummaryStatsCard';
import { WeightBarChart } from '../../components/charts/WeightBarChart';
import { WeeklyDeltaLine } from '../../components/charts/WeeklyDeltaLine';
import { WorkoutVolumeChart } from '../../components/charts/WorkoutVolumeChart';
import { Card } from '../../components/common/Card';
import { ThemedText } from '../../components/common/ThemedText';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { useUserStore } from '../../stores/userStore';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import { getWorkoutChartData } from '../workout';
import { toLocalDateString } from '../../db/weightRepository';
import { TimeRange, WorkoutChartPoint } from '../../types';
import { Spacing, Radius } from '../../constants/theme';
import { VerdictCard } from './components/VerdictCard';
import { SignalsCard } from './components/SignalsCard';
import { useInterpretation } from './useInterpretation';
import { Thresholds } from './engine/thresholds';

const WINDOWS: Array<{ days: number; label: string }> = [
  { days: 28, label: '4 週' },
  { days: Thresholds.defaultWindowDays, label: '8 週' },
  { days: 84, label: '12 週' },
];

const TIME_RANGES: Array<{ value: TimeRange; label: string }> = [
  { value: 'week', label: '7 天' },
  { value: 'month', label: '30 天' },
  { value: 'three_months', label: '3 個月' },
];

function Segmented<T extends string | number>({ options, value, onChange }: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTimeBasedTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {options.map((o) => {
        const isActive = o.value === value;
        return (
          <TouchableOpacity
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.segBtn, isActive && { backgroundColor: theme.primary }]}
          >
            <Text style={[styles.segLabel, { color: isActive ? '#fff' : theme.textSecondary }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AnalyticsScreen() {
  const theme = useTimeBasedTheme();
  const { profile } = useUserStore();
  const { timeRange, chartData, summaryStats, isLoading, error, loadAnalytics } = useAnalyticsStore();
  const [windowDays, setWindowDays] = useState<number>(Thresholds.defaultWindowDays);
  const interpretation = useInterpretation(windowDays);
  const [workoutChartData, setWorkoutChartData] = useState<WorkoutChartPoint[]>([]);

  const loadInterpretation = interpretation.load;

  const load = useCallback(() => {
    loadInterpretation();
    loadAnalytics(timeRange, profile.goal);
    // 訓練量圖表：過去 12 週
    const end = toLocalDateString();
    const startDate = new Date(end + 'T00:00:00');
    startDate.setDate(startDate.getDate() - 83);
    getWorkoutChartData(toLocalDateString(startDate), end)
      .then(setWorkoutChartData)
      .catch(() => setWorkoutChartData([]));
  }, [loadInterpretation, timeRange, profile.goal]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const windowOptions = WINDOWS.map((w) => ({ value: w.days, label: w.label }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        <ThemedText variant="title" bold>分析</ThemedText>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 判讀 ── */}
        <View style={styles.sectionHeader}>
          <ThemedText variant="label" color="secondary">觀察窗口</ThemedText>
          <Segmented options={windowOptions} value={windowDays} onChange={setWindowDays} />
        </View>

        {interpretation.isLoading && !interpretation.result ? (
          <Card variant="default" padding="lg">
            <View style={styles.emptyCard}>
              <ActivityIndicator size="small" color={theme.primary} />
              <ThemedText variant="caption" color="secondary">判讀中…</ThemedText>
            </View>
          </Card>
        ) : interpretation.error ? (
          <Card variant="outlined" padding="lg">
            <ThemedText variant="body" color="error" center>{interpretation.error}</ThemedText>
          </Card>
        ) : interpretation.result ? (
          <>
            <VerdictCard interpretation={interpretation.result} />
            <SignalsCard signals={interpretation.result.signals} />
          </>
        ) : null}

        {/* ── 圖表 ── */}
        <View style={[styles.sectionHeader, { marginTop: Spacing.md }]}>
          <ThemedText variant="label" color="secondary">圖表</ThemedText>
          <Segmented options={TIME_RANGES} value={timeRange} onChange={(r) => loadAnalytics(r, profile.goal)} />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <ThemedText variant="body" color="error" center>{error}</ThemedText>
          </View>
        ) : (
          <>
            {summaryStats ? (
              <SummaryStatsCard stats={summaryStats} />
            ) : (
              <Card variant="outlined" padding="lg">
                <View style={styles.emptyCard}>
                  <Text style={{ fontSize: 40 }}>📭</Text>
                  <ThemedText variant="body" color="secondary" center>
                    還沒有足夠的記錄{'\n'}每天記錄體重，圖表就會顯示在這裡
                  </ThemedText>
                </View>
              </Card>
            )}

            <Card variant="default" padding="lg">
              <ThemedText variant="label" color="secondary" style={{ marginBottom: Spacing.md }}>
                體重趨勢
              </ThemedText>
              <WeightBarChart data={chartData} height={200} />
            </Card>

            {timeRange !== 'week' && (
              <Card variant="default" padding="lg">
                <ThemedText variant="label" color="secondary" style={{ marginBottom: Spacing.sm }}>
                  週變化量（kg/週）
                </ThemedText>
                <ThemedText variant="caption" color="tertiary" style={{ marginBottom: Spacing.md }}>
                  負值代表減輕，正值代表增加
                </ThemedText>
                <WeeklyDeltaLine data={chartData} height={160} />
              </Card>
            )}
          </>
        )}

        {workoutChartData.some((p) => p.volume > 0) && (
          <Card variant="default" padding="lg">
            <ThemedText variant="label" color="secondary" style={{ marginBottom: Spacing.sm }}>
              訓練量趨勢
            </ThemedText>
            <ThemedText variant="caption" color="tertiary" style={{ marginBottom: Spacing.md }}>
              每週總訓練量（重量 × 次數）
            </ThemedText>
            <WorkoutVolumeChart data={workoutChartData} height={180} />
          </Card>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    borderWidth: 1,
    padding: 3,
  },
  segBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  segLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyCard: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
  },
});
