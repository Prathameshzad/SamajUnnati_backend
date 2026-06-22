require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    console.log('Adding appLanguage and relationLanguage columns...');
    await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "appLanguage" TEXT DEFAULT 'en';`);
    await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "relationLanguage" TEXT DEFAULT 'en';`);
    console.log('Successfully added columns!');
  } catch (err) {
    console.error('Error adding columns:', err);
  } finally {
    pool.end();
  }
}

main();
