import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  SectionList,
  StyleSheet,
  Dimensions,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Exercise } from '../../types';
import { BUILT_IN_EXERCISES, EXERCISE_SECTIONS } from '../../constants/exercises';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { Spacing, Radius, Typography } from '../../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ExercisePickerSheetRef {
  open: () => void;
  close: () => void;
}

interface ExercisePickerSheetProps {
  onSelect: (exercise: Exercise) => void;
}

export const ExercisePickerSheet = forwardRef<ExercisePickerSheetRef, ExercisePickerSheetProps>(
  ({ onSelect }, ref) => {
    const theme = useTimeBasedTheme();
    const sheetRef = useRef<BottomSheet>(null);
    const [query, setQuery] = useState('');

    const open = useCallback(() => {
      setQuery('');
      sheetRef.current?.expand();
    }, []);

    const close = useCallback(() => {
      sheetRef.current?.close();
    }, []);

    useImperativeHandle(ref, () => ({ open, close }));

    const handleSelect = useCallback(
      (exercise: Exercise) => {
        onSelect(exercise);
        close();
      },
      [onSelect, close]
    );

    const sections = EXERCISE_SECTIONS.map((section) => ({
      title: section.label,
      data: BUILT_IN_EXERCISES.filter(
        (e) =>
          e.muscleGroups.some((mg) => section.muscleGroups.includes(mg)) &&
          (query.length === 0 || e.name.includes(query))
      ),
    })).filter((s) => s.data.length > 0);

    const snapPoint = Math.round(SCREEN_HEIGHT * 0.75);

    return (
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={[snapPoint]}
        enablePanDownToClose
        backgroundStyle={{
          backgroundColor: theme.sheetBackground,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
        handleIndicatorStyle={{ backgroundColor: theme.sheetHandle, width: 40, height: 5 }}
      >
        <BottomSheetView style={[styles.container, { backgroundColor: theme.sheetBackground }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>選擇動作</Text>
            <TouchableOpacity onPress={close}>
              <Text style={{ fontSize: 20, color: theme.textTertiary }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[styles.searchWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={{ fontSize: 16 }}>🔍</Text>
            <BottomSheetTextInput
              value={query}
              onChangeText={setQuery}
              placeholder="搜尋動作名稱…"
              placeholderTextColor={theme.textTertiary}
              style={[styles.searchInput, { color: theme.textPrimary }]}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Text style={{ color: theme.textTertiary }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Exercise list */}
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                  {section.title}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                style={[styles.exerciseRow, { borderBottomColor: theme.separator }]}
                activeOpacity={0.6}
              >
                <Text style={[styles.exerciseName, { color: theme.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.exerciseCategory, { color: theme.textTertiary }]}>
                  {item.category === 'compound' ? '複合' : item.category === 'isolation' ? '孤立' : '有氧'}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
            // RN 0.86 的 ScrollViewStickyHeader 放在 bottom sheet 裡會無限重繪（Maximum update depth exceeded），
            // 而且此面板關閉時也會先渲染，App 一打開就當掉。iOS 預設會開，所以要明確關掉。
            stickySectionHeadersEnabled={false}
          />
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

ExercisePickerSheet.displayName = 'ExercisePickerSheet';

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.size.md,
    minHeight: 32,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseName: { fontSize: Typography.size.md },
  exerciseCategory: { fontSize: Typography.size.sm },
  listContent: { paddingBottom: Spacing.xxl },
});
