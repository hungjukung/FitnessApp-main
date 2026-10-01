/**
 * FitTrack AI — Tab Bar Layout
 * 自訂 Tab Bar 樣式，支援毛玻璃效果（iOS）
 */
import { useCallback } from 'react';
import { Tabs } from 'expo-router';
import { Text, StyleSheet, Platform, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTimeBasedTheme } from '../../src/stores/themeStore';
import { AIFloatingChat } from '../../src/components/ai/AIFloatingChat';

// 使用 emoji 作為 Tab 圖示（Expo Go 相容，無需額外 icon library）
// diet / workout / analytics 三個 tab 對應 src/modules 下的三個模組
const TAB_ITEMS = [
  { name: 'index', title: '今日', emoji: '🏠' },
  { name: 'diet', title: '飲食', emoji: '🥗' },
  { name: 'workout', title: '課表', emoji: '💪' },
  { name: 'analytics', title: '分析', emoji: '📊' },
  { name: 'settings', title: '設定', emoji: '⚙️' },
] as const;

// 保留路由但不顯示在 Tab Bar
const HIDDEN_ROUTES = ['calendar'] as const;

export default function TabsLayout() {
  const theme = useTimeBasedTheme();
  const isDark = theme.background === '#000000';

  const renderTabBarBackground = useCallback(
    () =>
      Platform.OS === 'ios' ? (
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : null,
    [isDark]
  );

  return (
    <>
    <Tabs
      screenOptions={({ route }: any) => ({
        headerShown: false,
        // 切走的分頁不再隨 store 更新重繪，切換時只渲染當前分頁
        freezeOnBlur: true,
        tabBarStyle: {
          position: 'absolute',
          borderTopColor: theme.border,
          borderTopWidth: 0.5,
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : theme.surface,
          elevation: 0,
          height: Platform.OS === 'ios' ? 84 : 64,
        },
        tabBarBackground: renderTabBarBackground,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      })}
    >
      {TAB_ITEMS.map(({ name, title, emoji }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ focused, color }: any) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Text style={[styles.tabEmoji, focused && styles.tabEmojiActive]}>
                  {emoji}
                </Text>
              </View>
            ),
          }}
        />
      ))}
      {HIDDEN_ROUTES.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
    <AIFloatingChat />
    </>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: Platform.OS === 'ios' ? 0 : 4,
  },
  tabItem: {
    paddingTop: 6,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
  },
  tabEmoji: {
    fontSize: 22,
    opacity: 0.6,
  },
  tabEmojiActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
});
