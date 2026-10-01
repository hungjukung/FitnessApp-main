/**
 * 課表一句話記錄
 *
 * 輸入一句話 → 解析成草稿 → 使用者檢查／修改 → 確認後才寫入今天的訓練 → 教練回一句（誇或嗆）
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTimeBasedTheme } from '../../../stores/themeStore';
import { useWorkoutStore } from '../../../stores/workoutStore';
import { getSessionsByDateRange } from '../../../db/workoutRepository';
import { toLocalDateString } from '../../../db/weightRepository';
import { SetInputRow } from '../../../components/workout/SetInputRow';
import { WorkoutSet } from '../../../types';
import { Radius, Spacing, Typography, OkabeIto } from '../../../constants/theme';
import { pickWorkoutFeedbackLine } from '../../coach';
import { DraftEntry, DraftSet, QuickLogContext, QuickLogDraft, QUICK_LOG_LIMITS } from './types';
import { buildQuickLogContext } from './history';
import { parseQuickLog } from './parseQuickLog';
import { countSets, hasAnyValue } from './validateDraft';
import { evaluateProgress } from './progress';
import { isCardio } from './exerciseAliases';

const EXAMPLES = ['臥推 60 公斤 5x5，最後一組只做 3 下', '跟上次一樣，但深蹲加 5 公斤', '跑步機 20 分鐘'];

/** 歷史紀錄往回看幾天（「上次」與進步比較用） */
const HISTORY_DAYS = 90;

type Step = 'input' | 'parsing' | 'review' | 'saving' | 'done';

interface QuickLogSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 成功寫入後呼叫，讓畫面重新載入 */
  onSaved?: () => void;
}

const EMPTY_CONTEXT: QuickLogContext = { lastSession: null, lastByExercise: {} };

function formatSetSummary(entry: DraftEntry): string {
  if (entry.sets.every((s) => s.durationMin !== undefined && s.weightKg === undefined && s.reps === undefined)) {
    return `${entry.sets.reduce((sum, s) => sum + (s.durationMin ?? 0), 0)} 分鐘`;
  }
  return `${entry.sets.length} 組`;
}

