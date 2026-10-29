import { emitKeypressEvents } from 'readline';
import { hashPassword } from '../server/auth';
import { getPool, getTableColumns } from '../server/db';

function readHiddenPassword(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error('Password provisioning requires an interactive terminal.');
  }

  return new Promise((resolve, reject) => {
    const input = process.stdin;
    emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    process.stdout.write(prompt);
    let value = '';

    const cleanup = () => {
      input.setRawMode(false);
      input.pause();
      input.removeListener('keypress', onKeypress);
      process.stdout.write('\n');
    };

    const onKeypress = (character: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Password provisioning cancelled.'));
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(value);
      } else if (key.name === 'backspace') {
        value = value.slice(0, -1);
      } else if (character && !key.ctrl) {
        value += character;
      }
    };

    input.on('keypress', onKeypress);
  });
}

async function main(): Promise<void> {
  const account = process.argv[2]?.trim();
  if (!account) {
    throw new Error('Usage: npm run auth:provision -- <existing-user-id-or-email>');
  }

  const columns = await getTableColumns('users');
  if (!columns.has('password_hash')) {
    throw new Error('Apply migrations/20261029_add_user_password_hash.sql before provisioning accounts.');
  }

  const pool = getPool();
  const [rows]: any = await pool.query(
    'SELECT id FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 2',
    [account, account]
  );
  if (rows.length !== 1) {
    throw new Error(rows.length ? 'The account identifier is ambiguous.' : 'No existing user matches that identifier.');
  }

  const password = await readHiddenPassword('New password (minimum 12 characters): ');
  if (password.length < 12) {
    throw new Error('Passwords must contain at least 12 characters.');
  }
  const confirmation = await readHiddenPassword('Confirm new password: ');
  if (password !== confirmation) {
    throw new Error('The passwords did not match.');
  }

  const passwordHash = await hashPassword(password);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, rows[0].id]);
  console.log('Password provisioned for the existing MySQL user.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Password provisioning failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });
