import { Stack } from 'expo-router';
import { useTimeBasedTheme } from '../../src/stores/themeStore';

export default function OnboardingLayout() {
  const theme = useTimeBasedTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme.background },
      }}
    />
  );
}
