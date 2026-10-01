/**
 * Onboarding Step 1 — 暱稱設定
 */
import { View, TextInput, StyleSheet, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { SafeScreen } from '../../src/components/common/SafeScreen';
import { PrimaryButton } from '../../src/components/common/PrimaryButton';
import { ThemedText } from '../../src/components/common/ThemedText';
import { useTimeBasedTheme } from '../../src/stores/themeStore';
import { useUserStore } from '../../src/stores/userStore';
import { Spacing, Radius } from '../../src/constants/theme';

export default function NicknameScreen() {
  const router = useRouter();
  const theme = useTimeBasedTheme();
  const { updateProfile } = useUserStore();
  const [nickname, setNickname] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const trimmed = nickname.trim();
  const canNext = trimmed.length >= 1 && trimmed.length <= 20;

  const handleNext = () => {
    if (!canNext) return;
    updateProfile({ nickname: trimmed });
    router.push('/(onboarding)/experience');
  };

  return (
    <SafeScreen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
            <View style={styles.stepIndicator}>
              <ThemedText variant="label" color="secondary">步驟 1 / 7</ThemedText>
            </View>
            <ThemedText variant="title" bold style={{ marginTop: Spacing.sm }}>
              你想叫什麼名字？
            </ThemedText>
            <ThemedText variant="body" color="secondary" style={{ marginTop: Spacing.sm }}>
              設定一個暱稱，讓 FitTrack AI 認識你
            </ThemedText>
          </Animated.View>

          <Animated.View style={[styles.inputSection, { opacity: fadeAnim }]}>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="輸入你的暱稱"
              placeholderTextColor={theme.textTertiary}
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={handleNext}
              autoFocus
              style={[
                styles.input,
                {
                  borderColor: trimmed.length > 0 ? theme.primary : theme.border,
                  backgroundColor: theme.surface,
                  color: theme.textPrimary,
                },
              ]}
            />
            <ThemedText variant="caption" color="tertiary" style={{ alignSelf: 'flex-end' }}>
              {trimmed.length} / 20
            </ThemedText>
          </Animated.View>

          <View style={styles.footer}>
            <PrimaryButton
              label="下一步"
              onPress={handleNext}
              disabled={!canNext}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
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
  },
  inputSection: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl ?? 40,
    gap: Spacing.sm,
  },
  input: {
    height: 56,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 20,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
});
