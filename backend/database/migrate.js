require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL || process.env.DB_URL;
const pool = connectionString ? new Pool({ connectionString }) : new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'swasthya_ai',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function migrate() {
  console.log('🔄 SwasthyaAI Database Migration Starting...\n');

  // Try both possible migration directories
  const migrationDirs = [
    path.join(__dirname, '..', '..', 'database', 'migrations'), // monorepo root
    path.join(__dirname, 'migrations'),                           // local
  ];

  let allFiles = [];
  for (const dir of migrationDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (!allFiles.find(f => path.basename(f) === file)) {
          allFiles.push(fullPath);
        }
      }
    }
  }

  allFiles.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

  if (allFiles.length === 0) {
    console.error('❌ No migration files found!');
    console.log('Expected migrations in:', migrationDirs[0]);
    process.exit(1);
  }

  for (const filePath of allFiles) {
    const filename = path.basename(filePath);
    console.log(`📋 Running: ${filename}`);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      await pool.query(sql);
      console.log(`   ✅ ${filename} — complete\n`);
    } catch (err) {
      // Gracefully handle "already exists" errors
      if (
        err.code === '42710' || // duplicate object
        err.code === '42P07' || // duplicate table
        err.code === '42701' || // duplicate column
        err.message.includes('already exists') ||
        err.message.includes('duplicate key')
      ) {
        console.log(`   ⚠️  ${filename} — some objects already exist (skipped)\n`);
      } else {
        console.error(`   ❌ ${filename} failed:`, err.message);
        throw err;
      }
    }
  }

  await pool.end();
  console.log('✅ All migrations complete!\n');
  console.log('📋 Next steps:');
  console.log('   npm run db:seed    — load sample data');
  console.log('   npm run dev        — start the backend server\n');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
