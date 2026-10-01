/**
 * AI screenshot import entry
 * SRS flow: select screenshot -> preview -> analyze -> editable review -> confirm write.
 */
import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '../common/ThemedText';
import { PrimaryButton } from '../common/PrimaryButton';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { useUserStore } from '../../stores/userStore';
import { analyzeHealthScreenshot, GEMINI_MODEL_ID } from '../../services/ai/AIServiceRouter';
import { AIExtractedField, AIImportDraft } from '../../types';
import { BusinessRules, Spacing, Radius } from '../../constants/theme';
import { getWeightLogByDate, isValidWeight, toLocalDateString } from '../../db/weightRepository';
import { saveConfirmedAIImport } from '../../db/aiInsightRepository';

const FAB_SIZE = 56;
const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;
const MIN_SHORTEST_EDGE = 600;
const ANALYSIS_TIMEOUT_MS = 45 * 1000;

const cloneFields = (fields: AIExtractedField[]) => fields.map((field) => ({ ...field }));

const scheduleTempScreenshotCleanup = (uri: string) => {
  if (!FileSystem.cacheDirectory || !uri.startsWith(FileSystem.cacheDirectory)) return;
  setTimeout(() => {
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }, 60 * 1000);
};

export function AIFloatingChat() {
  const theme = useTimeBasedTheme();
  const { profile } = useUserStore();
  const insets = useSafeAreaInsets();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [draft, setDraft] = useState<AIImportDraft | null>(null);
  const [fields, setFields] = useState<AIExtractedField[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const open = () => {
    if (!profile.aiConsentGiven) {
      Alert.alert('AI 功能未啟用', '請先到設定開啟本機 AI 截圖解析。', [
        { text: '取消', style: 'cancel' },
        { text: '前往設定', onPress: () => router.push('/(tabs)/settings') },
      ]);
      return;
    }
    bottomSheetModalRef.current?.present();
  };

  const pickScreenshot = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('需要相簿權限', '請允許讀取你選取的健康截圖。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const fileInfo = await FileSystem.getInfoAsync(asset.uri);
    const size = 'size' in fileInfo ? fileInfo.size ?? 0 : 0;
    const shortestEdge = Math.min(asset.width ?? 0, asset.height ?? 0);
    const normalizedType = (asset.mimeType ?? asset.uri.split('.').pop() ?? '').toLowerCase();
    const isSupportedFormat =
      normalizedType.includes('jpeg') ||
      normalizedType.includes('jpg') ||
      normalizedType.includes('png');

    if (size > MAX_SCREENSHOT_BYTES || !isSupportedFormat) {
      Alert.alert('檔案不支援', '請選擇 10 MB 以下的 JPG 或 PNG 截圖。');
      return;
    }
    if (shortestEdge > 0 && shortestEdge < MIN_SHORTEST_EDGE) {
      Alert.alert('截圖解析度不足', '請選擇最短邊至少 600px 的截圖。');
      return;
    }

    setScreenshotUri(asset.uri);
    setDraft(null);
    setFields([]);
  };

  const analyze = async () => {
    if (!screenshotUri || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const nextDraft = await Promise.race([
        analyzeHealthScreenshot(screenshotUri, toLocalDateString()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('分析逾時，請重新選擇截圖後再試。')), ANALYSIS_TIMEOUT_MS)
        ),
      ]);
      scheduleTempScreenshotCleanup(screenshotUri);
      const recognizedFields = nextDraft.fields.filter((field) => field.value.trim().length > 0);
      if (recognizedFields.length === 0) {
        Alert.alert('未偵測到可匯入的體態數據', '請確認截圖包含體重、BMI 或體組成數據後重試。');
        return;
      }
      setDraft(nextDraft);
      setFields(cloneFields(nextDraft.fields));
    } catch (e) {
      Alert.alert('解析失敗', e instanceof Error ? e.message : '請稍後再試');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateField = (name: AIExtractedField['name'], value: string) => {
    setFields((current) =>
      current.map((field) =>
        field.name === name ? { ...field, value: value.replace(/[^0-9.]/g, '') } : field
      )
    );
  };

  const confirmWrite = async () => {
    if (!draft || isSaving) return;
    const weight = Number(fields.find((field) => field.name === 'weight_kg')?.value);
    if (!Number.isFinite(weight) || !isValidWeight(weight)) {
      Alert.alert(
        '請確認體重',
        `體重需介於 ${BusinessRules.weight.min}-${BusinessRules.weight.max} kg。`
      );
      return;
    }

    const save = async () => {
      setIsSaving(true);
      try {
        await saveConfirmedAIImport(
          draft.localDate,
          Math.round(weight * 10) / 10,
          draft.insight,
          draft.modelId
        );
        Alert.alert('已保存', '已寫入今日體重並保存 AI 建議。');
        bottomSheetModalRef.current?.dismiss();
      } catch (e) {
        Alert.alert('保存失敗', e instanceof Error ? e.message : '請稍後再試');
      } finally {
        setIsSaving(false);
      }
    };

    const existing = await getWeightLogByDate(draft.localDate);
    if (existing) {
      Alert.alert('將覆寫當日體重', '這一天已經有體重資料，確認後會覆寫當日體重。', [
        { text: '取消', style: 'cancel' },
        { text: '確認覆寫', onPress: save },
      ]);
      return;
    }

    await save();
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.fab,
          {
            right: Spacing.md,
            bottom: insets.bottom + 88,
            backgroundColor: profile.aiConsentGiven ? theme.primary : theme.disabled,
          },
        ]}
        activeOpacity={0.85}
        onPress={open}
      >
        <Text style={styles.fabText}>AI</Text>
      </TouchableOpacity>

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={['88%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: theme.sheetBackground, borderRadius: 32 }}
        handleIndicatorStyle={{ backgroundColor: theme.sheetHandle, width: 40, height: 5 }}
      >
        <BottomSheetView style={{ flex: 1 }}>
          <View style={[styles.sheetHeader, { borderBottomColor: theme.separator }]}>
            <ThemedText variant="title" bold>AI 截圖解析</ThemedText>
            <ThemedText variant="caption" color="tertiary">
              {GEMINI_MODEL_ID}
            </ThemedText>
          </View>

          <BottomSheetScrollView contentContainerStyle={styles.content}>
            <PrimaryButton label="選取健康截圖" onPress={pickScreenshot} variant="secondary" />

            {screenshotUri && (
              <View style={[styles.preview, { borderColor: theme.border }]}>
                <Image source={{ uri: screenshotUri }} resizeMode="contain" style={styles.previewImage} />
              </View>
            )}

            {screenshotUri && !draft && (
              <PrimaryButton
                label={isAnalyzing ? '解析中...' : '確認並開始解析'}
                onPress={analyze}
                loading={isAnalyzing}
                disabled={isAnalyzing}
              />
            )}

            {isAnalyzing && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.primary} />
                <ThemedText variant="caption" color="secondary">
                  本機模型分析中，請稍候
                </ThemedText>
              </View>
            )}

            {draft && (
              <View style={styles.review}>
                <ThemedText variant="label" color="secondary">
                  請確認欄位後再保存
                </ThemedText>
                {fields.map((field) => {
                  const lowConfidence = field.confidence < 0.85;
                  return (
                    <View key={field.name} style={[styles.fieldCard, { borderColor: theme.border }]}>
                      <View style={styles.fieldHeader}>
                        <ThemedText variant="body" bold>{field.label}</ThemedText>
                        <ThemedText variant="caption" color={lowConfidence ? 'error' : 'secondary'}>
                          信心度 {(field.confidence * 100).toFixed(0)}%
                        </ThemedText>
                      </View>
                      <View style={[styles.inputRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <TextInput
                          value={field.value}
                          onChangeText={(value: string) => updateField(field.name, value)}
                          keyboardType="decimal-pad"
                          placeholder="手動輸入"
                          placeholderTextColor={theme.textTertiary}
                          style={[styles.valueInput, { color: theme.textPrimary }]}
                        />
                        <ThemedText variant="body" color="secondary">{field.unit}</ThemedText>
                      </View>
                      {lowConfidence && (
                        <ThemedText variant="caption" color="error">
                          請手動確認此數值
                        </ThemedText>
                      )}
                    </View>
                  );
                })}

                <View style={[styles.insightBox, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '44' }]}>
                  <ThemedText variant="body">{draft.insight}</ThemedText>
                  <ThemedText variant="caption" color="tertiary" style={{ marginTop: Spacing.sm }}>
                    {draft.disclaimer}
                  </ThemedText>
                </View>

                <PrimaryButton
                  label={isSaving ? '保存中...' : '確認寫入'}
                  onPress={confirmWrite}
                  loading={isSaving}
                  disabled={isSaving}
                />
              </View>
            )}
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 8,
  },
  fabText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  sheetHeader: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
  },
  content: {
    padding: Spacing.xl,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  preview: {
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    height: 260,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  review: {
    gap: Spacing.md,
  },
  fieldCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
  },
  valueInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 16,
    fontWeight: '600',
  },
  insightBox: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
});
