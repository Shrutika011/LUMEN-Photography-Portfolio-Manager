import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { NextFunction, Request, Response } from 'express';
import { config } from './config';
import { getPool } from './db';

const scrypt = promisify(scryptCallback);
const sessionCookieName = 'lumen_session';
const sessionDurationSeconds = 60 * 60 * 12;
const sessionSecret =
  process.env.AUTH_TOKEN_SECRET ||
  (config.nodeEnv === 'production' ? '' : randomBytes(32).toString('hex'));

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  title?: string;
  avatar?: string;
  studioRoleLabel?: string;
  bio?: string;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, saltHex, expectedHex] = storedHash.split('$');
  if (
    algorithm !== 'scrypt' ||
    !/^[a-f0-9]{32}$/i.test(saltHex || '') ||
    !/^[a-f0-9]{128}$/i.test(expectedHex || '')
  ) {
    return false;
  }

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = (await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length)) as Buffer;
  return timingSafeEqual(actual, expected);
}

function signPayload(payload: string): string {
  if (!sessionSecret) throw new Error('AUTH_TOKEN_SECRET must be configured before issuing sessions.');
  return createHmac('sha256', sessionSecret).update(payload).digest('base64url');
}

function getSessionPayload(req: Request): { userId: string; expiresAt: number } | null {
  if (!sessionSecret) return null;
  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));
  if (!cookie) return null;

  const token = decodeURIComponent(cookie.slice(sessionCookieName.length + 1));
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const suppliedSignature = Buffer.from(token.slice(separator + 1), 'base64url');
  const expectedSignature = Buffer.from(signPayload(payload), 'base64url');
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('userId' in parsed) ||
      typeof parsed.userId !== 'string' ||
      !parsed.userId ||
      !('expiresAt' in parsed) ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { userId: parsed.userId, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, userId: string, rememberMe: boolean): void {
  const lifetime = rememberMe ? 60 * 60 * 24 * 14 : sessionDurationSeconds;
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      expiresAt: Math.floor(Date.now() / 1000) + lifetime,
    })
  ).toString('base64url');
  const token = `${payload}.${signPayload(payload)}`;

  res.cookie(sessionCookieName, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/',
    ...(rememberMe ? { maxAge: lifetime * 1000 } : {}),
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

export async function requireAuthenticatedUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const session = getSessionPayload(req);
  if (!session) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Sign in is required to access this resource.' });
    return;
  }

  try {
    const [rows]: any = await getPool().query(
      `SELECT id, name, email, role, title, avatar,
              studio_role_label AS studioRoleLabel, bio
       FROM users WHERE id = ? AND password_hash IS NOT NULL LIMIT 1`,
      [session.userId]
    );
    if (!rows.length) {
      clearSessionCookie(res);
      res.status(401).json({ error: 'This account is not provisioned for MySQL sign-in.' });
      return;
    }

    req.authUser = rows[0] as AuthenticatedUser;
    const requestedUserId =
      typeof req.body?.userId === 'string'
        ? req.body.userId
        : typeof req.query.userId === 'string'
          ? req.query.userId
          : null;
    if (requestedUserId && requestedUserId !== req.authUser.id) {
      res.status(403).json({ error: 'You cannot access another user’s records.' });
      return;
    }

    next();
  } catch (error) {
    console.error('[Auth] MySQL session lookup failed:', error);
    res.status(503).json({ error: 'The MySQL authentication service is unavailable.' });
  }
}
