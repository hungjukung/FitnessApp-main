/**
 * Onboarding Step 6 — AI 同意書（最後一步）
 */
import { View, Text, StyleSheet, Animated, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useRef, useEffect } from 'react';
import { SafeScreen } from '../../src/components/common/SafeScreen';
import { PrimaryButton } from '../../src/components/common/PrimaryButton';
import { ThemedText } from '../../src/components/common/ThemedText';
import { Card } from '../../src/components/common/Card';
import { useTimeBasedTheme } from '../../src/stores/themeStore';
import { useUserStore } from '../../src/stores/userStore';
import { Spacing } from '../../src/constants/theme';

const PRIVACY_POINTS = [
  { emoji: '☁️', title: '帳號同步', desc: '體重、訓練紀錄與個人資料會同步至 FitTrack 伺服器，供您換裝置後還原' },
  { emoji: '🤖', title: 'AI 分析', desc: '啟用後，體重數列與您選擇的截圖會傳送至 Google Gemini 進行分析' },
  { emoji: '📸', title: '照片隱私', desc: '體態照片預設只留在這支手機，也不會存入系統相簿；雲端備份需您自行到設定開啟' },
  { emoji: '🔒', title: '資料控制', desc: '您可以隨時在設定中關閉上述功能，或刪除本機與雲端的所有資料' },
];

export default function AIConsentScreen() {
  const router = useRouter();
  const theme = useTimeBasedTheme();
  const { giveAIConsent, completeOnboarding } = useUserStore();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const handleConsent = () => {
    giveAIConsent();
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const handleSkipAI = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <SafeScreen edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <ThemedText variant="label" color="secondary">步驟 7 / 7</ThemedText>
          <ThemedText variant="title" bold style={{ marginTop: Spacing.sm }}>
            隱私與 AI 說明
          </ThemedText>
          <ThemedText variant="body" color="secondary" style={{ marginTop: Spacing.sm }}>
            請閱讀以下說明，再決定是否使用 AI 功能
          </ThemedText>
        </Animated.View>

        {/* 說明卡片 */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[{ gap: Spacing.sm }, { opacity: fadeAnim }]}>
            {PRIVACY_POINTS.map(({ emoji, title, desc }) => (
              <Card key={title} variant="outlined" padding="md">
                <View style={styles.pointRow}>
                  <Text style={{ fontSize: 28 }}>{emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="body" bold>
                      {title}
                    </ThemedText>
                    <ThemedText variant="caption" color="secondary" style={{ marginTop: 4, lineHeight: 18 }}>
                      {desc}
                    </ThemedText>
                  </View>
                </View>
              </Card>
            ))}
          </Animated.View>
        </ScrollView>

        {/* 底部按鈕 */}
        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <PrimaryButton
            label="✅ 同意並開始使用"
            onPress={handleConsent}
          />
          <PrimaryButton
            label="不使用 AI 功能"
            variant="ghost"
            onPress={handleSkipAI}
            style={{ marginTop: Spacing.sm }}
          />
          <ThemedText variant="caption" color="tertiary" center style={{ marginTop: Spacing.sm }}>
            可在「設定」中隨時更改 AI 偏好
          </ThemedText>
        </Animated.View>
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
    paddingBottom: Spacing.md,
  },
  pointRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
});
