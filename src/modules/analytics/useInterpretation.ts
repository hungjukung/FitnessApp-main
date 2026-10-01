/**
 * 透過各模組的 DataSource 讀取窗口內資料，交給判讀引擎
 * 分析模組不直接碰其他模組的 db / store —— 只用 contracts 定義的介面
 */
import { useCallback, useState } from 'react';
import { useUserStore } from '../../stores/userStore';
import { toLocalDateString } from '../../db/weightRepository';
import { weightDataSource } from '../core/weightDataSource';
import { inBodyDataSource } from '../core/inBodyDataSource';
import { workoutDataSource } from '../workout';
import { dietDataSource, estimateTdee } from '../diet';
import { interpret, Interpretation } from './engine/interpret';

function daysBefore(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() - days);
  return toLocalDateString(d);
}

export function useInterpretation(windowDays: number) {
  const { profile } = useUserStore();
  const [result, setResult] = useState<Interpretation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const endDate = toLocalDateString();
      // 窗口為閉區間，共 windowDays 天
      const startDate = daysBefore(endDate, windowDays - 1);

      const [weightLogs, sessions, dietSummaries, inBodyRecords] = await Promise.all([
        weightDataSource.getWeightLogs(startDate, endDate),
        workoutDataSource.getSessions(startDate, endDate),
        dietDataSource.getDailySummaries(startDate, endDate),
        inBodyDataSource.getRecords(startDate, endDate),
      ]);

      const latestWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : null;
      setResult(
        interpret({
          windowDays,
          endDate,
          weightLogs,
          sessions,
          dietSummaries,
          tdee: estimateTdee(profile, latestWeight),
          inBodyRecords,
        })
      );
    } catch (e) {
      console.error('[Analytics] interpret failed:', e);
      setError('判讀失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  }, [windowDays, profile]);

  return { result, isLoading, error, load };
}
