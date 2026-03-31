const fs = require('fs');

const path = 'd:/samajUnati/backend/src/utils/relationMetadata.ts';
let file = fs.readFileSync(path, 'utf8');

const updates = {
    BHAU: `{ left: [{ label: 'भाऊ (Brother)', code: 'BHAU', direction: 'SAME', triggerGender: 'MALE' }, { label: 'बहीण (Sister)', code: 'BAHIN', direction: 'SAME', triggerGender: 'FEMALE' }], right: [{ label: 'वहिनी', code: 'VAHINI', direction: 'SAME' }] }`,
    BAHIN: `{ left: [{ label: 'दाजी', code: 'DAJI', direction: 'SAME' }], right: [{ label: 'भाऊ (Brother)', code: 'BHAU', direction: 'SAME', triggerGender: 'MALE' }, { label: 'बहीण (Sister)', code: 'BAHIN', direction: 'SAME', triggerGender: 'FEMALE' }] }`,
    VAHINI: `{ left: [{ label: 'भाऊ', code: 'BHAU', direction: 'SAME' }], right: [] }`,
    DAJI: `{ left: [], right: [{ label: 'बहीण', code: 'BAHIN', direction: 'SAME' }] }`,

    MULGA: `{ left: [{ label: 'मुलगा', code: 'MULGA', direction: 'SAME', triggerGender: 'MALE' }, { label: 'मुलगी', code: 'MULGI', direction: 'SAME', triggerGender: 'FEMALE' }], right: [{ label: 'सून', code: 'SUN', direction: 'SAME' }] }`,
    MULGI: `{ left: [{ label: 'जावई', code: 'JAVAI', direction: 'SAME' }], right: [{ label: 'मुलगा', code: 'MULGA', direction: 'SAME', triggerGender: 'MALE' }, { label: 'मुलगी', code: 'MULGI', direction: 'SAME', triggerGender: 'FEMALE' }] }`,
    SUN: `{ left: [{ label: 'मुलगा', code: 'MULGA', direction: 'SAME' }], right: [] }`,
    JAVAI: `{ left: [], right: [{ label: 'मुलगी', code: 'MULGI', direction: 'SAME' }] }`,

    KAKA: `{ left: [{ label: 'वडील', code: 'VADIL', direction: 'SAME', triggerGender: 'MALE' }, { label: 'काका', code: 'KAKA', direction: 'SAME', triggerGender: 'MALE' }, { label: 'आत्या', code: 'ATYA', direction: 'SAME', triggerGender: 'FEMALE' }], right: [{ label: 'काकी', code: 'KAKI', direction: 'SAME' }] }`,
    KAKI: `{ left: [{ label: 'काका', code: 'KAKA', direction: 'SAME' }], right: [] }`,
    AATYA: `{ left: [{ label: 'दाजी', code: 'DAJI', direction: 'SAME' }, { label: 'फूफा', code: 'FUA', direction: 'SAME' }], right: [{ label: 'वडील', code: 'VADIL', direction: 'SAME', triggerGender: 'MALE' }, { label: 'काका', code: 'KAKA', direction: 'SAME', triggerGender: 'MALE' }, { label: 'आत्या', code: 'ATYA', direction: 'SAME', triggerGender: 'FEMALE' }] }`,
    FUA: `{ left: [], right: [{ label: 'आत्या', code: 'AATYA', direction: 'SAME' }] }`,

    MAMA: `{ left: [{ label: 'मामा', code: 'MAMA', direction: 'SAME', triggerGender: 'MALE' }, { label: 'मावशी', code: 'MAVSHI', direction: 'SAME', triggerGender: 'FEMALE' }, { label: 'आई', code: 'AAI', direction: 'SAME', triggerGender: 'FEMALE' }], right: [{ label: 'मामी', code: 'MAMI', direction: 'SAME' }] }`,
    MAMI: `{ left: [{ label: 'मामा', code: 'MAMA', direction: 'SAME' }], right: [] }`,
    MAVSHI: `{ left: [{ label: 'मावसा', code: 'MAVSA', direction: 'SAME' }], right: [{ label: 'मामा', code: 'MAMA', direction: 'SAME', triggerGender: 'MALE' }, { label: 'मावशी', code: 'MAVSHI', direction: 'SAME', triggerGender: 'FEMALE' }, { label: 'आई', code: 'AAI', direction: 'SAME', triggerGender: 'FEMALE' }] }`,
    MAVSA: `{ left: [], right: [{ label: 'मावशी', code: 'MAVSHI', direction: 'SAME' }] }`,

    NATU: `{ left: [{ label: 'नातू', code: 'NATU', direction: 'SAME', triggerGender: 'MALE' }, { label: 'नात', code: 'NAAT', direction: 'SAME', triggerGender: 'FEMALE' }], right: [{ label: 'नातसून', code: 'NATASUN', direction: 'SAME' }] }`,
    NAAT: `{ left: [{ label: 'नातजावई', code: 'NAT_JAVAI', direction: 'SAME' }], right: [{ label: 'नातू', code: 'NATU', direction: 'SAME', triggerGender: 'MALE' }, { label: 'नात', code: 'NAAT', direction: 'SAME', triggerGender: 'FEMALE' }] }`,
    NATASUN: `{ left: [{ label: 'नातू', code: 'NATU', direction: 'SAME' }], right: [] }`,
    NAT_JAVAI: `{ left: [], right: [{ label: 'नात', code: 'NAAT', direction: 'SAME' }] }`,

    PANTU: `{ left: [{ label: 'पणतू', code: 'PANTU', direction: 'SAME', triggerGender: 'MALE' }, { label: 'पणती', code: 'PANTI', direction: 'SAME', triggerGender: 'FEMALE' }], right: [{ label: 'पणतीसून', code: 'PANTISUN', direction: 'SAME' }] }`,
    PANTI: `{ left: [{ label: 'पणतूजावई', code: 'PANTU_JAVAI', direction: 'SAME' }], right: [{ label: 'पणतू', code: 'PANTU', direction: 'SAME', triggerGender: 'MALE' }, { label: 'पणती', code: 'PANTI', direction: 'SAME', triggerGender: 'FEMALE' }] }`,

    CHULTA: `{ left: [], right: [{ label: 'चुलती', code: 'CHULTI', direction: 'SAME' }] }`,
    CHULTI: `{ left: [{ label: 'चुलता', code: 'CHULTA', direction: 'SAME' }], right: [] }`,

    DIR_CHOTE: `{ left: [], right: [{ label: 'वहिनी', code: 'VAHINI', direction: 'SAME' }] }`,
    DIR_MOTHE: `{ left: [], right: [{ label: 'वहिनी', code: 'VAHINI', direction: 'SAME' }] }`,

    MEVHANA: `{ left: [{ label: 'मेव्हणा', code: 'MEVHANA', direction: 'SAME', triggerGender: 'MALE' }, { label: 'मेव्हणी', code: 'MEVHANI', direction: 'SAME', triggerGender: 'FEMALE' }], right: [] }`,
    MEVHANI: `{ left: [], right: [{ label: 'मेव्हणा', code: 'MEVHANA', direction: 'SAME', triggerGender: 'MALE' }, { label: 'मेव्हणी', code: 'MEVHANI', direction: 'SAME', triggerGender: 'FEMALE' }] }`,

    CHULAT_BHAU: `{ left: [{ label: 'चुलतभाऊ', code: 'CHULAT_BHAU', direction: 'SAME', triggerGender: 'MALE' }, { label: 'चुलतबहीण', code: 'CHULAT_BAHIN', direction: 'SAME', triggerGender: 'FEMALE' }], right: [{ label: 'वहिनी', code: 'VAHINI', direction: 'SAME' }] }`,
    CHULAT_BAHIN: `{ left: [{ label: 'दाजी', code: 'DAJI', direction: 'SAME' }], right: [{ label: 'चुलतभाऊ', code: 'CHULAT_BHAU', direction: 'SAME', triggerGender: 'MALE' }, { label: 'चुलतबहीण', code: 'CHULAT_BAHIN', direction: 'SAME', triggerGender: 'FEMALE' }] }`,

    ATYE_BHAU: `{ left: [{ label: 'आत्येभाऊ', code: 'ATYE_BHAU', direction: 'SAME', triggerGender: 'MALE' }, { label: 'आत्येबहीण', code: 'ATYE_BAHIN', direction: 'SAME', triggerGender: 'FEMALE' }], right: [{ label: 'वहिनी', code: 'VAHINI', direction: 'SAME' }] }`,
    ATYE_BAHIN: `{ left: [{ label: 'दाजी', code: 'DAJI', direction: 'SAME' }], right: [{ label: 'आत्येभाऊ', code: 'ATYE_BHAU', direction: 'SAME', triggerGender: 'MALE' }, { label: 'आत्येबहीण', code: 'ATYE_BAHIN', direction: 'SAME', triggerGender: 'FEMALE' }] }`,

    MAV_BHAU: `{ left: [{ label: 'मावसभाऊ', code: 'MAV_BHAU', direction: 'SAME', triggerGender: 'MALE' }, { label: 'मावसबहीण', code: 'MAV_BAHIN', direction: 'SAME', triggerGender: 'FEMALE' }], right: [{ label: 'वहिनी', code: 'VAHINI', direction: 'SAME' }] }`,
    MAV_BAHIN: `{ left: [{ label: 'दाजी', code: 'DAJI', direction: 'SAME' }], right: [{ label: 'मावसभाऊ', code: 'MAV_BHAU', direction: 'SAME', triggerGender: 'MALE' }, { label: 'मावसबहीण', code: 'MAV_BAHIN', direction: 'SAME', triggerGender: 'FEMALE' }] }`,

    MAMBHAU: `{ left: [{ label: 'मामेभाऊ', code: 'MAMBHAU', direction: 'SAME', triggerGender: 'MALE' }, { label: 'मामेबहीण', code: 'MAMBAHIN', direction: 'SAME', triggerGender: 'FEMALE' }], right: [{ label: 'वहिनी', code: 'VAHINI', direction: 'SAME' }] }`,
    MAMBAHIN: `{ left: [{ label: 'दाजी', code: 'DAJI', direction: 'SAME' }], right: [{ label: 'मामेभाऊ', code: 'MAMBHAU', direction: 'SAME', triggerGender: 'MALE' }, { label: 'मामेबहीण', code: 'MAMBAHIN', direction: 'SAME', triggerGender: 'FEMALE' }] }`
};

const lines = file.split(/\r?\n/);

for (const [key, replacement] of Object.entries(updates)) {
    let keyIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        // Just look for the key exactly
        if (trimmed === key + ': {') {
            keyIdx = i;
            break;
        }
    }

    if (keyIdx === -1) {
        console.log("NOT FOUND", key);
        continue;
    }

    let xIdx = -1;
    let yIdx = -1;

    for (let i = keyIdx; i < lines.length; i++) {
        if (lines[i].includes('xAxis: {') && xIdx === -1) {
            xIdx = i;
        }
        if (lines[i].includes('yAxis: {') && xIdx !== -1) {
            yIdx = i;
            break;
        }
    }

    if (xIdx !== -1 && yIdx !== -1) {
        console.log(`Replacing ${key} between lines ${xIdx} and ${yIdx}`);
        const repLines = ["        xAxis: " + replacement + ","];
        lines.splice(xIdx, yIdx - xIdx, ...repLines);
    } else {
        console.log(`Found ${key} but no xAxis/yAxis structure. xIdx=${xIdx}, yIdx=${yIdx}`);
    }
}

// Join with os specific newline (just \n for simplicity, but if windows \r\n)
fs.writeFileSync(path, lines.join('\n'));
console.log('Done mapping relationships carefully');
