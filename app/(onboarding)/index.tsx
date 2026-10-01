/**
 * Onboarding Step 1 — 歡迎畫面
 */
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { SafeScreen } from '../../src/components/common/SafeScreen';
import { PrimaryButton } from '../../src/components/common/PrimaryButton';
import { ThemedText } from '../../src/components/common/ThemedText';
import { useTimeBasedTheme } from '../../src/stores/themeStore';
import { Spacing } from '../../src/constants/theme';

// 進度指示器
function ProgressDots({ current, total }: { current: number; total: number }) {
  const theme = useTimeBasedTheme();
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i < current ? theme.primary : theme.border,
              width: i < current ? 20 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useTimeBasedTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeScreen edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* 頂部裝飾 */}
        <View style={[styles.topDecor, { backgroundColor: theme.primary + '18' }]} />

        {/* 主要內容 */}
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={styles.emoji}>🏋️‍♂️</Text>

          <ThemedText variant="display" bold center style={styles.title}>
            FitTrack AI
          </ThemedText>

          <ThemedText variant="body" color="secondary" center style={styles.subtitle}>
            你的智慧健身夥伴{'\n'}每天記錄，科學分析，持續進步
          </ThemedText>

          {/* 功能亮點 */}
          <View style={styles.features}>
            {[
              { emoji: '📊', text: '體重趨勢分析' },
              { emoji: '📸', text: '體態對比照片' },
              { emoji: '🤖', text: 'AI 智慧建議' },
              { emoji: '🔒', text: '資料完全本地儲存' },
            ].map(({ emoji, text }) => (
              <View key={text} style={styles.featureRow}>
                <Text style={styles.featureEmoji}>{emoji}</Text>
                <ThemedText variant="body" color="secondary">
                  {text}
                </ThemedText>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* 底部按鈕 */}
        <Animated.View style={[styles.bottom, { opacity: fadeAnim }]}>
          <ProgressDots current={0} total={7} />
          <PrimaryButton
            label="開始使用"
            icon="🚀"
            onPress={() => router.push('/(onboarding)/nickname')}
          />
          <ThemedText variant="caption" color="tertiary" center style={{ marginTop: Spacing.sm }}>
            完成設定只需 2 分鐘
          </ThemedText>
        </Animated.View>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topDecor: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emoji: { fontSize: 80, marginBottom: Spacing.lg },
  title: { marginBottom: Spacing.md },
  subtitle: { marginBottom: Spacing.xl, lineHeight: 26 },
  features: { gap: Spacing.sm, alignSelf: 'stretch' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  featureEmoji: { fontSize: 22, width: 32, textAlign: 'center' },
  bottom: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  dot: { height: 8, borderRadius: 4 },
});
