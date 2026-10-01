# 模組分工

| 模組 | 資料夾 | Tab 路由 | 負責人 |
|---|---|---|---|
| 飲食控制 | `diet/` | `app/(tabs)/diet.tsx` | （待填） |
| 記錄課表 | `workout/` | `app/(tabs)/workout.tsx` | （待填） |
| 數據分析 | `analytics/` | `app/(tabs)/analytics.tsx` | （待填） |
| 嗆教練 | `coach/` | （沒有獨立分頁，由其他模組呼叫） | （待填） |

`core/` 放不屬於任何一組的共用資料來源（體重、InBody）。

## 各模組內容

### diet/ 飲食控制
- `dietTypes.ts`：餐別、飲食紀錄、營養目標的型別
- `dietRepository.ts`：SQLite CRUD（資料表 `diet_entries`，於 `db/database.ts` migration v4 建立）
- `dietTargets.ts`：Mifflin-St Jeor 估計 TDEE，依健身目標算出每日熱量與三大營養素目標
- `DietScreen.tsx` / `DietEntrySheet.tsx`：每日總覽、依餐別記錄、最近吃過快速帶入、切換日期
- `foodPhoto.ts`：**拍照辨識**——拍照／選照片 → 壓縮 → 後端 `/ai/analyze-food`（xAI Grok `grok-4.3` 估算份量、熱量、三大營養素）→ 帶入表單讓使用者確認後才存檔；照片不保存

### workout/ 記錄課表
- `WorkoutScreen.tsx`：今日訓練、最近紀錄（原有功能）+ 訓練指標卡片
- `workoutMetrics.ts`：**訓練指標的定義**——每肌群有效組數（5–30 下、主要肌群 1 組／次要 0.5 組）、Epley e1RM
- `TrainingMetricsCard.tsx`：近 7 天各肌群組數、主要動作 e1RM
- `quickLog/`：**課表一句話記錄**（「臥推 60 公斤 5x5」「跟上次一樣，但深蹲加 5 公斤」）
  - `parseQuickLog.ts`：先送後端 `/ai/parse-workout` 讓 Gemini 解析；逾時、沒登入或失敗時改用離線解析
  - `localParser.ts`：離線規則解析（demo 現場網路不穩也能用）
  - `validateDraft.ts`：不論來源，草稿都先驗證（動作必須在動作庫、數字必須合理）
  - `progress.ts`：這次跟上次比有沒有進步（e1RM／重量／次數／時間），決定教練要誇還是嗆
  - `exerciseAliases.ts`：動作別名（新增動作時記得補）
  - `QuickLogSheet.tsx`：輸入 → 草稿確認 → 存檔 → 教練回一句
  - 測試：`npx tsx --test src/modules/workout/quickLog/quickLog.test.ts`

### analytics/ 數據分析
- `engine/`：**判讀引擎（純函式，不依賴 UI，可以直接寫單元測試）**
  - `thresholds.ts`：所有門檻值與理由
  - `regression.ts`：線性迴歸 + 斜率標準誤
  - `signals.ts`：體重、訓練量、e1RM、熱量、InBody → 「相容方向集合」
  - `hypotheses.ts`：H1–H6 假設表與排除邏輯
  - `interpret.ts`：結論／無法區分／拒答 + 信心分級
- `useInterpretation.ts`：透過各模組的 DataSource 讀資料
- `components/`：判讀結果卡片、判讀依據卡片

### coach/ 嗆教練
- `coachLines.ts`：台詞庫（初版範例，請改寫成組內要的風格）與嗆度（溫和／毒舌／地獄）
- `index.ts`：`pickWorkoutFeedbackLine()` 依事件（進步／持平／退步／第一次）挑台詞
- 之後要接：嗆度設定、LLM 參考台詞庫改寫

## 規則

1. **只改自己的資料夾。** `app/(tabs)/*.tsx` 只是一行 re-export，不要在裡面寫邏輯。
2. **跨模組只能 import 對方的 `index.ts`。** 例如分析組可以 `import { workoutDataSource } from '../workout'`，
   不能 `import ... from '../workout/WorkoutScreen'`。
3. **資料格式以 `contracts.ts` 為準。** 要改必須三人同意，改完通知大家。
4. **共用檔案**（`app/(tabs)/_layout.tsx`、`src/types/index.ts`、`src/db/database.ts` 的建表）改之前先講一聲。
5. 每人開自己的 branch，小步合併回 `main`。
