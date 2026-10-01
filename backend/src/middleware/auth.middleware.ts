import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: '未授權，請先登入' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ message: 'Token 無效或已過期，請重新登入' });
  }
}
