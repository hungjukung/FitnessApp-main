/**
 * 近 7 天每肌群有效組數 + 主要動作最佳 e1RM
 */
import { View, Text, StyleSheet } from 'react-native';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { Card } from '../../components/common/Card';
import { ThemedText } from '../../components/common/ThemedText';
import { MUSCLE_GROUP_LABELS } from '../../constants/exercises';
import { Spacing, Radius, Typography, OkabeIto } from '../../constants/theme';
import { WorkoutSession } from '../../types';
import {
  bestE1RMByLift,
  countEffectiveSetsByMuscle,
  EFFECTIVE_REPS_MAX,
  EFFECTIVE_REPS_MIN,
  liftName,
} from './workoutMetrics';

interface TrainingMetricsCardProps {
  /** 近 7 天的 sessions（算每肌群組數） */
  weekSessions: WorkoutSession[];
  /** 較長期的 sessions（找各動作最佳 e1RM） */
  historySessions: WorkoutSession[];
}

export function TrainingMetricsCard({ weekSessions, historySessions }: TrainingMetricsCardProps) {
  const theme = useTimeBasedTheme();

  const muscleCounts = Object.entries(countEffectiveSetsByMuscle(weekSessions))
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as Array<[string, number]>;
  const maxCount = muscleCounts.length > 0 ? muscleCounts[0][1] : 0;

  const lifts = Object.entries(bestE1RMByLift(historySessions)).map(([id, points]) => ({
    id,
    name: liftName(id),
    best: Math.max(...points.map((p) => p.e1rm)),
    latest: points[points.length - 1].e1rm,
  }));

  if (muscleCounts.length === 0 && lifts.length === 0) return null;

  return (
    <Card variant="default" padding="lg" style={styles.card}>
      {muscleCounts.length > 0 && (
        <View style={styles.block}>
          <ThemedText variant="label" color="secondary">近 7 天各肌群有效組數</ThemedText>
          <ThemedText variant="caption" color="tertiary">
            {EFFECTIVE_REPS_MIN}–{EFFECTIVE_REPS_MAX} 下的組才計入；主要肌群算 1 組、次要肌群 0.5 組
          </ThemedText>
          {muscleCounts.map(([group, count]) => (
            <View key={group} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: theme.textSecondary }]}>{MUSCLE_GROUP_LABELS[group] ?? group}</Text>
              <View style={[styles.track, { backgroundColor: theme.border }]}>
                <View style={[styles.fill, { width: `${(count / maxCount) * 100}%` as const, backgroundColor: OkabeIto.skyBlue }]} />
              </View>
              <Text style={[styles.barValue, { color: theme.textPrimary }]}>{count % 1 === 0 ? count : count.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      )}

      {lifts.length > 0 && (
        <View style={styles.block}>
          <ThemedText variant="label" color="secondary">主要動作 e1RM（近 30 天）</ThemedText>
          <ThemedText variant="caption" color="tertiary">Epley：重量 × (1 + 次數 / 30)，只用 1–10 下的組估計</ThemedText>
          {lifts.map((l) => (
            <View key={l.id} style={styles.liftRow}>
              <Text style={[styles.liftName, { color: theme.textPrimary }]}>{l.name}</Text>
              <Text style={[styles.liftValue, { color: theme.textSecondary }]}>
                最近 {l.latest.toFixed(1)} kg · 最佳 {l.best.toFixed(1)} kg
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.lg },
  block: { gap: Spacing.xs },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  barLabel: { width: 64, fontSize: Typography.size.sm },
  track: { flex: 1, height: 8, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },
  barValue: { width: 32, textAlign: 'right', fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
  liftRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  liftName: { fontSize: Typography.size.md },
  liftValue: { fontSize: Typography.size.sm },
});
