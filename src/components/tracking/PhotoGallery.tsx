/**
 * PhotoGallery — 當日體態照片橫向展示
 * 支援：縮圖預覽、長按刪除、空狀態
 */
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useState } from 'react';
import { PhotoLog } from '../../types';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { Spacing, Radius } from '../../constants/theme';

const THUMB_SIZE = 100;
const THUMB_RADIUS = Radius.md;

interface PhotoGalleryProps {
  photos: PhotoLog[];
  onDelete?: (photoId: string) => void;
  onAddPhoto?: () => void;
}

export function PhotoGallery({ photos, onDelete, onAddPhoto }: PhotoGalleryProps) {
  const theme = useTimeBasedTheme();
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const handleLongPress = (photo: PhotoLog) => {
    if (!onDelete) return;
    Alert.alert('刪除照片', '確定要永久刪除這張體態照嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: () => onDelete(photo.id),
      },
    ]);
  };

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 現有照片 */}
        {photos.map((photo, index) => (
          <TouchableOpacity
            key={photo.id}
            onPress={() => setPreviewUri(photo.fileUri)}
            onLongPress={() => handleLongPress(photo)}
            activeOpacity={0.85}
            style={styles.thumbWrapper}
          >
            <Image
              source={{ uri: photo.fileUri }}
              style={[
                styles.thumb,
                { borderColor: theme.border },
              ]}
              resizeMode="cover"
            />
            <View
              style={[
                styles.indexBadge,
                { backgroundColor: theme.primary },
              ]}
            >
              <Text style={styles.indexText}>{index + 1}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* 新增按鈕 */}
        {onAddPhoto && (
          <TouchableOpacity
            onPress={onAddPhoto}
            style={[
              styles.addBtn,
              {
                borderColor: theme.border,
                backgroundColor: theme.surface,
              },
            ]}
          >
            <Text style={{ fontSize: 28 }}>📷</Text>
            <Text style={[styles.addLabel, { color: theme.textSecondary }]}>
              拍照
            </Text>
          </TouchableOpacity>
        )}

        {/* 空狀態 */}
        {photos.length === 0 && !onAddPhoto && (
          <View
            style={[
              styles.emptyState,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={{ fontSize: 32 }}>📷</Text>
            <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
              尚無照片
            </Text>
          </View>
        )}
      </ScrollView>

      {photos.length > 0 && (
        <Text style={[styles.hint, { color: theme.textTertiary }]}>
          長按照片可刪除
        </Text>
      )}

      <Modal visible={previewUri !== null} transparent animationType="fade">
        <Pressable style={styles.previewOverlay} onPress={() => setPreviewUri(null)}>
          {previewUri && (
            <Image
              source={{ uri: previewUri }}
              resizeMode="contain"
              style={styles.previewImage}
            />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  thumbWrapper: {
    position: 'relative',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_RADIUS,
    borderWidth: 1,
  },
  indexBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  addBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_RADIUS,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyText: {
    fontSize: 10,
  },
  hint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  previewImage: {
    width: '100%',
    height: '86%',
  },
});
