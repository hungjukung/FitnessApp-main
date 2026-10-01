import { View, ViewProps, StyleSheet, Platform } from 'react-native';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { Radius, Spacing } from '../../constants/theme';

type CardVariant = 'default' | 'elevated' | 'outlined' | 'flat';

interface CardProps extends ViewProps {
  variant?: CardVariant;
  padding?: keyof typeof Spacing | number;
  radius?: keyof typeof Radius | number;
}

export function Card({
  variant = 'default',
  padding = 'md',
  radius = 'lg',
  style,
  ...props
}: CardProps) {
  const theme = useTimeBasedTheme();

  const paddingValue = typeof padding === 'number' ? padding : Spacing[padding];
  const radiusValue = typeof radius === 'number' ? radius : Radius[radius];

  const bgColor =
    variant === 'elevated' ? theme.surfaceElevated : theme.surface;

  const shadow =
    variant === 'elevated'
      ? styles.shadowElevated
      : variant === 'flat'
      ? {}
      : styles.shadowDefault;

  const borderStyle =
    variant === 'outlined'
      ? { borderWidth: 1, borderColor: theme.border }
      : {};

  return (
    <View
      style={[
        {
          backgroundColor: bgColor,
          padding: paddingValue,
          borderRadius: radiusValue,
        },
        shadow,
        borderStyle,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  shadowDefault: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  shadowElevated: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});
