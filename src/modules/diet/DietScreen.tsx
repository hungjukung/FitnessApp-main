/**
 * 飲食控制頁：每日熱量／三大營養素 vs 目標，依餐別記錄
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTimeBasedTheme } from '../../stores/themeStore';
import { useUserStore } from '../../stores/userStore';
import { ThemedText } from '../../components/common/ThemedText';
import { Card } from '../../components/common/Card';
import { toLocalDateString } from '../../db/weightRepository';
import { Spacing, Radius, Typography, OkabeIto } from '../../constants/theme';
import { weightDataSource } from '../core/weightDataSource';
import { addDietEntry, deleteDietEntry, getDietEntriesByDate, getRecentFoods } from './dietRepository';
import { computeDietTargets } from './dietTargets';
import { DietEntrySheet, DietEntrySheetRef } from './DietEntrySheet';
import { DietEntry, DietEntryInput, MealType, MEAL_LABELS, MEAL_ORDER } from './dietTypes';

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

function formatDateLabel(date: string, today: string): string {
  if (date === today) return '今天';
  if (date === shiftDate(today, -1)) return '昨天';
  const d = new Date(date + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function MacroBar({ label, value, target, color }: {
  label: string; value: number; target: number | null; color: string;
}) {
  const theme = useTimeBasedTheme();
  const ratio = target ? Math.min(value / target, 1) : 0;
  return (
    <View style={styles.macro}>
      <View style={styles.macroHeader}>
        <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.macroValue, { color: theme.textPrimary }]}>
          {Math.round(value)}{target ? ` / ${target}` : ''} g
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View style={[styles.fill, { width: `${ratio * 100}%` as const, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function DietScreen() {
  const theme = useTimeBasedTheme();
  const { profile } = useUserStore();
  const sheetRef = useRef<DietEntrySheetRef>(null);

  const today = toLocalDateString();
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState<DietEntry[]>([]);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [dayEntries, weights] = await Promise.all([
        getDietEntriesByDate(date),
        weightDataSource.getWeightLogs(shiftDate(today, -30), today),
      ]);
      setEntries(dayEntries);
      setLatestWeight(weights.length > 0 ? weights[weights.length - 1].weight : null);
    } catch {
      setEntries([]);
    }
  }, [date, today]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const targets = useMemo(() => computeDietTargets(profile, latestWeight), [profile, latestWeight]);

  const totals = useMemo(
    () => entries.reduce(
      (acc, e) => ({
        kcal: acc.kcal + e.kcal,
        proteinG: acc.proteinG + e.proteinG,
        carbsG: acc.carbsG + e.carbsG,
        fatG: acc.fatG + e.fatG,
      }),
      { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    ),
    [entries]
  );

  const openSheet = async (meal: MealType) => {
    const recent = await getRecentFoods().catch(() => []);
    sheetRef.current?.open(meal, recent);
  };

  const handleSave = async (input: DietEntryInput) => {
    await addDietEntry(input);
    await loadData();
  };

  const handleDelete = (entry: DietEntry) => {
    Alert.alert('刪除紀錄', `確定要刪除「${entry.name}」嗎？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          await deleteDietEntry(entry.id);
          await loadData();
        },
      },
    ]);
  };

  const kcalRatio = targets ? totals.kcal / targets.kcal : 0;
  const remaining = targets ? Math.round(targets.kcal - totals.kcal) : null;
  const overTarget = remaining !== null && remaining < 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header + 日期切換 */}
      <View style={[styles.header, { borderBottomColor: theme.separator }]}>
        <ThemedText variant="title" bold>飲食</ThemedText>
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => setDate(shiftDate(date, -1))} style={styles.dateBtn}>
            <Text style={[styles.dateArrow, { color: theme.primary }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.dateLabel, { color: theme.textPrimary }]}>{formatDateLabel(date, today)}</Text>
          <TouchableOpacity
            onPress={() => setDate(shiftDate(date, 1))}
            disabled={date >= today}
            style={styles.dateBtn}
          >
            <Text style={[styles.dateArrow, { color: date >= today ? theme.disabled : theme.primary }]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >
        {/* 今日總覽 */}
        <Card variant="default" padding="lg" style={styles.summaryCard}>
          <View style={styles.kcalRow}>
            <View>
              <ThemedText variant="caption" color="secondary">已攝取</ThemedText>
              <Text style={[styles.kcalBig, { color: theme.textPrimary }]}>
                {Math.round(totals.kcal)}
                <Text style={[styles.kcalUnit, { color: theme.textTertiary }]}>
                  {targets ? ` / ${targets.kcal}` : ''} kcal
                </Text>
              </Text>
            </View>
            {remaining !== null && (
              <View style={styles.remaining}>
                <ThemedText variant="caption" color="secondary">{overTarget ? '超出' : '剩餘'}</ThemedText>
                <Text style={[styles.remainingValue, { color: overTarget ? theme.warning : theme.textPrimary }]}>
                  {Math.abs(remaining)}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.track, styles.kcalTrack, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.min(kcalRatio, 1) * 100}%` as const,
                  backgroundColor: overTarget ? theme.warning : theme.primary,
                },
              ]}
            />
          </View>

          <View style={styles.macroList}>
            <MacroBar label="蛋白質" value={totals.proteinG} target={targets?.proteinG ?? null} color={OkabeIto.vermillion} />
            <MacroBar label="碳水" value={totals.carbsG} target={targets?.carbsG ?? null} color={OkabeIto.skyBlue} />
            <MacroBar label="脂肪" value={totals.fatG} target={targets?.fatG ?? null} color={OkabeIto.orange} />
          </View>

          {targets ? (
            <ThemedText variant="caption" color="tertiary" style={styles.targetNote}>
              估計每日消耗 {targets.tdee} kcal（Mifflin-St Jeor × 1.55），目標已依你的健身目標調整
            </ThemedText>
          ) : (
            <ThemedText variant="caption" color="tertiary" style={styles.targetNote}>
              在設定填寫年齡、身高與體重後，就能計算每日目標
            </ThemedText>
          )}
        </Card>

        {/* 各餐 */}
        {MEAL_ORDER.map((meal) => {
          const mealEntries = entries.filter((e) => e.meal === meal);
          const mealKcal = mealEntries.reduce((s, e) => s + e.kcal, 0);
          return (
            <Card key={meal} variant="outlined" style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <Text style={[styles.mealTitle, { color: theme.textPrimary }]}>{MEAL_LABELS[meal]}</Text>
                <View style={styles.mealHeaderRight}>
                  {mealKcal > 0 && (
                    <Text style={[styles.mealKcal, { color: theme.textSecondary }]}>{Math.round(mealKcal)} kcal</Text>
                  )}
                  <TouchableOpacity
                    onPress={() => openSheet(meal)}
                    style={[styles.addBtn, { backgroundColor: theme.primary + '1A' }]}
                  >
                    <Text style={[styles.addBtnLabel, { color: theme.primary }]}>＋ 新增</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {mealEntries.map((entry) => (
                <View key={entry.id} style={[styles.entryRow, { borderTopColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.entryName, { color: theme.textPrimary }]} numberOfLines={1}>{entry.name}</Text>
                    <Text style={[styles.entryMacros, { color: theme.textTertiary }]}>
                      P {Math.round(entry.proteinG)} · C {Math.round(entry.carbsG)} · F {Math.round(entry.fatG)} g
                    </Text>
                  </View>
                  <Text style={[styles.entryKcal, { color: theme.textSecondary }]}>{Math.round(entry.kcal)}</Text>
                  <TouchableOpacity onPress={() => handleDelete(entry)} style={styles.deleteBtn}>
                    <Text style={{ color: theme.textTertiary, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </Card>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      <DietEntrySheet ref={sheetRef} date={date} onSave={handleSave} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
  },
  dateNav: { flexDirection: 'row', alignItems: 'center' },
  dateBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  dateArrow: { fontSize: 26, fontWeight: '300' },
  dateLabel: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold, minWidth: 48, textAlign: 'center' },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.md },
  summaryCard: { gap: Spacing.md },
  kcalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  kcalBig: { fontSize: Typography.size.display, fontWeight: Typography.weight.bold },
  kcalUnit: { fontSize: Typography.size.md, fontWeight: Typography.weight.regular },
  remaining: { alignItems: 'flex-end' },
  remainingValue: { fontSize: Typography.size.xxl, fontWeight: Typography.weight.semibold },
  track: { height: 6, borderRadius: Radius.full, overflow: 'hidden' },
  kcalTrack: { height: 10 },
  fill: { height: '100%', borderRadius: Radius.full },
  macroList: { gap: Spacing.sm },
  macro: { gap: 4 },
  macroHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  macroLabel: { fontSize: Typography.size.sm },
  macroValue: { fontSize: Typography.size.sm, fontWeight: Typography.weight.medium },
  targetNote: { marginTop: Spacing.xs },
  mealCard: { gap: Spacing.sm },
  mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  mealTitle: { fontSize: Typography.size.lg, fontWeight: Typography.weight.semibold },
  mealKcal: { fontSize: Typography.size.sm },
  addBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full },
  addBtnLabel: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  entryName: { fontSize: Typography.size.md },
  entryMacros: { fontSize: Typography.size.xs, marginTop: 2 },
  entryKcal: { fontSize: Typography.size.md, fontWeight: Typography.weight.medium },
  deleteBtn: { padding: Spacing.xs },
});
