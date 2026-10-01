import { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { Typography, Spacing } from '../../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  icon?: string; // emoji icon
}

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  icon,
}: PrimaryButtonProps) {
  const theme = useTimeBasedTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const isDisabled = disabled || loading;

  const bgColor =
    variant === 'primary'
      ? isDisabled
        ? theme.disabled
        : theme.primary
      : variant === 'secondary'
      ? theme.surface
      : variant === 'danger'
      ? theme.error
      : 'transparent';

  const textColor =
    variant === 'primary' || variant === 'danger'
      ? theme.textOnPrimary
      : variant === 'secondary'
      ? theme.primary
      : theme.textSecondary;

  const borderColor =
    variant === 'secondary' ? theme.border : variant === 'ghost' ? theme.separator : 'transparent';

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], width: fullWidth ? '100%' : undefined }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={1}
        style={[
          styles.button,
          {
            backgroundColor: bgColor,
            borderColor,
            borderWidth: variant === 'secondary' || variant === 'ghost' ? 1.5 : 0,
            opacity: isDisabled && !loading ? 0.5 : 1,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          <>
            {icon && <Text style={styles.icon}>{icon}</Text>}
            <Text style={[styles.label, { color: textColor }]}>{label}</Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 9999,
    minHeight: 56,
    gap: 8,
  },
  label: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    letterSpacing: 0.2,
  },
  icon: {
    fontSize: Typography.size.lg,
  },
});
