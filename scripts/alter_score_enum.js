const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:Pratham%23postgresql20@localhost:5432/samaj' });
async function run() {
  await c.connect();
  await c.query(`ALTER TYPE "ScoreReason" ADD VALUE IF NOT EXISTS 'REMOVE_ALIVE';`);
  await c.query(`ALTER TYPE "ScoreReason" ADD VALUE IF NOT EXISTS 'REMOVE_DECEASED';`);
  await c.query(`ALTER TYPE "ScoreReason" ADD VALUE IF NOT EXISTS 'REMOVE_RELATION';`);
  console.log('ENUMS UPDATED SUCCESSFULLY');
  await c.end();
}
run().catch(e => { console.error(e); c.end(); });
