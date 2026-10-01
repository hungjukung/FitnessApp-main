import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WorkoutSession } from '../../types';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { Spacing, Radius, Typography, OkabeIto } from '../../constants/theme';
import { Card } from '../common/Card';

interface WorkoutSummaryCardProps {
  session: WorkoutSession | null;
  onPress: () => void;
}

function calcVolume(session: WorkoutSession): number {
  return session.sets.reduce(
    (sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 1),
    0
  );
}

function getUniqueExercises(session: WorkoutSession): number {
  return new Set(session.sets.map((s) => s.exerciseId)).size;
}

export function WorkoutSummaryCard({ session, onPress }: WorkoutSummaryCardProps) {
  const theme = useTimeBasedTheme();

  if (!session) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <Card variant="outlined" style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>💪</Text>
          <View style={styles.emptyText}>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              今日尚未訓練
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              點擊開始記錄訓練
            </Text>
          </View>
          <Text style={[styles.arrow, { color: theme.textTertiary }]}>›</Text>
        </Card>
      </TouchableOpacity>
    );
  }

  const exerciseCount = getUniqueExercises(session);
  const totalSets = session.sets.length;
  const totalVolume = calcVolume(session);
  const isCompleted = !!session.completedAt;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card variant="elevated" style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.icon}>💪</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              {session.name ?? '今日訓練'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isCompleted ? OkabeIto.green + '22' : theme.primary + '22' }]}>
            <Text style={[styles.badgeText, { color: isCompleted ? OkabeIto.green : theme.primary }]}>
              {isCompleted ? '已完成' : '進行中'}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.separator }]} />

        <View style={styles.statsRow}>
          <StatItem label="動作" value={String(exerciseCount)} />
          <View style={[styles.vDivider, { backgroundColor: theme.separator }]} />
          <StatItem label="總組數" value={String(totalSets)} />
          <View style={[styles.vDivider, { backgroundColor: theme.separator }]} />
          <StatItem label="訓練量" value={`${Math.round(totalVolume).toLocaleString()} kg`} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  const theme = useTimeBasedTheme();
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: theme.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  emptyIcon: { fontSize: 28 },
  emptyText: { flex: 1 },
  emptyTitle: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
  emptySubtitle: { fontSize: Typography.size.sm, marginTop: 2 },
  arrow: { fontSize: 22 },
  card: { gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  icon: { fontSize: 20 },
  title: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.medium },
  divider: { height: 1, marginVertical: Spacing.xs },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing.xs },
  statValue: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold },
  statLabel: { fontSize: Typography.size.xs, marginTop: 2 },
  vDivider: { width: 1, height: 36 },
});
