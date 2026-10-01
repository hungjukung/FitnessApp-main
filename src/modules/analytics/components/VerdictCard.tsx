/**
 * 判讀結果卡片
 * 「無法區分」與「暫不判讀」是正常且體面的狀態，不用錯誤色、不藏起來。
 */
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTimeBasedTheme } from '../../../stores/themeStore';
import { Card } from '../../../components/common/Card';
import { Spacing, Radius, Typography } from '../../../constants/theme';
import { Confidence, Interpretation } from '../engine/interpret';

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: '信心：高',
  medium: '信心：中',
  low: '信心：低',
};

export function VerdictCard({ interpretation }: { interpretation: Interpretation }) {
  const theme = useTimeBasedTheme();
  const [showReasons, setShowReasons] = useState(false);
  const { verdict, evaluations, nextSteps } = interpretation;

  let badge: { label: string; color: string };
  if (verdict.state === 'conclusion') {
    const color = { high: theme.chartOnTrack, medium: theme.primary, low: theme.chartPlateau }[verdict.confidence];
    badge = { label: CONFIDENCE_LABELS[verdict.confidence], color };
  } else if (verdict.state === 'ambiguous') {
    badge = { label: '尚無法區分', color: theme.info };
  } else {
    badge = { label: verdict.reason === 'insufficient' ? '資料不足' : '訊號矛盾', color: theme.textSecondary };
  }

  const eliminated = evaluations.filter((e) => e.eliminated);
  // 資料不足而拒答時，排除理由沒有意義（體重這個基礎訊號本身就不可靠）
  const isInsufficient = verdict.state === 'refused' && verdict.reason === 'insufficient';
  const showReasonSection = eliminated.length > 0 && !isInsufficient;

  return (
    <Card variant="elevated" padding="lg" style={styles.card}>
      <View style={[styles.badge, { backgroundColor: badge.color + '22' }]}>
        <Text style={[styles.badgeLabel, { color: badge.color }]}>{badge.label}</Text>
      </View>

      <Text style={[styles.headline, { color: theme.textPrimary }]}>{verdict.headline}</Text>

      {verdict.state === 'conclusion' && verdict.confidence === 'low' && (
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          證據還不強，目前只能說「傾向」這個方向。
        </Text>
      )}

      {verdict.state === 'ambiguous' && (
        <View style={styles.candidates}>
          {verdict.candidates.map((h) => (
            <View key={h.id} style={[styles.candidate, { borderColor: theme.border }]}>
              <Text style={[styles.candidateId, { color: theme.textTertiary }]}>{h.id}</Text>
              <Text style={[styles.candidateName, { color: theme.textPrimary }]}>{h.name}</Text>
            </View>
          ))}
        </View>
      )}

      {verdict.state === 'refused' && verdict.reason === 'contradiction' && (
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          沒有任何一種情境能同時解釋所有訊號。與其給一個看似篤定的答案，不如再給它一點時間。
        </Text>
      )}

      {nextSteps.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            {verdict.state === 'conclusion' ? '補齊這些資料可以提高信心' : '要進一步判斷，還需要'}
          </Text>
          {nextSteps.map((step) => (
            <Text key={step} style={[styles.bullet, { color: theme.textPrimary }]}>• {step}</Text>
          ))}
        </View>
      )}

      {/* 可解釋性：列出排除了誰、為什麼 */}
      {showReasonSection ? (
        <View style={styles.section}>
          <TouchableOpacity onPress={() => setShowReasons((v) => !v)}>
            <Text style={[styles.toggle, { color: theme.primary }]}>
              {showReasons ? '隱藏判斷過程 ▲' : `為什麼？（已排除 ${eliminated.length} 種情境）▼`}
            </Text>
          </TouchableOpacity>
          {showReasons && eliminated.map((e) => (
            <View key={e.hypothesis.id} style={[styles.reasonBlock, { backgroundColor: theme.background }]}>
              <Text style={[styles.reasonTitle, { color: theme.textPrimary }]}>
                排除 {e.hypothesis.id} {e.hypothesis.name}
              </Text>
              {e.reasons.map((r) => (
                <Text key={r} style={[styles.reasonText, { color: theme.textSecondary }]}>– {r}</Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  badge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  badgeLabel: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold },
  headline: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, lineHeight: 28 },
  body: { fontSize: Typography.size.sm, lineHeight: 20 },
  candidates: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  candidateId: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold },
  candidateName: { fontSize: Typography.size.sm, fontWeight: Typography.weight.medium },
  section: { marginTop: Spacing.sm, gap: Spacing.xs },
  sectionTitle: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
  bullet: { fontSize: Typography.size.sm, lineHeight: 20 },
  toggle: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
  reasonBlock: { borderRadius: Radius.md, padding: Spacing.sm, gap: 2, marginTop: Spacing.xs },
  reasonTitle: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
  reasonText: { fontSize: Typography.size.xs, lineHeight: 18 },
});
