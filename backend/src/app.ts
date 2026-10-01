import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import aiRoutes from './routes/ai.routes';
import workoutRoutes from './routes/workout.routes';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json({ limit: '10mb' })); // 10mb to support base64 photo uploads

// Auth endpoints: stricter rate limit
const authLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
  message: { message: '請求過於頻繁，請稍後再試' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limit
const generalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 100),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/users', workoutRoutes);
app.use('/api/v1/ai', aiRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

export default app;
