import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import { owners } from '../src/database/schema';
import { normalizeOwnerEmail } from '../src/auth/owner-email';

const MIN_PASSWORD = 10;

// Creates the gym owner, or resets their password (and name, if given)
async function main() {
  const email = normalizeOwnerEmail(process.env.OWNER_EMAIL ?? '');
  const name = process.env.OWNER_NAME?.trim();
  const password = process.env.OWNER_PASSWORD;

  if (!email) fail('set OWNER_EMAIL to an email address');
  if (!password || password.length < MIN_PASSWORD) fail(`set OWNER_PASSWORD, at least ${MIN_PASSWORD} characters`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool });
  const passwordHash = await bcrypt.hash(password, 12);

  const [existing] = await db.select().from(owners).where(eq(owners.email, email)).limit(1);
  if (existing) {
    await db
      .update(owners)
      .set({ passwordHash, ...(name ? { name } : {}) })
      .where(eq(owners.id, existing.id));
    console.log(`Owner "${email}" updated.`);
  } else {
    if (!name) fail('set OWNER_NAME for a new owner (shown in the price change history)');
    await db.insert(owners).values({ email, name, passwordHash });
    console.log(`Owner "${email}" created.`);
  }

  await pool.end();
}

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
