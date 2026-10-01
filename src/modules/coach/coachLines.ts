/**
 * 嗆教練台詞庫（初版範例，請組內改寫成你們要的風格）
 *
 * 規則（見《大四專題改版.md》第零節）：
 * - 嗆的對象只限使用者本人的數據與行為，不拿族群、地區或任何群體當笑點
 * - 數字只能用程式算好的結果（{delta}），台詞本身不編數字
 * - 之後由 LLM 參考這裡的風格、套入真實數據改寫；LLM 連不上時直接用這裡的句子
 *
 * 可用變數：{exercise} 動作名稱、{delta} 帶正負號的差距（例如「+5 kg」「-2 下」），請當成獨立詞使用
 */

export type CoachLevel = 'mild' | 'savage' | 'hell';

export const COACH_LEVEL_LABELS: Record<CoachLevel, string> = {
  mild: '溫和',
  savage: '毒舌',
  hell: '地獄',
};

export const DEFAULT_COACH_LEVEL: CoachLevel = 'savage';

export type WorkoutFeedbackEvent = 'improved' | 'same' | 'regressed' | 'first_time';

export const WORKOUT_FEEDBACK_LINES: Record<WorkoutFeedbackEvent, Record<CoachLevel, string[]>> = {
  improved: {
    mild: ['{exercise} {delta}，比上次強，做得好。', '有進步就是有進步，{exercise} {delta}，繼續保持。'],
    savage: ['{exercise} {delta}？行，今天算你真牛。', '可以喔，{exercise} {delta}，上次說你的話我先收回。'],
    hell: ['{exercise} {delta}，真牛。但別以為我會一直誇你。', '{exercise} {delta}。記住這個感覺，下次沒進步我照樣罵。'],
  },
  same: {
    mild: ['{exercise} 跟上次差不多，下次試著加一點點重量或多做一下。'],
    savage: ['{exercise} 跟上次一模一樣，你是來健身房打卡的嗎？', '原地踏步也是一種才華。{exercise}，下次給我加重。'],
    hell: ['{exercise} 零進步，槓鈴都比你有上進心。', '一樣的重量、一樣的次數，你是在重播上一集嗎？'],
  },
  regressed: {
    mild: ['{exercise} {delta}，比上次弱一點，可能是累了，記得睡飽。'],
    savage: ['{exercise} {delta}？昨晚是熬夜還是偷懶，自己選一個。', '{exercise} {delta}，你的肌肉正在跟你冷戰。'],
    hell: ['{exercise} {delta}。再這樣下去，槓鈴要申請換主人了。', '{exercise} {delta}，我都替你的健身房月費心疼。'],
  },
  first_time: {
    mild: ['第一次記錄 {exercise}，先記下來，下次就能比較了。'],
    savage: ['{exercise} 第一次記錄，先放你一馬，下次沒進步就等著。'],
    hell: ['{exercise} 首次登場。記好了，這就是以後我拿來比較你的基準。'],
  },
};
