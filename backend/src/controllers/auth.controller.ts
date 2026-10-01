import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

const ACCESS_SECRET = () => process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = () => process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRES_IN = 60 * 60;          // 1 hour (seconds)
const REFRESH_EXPIRES_IN = 90 * 24 * 60 * 60; // 90 days (seconds)
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

function issueAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, ACCESS_SECRET(), { expiresIn: ACCESS_EXPIRES_IN });
}

function buildAuthResponse(userId: string, email: string, isEmailVerified: boolean, refreshToken: string) {
  return {
    userId,
    email,
    isEmailVerified,
    accessToken: issueAccessToken(userId),
    refreshToken,
    accessTokenExpiresIn: ACCESS_EXPIRES_IN,
    refreshTokenExpiresIn: REFRESH_EXPIRES_IN,
  };
}

// POST /auth/register
export async function register(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password || password.length < 8) {
    res.status(400).json({ message: '電子信箱與密碼（至少 8 碼）為必填' });
    return;
  }

  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if ((existing as any[]).length > 0) {
    res.status(409).json({ message: '此電子信箱已被註冊' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const userId = uuidv4();
  const now = Date.now();
  // In production: generate verifyToken, send email, set expires
  // For now: mark verified immediately for dev convenience
  await pool.execute(
    `INSERT INTO users (id, email, password_hash, is_email_verified, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)`,
    [userId, email, passwordHash, now, now]
  );

  res.status(201).json({ userId, email });
}

// POST /auth/login
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ message: '電子信箱與密碼為必填' });
    return;
  }

  const [rows] = await pool.execute(
    'SELECT id, password_hash, is_email_verified FROM users WHERE email = ?',
    [email]
  );
  const user = (rows as any[])[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ message: '電子信箱或密碼不正確' });
    return;
  }

  const refreshToken = uuidv4();
  const expiresAt = Date.now() + REFRESH_EXPIRES_IN * 1000;
  await pool.execute(
    'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
    [refreshToken, user.id, expiresAt]
  );

  res.json(buildAuthResponse(user.id, email, Boolean(user.is_email_verified), refreshToken));
}

// POST /auth/refresh
export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    res.status(400).json({ message: 'Refresh token 為必填' });
    return;
  }

  const [rows] = await pool.execute(
    'SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?',
    [refreshToken]
  );
  const record = (rows as any[])[0];

  if (!record || record.expires_at < Date.now()) {
    res.status(401).json({ message: 'Refresh token 已過期或無效，請重新登入' });
    return;
  }

  // Rotate: delete old, issue new
  const newRefresh = uuidv4();
  const expiresAt = Date.now() + REFRESH_EXPIRES_IN * 1000;
  await pool.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
  await pool.execute(
    'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
    [newRefresh, record.user_id, expiresAt]
  );

  const [userRows] = await pool.execute(
    'SELECT email, is_email_verified FROM users WHERE id = ?',
    [record.user_id]
  );
  const user = (userRows as any[])[0];

  res.json(buildAuthResponse(record.user_id, user.email, Boolean(user.is_email_verified), newRefresh));
}

// POST /auth/logout
export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    await pool.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
  }
  res.status(204).send();
}

// POST /auth/forgot-password
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ message: '電子信箱為必填' });
    return;
  }

  const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  // Always respond 200 to prevent email enumeration
  if ((rows as any[]).length > 0) {
    const resetToken = uuidv4();
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour
    await pool.execute(
      'UPDATE users SET reset_token = ?, reset_token_expires_at = ?, updated_at = ? WHERE email = ?',
      [resetToken, expires, Date.now(), email]
    );
    // TODO: send email with reset link containing resetToken
    // In production: integrate with an email service (e.g. SendGrid, Resend)
  }

  res.json({ message: '若此信箱已註冊，重設連結已寄出' });
}

// DELETE /users/me
export async function deleteAccount(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  // Cascades refresh_tokens via FK ON DELETE CASCADE
  await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
  res.status(204).send();
}
