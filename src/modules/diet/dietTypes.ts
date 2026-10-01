export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '點心',
};

/** 一筆飲食紀錄（一份食物） */
export interface DietEntry {
  id: string;
  date: string;       // "YYYY-MM-DD"
  meal: MealType;
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  createdAt: number;
}

export type DietEntryInput = Omit<DietEntry, 'id' | 'createdAt'>;

/** 每日營養目標 */
export interface DietTargets {
  /** 估計的每日總消耗（維持體重所需熱量） */
  tdee: number;
  /** 依目標調整後的每日攝取目標 */
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
