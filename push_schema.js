const { execSync } = require('child_process');
const fs = require('fs');
require('dotenv').config();

const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

// Replace env(...) with hardcoded value
const url = process.env.DATABASE_URL;
schema = schema.replace(/url\s+=\s+env\(['"]DATABASE_URL['"]\)/, `url = "${url}"`);

const tempSchemaPath = 'prisma/temp_schema.prisma';
fs.writeFileSync(tempSchemaPath, schema);

try {
    console.log('Pushing schema...');
    execSync(`npx prisma db push --force-reset --schema ${tempSchemaPath}`, { stdio: 'inherit' });
    console.log('Generating client...');
    execSync(`npx prisma generate --schema ${tempSchemaPath}`, { stdio: 'inherit' });
} catch (err) {
    console.error('Failed to push schema:', err.message);
} finally {
    fs.unlinkSync(tempSchemaPath);
}
