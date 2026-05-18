/**
 * Seed script — populates Supabase (or local Postgres) with test profiles.
 * Usage:  cd backend && node database/seed.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const isCloud = !!process.env.DATABASE_URL;

const pool = new Pool(
  isCloud
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'walkupandgo',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
      }
);

async function seed() {
  console.log(isCloud ? '🌐 Seeding Supabase...' : '🏠 Seeding local database...');

  const passwordHash = await bcrypt.hash('password123', 12);

  const jsonPath = path.join(__dirname, '../../backend-scripts/fake_profiles.json');
  const allProfiles = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const existingCount = await pool.query(
    `SELECT COUNT(*) FROM users WHERE email LIKE 'user%@example.com'`
  );
  const offset = parseInt(existingCount.rows[0].count);
  const batch = allProfiles.slice(offset, offset + 50);
  console.log(`  Seeding profiles ${offset + 1}–${offset + batch.length} of ${allProfiles.length}`);

  let created = 0;

  for (let i = 0; i < batch.length; i++) {
    const p = batch[i];
    const userId = uuidv4();
    const email = `user${p.id}@example.com`;
    const city  = p.location?.split(', ')[0] || 'Austin';
    const state = p.location?.split(', ')[1]?.substring(0, 2) || 'TX';

    const rawGender = (p.gender || '').toLowerCase();
    const gender = rawGender === 'male' ? 'man' : rawGender === 'female' ? 'woman' : rawGender;
    const interested_in = i % 5 === 0 ? ['everyone'] : gender === 'man' ? ['women'] : ['men'];

    try {
      await pool.query(
        `INSERT INTO users (id, email, password_hash, is_verified)
         VALUES ($1,$2,$3,true) ON CONFLICT (email) DO NOTHING`,
        [userId, email, passwordHash]
      );

      const row = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      const uid = row.rows[0].id;
      const birthYear = new Date().getFullYear() - (p.age || 25);

      await pool.query(
        `INSERT INTO profiles
           (user_id, display_name, birthdate, gender, interested_in, bio,
            location_city, location_state, is_complete)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
         ON CONFLICT (user_id) DO UPDATE SET
           gender        = EXCLUDED.gender,
           interested_in = EXCLUDED.interested_in,
           is_complete   = true`,
        [uid, p.name, `${birthYear}-06-15`, gender, interested_in,
         p.bio || null, city, state]
      );

      if (p.photo) {
        await pool.query(`DELETE FROM profile_photos WHERE user_id = $1`, [uid]);
        await pool.query(
          `INSERT INTO profile_photos (user_id, url, thumbnail_url, is_primary)
           VALUES ($1,$2,$2,true)`,
          [uid, p.photo]
        );
      }

      // Flag last 5 in each batch as test-fakes for the admin panel
      if (i >= batch.length - 5) {
        await pool.query(
          `UPDATE users SET is_flagged=true, flag_reason='seed_fake_profile' WHERE id=$1`, [uid]
        );
      }

      created++;
    } catch (err) {
      console.error(`  ✘ ${p.id}: ${err.message}`);
    }
  }

  // Admin account
  const adminId = uuidv4();
  await pool.query(
    `INSERT INTO users (id, email, password_hash, is_verified, is_admin)
     VALUES ($1,'admin@walkupandgo.com',$2,true,true)
     ON CONFLICT (email) DO UPDATE SET is_admin=true`,
    [adminId, passwordHash]
  );
  const adminRow = await pool.query(`SELECT id FROM users WHERE email='admin@walkupandgo.com'`);
  await pool.query(
    `INSERT INTO profiles (user_id, display_name, birthdate, gender, interested_in, is_complete)
     VALUES ($1,'Admin','1990-01-01','other','{}',true)
     ON CONFLICT (user_id) DO NOTHING`,
    [adminRow.rows[0].id]
  );

  console.log(`\n✅ Seeded ${created} profiles`);
  console.log(`✅ Admin: admin@walkupandgo.com / password123`);
  await pool.end();
}

seed().catch(err => { console.error('❌', err.message); process.exit(1); });
