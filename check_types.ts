import prisma from './src/lib/prisma';

async function check() {
    try {
        const types = await prisma.relationType.findMany({
            select: { code: true, label: true }
        });
        console.log('--- RELATION TYPES IN DB ---');
        console.log(types);
        if (types.length === 0) {
            console.log('NO RELATION TYPES FOUND. DATABASE MIGHT BE EMPTY.');
        }
    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        process.exit(0);
    }
}

check();
