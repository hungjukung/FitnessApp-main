import { getDatabase } from './database';

export interface AIInsightRecord {
  id: string;
  date: string;
  insight: string;
  modelId: string;
  createdAt: number;
}

export const saveAIInsight = async (
  date: string,
  insight: string,
  modelId: string
): Promise<AIInsightRecord> => {
  const db = getDatabase();
  const now = Date.now();
  const record: AIInsightRecord = {
    id: `insight_${now}`,
    date,
    insight: insight.slice(0, 120),
    modelId,
    createdAt: now,
  };

  await db.runAsync(
    `INSERT INTO ai_insights (id, date, insight, model_id, created_at)
     VALUES (?, ?, ?, ?, ?);`,
    [record.id, record.date, record.insight, record.modelId, record.createdAt]
  );

  return record;
};

export const getLatestAIInsight = async (): Promise<AIInsightRecord | null> => {
  const db = getDatabase();
  const row = await db.getFirstAsync<{
    id: string;
    date: string;
    insight: string;
    model_id: string;
    created_at: number;
  }>('SELECT * FROM ai_insights ORDER BY created_at DESC LIMIT 1;');

  if (!row) return null;
  return {
    id: row.id,
    date: row.date,
    insight: row.insight,
    modelId: row.model_id,
    createdAt: row.created_at,
  };
};

export const saveConfirmedAIImport = async (
  date: string,
  weight: number,
  insight: string,
  modelId: string
): Promise<void> => {
  const db = getDatabase();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO weight_logs (date, weight, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET weight = excluded.weight, updated_at = excluded.updated_at;`,
      [date, weight, now, now]
    );
    await db.runAsync(
      `INSERT INTO ai_insights (id, date, insight, model_id, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      [`insight_${now}`, date, insight.slice(0, 120), modelId, now]
    );
  });
};
