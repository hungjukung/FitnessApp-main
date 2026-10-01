import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { initDatabaseSchema } from './config/database';

const PORT = Number(process.env.PORT ?? 3000);

async function main() {
  try {
    await initDatabaseSchema();
    console.log('Database schema ready');
  } catch (err) {
    // AI 端點（例如飲食拍照辨識）不需要資料庫，MySQL 沒開時仍讓伺服器啟動
    console.warn('Database unavailable, starting without it:', err instanceof Error ? err.message : err);
  }

  app.listen(PORT, () => {
    console.log(`FitTrack backend running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
