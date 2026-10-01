/**
 * analyticsStore — 圖表數據計算 Store
 * 從 SQLite weight_logs 計算 ChartDataPoint、SummaryStats、WeeklyDeltaPoint
 */
import { create } from 'zustand';
import { getWeightLogsByRange, toLocalDateString } from '../db/weightRepository';
import {
  TimeRange,
  ChartDataPoint,
  SummaryStats,
  WeeklyDeltaPoint,
  TrendDirection,
} from '../types';

// ─────────────────────────────────────────────
// 工具函式
// ─────────────────────────────────────────────

function getDateRange(range: TimeRange): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  if (range === 'week') start.setDate(end.getDate() - 6);
  else if (range === 'month') start.setDate(end.getDate() - 29);
  else start.setDate(end.getDate() - 89); // 3 months
  return {
    startDate: toLocalDateString(start),
    endDate: toLocalDateString(end),
  };
}

function shortDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function weekLabel(startStr: string, weekIndex: number): string {
  return `W${weekIndex + 1}`;
}

// ─────────────────────────────────────────────
// 計算週變化點
// ─────────────────────────────────────────────

function calcWeeklyDeltas(
  dataMap: Map<string, number>,
  startDate: string,
  endDate: string
): WeeklyDeltaPoint[] {
  const result: WeeklyDeltaPoint[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  // 建立週區間
  let weekStart = new Date(start);
  let weekIndex = 0;

  while (weekStart <= end) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    if (weekEnd > end) weekEnd.setTime(end.getTime());

    // 收集本週所有有效體重值
    const vals: number[] = [];
    const cur = new Date(weekStart);
    while (cur <= weekEnd) {
      const ds = toLocalDateString(cur);
      const v = dataMap.get(ds);
      if (v !== undefined) vals.push(v);
      cur.setDate(cur.getDate() + 1);
    }
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    result.push({
      weekLabel: weekLabel(toLocalDateString(weekStart), weekIndex),
      weekStart: toLocalDateString(weekStart),
      currentWeekAvg: avg,
      prevWeekAvg: result[weekIndex - 1]?.currentWeekAvg ?? null,
      delta:
        avg !== null && (result[weekIndex - 1]?.currentWeekAvg ?? null) !== null
          ? +(avg - (result[weekIndex - 1].currentWeekAvg as number)).toFixed(2)
          : null,
    });

    weekStart.setDate(weekStart.getDate() + 7);
    weekIndex++;
  }

  return result;
}

// ─────────────────────────────────────────────
// 主要計算：生成圖表數據點
// ─────────────────────────────────────────────

function buildChartData(
  dataMap: Map<string, number>,
  range: TimeRange,
  startDate: string,
  endDate: string,
  weeklyDeltas: WeeklyDeltaPoint[]
): ChartDataPoint[] {
  if (range === 'week' || range === 'month') {
    // 每日一個點
    const result: ChartDataPoint[] = [];
    const cur = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    let dayIndex = 0;
    
    while (cur <= end) {
      const ds = toLocalDateString(cur);
      const isEndOfWeek = dayIndex % 7 === 6;
      const isLastDay = ds === endDate;
      const weekIdx = Math.floor(dayIndex / 7);
      
      let deltaForDay = null;
      if ((isEndOfWeek || isLastDay) && weeklyDeltas[weekIdx]) {
        deltaForDay = weeklyDeltas[weekIdx].delta;
      }

      result.push({
        timeLabel: shortDateLabel(ds),
        weightValue: dataMap.get(ds) ?? null,
        weeklyDelta: deltaForDay,
      });
      cur.setDate(cur.getDate() + 1);
      dayIndex++;
    }
    return result;
  } else {
    // 三個月：每週平均
    return weeklyDeltas.map((w) => ({
      timeLabel: w.weekLabel,
      weightValue: w.currentWeekAvg,
      weeklyDelta: w.delta,
    }));
  }
}

// ─────────────────────────────────────────────
// 趨勢判定：比較最近兩週平均
// ─────────────────────────────────────────────

function detectTrend(
  weeklyDeltas: WeeklyDeltaPoint[],
  goal: string | null
): TrendDirection {
  const recent = weeklyDeltas.filter((w) => w.delta !== null).slice(-2);
  if (recent.length < 1) return 'flat';
  const latestDelta = recent[recent.length - 1].delta!;
  if (Math.abs(latestDelta) < 0.1) return 'flat';
  return latestDelta < 0 ? 'down' : 'up';
}

function periodLabel(range: TimeRange): string {
  if (range === 'week') return '過去 7 天';
  if (range === 'month') return '過去 30 天';
  return '過去 3 個月';
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

interface AnalyticsState {
  timeRange: TimeRange;
  chartData: ChartDataPoint[];
  summaryStats: SummaryStats | null;
  weeklyDeltas: WeeklyDeltaPoint[];
  isLoading: boolean;
  error: string | null;

  setTimeRange: (range: TimeRange) => void;
  loadAnalytics: (range: TimeRange, goal?: string | null) => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>()((set, get) => ({
  timeRange: 'month',
  chartData: [],
  summaryStats: null,
  weeklyDeltas: [],
  isLoading: false,
  error: null,

  setTimeRange: (range) => set({ timeRange: range }),

  loadAnalytics: async (range, goal = null) => {
    set({ isLoading: true, error: null });
    try {
      const { startDate, endDate } = getDateRange(range);
      const logs = await getWeightLogsByRange(startDate, endDate);

      if (logs.length < 2) {
        set({
          chartData: [],
          summaryStats: null,
          weeklyDeltas: [],
          isLoading: false,
        });
        return;
      }

      // 建立 date → weight 的 Map
      const dataMap = new Map<string, number>(logs.map((l) => [l.date, l.weight]));

      // 週變化
      const weeklyDeltas = calcWeeklyDeltas(dataMap, startDate, endDate);

      // 圖表數據
      const chartData = buildChartData(dataMap, range, startDate, endDate, weeklyDeltas);

      // 趨勢
      const trend = detectTrend(weeklyDeltas, goal);

      // 統計摘要
      const validWeights = logs.map((l) => l.weight);
      const firstWeight = validWeights[0];
      const lastWeight = validWeights[validWeights.length - 1];
      const highestWeight = Math.max(...validWeights);
      const lowestWeight = Math.min(...validWeights);
      const averageWeight = validWeights.reduce((sum, weight) => sum + weight, 0) / validWeights.length;
      const totalDelta = +(lastWeight - firstWeight).toFixed(2);
      const weeks = Math.max(1, weeklyDeltas.length);
      const avgWeeklyDelta = +(totalDelta / weeks).toFixed(2);

      const summaryStats: SummaryStats = {
        highestWeight: +highestWeight.toFixed(1),
        lowestWeight: +lowestWeight.toFixed(1),
        averageWeight: +averageWeight.toFixed(1),
        totalDelta,
        avgWeeklyDelta,
        trend,
        dataPoints: logs.length,
        periodLabel: periodLabel(range),
      };

      set({ chartData, weeklyDeltas, summaryStats, isLoading: false, timeRange: range });
    } catch (e) {
      set({ error: '載入分析資料失敗', isLoading: false });
    }
  },
}));
