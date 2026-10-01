import { Router } from 'express';
import {
  getWorkoutSessions,
  upsertWorkoutSession,
  deleteWorkoutSession,
  upsertWorkoutSet,
  deleteWorkoutSet,
} from '../controllers/workout.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/me/workout-sessions', requireAuth, getWorkoutSessions);
router.post('/me/workout-sessions', requireAuth, upsertWorkoutSession);
router.delete('/me/workout-sessions/:id', requireAuth, deleteWorkoutSession);

router.post('/me/workout-sets', requireAuth, upsertWorkoutSet);
router.delete('/me/workout-sets/:id', requireAuth, deleteWorkoutSet);

export default router;
