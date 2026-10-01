import { ScrollView, KeyboardAvoidingView, Platform, ViewStyle, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTimeBasedTheme } from '../../stores/themeStore';

interface SafeScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  /** 套用 SafeAreaView 的邊（預設 top + bottom） */
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
  /** 避開鍵盤 */
  avoidKeyboard?: boolean;
  contentStyle?: ViewStyle;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function SafeScreen({
  children,
  scrollable = false,
  edges = ['top', 'bottom'],
  avoidKeyboard = false,
  contentStyle,
  onRefresh,
  refreshing = false,
}: SafeScreenProps) {
  const theme = useTimeBasedTheme();
  const bgStyle = { flex: 1, backgroundColor: theme.background };

  const content = scrollable ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ flexGrow: 1 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  if (avoidKeyboard) {
    return (
      <SafeAreaView style={bgStyle} edges={edges}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {content}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={bgStyle} edges={edges}>
      {content}
    </SafeAreaView>
  );
}
