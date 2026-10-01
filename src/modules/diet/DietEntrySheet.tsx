/**
 * DietEntrySheet — 新增一筆飲食紀錄的 Bottom Sheet
 */
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Keyboard, Dimensions, ScrollView, Image, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { Spacing, Radius, Typography } from '../../constants/theme';
import { DietEntry, DietEntryInput, MealType, MEAL_LABELS, MEAL_ORDER } from './dietTypes';
import { analyzeFoodPhoto, FoodPhotoError, FoodPhotoItem, pickFoodPhoto, PhotoSource } from './foodPhoto';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const MAX_KCAL = 5000;
const MAX_MACRO_G = 500;

export interface DietEntrySheetRef {
  open: (meal: MealType, recentFoods: DietEntry[]) => void;
  close: () => void;
}

interface DietEntrySheetProps {
  date: string;
  onSave: (input: DietEntryInput) => Promise<void>;
}

type NumericField = 'kcal' | 'proteinG' | 'carbsG' | 'fatG';

const NUMERIC_FIELDS: Array<{ key: NumericField; label: string; unit: string }> = [
  { key: 'kcal', label: '熱量', unit: 'kcal' },
  { key: 'proteinG', label: '蛋白質', unit: 'g' },
  { key: 'carbsG', label: '碳水', unit: 'g' },
  { key: 'fatG', label: '脂肪', unit: 'g' },
];

const EMPTY_NUMBERS: Record<NumericField, string> = { kcal: '', proteinG: '', carbsG: '', fatG: '' };

/** 只保留數字與一個小數點 */
function sanitizeNumber(text: string): string {
  const clean = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  return parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : clean;
}

