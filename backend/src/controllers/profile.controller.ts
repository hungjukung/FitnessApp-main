import { Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const [rows] = await pool.execute(
    'SELECT * FROM user_profiles WHERE user_id = ?',
    [userId]
  );
  const row = (rows as any[])[0];
  if (!row) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }
  res.json({
    userId:              row.user_id,
    nickname:            row.nickname,
    gender:              row.gender,
    age:                 row.age,
    heightCm:            row.height_cm,
    initialWeightKg:     row.initial_weight_kg,
    goalWeightKg:        row.goal_weight_kg,
    goal:                row.goal,
    experienceLevel:     row.experience_level,
    aiConsentGiven:      Boolean(row.ai_consent_given),
    onboardingCompleted: Boolean(row.onboarding_completed),
    updatedAt:           row.updated_at,
  });
}

export async function upsertProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const {
    nickname, gender, age, heightCm, initialWeightKg, goalWeightKg,
    goal, experienceLevel, aiConsentGiven, onboardingCompleted,
  } = req.body as Record<string, any>;

  const now = Date.now();
  await pool.execute(
    `INSERT INTO user_profiles
       (user_id, nickname, gender, age, height_cm, initial_weight_kg, goal_weight_kg,
        goal, experience_level, ai_consent_given, onboarding_completed, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       nickname             = VALUES(nickname),
       gender               = VALUES(gender),
       age                  = VALUES(age),
       height_cm            = VALUES(height_cm),
       initial_weight_kg    = VALUES(initial_weight_kg),
       goal_weight_kg       = VALUES(goal_weight_kg),
       goal                 = VALUES(goal),
       experience_level     = VALUES(experience_level),
       ai_consent_given     = VALUES(ai_consent_given),
       onboarding_completed = VALUES(onboarding_completed),
       updated_at           = VALUES(updated_at)`,
    [
      userId,
      nickname        ?? null,
      gender          ?? null,
      age             ?? null,
      heightCm        ?? null,
      initialWeightKg ?? null,
      goalWeightKg    ?? null,
      goal            ?? null,
      experienceLevel ?? null,
      aiConsentGiven  ? 1 : 0,
      onboardingCompleted ? 1 : 0,
      now,
    ]
  );
  res.json({ updatedAt: now });
}
