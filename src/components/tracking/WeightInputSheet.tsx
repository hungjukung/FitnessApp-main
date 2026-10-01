/**
 * WeightInputSheet — @gorhom/bottom-sheet v5 體重輸入面板
 * 功能：文字鍵盤輸入 + 語音輸入（引導系統鍵盤麥克風）
 * 高度：80%；頂部圓角：50dp
 */
import {
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Keyboard,
  Platform,
  Dimensions,
} from 'react-native';
import BottomSheet, {
  BottomSheetView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { Spacing, Radius, Typography, BusinessRules } from '../../constants/theme';
import { isValidWeight } from '../../db/weightRepository';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export interface WeightInputSheetRef {
  open: () => void;
  close: () => void;
}

interface WeightInputSheetProps {
  /** 呼叫方的初始體重（已記錄）*/
  initialWeight?: number | null;
  /** 儲存成功後的回調 */
  onSave: (weight: number) => Promise<void>;
  /** 關閉面板的回調 */
  onClose?: () => void;
}

// ─────────────────────────────────────────────
// 聲音圖示元件（語音輸入提示）
// ─────────────────────────────────────────────

function MicButton({
  isListening,
  onPress,
}: {
  isListening: boolean;
  onPress: () => void;
}) {
  const theme = useTimeBasedTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isListening) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    return () => pulseRef.current?.stop();
  }, [isListening]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Animated.View
        style={[
          micStyles.micBtn,
          {
            backgroundColor: isListening ? theme.error + '22' : theme.surface,
            borderColor: isListening ? theme.error : theme.border,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Text style={{ fontSize: 24 }}>{isListening ? '🎙️' : '🎤'}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const micStyles = StyleSheet.create({
  micBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────

export const WeightInputSheet = forwardRef<WeightInputSheetRef, WeightInputSheetProps>(
  ({ initialWeight, onSave, onClose }, ref) => {
    const theme = useTimeBasedTheme();
    const sheetRef = useRef<BottomSheet>(null);
    const textInputRef = useRef<any>(null);

    const [weightText, setWeightText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 開啟時預填充已有的體重值
    const handleOpen = useCallback(() => {
      setWeightText(initialWeight ? initialWeight.toFixed(1) : '');
      setError(null);
      setIsListening(false);
      sheetRef.current?.expand();
    }, [initialWeight]);

    const handleClose = useCallback(() => {
      Keyboard.dismiss();
      sheetRef.current?.close();
      onClose?.();
    }, [onClose]);

    useImperativeHandle(ref, () => ({ open: handleOpen, close: handleClose }));

    // 語音輸入：引導使用者使用鍵盤的語音鍵
    const handleMicPress = useCallback(() => {
      if (isListening) {
        setIsListening(false);
        return;
      }
      setIsListening(true);
      // 聚焦 TextInput，讓使用者可以使用鍵盤麥克風按鈕
      setTimeout(() => {
        textInputRef.current?.focus?.();
      }, 100);
      // 3 秒後自動取消「聆聽」狀態
      setTimeout(() => setIsListening(false), 3000);
    }, [isListening]);

    const handleSave = useCallback(async () => {
      const w = parseFloat(weightText.replace(',', '.'));
      if (isNaN(w) || !isValidWeight(w)) {
        setError(
          `請輸入 ${BusinessRules.weight.min.toFixed(1)}-${BusinessRules.weight.max.toFixed(1)} kg 之間的體重`
        );
        return;
      }
      setError(null);
      setIsSaving(true);
      try {
        await onSave(w);
        handleClose();
      } catch (e) {
        setError('儲存失敗，請重試');
      } finally {
        setIsSaving(false);
      }
    }, [weightText, onSave, handleClose]);

    const parsedWeight = parseFloat(weightText.replace(',', '.'));
    const isValid = !isNaN(parsedWeight) && isValidWeight(parsedWeight);

    // 80% of screen height as snap point
    const snapPoint = Math.round(SCREEN_HEIGHT * 0.8);

    return (
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={[snapPoint]}
        enablePanDownToClose
        onClose={onClose}
        backgroundStyle={{
          backgroundColor: theme.sheetBackground,
          borderTopLeftRadius: 50,
          borderTopRightRadius: 50,
        }}
        handleIndicatorStyle={{
          backgroundColor: theme.sheetHandle,
          width: 40,
          height: 5,
        }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        <BottomSheetView style={styles.content}>
          {/* 標題列 */}
          <View style={styles.titleRow}>
            <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
              記錄體重
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={{ fontSize: 22, color: theme.textTertiary }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 輸入區域 */}
          <View style={styles.inputArea}>
            {/* 數字輸入 */}
            <View
              style={[
                styles.inputWrapper,
                {
                  borderColor: error
                    ? theme.error
                    : isValid
                    ? theme.primary
                    : theme.border,
                  backgroundColor: theme.surface,
                },
              ]}
            >
              <BottomSheetTextInput
                ref={textInputRef}
                value={weightText}
                onChangeText={(t) => {
                  setError(null);
                  // 支援語音輸入：允許逗號（轉為句點）、中文「點」
                  let clean = t
                    .replace(/，|。/g, '.')   // 全形標點
                    .replace(/[點点]/g, '.')   // 中文小數點
                    .replace(/,/g, '.')        // 半形逗號
                    .replace(/[^0-9.]/g, ''); // 移除其餘非數字字元
                  // 只保留第一個小數點，防止 "75..5" 之類的情況
                  const parts = clean.split('.');
                  if (parts.length > 2) {
                    clean = parts[0] + '.' + parts.slice(1).join('');
                  }
                  setWeightText(clean);
                }}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'}
                placeholder="75.0"
                placeholderTextColor={theme.textTertiary}
                style={[styles.weightInput, { color: theme.textPrimary }]}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                maxLength={5}
                selectTextOnFocus
              />
              <Text style={[styles.unitLabel, { color: theme.textSecondary }]}>kg</Text>
            </View>

            {/* 語音輸入按鈕 */}
            <View style={styles.micArea}>
              <MicButton isListening={isListening} onPress={handleMicPress} />
              {isListening && (
                <Text style={[styles.micHint, { color: theme.textSecondary }]}>
                  請使用鍵盤麥克風輸入體重
                </Text>
              )}
            </View>
          </View>

          {/* 錯誤訊息 */}
          {error && (
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          )}

          {/* 快速輸入建議（+/- 0.1） */}
          {isValid && (
            <View style={styles.quickAdjust}>
              {[-0.5, -0.1, +0.1, +0.5].map((delta) => {
                const newVal = +(parsedWeight + delta).toFixed(1);
                if (!isValidWeight(newVal)) return null;
                return (
                  <TouchableOpacity
                    key={delta}
                    style={[styles.adjustBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                    onPress={() => setWeightText(newVal.toFixed(1))}
                  >
                    <Text style={[styles.adjustLabel, { color: theme.textSecondary }]}>
                      {delta > 0 ? '+' : ''}{delta}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* 儲存按鈕 */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isValid || isSaving}
            style={[
              styles.saveBtn,
              {
                backgroundColor: isValid && !isSaving ? theme.primary : theme.disabled,
              },
            ]}
          >
            <Text style={[styles.saveBtnLabel, { color: theme.textOnPrimary }]}>
              {isSaving ? '儲存中…' : '💾 儲存'}
            </Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

WeightInputSheet.displayName = 'WeightInputSheet';

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  sheetTitle: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
  },
  closeBtn: {
    padding: Spacing.sm,
  },
  inputArea: {
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 2,
    gap: Spacing.sm,
  },
  weightInput: {
    flex: 1,
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: -1,
    textAlign: 'right',
  },
  unitLabel: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.semibold,
  },
  micArea: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  micHint: {
    fontSize: Typography.size.sm,
  },
  errorText: {
    fontSize: Typography.size.sm,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  quickAdjust: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  adjustBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  adjustLabel: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
  },
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    minHeight: 56,
  },
  saveBtnLabel: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
});
