/**
 * 各訊號的原始數字，讓使用者（和口試委員）看到結論背後的依據
 */
import { View, Text, StyleSheet } from 'react-native';
import { useTimeBasedTheme } from '../../../stores/themeStore';
import { Card } from '../../../components/common/Card';
import { ThemedText } from '../../../components/common/ThemedText';
import { Spacing, Typography } from '../../../constants/theme';
import { isInformative, Signal } from '../engine/signals';

export function SignalsCard({ signals }: { signals: Signal[] }) {
  const theme = useTimeBasedTheme();

  return (
    <Card variant="default" padding="lg">
      <ThemedText variant="label" color="secondary" style={{ marginBottom: Spacing.sm }}>
        判讀依據
      </ThemedText>
      {signals.map((s, i) => {
        const informative = isInformative(s);
        return (
          <View
            key={s.key}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}
          >
            <View style={styles.rowHeader}>
              <Text style={[styles.label, { color: theme.textPrimary }]}>{s.label}</Text>
              <Text
                style={[
                  styles.state,
                  { color: informative ? theme.primary : theme.textTertiary },
                  s.evidence === 'weak' && { color: theme.chartPlateau },
                ]}
              >
                {s.stateLabel}
              </Text>
            </View>
            <Text style={[styles.summary, { color: theme.textSecondary }]}>{s.summary}</Text>
            {s.detail && <Text style={[styles.detail, { color: theme.textTertiary }]}>{s.detail}</Text>}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: Spacing.sm, gap: 2 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  label: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
  state: { fontSize: Typography.size.sm, fontWeight: Typography.weight.medium, flexShrink: 1, textAlign: 'right' },
  summary: { fontSize: Typography.size.sm },
  detail: { fontSize: Typography.size.xs, lineHeight: 16 },
});
