/**
 * AICompanionCard — AI 分析結果顯示卡片
 * 顯示：摘要、建議清單、生成時間、AI 層級標籤
 */
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { ThemedText } from '../common/ThemedText';
import { TrendBadge } from './TrendBadge';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { AIAnalysisOutput } from '../../types';
import { Spacing, Radius } from '../../constants/theme';

interface AICompanionCardProps {
  output: AIAnalysisOutput;
  fromCache?: boolean;
}

const TIER_LABELS: Record<string, { emoji: string; label: string }> = {
  gemini: { emoji: '☁️', label: 'Gemini 雲端分析' },
};

export function AICompanionCard({ output, fromCache }: AICompanionCardProps) {
  const theme = useTimeBasedTheme();
  const tierInfo = TIER_LABELS[output.tier] ?? { emoji: '🤖', label: output.tier };
  const generatedAt = new Date(output.generatedAt).toLocaleString('zh-TW', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <Card variant="elevated" padding="lg">
      {/* Header：趨勢徽章 + AI 層級 */}
      <View style={styles.cardHeader}>
        <TrendBadge status={output.trendStatus} size="medium" />
        <View style={[styles.tierBadge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ fontSize: 12 }}>{tierInfo.emoji}</Text>
          <ThemedText variant="caption" color="tertiary">{tierInfo.label}</ThemedText>
        </View>
      </View>

      {/* AI 摘要 */}
      <View style={[styles.summaryBox, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
        <Text style={{ fontSize: 20, marginBottom: Spacing.sm }}>💬</Text>
        <ThemedText variant="body" style={{ lineHeight: 22 }}>
          {output.summary}
        </ThemedText>
      </View>

      {/* 建議清單 */}
      {output.suggestions.length > 0 && (
        <>
          <ThemedText variant="label" color="secondary" style={{ marginTop: Spacing.md, marginBottom: Spacing.sm }}>
            建議事項
          </ThemedText>
          <View style={{ gap: Spacing.sm }}>
            {output.suggestions.map((s, i) => (
              <View key={i} style={styles.suggestion}>
                <View style={[styles.bullet, { backgroundColor: theme.primary }]} />
                <ThemedText variant="body" style={{ flex: 1, lineHeight: 22 }}>
                  {s}
                </ThemedText>
              </View>
            ))}
          </View>
        </>
      )}

      {/* 底部：生成時間 + 快取提示 */}
      <View style={[styles.footer, { borderTopColor: theme.separator }]}>
        <ThemedText variant="caption" color="tertiary">
          {generatedAt} 生成
        </ThemedText>
        {fromCache && (
          <View style={[styles.cacheBadge, { backgroundColor: theme.warning + '20' }]}>
            <ThemedText variant="caption" style={{ color: theme.warning }}>
              快取結果
            </ThemedText>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  summaryBox: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    flexShrink: 0,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 0.5,
  },
  cacheBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
});
