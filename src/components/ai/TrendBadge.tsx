/**
 * TrendBadge — 趨勢狀態徽章
 * on_track / plateau / regression
 */
import { View, Text, StyleSheet } from 'react-native';
import { TrendStatus } from '../../types';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { TrendStatusConfig } from '../../services/ai/AIServiceRouter';
import { Radius } from '../../constants/theme';

interface TrendBadgeProps {
  status: TrendStatus;
  size?: 'small' | 'medium' | 'large';
}

export function TrendBadge({ status, size = 'medium' }: TrendBadgeProps) {
  const theme = useTimeBasedTheme();
  const isDark = theme.background === '#000000';
  const config = TrendStatusConfig[status];

  const bg = isDark ? config.darkBg : config.lightBg;
  const textColor = isDark ? config.darkText : config.lightText;

  const fontSize = size === 'small' ? 11 : size === 'large' ? 16 : 13;
  const emojiSize = size === 'small' ? 14 : size === 'large' ? 22 : 18;
  const padding = size === 'small' ? { paddingHorizontal: 8, paddingVertical: 4 } : { paddingHorizontal: 14, paddingVertical: 8 };

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: textColor + '40' }, padding]}>
      <Text style={{ fontSize: emojiSize }}>{config.emoji}</Text>
      <Text style={[styles.label, { color: textColor, fontSize }]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
