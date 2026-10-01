/**
 * SummaryStatsCard — 分析摘要卡片
 * 顯示：總變化、週均變化、有效天數、趨勢
 */
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { ThemedText } from '../common/ThemedText';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { SummaryStats } from '../../types';
import { Spacing } from '../../constants/theme';

interface StatBoxProps {
  emoji: string;
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
}

function StatBox({ emoji, label, value, valueColor, sub }: StatBoxProps) {
  const theme = useTimeBasedTheme();
  return (
    <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <ThemedText variant="label" color="secondary">{label}</ThemedText>
      <Text style={[styles.value, { color: valueColor ?? theme.textPrimary }]}>{value}</Text>
      {sub && <ThemedText variant="caption" color="tertiary">{sub}</ThemedText>}
    </View>
  );
}

interface SummaryStatsCardProps {
  stats: SummaryStats;
}

const TREND_CONFIG = {
  down: { emoji: '📉', label: '下降中', color: '#34C759' },
  flat: { emoji: '➡️', label: '持平', color: '#FF9500' },
  up: { emoji: '📈', label: '上升中', color: '#FF3B30' },
} as const;

export function SummaryStatsCard({ stats }: SummaryStatsCardProps) {
  const theme = useTimeBasedTheme();
  const trend = TREND_CONFIG[stats.trend];

  const deltaSign = stats.totalDelta > 0 ? '+' : '';
  const weeklySign = stats.avgWeeklyDelta > 0 ? '+' : '';

  return (
    <Card variant="elevated" padding="lg">
      <ThemedText variant="label" color="secondary" style={{ marginBottom: Spacing.md }}>
        {stats.periodLabel} · {stats.dataPoints} 天有記錄
      </ThemedText>
      <View style={styles.grid}>
        <StatBox
          emoji="⬆️"
          label="最高"
          value={`${stats.highestWeight.toFixed(1)} kg`}
        />
        <StatBox
          emoji="⬇️"
          label="最低"
          value={`${stats.lowestWeight.toFixed(1)} kg`}
        />
        <StatBox
          emoji="∅"
          label="平均"
          value={`${stats.averageWeight.toFixed(1)} kg`}
        />
        <StatBox
          emoji="⚖️"
          label="總變化"
          value={`${deltaSign}${stats.totalDelta.toFixed(1)} kg`}
          valueColor={stats.totalDelta < 0 ? theme.success : stats.totalDelta > 0 ? theme.error : theme.textPrimary}
        />
        <StatBox
          emoji="📅"
          label="週均變化"
          value={`${weeklySign}${stats.avgWeeklyDelta.toFixed(2)} kg/w`}
          valueColor={stats.avgWeeklyDelta < 0 ? theme.success : stats.avgWeeklyDelta > 0 ? theme.warning : theme.textPrimary}
        />
        <StatBox
          emoji={trend.emoji}
          label="趨勢"
          value={trend.label}
          valueColor={trend.color}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statBox: {
    flex: 1,
    minWidth: '44%',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  emoji: { fontSize: 24 },
  value: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
});
