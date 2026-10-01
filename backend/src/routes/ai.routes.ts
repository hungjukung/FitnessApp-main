import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { analyzeWeightTrendHandler, analyzeImageHandler, parseWorkoutHandler, analyzeFoodHandler } from '../controllers/ai.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// App 目前沒有登入流程，拍照辨識不檢查 token，改用較嚴格的 IP 頻率限制保護 xAI 額度
const foodPhotoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: '辨識次數過多，請稍後再試' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/analyze', requireAuth, analyzeWeightTrendHandler);
router.post('/analyze-image', requireAuth, analyzeImageHandler);
router.post('/parse-workout', requireAuth, parseWorkoutHandler);
router.post('/analyze-food', foodPhotoLimiter, analyzeFoodHandler);

export default router;
