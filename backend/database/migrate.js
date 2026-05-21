const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');

const isCloud = !!process.env.DATABASE_URL;

const poolConfig = isCloud
  ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'walkupandgo',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };

const pool = new Pool(poolConfig);

// Splits SQL on semicolons but ignores semicolons inside $$ dollar-quote blocks
function splitSQL(sql) {
  const stmts = [];
  let buf = '';
  let inDollar = false;
  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    if (two === '$$') {
      inDollar = !inDollar;
      buf += '$$';
      i += 2;
      continue;
    }
    if (!inDollar && sql[i] === ';') {
      const s = buf.trim();
      if (s) stmts.push(s);
      buf = '';
      i++;
      continue;
    }
    buf += sql[i++];
  }
  if (buf.trim()) stmts.push(buf.trim());
  return stmts;
}

async function migrate() {
  console.log('');
  console.log(isCloud ? '🌐 Using cloud database (Supabase)' : '🏠 Using local database');

  const client = await pool.connect();

  try {
    await client.query('SELECT 1');
    console.log('✅ Database connection OK\n');
  } catch (err) {
    console.error('❌ Cannot connect:', err.message);
    client.release();
    await pool.end();
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`🔄 ${file}`);

    // On Supabase, uuid-ossp and pg_trgm are pre-installed — skip those lines
    if (isCloud) {
      sql = sql
        .replace(/CREATE EXTENSION[^;]*;/g, '')
        .trim();
    }

    const statements = splitSQL(sql);
    console.log(`   ${statements.length} statements to run`);

    for (let idx = 0; idx < statements.length; idx++) {
      const stmt = statements[idx];
      const preview = stmt.replace(/\s+/g, ' ').substring(0, 80);
      try {
        await client.query(stmt);
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
          process.stdout.write('.');
          continue;
        }
        console.error(`\n❌ Statement ${idx + 1} failed:`);
        console.error(`   SQL: ${preview}`);
        console.error(`   Error: ${err.message}`);
        client.release();
        await pool.end();
        process.exit(1);
      }
      process.stdout.write('.');
    }
    console.log(`\n✅ ${file} done`);
  }

  client.release();
  await pool.end();
  console.log('\n✅ All migrations complete.\n');
}

migrate().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
