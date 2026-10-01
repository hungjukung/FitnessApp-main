/**
 * PhotoComparisonView — 進度照片對比
 * 並排顯示兩個日期的體態照片，支援日期選擇
 */
import { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Calendar } from 'react-native-calendars';
import { getPhotosByDate } from '../../db/photoRepository';
import { toLocalDateString } from '../../db/weightRepository';
import { PhotoLog } from '../../types';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { ThemedText } from '../common/ThemedText';
import { Spacing, Radius } from '../../constants/theme';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const SNAP_POINT = Math.round(SCREEN_HEIGHT * 0.9);
const PHOTO_SIZE = Math.floor((SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2);

export interface PhotoComparisonViewRef {
  open(beforeDate?: string, afterDate?: string): void;
  close(): void;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface PanelProps {
  label: string;
  date: string;
  photo: PhotoLog | null;
  onPickDate: () => void;
}

function PhotoPanel({ label, date, photo, onPickDate }: PanelProps) {
  const theme = useTimeBasedTheme();
  return (
    <View style={styles.panel}>
      <ThemedText variant="label" color="secondary" center style={{ marginBottom: 4 }}>
        {label}
      </ThemedText>
      <TouchableOpacity
        onPress={onPickDate}
        style={[styles.dateBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <ThemedText variant="caption" bold center style={{ color: theme.primary }}>
          {formatDateLabel(date)} ▾
        </ThemedText>
      </TouchableOpacity>
      {photo ? (
        <Image
          source={{ uri: photo.fileUri }}
          style={[styles.photo, { borderColor: theme.border }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.photoEmpty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ fontSize: 32 }}>📷</Text>
          <ThemedText variant="caption" color="tertiary" center>該日無照片</ThemedText>
        </View>
      )}
    </View>
  );
}

export const PhotoComparisonView = forwardRef<PhotoComparisonViewRef>((_, ref) => {
  const theme = useTimeBasedTheme();
  const sheetRef = useRef<BottomSheet>(null);
  const isDark = theme.background === '#000000';

  const today = toLocalDateString();
  const thirtyDaysAgo = (() => {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - 30);
    return toLocalDateString(d);
  })();

  const [beforeDate, setBeforeDate] = useState(thirtyDaysAgo);
  const [afterDate, setAfterDate] = useState(today);
  const [beforePhoto, setBeforePhoto] = useState<PhotoLog | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<PhotoLog | null>(null);

  // Date picker modal state
  const [pickerTarget, setPickerTarget] = useState<'before' | 'after' | null>(null);

  const loadPhotos = useCallback(async (bDate: string, aDate: string) => {
    const [bPhotos, aPhotos] = await Promise.all([
      getPhotosByDate(bDate),
      getPhotosByDate(aDate),
    ]);
    setBeforePhoto(bPhotos[0] ?? null);
    setAfterPhoto(aPhotos[0] ?? null);
  }, []);

  useImperativeHandle(ref, () => ({
    open(beforeDateArg?: string, afterDateArg?: string) {
      const b = beforeDateArg ?? thirtyDaysAgo;
      const a = afterDateArg ?? today;
      setBeforeDate(b);
      setAfterDate(a);
      loadPhotos(b, a);
      sheetRef.current?.expand();
    },
    close() {
      sheetRef.current?.close();
    },
  }));

  const handleDateSelect = (day: { dateString: string }) => {
    const date = day.dateString;
    if (pickerTarget === 'before') {
      setBeforeDate(date);
      loadPhotos(date, afterDate);
    } else {
      setAfterDate(date);
      loadPhotos(beforeDate, date);
    }
    setPickerTarget(null);
  };

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={[SNAP_POINT]}
        enablePanDownToClose
        backgroundStyle={{
          backgroundColor: theme.sheetBackground,
          borderTopLeftRadius: 50,
          borderTopRightRadius: 50,
        }}
        handleIndicatorStyle={{ backgroundColor: theme.sheetHandle, width: 40, height: 5 }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.content}>
          <ThemedText variant="subtitle" bold style={{ marginBottom: Spacing.lg }}>
            進度對比
          </ThemedText>

          <View style={styles.row}>
            <PhotoPanel
              label="之前"
              date={beforeDate}
              photo={beforePhoto}
              onPickDate={() => setPickerTarget('before')}
            />
            <View style={[styles.divider, { backgroundColor: theme.separator }]} />
            <PhotoPanel
              label="之後"
              date={afterDate}
              photo={afterPhoto}
              onPickDate={() => setPickerTarget('after')}
            />
          </View>

          {!beforePhoto && !afterPhoto && (
            <ThemedText variant="caption" color="tertiary" center style={{ marginTop: Spacing.lg }}>
              選擇有照片的日期來進行對比
            </ThemedText>
          )}

          <View style={{ height: 60 }} />
        </BottomSheetScrollView>
      </BottomSheet>

      {/* 日期選擇 Modal */}
      <Modal
        visible={pickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerTarget(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setPickerTarget(null)}>
          <Pressable style={[styles.calendarCard, { backgroundColor: theme.sheetBackground }]}>
            <ThemedText variant="label" color="secondary" style={{ marginBottom: Spacing.sm }}>
              {pickerTarget === 'before' ? '選擇「之前」日期' : '選擇「之後」日期'}
            </ThemedText>
            <Calendar
              current={pickerTarget === 'before' ? beforeDate : afterDate}
              maxDate={today}
              onDayPress={handleDateSelect}
              theme={{
                backgroundColor: theme.sheetBackground,
                calendarBackground: theme.sheetBackground,
                textSectionTitleColor: theme.textSecondary,
                selectedDayBackgroundColor: theme.primary,
                selectedDayTextColor: '#FFFFFF',
                todayTextColor: theme.primary,
                dayTextColor: theme.textPrimary,
                textDisabledColor: theme.disabled,
                arrowColor: theme.primary,
                monthTextColor: theme.textPrimary,
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
});

PhotoComparisonView.displayName = 'PhotoComparisonView';

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  panel: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'center',
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.33,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  photoEmpty: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.33,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    marginTop: 32,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  calendarCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
  },
});
