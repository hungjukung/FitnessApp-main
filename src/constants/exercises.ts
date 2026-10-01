import { Exercise } from '../types';

export const BUILT_IN_EXERCISES: Exercise[] = [
  // ── 胸部 ──
  { id: 'bench_press', name: '槓鈴臥推', muscleGroups: ['chest', 'triceps', 'shoulders'], category: 'compound' },
  { id: 'incline_bench', name: '上斜臥推', muscleGroups: ['chest', 'triceps', 'shoulders'], category: 'compound' },
  { id: 'decline_bench', name: '下斜臥推', muscleGroups: ['chest', 'triceps'], category: 'compound' },
  { id: 'dumbbell_fly', name: '啞鈴飛鳥', muscleGroups: ['chest'], category: 'isolation' },
  { id: 'cable_crossover', name: '繩索夾胸', muscleGroups: ['chest'], category: 'isolation' },
  { id: 'push_up', name: '伏地挺身', muscleGroups: ['chest', 'triceps', 'shoulders'], category: 'compound' },

  // ── 背部 ──
  { id: 'deadlift', name: '槓鈴硬舉', muscleGroups: ['back', 'glutes', 'hamstrings'], category: 'compound' },
  { id: 'pull_up', name: '引體向上', muscleGroups: ['back', 'biceps'], category: 'compound' },
  { id: 'lat_pulldown', name: '下拉訓練', muscleGroups: ['back', 'biceps'], category: 'compound' },
  { id: 'seated_row', name: '坐姿划船', muscleGroups: ['back', 'biceps'], category: 'compound' },
  { id: 'bent_over_row', name: '俯身槓鈴划船', muscleGroups: ['back', 'biceps'], category: 'compound' },
  { id: 'face_pull', name: '臉拉', muscleGroups: ['back', 'shoulders'], category: 'isolation' },

  // ── 腿部 ──
  { id: 'squat', name: '槓鈴深蹲', muscleGroups: ['quads', 'glutes', 'hamstrings'], category: 'compound' },
  { id: 'leg_press', name: '腿推機', muscleGroups: ['quads', 'glutes'], category: 'compound' },
  { id: 'romanian_deadlift', name: '羅馬尼亞硬舉', muscleGroups: ['hamstrings', 'glutes', 'back'], category: 'compound' },
  { id: 'leg_curl', name: '腿彎舉', muscleGroups: ['hamstrings'], category: 'isolation' },
  { id: 'leg_extension', name: '腿伸展', muscleGroups: ['quads'], category: 'isolation' },
  { id: 'calf_raise', name: '小腿上提', muscleGroups: ['calves'], category: 'isolation' },
  { id: 'lunge', name: '弓步蹲', muscleGroups: ['quads', 'glutes', 'hamstrings'], category: 'compound' },
  { id: 'hip_thrust', name: '臀推', muscleGroups: ['glutes', 'hamstrings'], category: 'compound' },

  // ── 肩部 ──
  { id: 'overhead_press', name: '槓鈴肩推', muscleGroups: ['shoulders', 'triceps'], category: 'compound' },
  { id: 'dumbbell_shoulder_press', name: '啞鈴肩推', muscleGroups: ['shoulders', 'triceps'], category: 'compound' },
  { id: 'lateral_raise', name: '側平舉', muscleGroups: ['shoulders'], category: 'isolation' },
  { id: 'front_raise', name: '前平舉', muscleGroups: ['shoulders'], category: 'isolation' },
  { id: 'rear_delt_fly', name: '後三角飛鳥', muscleGroups: ['shoulders', 'back'], category: 'isolation' },

  // ── 手臂 ──
  { id: 'barbell_curl', name: '槓鈴彎舉', muscleGroups: ['biceps'], category: 'isolation' },
  { id: 'dumbbell_curl', name: '啞鈴彎舉', muscleGroups: ['biceps'], category: 'isolation' },
  { id: 'hammer_curl', name: '錘式彎舉', muscleGroups: ['biceps', 'forearms'], category: 'isolation' },
  { id: 'tricep_pushdown', name: '三頭下壓', muscleGroups: ['triceps'], category: 'isolation' },
  { id: 'skull_crusher', name: '頭頂三頭伸展', muscleGroups: ['triceps'], category: 'isolation' },
  { id: 'dips', name: '雙槓撐體', muscleGroups: ['triceps', 'chest', 'shoulders'], category: 'compound' },

  // ── 核心 ──
  { id: 'plank', name: '棒式', muscleGroups: ['core'], category: 'isolation' },
  { id: 'crunch', name: '捲腹', muscleGroups: ['core'], category: 'isolation' },
  { id: 'russian_twist', name: '俄羅斯轉體', muscleGroups: ['core'], category: 'isolation' },
  { id: 'leg_raise', name: '懸掛舉腿', muscleGroups: ['core'], category: 'isolation' },
  { id: 'cable_crunch', name: '繩索捲腹', muscleGroups: ['core'], category: 'isolation' },

  // ── 有氧 ──
  { id: 'treadmill', name: '跑步機', muscleGroups: ['cardio'], category: 'cardio' },
  { id: 'jump_rope', name: '跳繩', muscleGroups: ['cardio'], category: 'cardio' },
  { id: 'cycling', name: '飛輪/腳踏車', muscleGroups: ['cardio', 'quads'], category: 'cardio' },
  { id: 'rowing', name: '划船機', muscleGroups: ['cardio', 'back'], category: 'cardio' },
  { id: 'elliptical', name: '橢圓機', muscleGroups: ['cardio'], category: 'cardio' },
];

export const MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: '胸部',
  back: '背部',
  shoulders: '肩部',
  biceps: '二頭肌',
  triceps: '三頭肌',
  forearms: '前臂',
  core: '核心',
  quads: '股四頭肌',
  hamstrings: '腿後肌',
  glutes: '臀部',
  calves: '小腿',
  cardio: '有氧',
};

export const EXERCISE_SECTION_ORDER = [
  'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio',
] as const;

export type ExerciseSectionKey = typeof EXERCISE_SECTION_ORDER[number];

export const EXERCISE_SECTIONS: { key: string; label: string; muscleGroups: string[] }[] = [
  { key: 'chest', label: '胸部', muscleGroups: ['chest'] },
  { key: 'back', label: '背部', muscleGroups: ['back'] },
  { key: 'legs', label: '腿部', muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { key: 'shoulders', label: '肩部', muscleGroups: ['shoulders'] },
  { key: 'arms', label: '手臂', muscleGroups: ['biceps', 'triceps', 'forearms'] },
  { key: 'core', label: '核心', muscleGroups: ['core'] },
  { key: 'cardio', label: '有氧', muscleGroups: ['cardio'] },
];
