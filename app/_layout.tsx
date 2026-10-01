/**
 * FitTrack AI — Root Layout
 * 負責：DB 初始化、導向主畫面
 * App 不提供登入：啟動後以本機使用者開啟資料庫，直接進入 (tabs)。
 * 個人資料在「設定」頁填寫；(onboarding) 頁面保留但不再自動導向。
 */

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from '../src/db/database';
import { setPhotoUser } from '../src/db/photoRepository';
import { useUserStore } from '../src/stores/userStore';
import { useTimeBasedTheme } from '../src/stores/themeStore';
import { requestPermissions, rescheduleAll } from '../src/services/notifications/NotificationService';
import { LOCAL_USER_ID } from '../src/constants/localUser';

// 冷啟動時先落在主畫面，避免 "/" 同時對應到 (onboarding)/index 與 (tabs)/index
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// ─────────────────────────────────────────────
// 啟動 Loading 畫面
// ─────────────────────────────────────────────

function LoadingScreen() {
  const theme = useTimeBasedTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <Text style={styles.logo}>🏋️</Text>
      <ActivityIndicator
        size="large"
        color={theme.primary}
        style={{ marginTop: 24 }}
      />
      <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
        啟動中⋯
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// 錯誤畫面
// ─────────────────────────────────────────────

function ErrorScreen({ message }: { message: string }) {
  const theme = useTimeBasedTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background, padding: 32 }]}>
      <Text style={styles.logo}>⚠️</Text>
      <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>
        啟動失敗
      </Text>
      <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>
        {message}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// 導航守衛：資料庫就緒後確保停在主畫面
// ─────────────────────────────────────────────

function NavigationGuard({ isReady }: { isReady: boolean }) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (segments[0] !== '(tabs)') router.replace('/(tabs)');
  }, [isReady, segments, router]);

  return null;
}

// ─────────────────────────────────────────────
// Root Layout
// ─────────────────────────────────────────────

export default function RootLayout() {
  const [dbState, setDbState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [dbError, setDbError] = useState('');
  const initForUser = useUserStore(s => s.initForUser);

  useEffect(() => {
    initDatabase(LOCAL_USER_ID)
      .then(async () => {
        setPhotoUser(LOCAL_USER_ID);
        await initForUser(LOCAL_USER_ID);
        // Request notification permissions and reschedule (fire-and-forget)
        requestPermissions()
          .then(granted => {
            if (granted) {
              const settings = useUserStore.getState().notificationSettings;
              rescheduleAll(settings).catch(console.error);
            }
          })
          .catch(console.error);
        setDbState('ready');
      })
      .catch((e: Error) => {
        setDbError(e.message ?? '資料庫初始化失敗，請重啟 App。');
        setDbState('error');
      });
  }, [initForUser]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <StatusBar style="auto" />
        <NavigationGuard isReady={dbState === 'ready'} />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        {dbState === 'loading' && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
            <LoadingScreen />
          </View>
        )}
        {dbState === 'error' && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
            <ErrorScreen message={dbError} />
          </View>
        )}
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 64,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    letterSpacing: 0.3,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '700',
  },
  errorMessage: {
    marginTop: 12,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
