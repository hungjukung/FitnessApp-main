import { Text, TextProps } from 'react-native';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { Typography } from '../../constants/theme';

export type TextVariant = 'display' | 'title' | 'subtitle' | 'body' | 'caption' | 'label';
export type TextColorRole = 'primary' | 'secondary' | 'tertiary' | 'onPrimary' | 'error' | 'success' | 'warning';

interface ThemedTextProps extends TextProps {
  variant?: TextVariant;
  color?: TextColorRole;
  bold?: boolean;
  center?: boolean;
}

const variantStyles: Record<TextVariant, object> = {
  display: {
    fontSize: Typography.size.display,
    fontWeight: Typography.weight.bold,
    lineHeight: Typography.size.display * 1.1,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
    lineHeight: Typography.size.xxl * 1.2,
  },
  subtitle: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.semibold,
    lineHeight: Typography.size.xl * 1.3,
  },
  body: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.regular,
    lineHeight: Typography.size.md * 1.5,
  },
  caption: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.regular,
    lineHeight: Typography.size.sm * 1.4,
  },
  label: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
};

export function ThemedText({
  variant = 'body',
  color = 'primary',
  bold = false,
  center = false,
  style,
  ...props
}: ThemedTextProps) {
  const theme = useTimeBasedTheme();

  const colorMap: Record<TextColorRole, string> = {
    primary: theme.textPrimary,
    secondary: theme.textSecondary,
    tertiary: theme.textTertiary,
    onPrimary: theme.textOnPrimary,
    error: theme.error,
    success: theme.success,
    warning: theme.warning,
  };

  return (
    <Text
      style={[
        variantStyles[variant],
        { color: colorMap[color] },
        bold && { fontWeight: Typography.weight.bold },
        center && { textAlign: 'center' },
        style,
      ]}
      {...props}
    />
  );
}