export const DietEntrySheet = forwardRef<DietEntrySheetRef, DietEntrySheetProps>(
  ({ date, onSave }, ref) => {
    const theme = useTimeBasedTheme();
    const sheetRef = useRef<BottomSheet>(null);

    const [meal, setMeal] = useState<MealType>('breakfast');
    const [name, setName] = useState('');
    const [numbers, setNumbers] = useState(EMPTY_NUMBERS);
    const [recentFoods, setRecentFoods] = useState<DietEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [photoItems, setPhotoItems] = useState<FoodPhotoItem[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    // 每次分析遞增；關閉表單或重新拍照後，舊的分析結果不再寫回
    const analyzeIdRef = useRef(0);

    const handleOpen = useCallback((initialMeal: MealType, recent: DietEntry[]) => {
      setMeal(initialMeal);
      setName('');
      setNumbers(EMPTY_NUMBERS);
      setRecentFoods(recent);
      setError(null);
      setPhotoUri(null);
      setPhotoItems([]);
      setIsAnalyzing(false);
      analyzeIdRef.current += 1;
      sheetRef.current?.expand();
    }, []);

    const handleClose = useCallback(() => {
      analyzeIdRef.current += 1;
      setIsAnalyzing(false);
      Keyboard.dismiss();
      sheetRef.current?.close();
    }, []);

    useImperativeHandle(ref, () => ({ open: handleOpen, close: handleClose }));

    const fillFromRecent = (food: DietEntry) => {
      setName(food.name);
      setNumbers({
        kcal: String(food.kcal),
        proteinG: String(food.proteinG),
        carbsG: String(food.carbsG),
        fatG: String(food.fatG),
      });
      setError(null);
    };

    const handlePhoto = async (source: PhotoSource) => {
      Keyboard.dismiss();
      setError(null);
      let uri: string | null;
      try {
        uri = await pickFoodPhoto(source);
      } catch (e) {
        setError(e instanceof FoodPhotoError ? e.message : '無法開啟相機或相簿');
        return;
      }
      if (!uri) return;

      const id = ++analyzeIdRef.current;
      setPhotoUri(uri);
      setPhotoItems([]);
      setIsAnalyzing(true);
      try {
        const result = await analyzeFoodPhoto(uri);
        if (id !== analyzeIdRef.current) return;
        setName(result.name);
        setNumbers({
          kcal: String(result.kcal),
          proteinG: String(result.proteinG),
          carbsG: String(result.carbsG),
          fatG: String(result.fatG),
        });
        setPhotoItems(result.items);
      } catch (e) {
        if (id !== analyzeIdRef.current) return;
        setError(e instanceof FoodPhotoError ? e.message : 'AI 辨識失敗，請改用手動輸入');
      } finally {
        if (id === analyzeIdRef.current) setIsAnalyzing(false);
      }
    };

    const handleSave = async () => {
      const trimmed = name.trim();
      const kcal = parseFloat(numbers.kcal);
      // 三大營養素選填，空白視為 0
      const macro = (key: NumericField) => (numbers[key] === '' ? 0 : parseFloat(numbers[key]));
      const proteinG = macro('proteinG');
      const carbsG = macro('carbsG');
      const fatG = macro('fatG');

      if (!trimmed) {
        setError('請輸入食物名稱');
        return;
      }
      if (isNaN(kcal) || kcal < 0 || kcal > MAX_KCAL) {
        setError(`熱量請輸入 0–${MAX_KCAL} kcal`);
        return;
      }
      if ([proteinG, carbsG, fatG].some((g) => isNaN(g) || g < 0 || g > MAX_MACRO_G)) {
        setError(`營養素請輸入 0–${MAX_MACRO_G} g`);
        return;
      }

      setIsSaving(true);
      try {
        await onSave({ date, meal, name: trimmed, kcal, proteinG, carbsG, fatG });
        handleClose();
      } catch {
        setError('儲存失敗，請重試');
      } finally {
        setIsSaving(false);
      }
    };

    const canSave = name.trim() !== '' && numbers.kcal !== '' && !isSaving && !isAnalyzing;

    return (
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={[Math.round(SCREEN_HEIGHT * 0.85)]}
        enablePanDownToClose
        backgroundStyle={{
          backgroundColor: theme.sheetBackground,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
        }}
        handleIndicatorStyle={{ backgroundColor: theme.sheetHandle, width: 40, height: 5 }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        <BottomSheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>新增飲食</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={{ fontSize: 22, color: theme.textTertiary }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 餐別 */}
          <View style={styles.mealRow}>
            {MEAL_ORDER.map((m) => {
              const active = m === meal;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMeal(m)}
                  style={[
                    styles.mealChip,
                    { borderColor: active ? theme.primary : theme.border },
                    active && { backgroundColor: theme.primary },
                  ]}
                >
                  <Text style={[styles.mealChipLabel, { color: active ? theme.textOnPrimary : theme.textSecondary }]}>
                    {MEAL_LABELS[m]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 拍照辨識 */}
          <View style={styles.photoRow}>
            {([['camera', '📷 拍照辨識'], ['library', '🖼️ 從相簿選']] as const).map(([source, label]) => (
              <TouchableOpacity
                key={source}
                onPress={() => handlePhoto(source)}
                disabled={isAnalyzing}
                style={[styles.photoBtn, { backgroundColor: theme.primary + '1A', opacity: isAnalyzing ? 0.5 : 1 }]}
              >
                <Text style={[styles.photoBtnLabel, { color: theme.primary }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {photoUri && (
            <View style={[styles.photoResult, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Image source={{ uri: photoUri }} style={styles.photoThumb} />
              <View style={styles.photoInfo}>
                {isAnalyzing ? (
                  <View style={styles.analyzingRow}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={[styles.photoNote, { color: theme.textSecondary }]}>AI 分析中⋯</Text>
                  </View>
                ) : (
                  <>
                    {photoItems.map((item, idx) => (
                      <Text key={idx} style={[styles.photoItem, { color: theme.textPrimary }]} numberOfLines={1}>
                        {item.name}
                        <Text style={{ color: theme.textTertiary }}>
                          {item.portion ? `　${item.portion}` : ''}　{Math.round(item.kcal)} kcal
                        </Text>
                      </Text>
                    ))}
                    {photoItems.length > 0 && (
                      <Text style={[styles.photoNote, { color: theme.textTertiary }]}>
                        AI 估算僅供參考，請確認下方數值後再儲存
                      </Text>
                    )}
                  </>
                )}
              </View>
            </View>
          )}

          {/* 最近吃過 */}
          {recentFoods.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>最近吃過</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
                {recentFoods.map((food) => (
                  <TouchableOpacity
                    key={food.id}
                    onPress={() => fillFromRecent(food)}
                    style={[styles.recentChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  >
                    <Text style={[styles.recentName, { color: theme.textPrimary }]} numberOfLines={1}>
                      {food.name}
                    </Text>
                    <Text style={[styles.recentKcal, { color: theme.textTertiary }]}>
                      {Math.round(food.kcal)} kcal
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 名稱 */}
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>食物名稱</Text>
          <BottomSheetTextInput
            value={name}
            onChangeText={(t) => { setName(t); setError(null); }}
            placeholder="例：雞胸便當"
            placeholderTextColor={theme.textTertiary}
            style={[styles.textInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface }]}
            maxLength={40}
          />

          {/* 數值 */}
          <View style={styles.numberGrid}>
            {NUMERIC_FIELDS.map(({ key, label, unit }) => (
              <View key={key} style={styles.numberCell}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {label}{key === 'kcal' ? '' : '（選填）'}
                </Text>
                <View style={[styles.numberInputWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <BottomSheetTextInput
                    value={numbers[key]}
                    onChangeText={(t) => {
                      setNumbers((prev) => ({ ...prev, [key]: sanitizeNumber(t) }));
                      setError(null);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={theme.textTertiary}
                    style={[styles.numberInput, { color: theme.textPrimary }]}
                    maxLength={6}
                  />
                  <Text style={[styles.unit, { color: theme.textTertiary }]}>{unit}</Text>
                </View>
              </View>
            ))}
          </View>

          {error && <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>}

          <TouchableOpacity
            onPress={handleSave}
            disabled={!canSave}
            style={[styles.saveBtn, { backgroundColor: canSave ? theme.primary : theme.disabled }]}
          >
            <Text style={[styles.saveBtnLabel, { color: theme.textOnPrimary }]}>
              {isSaving ? '儲存中…' : '儲存'}
            </Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  }
);

DietEntrySheet.displayName = 'DietEntrySheet';

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sheetTitle: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold },
  closeBtn: { padding: Spacing.sm },
  mealRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  mealChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  mealChipLabel: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
  photoRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  photoBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm + 2, borderRadius: Radius.md },
  photoBtnLabel: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
  photoResult: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  photoThumb: { width: 72, height: 72, borderRadius: Radius.sm },
  photoInfo: { flex: 1, justifyContent: 'center', gap: 2 },
  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  photoItem: { fontSize: Typography.size.sm },
  photoNote: { fontSize: Typography.size.xs, marginTop: 2 },
  recentSection: { marginBottom: Spacing.md },
  recentRow: { gap: Spacing.sm },
  recentChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    maxWidth: 140,
  },
  recentName: { fontSize: Typography.size.sm, fontWeight: Typography.weight.medium },
  recentKcal: { fontSize: Typography.size.xs },
  fieldLabel: { fontSize: Typography.size.sm, marginBottom: Spacing.xs },
  textInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: Typography.size.md,
    marginBottom: Spacing.md,
  },
  numberGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: Spacing.md },
  numberCell: { width: '48%' },
  numberInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  numberInput: { flex: 1, fontSize: Typography.size.lg, paddingVertical: Spacing.sm },
  unit: { fontSize: Typography.size.sm },
  errorText: { fontSize: Typography.size.sm, textAlign: 'center', marginTop: Spacing.md },
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    borderRadius: Radius.full,
    minHeight: 52,
  },
  saveBtnLabel: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
});
