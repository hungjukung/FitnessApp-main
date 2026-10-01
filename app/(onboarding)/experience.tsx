/**
 * Onboarding Step 2 — 健身資歷選擇
 */
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { SafeScreen } from '../../src/components/common/SafeScreen';
import { PrimaryButton } from '../../src/components/common/PrimaryButton';
import { ThemedText } from '../../src/components/common/ThemedText';
import { useTimeBasedTheme } from '../../src/stores/themeStore';
import { useUserStore, ExperienceLevelLabels } from '../../src/stores/userStore';
import { ExperienceLevel } from '../../src/types';
import { Spacing, Radius } from '../../src/constants/theme';

const EXPERIENCE_OPTIONS: Array<{
  value: ExperienceLevel;
  emoji: string;
  title: string;
  desc: string;
}> = [
  {
    value: 'beginner',
    emoji: '1',
    title: '初學',
    desc: '剛開始健身，或回歸訓練不久',
  },
  {
    value: 'intermediate',
    emoji: '2',
    title: '中階',
    desc: '已能穩定訓練，正在建立固定節奏',
  },
  {
    value: 'advanced',
    emoji: '3',
    title: '進階',
    desc: '規律訓練超過 1 年，熟悉各種訓練方法',
  },
];

export default function ExperienceScreen() {
  const router = useRouter();
  const theme = useTimeBasedTheme();
  const { updateProfile } = useUserStore();
  const [selected, setSelected] = useState<ExperienceLevel | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const handleNext = () => {
    if (!selected) return;
    updateProfile({ experienceLevel: selected });
    router.push('/(onboarding)/goal');
  };

  return (
    <SafeScreen edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <View style={styles.stepIndicator}>
            <ThemedText variant="label" color="secondary">步驟 2 / 7</ThemedText>
          </View>
          <ThemedText variant="title" bold style={{ marginTop: Spacing.sm }}>
            你的健身資歷？
          </ThemedText>
          <ThemedText variant="body" color="secondary" style={{ marginTop: Spacing.sm }}>
            這會影響後續的本機 AI 建議語氣
          </ThemedText>
        </Animated.View>

        {/* 選項 */}
        <Animated.View style={[styles.options, { opacity: fadeAnim }]}>
          {EXPERIENCE_OPTIONS.map(({ value, emoji, title, desc }) => {
            const isSelected = selected === value;
            return (
              <TouchableOpacity
                key={value}
                activeOpacity={0.8}
                onPress={() => setSelected(value)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isSelected ? theme.primary + '18' : theme.surface,
                    borderColor: isSelected ? theme.primary : theme.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <Text style={styles.optionEmoji}>{emoji}</Text>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="subtitle" bold color={isSelected ? 'primary' : 'primary'}>
                    {title}
                  </ThemedText>
                  <ThemedText variant="caption" color="secondary" style={{ marginTop: 4 }}>
                    {desc}
                  </ThemedText>
                </View>
                {isSelected && (
                  <View style={[styles.checkmark, { backgroundColor: theme.primary }]}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <PrimaryButton
            label="下一步"
            onPress={handleNext}
            disabled={!selected}
          />
        </View>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  stepIndicator: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'transparent',
  },
  options: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    gap: Spacing.md,
  },
  optionEmoji: { fontSize: 40 },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
});
