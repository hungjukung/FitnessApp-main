/**
 * Onboarding Step 3 — 健身目標選擇
 */
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { SafeScreen } from '../../src/components/common/SafeScreen';
import { PrimaryButton } from '../../src/components/common/PrimaryButton';
import { ThemedText } from '../../src/components/common/ThemedText';
import { useTimeBasedTheme } from '../../src/stores/themeStore';
import { useUserStore } from '../../src/stores/userStore';
import { FitnessGoal } from '../../src/types';
import { Spacing, Radius } from '../../src/constants/theme';

const GOAL_OPTIONS: Array<{
  value: FitnessGoal;
  emoji: string;
  title: string;
  desc: string;
}> = [
  { value: 'fat_loss', emoji: '🔥', title: '減脂', desc: '降低體脂肪，保持肌肉量' },
  { value: 'muscle_gain', emoji: '🏋️', title: '增肌', desc: '增加肌肉量，提升身體線條' },
  { value: 'maintenance', emoji: '⚖️', title: '維持', desc: '保持現有的體重與體態' },
];

export default function GoalScreen() {
  const router = useRouter();
  const theme = useTimeBasedTheme();
  const { updateProfile } = useUserStore();
  const [selected, setSelected] = useState<FitnessGoal | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const handleNext = () => {
    if (!selected) return;
    updateProfile({ goal: selected });
    router.push('/(onboarding)/profile');
  };

  return (
    <SafeScreen edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <ThemedText variant="label" color="secondary">步驟 3 / 7</ThemedText>
          <ThemedText variant="title" bold style={{ marginTop: Spacing.sm }}>
            你的健身目標？
          </ThemedText>
          <ThemedText variant="body" color="secondary" style={{ marginTop: Spacing.sm }}>
            本機 AI 會根據目標調整分析方向
          </ThemedText>
        </Animated.View>

        {/* 選項清單 */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[{ gap: Spacing.sm }, { opacity: fadeAnim }]}>
            {GOAL_OPTIONS.map(({ value, emoji, title, desc }) => {
              const isSelected = selected === value;
              return (
                <TouchableOpacity
                  key={value}
                  activeOpacity={0.8}
                  onPress={() => setSelected(value)}
                  style={[
                    styles.card,
                    {
                      backgroundColor: isSelected ? theme.primary + '18' : theme.surface,
                      borderColor: isSelected ? theme.primary : theme.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="body" bold>
                      {title}
                    </ThemedText>
                    <ThemedText variant="caption" color="secondary" style={{ marginTop: 2 }}>
                      {desc}
                    </ThemedText>
                  </View>
                  {isSelected && (
                    <View style={[styles.check, { backgroundColor: theme.primary }]}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <PrimaryButton label="下一步" onPress={handleNext} disabled={!selected} />
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
    paddingBottom: Spacing.md,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    gap: Spacing.md,
  },
  emoji: { fontSize: 32, width: 40, textAlign: 'center' },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
});
