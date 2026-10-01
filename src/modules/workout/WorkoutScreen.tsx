import { useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { WorkoutSummaryCard } from '../../components/workout/WorkoutSummaryCard';
import { WorkoutSessionSheet, WorkoutSessionSheetRef } from '../../components/workout/WorkoutSessionSheet';
import { ThemedText } from '../../components/common/ThemedText';
import { Card } from '../../components/common/Card';
import { getSessionsByDateRange } from '../../db/workoutRepository';
import { toLocalDateString } from '../../db/weightRepository';
import { WorkoutSession } from '../../types';
import { Spacing, Typography, OkabeIto } from '../../constants/theme';
import { TrainingMetricsCard } from './TrainingMetricsCard';
import { QuickLogSheet } from './quickLog/QuickLogSheet';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function calcVolume(session: WorkoutSession): number {
  return session.sets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 1), 0);
}

function getUniqueExercises(session: WorkoutSession): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const s of session.sets) {
    if (!seen.has(s.exerciseId)) {
      seen.add(s.exerciseId);
      names.push(s.exerciseName);
    }
  }
  return names;
}

export default function WorkoutScreen() {
  const theme = useTimeBasedTheme();
  const todaySession = useWorkoutStore((s) => s.todaySession);
  const loadTodaySession = useWorkoutStore((s) => s.loadTodaySession);
  const sessionSheetRef = useRef<WorkoutSessionSheetRef>(null);

  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  // 近 30 天（含今天），給訓練指標卡片用
  const [metricSessions, setMetricSessions] = useState<WorkoutSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [quickLogVisible, setQuickLogVisible] = useState(false);

  const today = toLocalDateString();
  const weekStart = (() => {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - 6);
    return toLocalDateString(d);
  })();

  const loadData = useCallback(async () => {
    await loadTodaySession();
    const start = new Date(today + 'T00:00:00');
    start.setDate(start.getDate() - 29);
    try {
      const sessions = await getSessionsByDateRange(toLocalDateString(start), today);
      setMetricSessions(sessions);
      // 最近紀錄：不含今天，最多 10 筆
      setRecentSessions(sessions.filter((s) => s.date !== today).reverse().slice(0, 10));
    } catch {
      setRecentSessions([]);
      setMetricSessions([]);
    }
  }, [loadTodaySession, today]);

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

  const handleSessionDone = useCallback(() => {
    loadData();
  }, [loadData]);

  const handleCardPress = useCallback(() => {
    sessionSheetRef.current?.open(todaySession);
  }, [todaySession]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        <ThemedText variant="title" bold>課表</ThemedText>
        <ThemedText variant="caption" color="secondary">{today.replace(/-/g, '/')}</ThemedText>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        {/* Today workout card */}
        <View style={styles.section}>
          <ThemedText variant="label" color="secondary" style={styles.sectionLabel}>今日訓練</ThemedText>
          <TouchableOpacity
            onPress={() => setQuickLogVisible(true)}
            style={[styles.quickLogBtn, { backgroundColor: theme.surface, borderColor: theme.primary }]}
            accessibilityRole="button"
            accessibilityLabel="一句話記錄"
          >
            <Text style={[styles.quickLogTitle, { color: theme.primary }]}>💬 一句話記錄</Text>
            <Text style={[styles.quickLogHint, { color: theme.textSecondary }]}>
              例如「臥推 60 公斤 5x5」「跟上次一樣，但深蹲加 5 公斤」
            </Text>
          </TouchableOpacity>
          <WorkoutSummaryCard session={todaySession} onPress={handleCardPress} />
        </View>

        {/* Training metrics */}
        <TrainingMetricsCard
          weekSessions={metricSessions.filter((s) => s.date >= weekStart)}
          historySessions={metricSessions}
        />

        {/* Recent history */}
        <View style={styles.section}>
          <ThemedText variant="label" color="secondary" style={styles.sectionLabel}>最近紀錄</ThemedText>

          {recentSessions.length === 0 ? (
            <Card variant="flat" style={styles.emptyHistory}>
              <Text style={[styles.emptyIcon, { color: theme.textTertiary }]}>📋</Text>
              <ThemedText variant="caption" color="tertiary" center>
                尚無訓練紀錄{'\n'}開始記錄第一次訓練吧！
              </ThemedText>
            </Card>
          ) : (
            recentSessions.map((session) => (
              <Card key={session.id} variant="outlined" style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={[styles.historyDate, { color: theme.textPrimary }]}>
                    {formatDate(session.date)}
                  </Text>
                  {session.completedAt && (
                    <View style={[styles.doneBadge, { backgroundColor: OkabeIto.green + '22' }]}>
                      <Text style={[styles.doneBadgeText, { color: OkabeIto.green }]}>已完成</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.historyExercises, { color: theme.textSecondary }]} numberOfLines={1}>
                  {getUniqueExercises(session).join('、') || '無動作'}
                </Text>
                <View style={styles.historyStats}>
                  <Text style={[styles.historyStat, { color: theme.textTertiary }]}>
                    {session.sets.length} 組
                  </Text>
                  <Text style={[styles.historyStat, { color: theme.textTertiary }]}>·</Text>
                  <Text style={[styles.historyStat, { color: theme.textTertiary }]}>
                    {Math.round(calcVolume(session)).toLocaleString()} kg
                  </Text>
                </View>
              </Card>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <WorkoutSessionSheet
        ref={sessionSheetRef}
        onSessionComplete={handleSessionDone}
      />

      <QuickLogSheet
        visible={quickLogVisible}
        onClose={() => setQuickLogVisible(false)}
        onSaved={handleSessionDone}
      />
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
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  section: { gap: Spacing.sm },
  quickLogBtn: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: 4,
  },
  quickLogTitle: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
  quickLogHint: { fontSize: Typography.size.sm },
  sectionLabel: { marginBottom: 2 },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 32, textAlign: 'center' },
  historyCard: { gap: 4 },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyDate: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
  doneBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
  },
  doneBadgeText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.medium },
  historyExercises: { fontSize: Typography.size.sm },
  historyStats: { flexDirection: 'row', gap: Spacing.xs },
  historyStat: { fontSize: Typography.size.sm },
});
