const { RELATION_METADATA } = require('./src/utils/relationMetadata');
console.log('Total keys:', Object.keys(RELATION_METADATA).length);
console.log('NAVRA definition:', RELATION_METADATA['NAVRA']);
