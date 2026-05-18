/**
 * Development seed script — populates the DB with test users from fake_profiles.json
 * Run: node database/seeds/seed_dev.js
 *
 * Requires backend/.env to be configured with DB credentials.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fakeProfiles = require(path.join(__dirname, '../../backend-scripts/fake_profiles.json'));

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'walkupandgo',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','TX','NY','WA','OR','IL'];

const parseStateFromLocation = (location) => {
  if (!location) return 'TX';
  const parts = location.split(', ');
  return parts[1]?.substring(0, 2) || 'TX';
};

async function seed() {
  console.log('🌱 Seeding development database...');

  // Fix any previously seeded profiles that have old gender values ('male'/'female')
  await pool.query(`UPDATE profiles SET gender = 'man' WHERE gender = 'male'`);
  await pool.query(`UPDATE profiles SET gender = 'woman' WHERE gender = 'female'`);
  // Fix interested_in arrays that used old format
  await pool.query(`UPDATE profiles SET interested_in = ARRAY['women'] WHERE interested_in = ARRAY['women']::text[]`);
  console.log('  Fixed legacy gender values');

  const passwordHash = await bcrypt.hash('password123', 12);
  let created = 0;

  for (const profile of fakeProfiles.slice(0, 50)) {
    const userId = uuidv4();
    const email = `user${profile.id}@example.com`;
    const state = parseStateFromLocation(profile.location);
    const city = profile.location?.split(', ')[0] || 'Austin';

    // Normalise gender to match what the app stores ('man' / 'woman')
    const rawGender = profile.gender?.toLowerCase() || 'other';
    const genderNorm = rawGender === 'male' ? 'man' : rawGender === 'female' ? 'woman' : rawGender;

    // Give ~20% of profiles 'everyone' so they show up for all orientations
    const idx = fakeProfiles.indexOf(profile);
    const interested_in = idx % 5 === 0
      ? ['everyone']
      : genderNorm === 'man' ? ['women'] : ['men'];

    try {
      await pool.query(
        'INSERT INTO users (id, email, password_hash, is_verified) VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING',
        [userId, email, passwordHash]
      );

      // Calculate birthdate from age
      const birthYear = new Date().getFullYear() - (profile.age || 25);
      const birthdate = `${birthYear}-06-15`;

      await pool.query(
        `INSERT INTO profiles
          (user_id, display_name, birthdate, gender, interested_in, bio,
           location_city, location_state, is_complete)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
         ON CONFLICT DO NOTHING`,
        [
          userId, profile.name, birthdate, genderNorm, interested_in,
          profile.bio, city, state,
        ]
      );

      // Use picsum photo as placeholder
      if (profile.photo) {
        await pool.query(
          'INSERT INTO profile_photos (user_id, url, thumbnail_url, is_primary) VALUES ($1,$2,$2,true) ON CONFLICT DO NOTHING',
          [userId, profile.photo]
        );
      }

      // Flag truly fake profiles in the DB
      if (profile.fake) {
        await pool.query(
          "UPDATE users SET is_flagged = true, flag_reason = 'seed_fake_profile' WHERE id = $1",
          [userId]
        );
        await pool.query(
          "INSERT INTO fake_profile_signals (user_id, signal_type, score, details) VALUES ($1, 'seed_fake', 90, '{\"source\": \"dev_seed\"}')",
          [userId]
        );
      }

      created++;
    } catch (err) {
      console.error(`Failed to seed profile ${profile.id}:`, err.message);
    }
  }

  // Create a test admin user
  const adminId = uuidv4();
  const adminEmail = 'admin@walkupandgo.com';
  await pool.query(
    'INSERT INTO users (id, email, password_hash, is_verified, is_admin) VALUES ($1,$2,$3,true,true) ON CONFLICT DO NOTHING',
    [adminId, adminEmail, passwordHash]
  );
  await pool.query(
    `INSERT INTO profiles (user_id, display_name, birthdate, gender, interested_in, is_complete)
     VALUES ($1,'Admin User','1990-01-01','other','{}',true) ON CONFLICT DO NOTHING`,
    [adminId]
  );

  console.log(`✅ Seeded ${created} profiles`);
  console.log(`✅ Admin: ${adminEmail} / password123`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
