/**
 * Onboarding Step 4 — 個人資料（性別 / 年齡 / 身高）
 */
import { View, Text, TouchableOpacity, StyleSheet, Animated, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { SafeScreen } from '../../src/components/common/SafeScreen';
import { PrimaryButton } from '../../src/components/common/PrimaryButton';
import { ThemedText } from '../../src/components/common/ThemedText';
import { Card } from '../../src/components/common/Card';
import { useTimeBasedTheme } from '../../src/stores/themeStore';
import { useUserStore } from '../../src/stores/userStore';
import { Gender } from '../../src/types';
import { Spacing, Radius, BusinessRules, Typography } from '../../src/constants/theme';

const GENDER_OPTIONS: Array<{ value: Gender; emoji: string; label: string }> = [
  { value: 'male', emoji: '♂️', label: '男性' },
  { value: 'female', emoji: '♀️', label: '女性' },
  { value: 'prefer_not_to_say', emoji: '🤐', label: '不透露' },
];

interface NumberInputProps {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  placeholder: string;
}

function NumberInput({ label, unit, value, onChange, min, max, placeholder }: NumberInputProps) {
  const theme = useTimeBasedTheme();
  const numericValue = Number(value);
  const hasError =
    value.length > 0 &&
    (!Number.isFinite(numericValue) || numericValue < min || numericValue > max);

  return (
    <View style={niStyles.wrapper}>
      <ThemedText variant="label" color="secondary">
        {label}
      </ThemedText>
      <View
        style={[
          niStyles.inputRow,
          { borderColor: theme.border, backgroundColor: theme.surface },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor={theme.textTertiary}
          style={[niStyles.input, { color: theme.textPrimary }]}
          maxLength={3}
        />
        <ThemedText variant="body" color="secondary">
          {unit}
        </ThemedText>
      </View>
      {hasError && (
        <ThemedText variant="caption" color="error">
          請輸入 {min}-{max} {unit} 之間的數值
        </ThemedText>
      )}
    </View>
  );
}

const niStyles = StyleSheet.create({
  wrapper: { gap: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.semibold,
  },
});

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTimeBasedTheme();
  const { updateProfile } = useUserStore();

  const [gender, setGender] = useState<Gender | null>(null);
  const [ageText, setAgeText] = useState('');
  const [heightText, setHeightText] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const age = parseInt(ageText, 10);
  const height = parseInt(heightText, 10);
  const isValid =
    gender !== null &&
    !isNaN(age) &&
    age >= BusinessRules.age.min &&
    age <= BusinessRules.age.max &&
    !isNaN(height) &&
    height >= BusinessRules.height.min &&
    height <= BusinessRules.height.max;

  const handleNext = () => {
    if (!isValid || !gender) return;
    updateProfile({ gender, age, heightCm: height });
    router.push('/(onboarding)/initial-weight');
  };

  return (
    <SafeScreen edges={['top', 'bottom']} avoidKeyboard scrollable>
      <View style={styles.container}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <ThemedText variant="label" color="secondary">步驟 4 / 7</ThemedText>
          <ThemedText variant="title" bold style={{ marginTop: Spacing.sm }}>
            基本資料
          </ThemedText>
          <ThemedText variant="body" color="secondary" style={{ marginTop: Spacing.sm }}>
            用於計算 BMI 及提供個人化建議
          </ThemedText>
        </Animated.View>

        <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
          {/* 性別 */}
          <View>
            <ThemedText variant="label" color="secondary" style={{ marginBottom: Spacing.sm }}>
              性別
            </ThemedText>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map(({ value, emoji, label }) => {
                const isSelected = gender === value;
                return (
                  <TouchableOpacity
                    key={value}
                    activeOpacity={0.8}
                    onPress={() => setGender(value)}
                    style={[
                      styles.genderCard,
                      {
                        backgroundColor: isSelected ? theme.primary + '18' : theme.surface,
                        borderColor: isSelected ? theme.primary : theme.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                    <ThemedText variant="caption" bold={isSelected}>
                      {label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 年齡 / 身高 */}
          <NumberInput
            label="年齡"
            unit="歲"
            value={ageText}
            onChange={setAgeText}
            min={BusinessRules.age.min}
            max={BusinessRules.age.max}
            placeholder="例：25"
          />
          <NumberInput
            label="身高"
            unit="cm"
            value={heightText}
            onChange={setHeightText}
            min={BusinessRules.height.min}
            max={BusinessRules.height.max}
            placeholder="例：170"
          />
        </Animated.View>

        <View style={styles.footer}>
          <PrimaryButton label="下一步" onPress={handleNext} disabled={!isValid} />
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
  body: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },
  genderRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  genderCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    gap: 6,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.lg,
  },
});
