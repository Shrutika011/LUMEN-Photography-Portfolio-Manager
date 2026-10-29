import { Router, Request, Response } from 'express';
import { checkDatabaseConnection, getPool, getTableColumns, respondDatabaseUnavailable } from '../db';
import {
  clearSessionCookie,
  requireAuthenticatedUser,
  setSessionCookie,
  verifyPassword,
} from '../auth';

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const requiredRole = req.body?.requiredRole;
  if (!email || !password || password.length > 1024) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  if (requiredRole !== undefined && requiredRole !== 'CLIENT') {
    res.status(400).json({ error: 'The requested sign-in role is not supported.' });
    return;
  }

  const dbStatus = await checkDatabaseConnection();
  if (!dbStatus.isConnected) {
    respondDatabaseUnavailable(res, dbStatus.error, 'Authentication');
    return;
  }

  try {
    const columns = await getTableColumns('users');
    if (!columns.has('password_hash')) {
      res.status(503).json({ error: 'MySQL authentication is not initialized. Apply the user password migration.' });
      return;
    }

    const [rows]: any = await getPool().query(
      `SELECT id, name, email, password_hash, role, title, avatar,
              studio_role_label AS studioRoleLabel, bio
       FROM users
       WHERE LOWER(email) = LOWER(?)
       LIMIT 2`,
      [email]
    );
    if (rows.length !== 1 || !rows[0].password_hash || !(await verifyPassword(password, rows[0].password_hash))) {
      res.status(401).json({ error: 'Email or password is incorrect.' });
      return;
    }

    const user = rows[0];
    if (requiredRole && user.role !== requiredRole) {
      res.status(403).json({ error: 'This account does not have client gallery access.' });
      return;
    }

    setSessionCookie(res, user.id, req.body?.rememberMe === true);
    delete user.password_hash;
    res.json({ success: true, user });
  } catch (error: any) {
    console.error('[Auth] MySQL sign-in failed:', error);
    res.status(500).json({ error: 'Sign-in could not be completed.' });
  }
});

router.post('/register', (_req: Request, res: Response): void => {
  res.status(403).json({ error: 'Public registration is disabled. Contact the studio owner for account access.' });
});

router.get('/session', requireAuthenticatedUser, (req: Request, res: Response): void => {
  res.json({ user: req.authUser });
});

router.post('/logout', (_req: Request, res: Response): void => {
  clearSessionCookie(res);
  res.json({ success: true });
});

router.get('/', (req: Request, res: Response): void => {
  res.json(req.authUser ? [req.authUser] : []);
});

router.get('/:id', (req: Request, res: Response): void => {
  if (!req.authUser || req.params.id !== req.authUser.id) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  res.json(req.authUser);
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  if (!req.authUser || req.params.id !== req.authUser.id) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const updates = req.body || {};
  const userRecord = {
    name: typeof updates.name === 'string' ? updates.name.trim().slice(0, 255) : req.authUser.name,
    title: typeof updates.title === 'string' ? updates.title.slice(0, 255) : req.authUser.title || '',
    avatar: typeof updates.avatar === 'string' ? updates.avatar : req.authUser.avatar || '',
    studioRoleLabel:
      typeof updates.studioRoleLabel === 'string'
        ? updates.studioRoleLabel.slice(0, 255)
        : req.authUser.studioRoleLabel || '',
    bio: typeof updates.bio === 'string' ? updates.bio : req.authUser.bio || '',
  };
  if (!userRecord.name) {
    res.status(400).json({ error: 'A display name is required.' });
    return;
  }

  try {
    await getPool().query(
      `UPDATE users
       SET name = ?, title = ?, avatar = ?, studio_role_label = ?, bio = ?
       WHERE id = ?`,
      [
        userRecord.name,
        userRecord.title,
        userRecord.avatar,
        userRecord.studioRoleLabel,
        userRecord.bio,
        req.authUser.id,
      ]
    );
    const [rows]: any = await getPool().query(
      `SELECT id, name, email, role, title, avatar,
              studio_role_label AS studioRoleLabel, bio
       FROM users WHERE id = ?`,
      [req.authUser.id]
    );
    if (!rows.length) {
      res.status(404).json({ error: 'User not found after profile update.' });
      return;
    }
    res.json(rows[0]);
  } catch (error: any) {
    console.error('[Users API] MySQL profile update failed:', error);
    res.status(500).json({ error: 'User profile could not be updated in MySQL.' });
  }
});

export default router;