export function QuickLogSheet({ visible, onClose, onSaved }: QuickLogSheetProps) {
  const theme = useTimeBasedTheme();
  const addDraftEntries = useWorkoutStore((s) => s.addDraftEntries);

  const [step, setStep] = useState<Step>('input');
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<QuickLogDraft | null>(null);
  const [context, setContext] = useState<QuickLogContext>(EMPTY_CONTEXT);
  const [coachLine, setCoachLine] = useState('');
  const [savedEntries, setSavedEntries] = useState<DraftEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 每次打開都重新讀歷史，並清空上一次的狀態
  useEffect(() => {
    if (!visible) return;
    setStep('input');
    setText('');
    setDraft(null);
    setCoachLine('');
    setSavedEntries([]);
    setError(null);

    const today = toLocalDateString();
    const start = new Date(`${today}T00:00:00`);
    start.setDate(start.getDate() - HISTORY_DAYS);
    getSessionsByDateRange(toLocalDateString(start), today)
      .then((sessions) => setContext(buildQuickLogContext(sessions, today)))
      .catch(() => setContext(EMPTY_CONTEXT));
  }, [visible]);

  const handleParse = useCallback(async () => {
    if (!text.trim()) return;
    setStep('parsing');
    setError(null);
    const result = await parseQuickLog(text, context);
    setDraft(result);
    setStep(result.entries.length > 0 ? 'review' : 'input');
    if (result.entries.length === 0) {
      setError(
        result.unrecognized.length > 0
          ? `看不懂：「${result.unrecognized.join('」「')}」。換個說法，例如「臥推 60 公斤 5x5」。`
          : '這句沒有看到任何動作。試試「臥推 60 公斤 5x5」。'
      );
    }
  }, [text, context]);

  const updateEntry = useCallback((entryIdx: number, update: (e: DraftEntry) => DraftEntry | null) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const entries = prev.entries
        .map((e, i) => (i === entryIdx ? update(e) : e))
        .filter((e): e is DraftEntry => e !== null && e.sets.length > 0);
      return { ...prev, entries };
    });
  }, []);

  const handleSetChange = useCallback(
    (entryIdx: number, setIdx: number, updated: WorkoutSet) => {
      updateEntry(entryIdx, (e) => ({
        ...e,
        sets: e.sets.map((s, i) =>
          i === setIdx
            ? {
                ...s,
                weightKg: updated.weight !== undefined && updated.weight > 0 ? updated.weight : undefined,
                reps: updated.reps !== undefined && updated.reps > 0 ? updated.reps : undefined,
              }
            : s
        ),
      }));
    },
    [updateEntry]
  );

  const handleDeleteSet = useCallback(
    (entryIdx: number, setIdx: number) => {
      updateEntry(entryIdx, (e) => ({ ...e, sets: e.sets.filter((_, i) => i !== setIdx) }));
    },
    [updateEntry]
  );

  const handleAddSet = useCallback(
    (entryIdx: number) => {
      updateEntry(entryIdx, (e) =>
        e.sets.length >= QUICK_LOG_LIMITS.maxSetsPerEntry ? e : { ...e, sets: [...e.sets, { ...e.sets[e.sets.length - 1] }] }
      );
    },
    [updateEntry]
  );

  const handleConfirm = useCallback(async () => {
    if (!draft) return;
    // 使用者可能把數字清空：沒有任何數值的組不存
    const entries = draft.entries
      .map((e) => ({ ...e, sets: e.sets.filter(hasAnyValue) }))
      .filter((e) => e.sets.length > 0);
    if (entries.length === 0) {
      setError('草稿裡沒有可以存的組數。');
      return;
    }

    setStep('saving');
    try {
      await addDraftEntries(
        entries.map((e) => ({
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          sets: e.sets.map((s: DraftSet) => ({
            weight: s.weightKg,
            reps: s.reps,
            duration: s.durationMin !== undefined ? Math.round(s.durationMin * 60) : undefined,
          })),
        }))
      );

      const progress = evaluateProgress(entries, context);
      const fallbackDelta = progress.overall === 'improved' ? '有進步' : progress.overall === 'regressed' ? '退步了' : '';
      setCoachLine(
        pickWorkoutFeedbackLine(progress.overall, {
          exercise: progress.highlight?.exerciseName,
          delta: progress.highlight?.deltaText ?? fallbackDelta,
        })
      );
      setSavedEntries(entries);
      setStep('done');
      onSaved?.();
    } catch {
      setError('存檔失敗，請再試一次。');
      setStep('review');
    }
  }, [draft, context, addDraftEntries, onSaved]);

  const busy = step === 'parsing' || step === 'saving';
  const setTotal = draft ? countSets(draft.entries) : 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView
        style={[styles.flex, { backgroundColor: theme.sheetBackground }]}
        // iOS 的 pageSheet 本來就不在瀏海下方，不需要上方留白
        edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}
      >
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.separator }]}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>一句話記錄</Text>
            <TouchableOpacity onPress={onClose} disabled={busy} style={styles.closeBtn} accessibilityLabel="關閉">
              <Text style={{ fontSize: 20, color: theme.textTertiary }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {step === 'done' ? (
              <View style={styles.doneWrap}>
                <View style={[styles.coachBubble, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.coachLabel, { color: theme.textSecondary }]}>教練</Text>
                  <Text style={[styles.coachLine, { color: theme.textPrimary }]}>{coachLine}</Text>
                </View>
                <Text style={[styles.savedTitle, { color: theme.textSecondary }]}>已加入今日訓練</Text>
                {savedEntries.map((e) => (
                  <Text key={e.exerciseId} style={[styles.savedItem, { color: theme.textPrimary }]}>
                    {e.exerciseName}　{formatSetSummary(e)}
                  </Text>
                ))}
              </View>
            ) : (
              <>
                {/* Input */}
                <TextInput
                  value={text}
                  onChangeText={setText}
                  editable={!busy}
                  multiline
                  maxLength={QUICK_LOG_LIMITS.maxTextLength}
                  placeholder="例如：臥推 60 公斤 5x5，最後一組只做 3 下"
                  placeholderTextColor={theme.textTertiary}
                  style={[
                    styles.input,
                    { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface },
                  ]}
                />

                {step === 'input' && (!draft || draft.entries.length === 0) && (
                  <View style={styles.examples}>
                    {EXAMPLES.map((ex) => (
                      <TouchableOpacity
                        key={ex}
                        onPress={() => setText(ex)}
                        style={[styles.exampleChip, { borderColor: theme.border }]}
                      >
                        <Text style={[styles.exampleText, { color: theme.textSecondary }]}>{ex}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleParse}
                  disabled={busy || !text.trim()}
                  style={[
                    styles.parseBtn,
                    { backgroundColor: !text.trim() || busy ? theme.disabledBackground : theme.primary },
                  ]}
                >
                  {step === 'parsing' ? (
                    <View style={styles.row}>
                      <ActivityIndicator color={theme.textOnPrimary} />
                      <Text style={[styles.parseText, { color: theme.textOnPrimary }]}>AI 解析中…</Text>
                    </View>
                  ) : (
                    <Text style={[styles.parseText, { color: !text.trim() ? theme.disabled : theme.textOnPrimary }]}>
                      {draft ? '重新解析' : '解析'}
                    </Text>
                  )}
                </TouchableOpacity>

                {error && <Text style={[styles.error, { color: theme.error }]}>{error}</Text>}

                {/* Draft review */}
                {draft && draft.entries.length > 0 && (
                  <View style={styles.draft}>
                    <View style={styles.row}>
                      <Text style={[styles.draftTitle, { color: theme.textPrimary }]}>確認一下</Text>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: (draft.source === 'ai' ? OkabeIto.blue : OkabeIto.orange) + '22' },
                        ]}
                      >
                        <Text
                          style={[styles.badgeText, { color: draft.source === 'ai' ? OkabeIto.blue : OkabeIto.orange }]}
                        >
                          {draft.source === 'ai' ? 'AI 解析' : '離線解析（AI 暫時連不上）'}
                        </Text>
                      </View>
                    </View>

                    {draft.unrecognized.length > 0 && (
                      <Text style={[styles.warning, { color: theme.warning }]}>
                        這幾段沒看懂，沒有加入：「{draft.unrecognized.join('」「')}」
                      </Text>
                    )}

                    {draft.entries.map((entry, entryIdx) => (
                      <View
                        key={`${entry.exerciseId}-${entryIdx}`}
                        style={[styles.entryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      >
                        <View style={styles.entryHeader}>
                          <Text style={[styles.entryName, { color: theme.textPrimary }]}>{entry.exerciseName}</Text>
                          <TouchableOpacity
                            onPress={() => updateEntry(entryIdx, () => null)}
                            accessibilityLabel={`移除${entry.exerciseName}`}
                          >
                            <Text style={{ color: theme.error, fontSize: Typography.size.sm }}>移除</Text>
                          </TouchableOpacity>
                        </View>

                        {entry.sets.map((set, setIdx) =>
                          isCardio(entry.exerciseId) || (set.weightKg === undefined && set.reps === undefined) ? (
                            <View key={setIdx} style={styles.cardioRow}>
                              <Text style={{ color: theme.textPrimary }}>
                                第 {setIdx + 1} 組　{set.durationMin ?? '-'} 分鐘
                              </Text>
                              <TouchableOpacity onPress={() => handleDeleteSet(entryIdx, setIdx)}>
                                <Text style={{ color: theme.textTertiary }}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <SetInputRow
                              key={setIdx}
                              set={{
                                id: `draft-${entryIdx}-${setIdx}`,
                                sessionId: 'draft',
                                exerciseId: entry.exerciseId,
                                exerciseName: entry.exerciseName,
                                setNumber: setIdx + 1,
                                weight: set.weightKg,
                                reps: set.reps,
                                createdAt: 0,
                              }}
                              onChange={(updated) => handleSetChange(entryIdx, setIdx, updated)}
                              onDelete={() => handleDeleteSet(entryIdx, setIdx)}
                            />
                          )
                        )}

                        <TouchableOpacity
                          onPress={() => handleAddSet(entryIdx)}
                          style={[styles.addSetBtn, { borderColor: theme.border }]}
                        >
                          <Text style={{ color: theme.textSecondary, fontSize: Typography.size.sm }}>+ 新增一組</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: theme.separator }]}>
            {step === 'done' ? (
              <TouchableOpacity onPress={onClose} style={[styles.confirmBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.confirmText}>好</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleConfirm}
                disabled={busy || setTotal === 0 || step !== 'review'}
                style={[
                  styles.confirmBtn,
                  {
                    backgroundColor:
                      busy || setTotal === 0 || step !== 'review' ? theme.disabledBackground : OkabeIto.green,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.confirmText,
                    busy || setTotal === 0 || step !== 'review' ? { color: theme.disabled } : null,
                  ]}
                >
                  {step === 'saving' ? '儲存中…' : setTotal > 0 ? `確認加入今日訓練（${setTotal} 組）` : '確認加入今日訓練'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold },
  closeBtn: { padding: Spacing.xs },
  content: { padding: Spacing.lg, gap: Spacing.md },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: Typography.size.md,
    textAlignVertical: 'top',
  },
  examples: { gap: Spacing.sm },
  exampleChip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
  },
  exampleText: { fontSize: Typography.size.sm },
  parseBtn: { paddingVertical: Spacing.md, borderRadius: Radius.full, alignItems: 'center' },
  parseText: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
  error: { fontSize: Typography.size.sm },
  warning: { fontSize: Typography.size.sm },
  draft: { gap: Spacing.md },
  draftTitle: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  badgeText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.medium },
  entryCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.xs },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  entryName: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
  cardioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  addSetBtn: {
    marginTop: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  doneWrap: { gap: Spacing.md, paddingTop: Spacing.lg },
  coachBubble: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  coachLabel: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
  coachLine: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, lineHeight: 30 },
  savedTitle: { fontSize: Typography.size.sm, marginTop: Spacing.md },
  savedItem: { fontSize: Typography.size.md },
  footer: { padding: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  confirmBtn: { paddingVertical: Spacing.md, borderRadius: Radius.full, alignItems: 'center' },
  confirmText: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold, color: '#fff' },
});
