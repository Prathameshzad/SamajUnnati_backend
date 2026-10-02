/**
 * Baseline and Deploy Script for Prisma Migrations
 * 
 * Purpose:
 * Safe baselining for existing databases restored from dump without migration history.
 * 1. Marks existing migrations (1 to 18) as applied in _prisma_migrations so Prisma knows they already exist.
 * 2. Runs `npx prisma migrate deploy` to safely apply any newer migrations (19 to 27) without data loss.
 * 
 * Works cross-platform on Windows, macOS, Linux, and Docker containers.
 */

const { execSync } = require('child_process');

const BASELINE_MIGRATIONS = [
  '20251130124711_init',
  '20251130140645_add_gender_and_target_gender',
  '20251130161952_init_relations',
  '20251130163708_add_tree_level_and_marathi_relations',
  '20251202172324_extend_user_fields',
  '20251202175523_remove_full_name',
  '20251207093643_add_profile_completed',
  '20260101095123_add_vertical_group_to_rel_type',
  '20260201132000_something_one',
  '20260214191812_add_custom_relation_fields',
  '20260222135836_add_unregistered_user',
  '20260319104408_sync_schema',
  '20260319105502_sync_schema_v2',
  '20260525000100_add_relation_visual_side',
  '20260620114557_add_parent_matrimony',
  '20260826225321_add_gamification_score',
  '20260906120000_add_relation_and_user_indexes',
  '20260906161600_add_caste_and_subcaste'
];

function runCommand(command) {
  try {
    return {
      success: true,
      output: execSync(command, { encoding: 'utf-8', stdio: 'pipe' })
    };
  } catch (err) {
    return {
      success: false,
      output: err.stdout || err.stderr || err.message
    };
  }
}

async function main() {
  console.log('====================================================');
  console.log('🚀 Starting Database Baselining & Migration Deployment');
  console.log('====================================================\n');

  console.log(`Step 1: Baselining ${BASELINE_MIGRATIONS.length} existing migrations...`);
  
  for (let i = 0; i < BASELINE_MIGRATIONS.length; i++) {
    const migration = BASELINE_MIGRATIONS[i];
    process.stdout.write(`  [${i + 1}/${BASELINE_MIGRATIONS.length}] Resolving ${migration}... `);

    const result = runCommand(`npx prisma migrate resolve --applied "${migration}"`);

    if (result.success) {
      console.log('✅ Marked as applied');
    } else {
      const output = String(result.output || '');
      if (output.includes('already recorded as applied') || output.includes('already applied')) {
        console.log('ℹ️  Already applied (skipped)');
      } else {
        console.log('⚠️  Notice:');
        console.log(output.trim());
      }
    }
  }

  console.log('\nStep 2: Checking migration status...');
  const statusResult = runCommand('npx prisma migrate status');
  console.log(statusResult.output);

  console.log('\nStep 3: Running `npx prisma migrate deploy` for pending migrations...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('\n🎉 Database migrations deployed successfully and database is 100% in sync!');
  } catch (deployErr) {
    console.error('\n❌ Migration deploy failed:');
    console.error(deployErr.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
