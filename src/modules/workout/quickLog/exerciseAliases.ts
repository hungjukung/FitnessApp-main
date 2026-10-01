/**
 * 動作別名：使用者平常怎麼稱呼動作
 *
 * - 離線解析用來比對文字；AI 解析時也會連同動作清單一起送出，提高對應正確率
 * - 刻意不放太短的別名（例如單獨一個「蹲」「划船」），避免「保加利亞分腿蹲」被誤判成深蹲
 * - 新增動作到 constants/exercises.ts 時，記得也在這裡補別名
 */

import { Exercise } from '../../../types';
import { BUILT_IN_EXERCISES } from '../../../constants/exercises';

export const EXERCISE_ALIASES: Record<string, string[]> = {
  bench_press: ['臥推', '平板臥推', '槓鈴臥推', 'bench'],
  incline_bench: ['上斜臥推', '上斜推'],
  decline_bench: ['下斜臥推'],
  dumbbell_fly: ['飛鳥', '啞鈴飛鳥'],
  cable_crossover: ['夾胸', '繩索夾胸', '滑輪夾胸'],
  push_up: ['伏地挺身', '俯地挺身'],

  deadlift: ['硬舉', '槓鈴硬舉'],
  pull_up: ['引體向上', '引體'],
  lat_pulldown: ['滑輪下拉', '高位下拉', '下拉'],
  seated_row: ['坐姿划船'],
  bent_over_row: ['俯身划船', '槓鈴划船'],
  face_pull: ['臉拉', '面拉'],

  squat: ['深蹲', '槓鈴深蹲', '背蹲'],
  leg_press: ['腿推', '腿推機'],
  romanian_deadlift: ['羅馬尼亞硬舉', 'RDL'],
  leg_curl: ['腿彎舉', '腿後勾'],
  leg_extension: ['腿伸展', '腿屈伸'],
  calf_raise: ['小腿上提', '提踵'],
  lunge: ['弓步蹲', '弓箭步'],
  hip_thrust: ['臀推'],

  overhead_press: ['肩推', '槓鈴肩推', '站姿肩推'],
  dumbbell_shoulder_press: ['啞鈴肩推'],
  lateral_raise: ['側平舉'],
  front_raise: ['前平舉'],
  rear_delt_fly: ['後三角飛鳥', '反向飛鳥'],

  barbell_curl: ['槓鈴彎舉'],
  dumbbell_curl: ['啞鈴彎舉', '二頭彎舉'],
  hammer_curl: ['錘式彎舉'],
  tricep_pushdown: ['三頭下壓'],
  skull_crusher: ['頭頂三頭伸展', '碎顱者'],
  dips: ['雙槓撐體', '雙槓'],

  plank: ['棒式'],
  crunch: ['捲腹'],
  russian_twist: ['俄羅斯轉體'],
  leg_raise: ['懸掛舉腿', '舉腿'],
  cable_crunch: ['繩索捲腹'],

  treadmill: ['跑步機', '跑步'],
  jump_rope: ['跳繩'],
  cycling: ['飛輪', '腳踏車', '單車'],
  rowing: ['划船機'],
  elliptical: ['橢圓機'],
};

export const EXERCISE_BY_ID = new Map<string, Exercise>(BUILT_IN_EXERCISES.map((e) => [e.id, e]));

export interface AliasMatch {
  alias: string;
  exerciseId: string;
}

/** 名稱 + 別名，依長度由長到短排序（先比對「羅馬尼亞硬舉」再比對「硬舉」） */
export const ALIAS_INDEX: AliasMatch[] = BUILT_IN_EXERCISES.flatMap((e) =>
  Array.from(new Set([e.name, ...(EXERCISE_ALIASES[e.id] ?? [])])).map((alias) => ({
    alias,
    exerciseId: e.id,
  }))
).sort((a, b) => b.alias.length - a.alias.length);

/** 送給後端的動作清單 */
export function buildCatalogPayload(): Array<{ id: string; name: string; aliases: string[] }> {
  return BUILT_IN_EXERCISES.map((e) => ({
    id: e.id,
    name: e.name,
    aliases: EXERCISE_ALIASES[e.id] ?? [],
  }));
}

export function isCardio(exerciseId: string): boolean {
  return EXERCISE_BY_ID.get(exerciseId)?.category === 'cardio';
}

export function exerciseName(exerciseId: string): string {
  return EXERCISE_BY_ID.get(exerciseId)?.name ?? exerciseId;
}
