/**
 * TodaySummaryCard — 今日數據摘要卡片
 * 顯示：體重、BMI、連續記錄天數
 */
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { ThemedText } from '../common/ThemedText';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { Spacing } from '../../constants/theme';
import { WeightLog } from '../../types';
import { UserProfile } from '../../types';

interface StatItemProps {
  emoji: string;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

function StatItem({ emoji, label, value, sub, color }: StatItemProps) {
  const theme = useTimeBasedTheme();
  return (
    <View style={styles.statItem}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <ThemedText variant="label" color="secondary">
        {label}
      </ThemedText>
      <Text style={[styles.statValue, { color: color ?? theme.textPrimary }]}>
        {value}
      </Text>
      {sub && (
        <ThemedText variant="caption" color="tertiary">
          {sub}
        </ThemedText>
      )}
    </View>
  );
}

interface TodaySummaryCardProps {
  todayLog: WeightLog | null;
  profile: UserProfile;
  streakDays: number;
}

function calcBMI(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  return weightKg / (h * h);
}

function bmiLabel(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: '偏輕', color: '#60A5FA' };
  if (bmi < 25) return { label: '正常', color: '#34C759' };
  if (bmi < 30) return { label: '偏重', color: '#FF9500' };
  return { label: '肥胖', color: '#FF3B30' };
}

export function TodaySummaryCard({ todayLog, profile, streakDays }: TodaySummaryCardProps) {
  const theme = useTimeBasedTheme();

  const bmiInfo =
    todayLog && profile.heightCm
      ? bmiLabel(calcBMI(todayLog.weight, profile.heightCm))
      : null;

  const bmiValue =
    todayLog && profile.heightCm
      ? calcBMI(todayLog.weight, profile.heightCm).toFixed(1)
      : '--';

  return (
    <Card variant="elevated" padding="lg">
      <ThemedText variant="label" color="secondary" style={{ marginBottom: Spacing.md }}>
        今日統計
      </ThemedText>
      <View style={styles.statsRow}>
        <StatItem
          emoji="⚖️"
          label="體重"
          value={todayLog ? `${todayLog.weight.toFixed(1)} kg` : '--'}
          color={todayLog ? theme.primary : theme.textTertiary}
        />
        <View style={[styles.divider, { backgroundColor: theme.separator }]} />
        <StatItem
          emoji="📏"
          label="BMI"
          value={bmiValue}
          sub={bmiInfo?.label}
          color={bmiInfo?.color}
        />
        <View style={[styles.divider, { backgroundColor: theme.separator }]} />
        <StatItem
          emoji="🔥"
          label="連續"
          value={streakDays > 0 ? `${streakDays} 天` : '--'}
          sub={streakDays >= 7 ? '🎉 一週！' : undefined}
          color={streakDays >= 7 ? theme.success : theme.textPrimary}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statEmoji: { fontSize: 24 },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  divider: {
    width: 1,
    height: 56,
    marginHorizontal: 4,
  },
});
