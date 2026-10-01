import { View, ViewProps } from 'react-native';
import { useTimeBasedTheme } from '../../stores/themeStore';

type ViewVariant = 'background' | 'surface' | 'elevated';

interface ThemedViewProps extends ViewProps {
  variant?: ViewVariant;
}

export function ThemedView({ variant = 'background', style, ...props }: ThemedViewProps) {
  const theme = useTimeBasedTheme();
  const bg =
    variant === 'surface'
      ? theme.surface
      : variant === 'elevated'
      ? theme.surfaceElevated
      : theme.background;

  return <View style={[{ backgroundColor: bg }, style]} {...props} />;
}
