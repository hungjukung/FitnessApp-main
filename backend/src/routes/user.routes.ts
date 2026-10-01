import { Router } from 'express';
import { deleteAccount } from '../controllers/auth.controller';
import { getProfile, upsertProfile } from '../controllers/profile.controller';
import { getWeightLogs, upsertWeightLog, deleteWeightLog } from '../controllers/weightLog.controller';
import { getPhotos, getPhotoData, uploadPhoto, deletePhoto } from '../controllers/photo.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.delete('/me', requireAuth, deleteAccount);

// Profile
router.get('/me/profile', requireAuth, getProfile);
router.put('/me/profile', requireAuth, upsertProfile);

// Weight logs
router.get('/me/weight-logs', requireAuth, getWeightLogs);
router.post('/me/weight-logs', requireAuth, upsertWeightLog);
router.delete('/me/weight-logs/:date', requireAuth, deleteWeightLog);

// Photos
router.get('/me/photos', requireAuth, getPhotos);
router.get('/me/photos/:id/data', requireAuth, getPhotoData);
router.post('/me/photos', requireAuth, uploadPhoto);
router.delete('/me/photos/:id', requireAuth, deletePhoto);

export default router;
