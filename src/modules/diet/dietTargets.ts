/**
 * 每日營養目標估計
 *
 * 1. 基礎代謝率（BMR）：Mifflin-St Jeor 公式
 *      男：10 × 體重kg + 6.25 × 身高cm − 5 × 年齡 + 5
 *      女：10 × 體重kg + 6.25 × 身高cm − 5 × 年齡 − 161
 *    未提供性別時取兩者中間值（−78）。
 * 2. TDEE = BMR × 活動係數。App 使用者每週規律訓練，固定用 1.55（中度活動）。
 * 3. 依目標調整熱量，再分配三大營養素。
 *
 * ⚠️ TDEE 是估計值，誤差約 ±10–15%。分析模組只把「明顯」赤字／盈餘當成訊號。
 */

import { FitnessGoal, Gender, UserProfile } from '../../types';
import { DietTargets } from './dietTypes';

export const ACTIVITY_FACTOR = 1.55;

const GENDER_CONSTANT: Record<Gender, number> = {
  male: 5,
  female: -161,
  prefer_not_to_say: -78,
};

/** 熱量目標 = TDEE × 係數：減脂約 20% 赤字、增肌約 10% 盈餘 */
const GOAL_KCAL_FACTOR: Record<FitnessGoal, number> = {
  fat_loss: 0.8,
  maintenance: 1.0,
  muscle_gain: 1.1,
};

/** 蛋白質 g/kg 體重：減脂期提高以保留肌肉（文獻常見範圍 1.6–2.2） */
const PROTEIN_G_PER_KG: Record<FitnessGoal, number> = {
  fat_loss: 2.2,
  maintenance: 1.6,
  muscle_gain: 1.8,
};

/** 脂肪佔總熱量比例 */
const FAT_KCAL_RATIO = 0.25;

export function estimateTdee(profile: UserProfile, weightKg: number | null): number | null {
  const weight = weightKg ?? profile.initialWeightKg;
  if (!weight || !profile.heightCm || !profile.age) return null;

  const genderConstant = GENDER_CONSTANT[profile.gender ?? 'prefer_not_to_say'];
  const bmr = 10 * weight + 6.25 * profile.heightCm - 5 * profile.age + genderConstant;
  return Math.round(bmr * ACTIVITY_FACTOR);
}

export function computeDietTargets(profile: UserProfile, weightKg: number | null): DietTargets | null {
  const tdee = estimateTdee(profile, weightKg);
  const weight = weightKg ?? profile.initialWeightKg;
  if (tdee === null || !weight) return null;

  const goal = profile.goal ?? 'maintenance';
  const kcal = Math.round(tdee * GOAL_KCAL_FACTOR[goal]);
  const proteinG = Math.round(weight * PROTEIN_G_PER_KG[goal]);
  const fatG = Math.round((kcal * FAT_KCAL_RATIO) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));

  return { tdee, kcal, proteinG, carbsG, fatG };
}
