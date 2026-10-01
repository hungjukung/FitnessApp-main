/**
 * Onboarding Step 5 — 目標體重輸入（選填）
 */
import { View, TextInput, StyleSheet, Animated, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { SafeScreen } from '../../src/components/common/SafeScreen';
import { PrimaryButton } from '../../src/components/common/PrimaryButton';
import { ThemedText } from '../../src/components/common/ThemedText';
import { useTimeBasedTheme } from '../../src/stores/themeStore';
import { useUserStore } from '../../src/stores/userStore';
import { isValidWeight } from '../../src/db/weightRepository';
import { Spacing, Radius, BusinessRules } from '../../src/constants/theme';

export default function GoalWeightScreen() {
  const router = useRouter();
  const theme = useTimeBasedTheme();
  const { updateProfile } = useUserStore();
  const [weightText, setWeightText] = useState('');
  const inputRef = useRef<any>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    setTimeout(() => inputRef.current?.focus(), 700);
  }, []);

  const weight = parseFloat(weightText.replace(',', '.'));
  const isValid = !isNaN(weight) && isValidWeight(weight);
  const showError = weightText.length > 0 && !isValid;

  const handleNext = () => {
    if (!isValid) return;
    updateProfile({ goalWeightKg: Math.round(weight * 10) / 10 });
    router.push('/(onboarding)/ai-consent');
  };

  const handleSkip = () => {
    updateProfile({ goalWeightKg: null });
    router.push('/(onboarding)/ai-consent');
  };

  return (
    <SafeScreen edges={['top', 'bottom']} avoidKeyboard>
      <View style={styles.container}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <ThemedText variant="label" color="secondary">步驟 6 / 7</ThemedText>
          <ThemedText variant="title" bold style={{ marginTop: Spacing.sm }}>
            目標體重？
          </ThemedText>
          <ThemedText variant="body" color="secondary" style={{ marginTop: Spacing.sm }}>
            設定目標幫助追蹤進度，可隨時在設定中修改
          </ThemedText>
        </Animated.View>

        {/* 大型體重輸入 */}
        <Animated.View style={[styles.inputArea, { opacity: fadeAnim }]}>
          <View
            style={[
              styles.inputContainer,
              {
                borderColor: isValid ? theme.primary : theme.border,
                backgroundColor: theme.surface,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              value={weightText}
              onChangeText={(t: string) => {
                const clean = t.replace(/[^0-9.]/g, '');
                setWeightText(clean);
              }}
              keyboardType="decimal-pad"
              placeholder="65.0"
              placeholderTextColor={theme.textTertiary}
              style={[styles.weightInput, { color: theme.textPrimary }]}
              returnKeyType="done"
              onSubmitEditing={handleNext}
              maxLength={5}
            />
            <ThemedText variant="subtitle" color="secondary">
              kg
            </ThemedText>
          </View>

          <ThemedText variant="caption" color="tertiary" center>
            有效範圍：{BusinessRules.weight.min} – {BusinessRules.weight.max} kg
          </ThemedText>
          {showError && (
            <ThemedText variant="caption" color="error" center>
              請輸入 {BusinessRules.weight.min.toFixed(1)}-{BusinessRules.weight.max.toFixed(1)} kg 之間的體重
            </ThemedText>
          )}

          {isValid && (
            <Animated.View
              style={[
                styles.validIndicator,
                { backgroundColor: theme.success + '20', borderColor: theme.success },
              ]}
            >
              <Text style={{ fontSize: 16 }}>🎯</Text>
              <ThemedText variant="caption" color="success">
                目標：{weight.toFixed(1)} kg
              </ThemedText>
            </Animated.View>
          )}
        </Animated.View>

        <View style={styles.footer}>
          <PrimaryButton label="下一步" onPress={handleNext} disabled={!isValid} />
          <PrimaryButton
            label="暫不設定"
            variant="ghost"
            onPress={handleSkip}
            style={{ marginTop: Spacing.sm }}
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
  inputArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 2,
    gap: Spacing.md,
    width: '100%',
  },
  weightInput: {
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: -1,
    textAlign: 'right',
    flex: 1,
    minWidth: 120,
  },
  validIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
});
