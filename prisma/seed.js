// prisma/seed.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set in .env');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const relationTypes = [
  // UP (Generation +)
  { code: 'AJI_SASU', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 2, reciprocalCode: 'NAT_JAVAI' },
  { code: 'AJI_SASRA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 2, reciprocalCode: 'NAT_JAVAI' },
  { code: 'AAJI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 2, reciprocalCode: 'NATU' },
  { code: 'AJOBA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 2, reciprocalCode: 'NATU' },
  { code: 'NANI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 2, reciprocalCode: 'NATU' },
  { code: 'NANA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 2, reciprocalCode: 'NATU' },
  { code: 'PANAAJI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 3, reciprocalCode: 'PANTU' },
  { code: 'PANJOBA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 3, reciprocalCode: 'PANTU' },
  { code: 'AAI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 1, reciprocalCode: 'MULGA' },
  { code: 'VADIL', category: 'FAMILY', targetGender: 'MALE', treeLevel: 1, reciprocalCode: 'MULGA' },
  { code: 'SASU', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 1, reciprocalCode: 'JAVAI' },
  { code: 'SASRA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 1, reciprocalCode: 'JAVAI' },
  { code: 'KAKA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 1, reciprocalCode: 'PUTANYA' },
  { code: 'KAKI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 1, reciprocalCode: 'PUTANYA' },
  { code: 'MAMA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 1, reciprocalCode: 'BHACHA' },
  { code: 'MAMI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 1, reciprocalCode: 'BHACHA' },
  { code: 'AATYA', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 1, reciprocalCode: 'BHACHA' },
  { code: 'FUA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 1, reciprocalCode: 'BHACHA' },
  { code: 'MAVSHI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 1, reciprocalCode: 'BHACHA' },
  { code: 'MAVSA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 1, reciprocalCode: 'BHACHA' },
  { code: 'CHULTA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 1, reciprocalCode: 'PUTANYA' },
  { code: 'CHULTI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 1, reciprocalCode: 'PUTANYA' },
  { code: 'SAVATR_VADIL', category: 'FAMILY', targetGender: 'MALE', treeLevel: 1, reciprocalCode: 'SAVATR_MULGA' },
  { code: 'SAVATR_AAI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 1, reciprocalCode: 'SAVATR_MULGA' },
  { code: 'PP_AJOBA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 4, reciprocalCode: 'PP_NATU' },
  { code: 'PP_AAJI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 4, reciprocalCode: 'PP_NAAT' },
  { code: 'PPP_AJOBA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 5, reciprocalCode: 'PPP_NATU' },
  { code: 'PPP_AAJI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 5, reciprocalCode: 'PPP_NAAT' },
  { code: 'AJOBA_SASRA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 2, reciprocalCode: 'NAT_JAVAI' },
  { code: 'AJOBA_SASU', category: 'FAMILY', targetGender: 'MALE', treeLevel: 2, reciprocalCode: 'NAT_JAVAI' },
  { code: 'MAMA_SASRA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 1, reciprocalCode: 'JAVAI' },
  { code: 'MAMI_SASU', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 1, reciprocalCode: 'JAVAI' },
  { code: 'PANAJI_SASU', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 3, reciprocalCode: 'PANTU_JAVAI' },
  { code: 'PANJOBA_SASRA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 3, reciprocalCode: 'PANTU_JAVAI' },
  { code: 'CHULAT_SASRA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 1, reciprocalCode: 'PUTAN_JAVAI' },
  { code: 'ATYA_SASU', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 1, reciprocalCode: 'BHOCHA_JAVAI' },
  { code: 'MAVAS_SASU', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 1, reciprocalCode: 'BHOCHA_JAVAI' },

  // SAME (Generation 0)
  { code: 'NAVRA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 0, reciprocalCode: 'BAYKO' },
  { code: 'BAYKO', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 0, reciprocalCode: 'NAVRA' },
  { code: 'BHAU', category: 'FAMILY', targetGender: 'MALE', treeLevel: 0, reciprocalCode: 'BHAU' },
  { code: 'BAHIN', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 0, reciprocalCode: 'BHAU' },
  { code: 'VAHINI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 0, reciprocalCode: 'DIR_CHOTE' },
  { code: 'DAJI', category: 'FAMILY', targetGender: 'MALE', treeLevel: 0, reciprocalCode: 'MEVHANA' },
  { code: 'MEVHANA', category: 'FAMILY', targetGender: 'MALE', treeLevel: 0, reciprocalCode: 'DAJI' },
  { code: 'MEVHANI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 0, reciprocalCode: 'DAJI' },
  { code: 'DIR_CHOTE', category: 'FAMILY', targetGender: 'MALE', treeLevel: 0, reciprocalCode: 'VAHINI' },
  { code: 'DIR_MOTHE', category: 'FAMILY', targetGender: 'MALE', treeLevel: 0, reciprocalCode: 'VAHINI' },
  { code: 'CHULAT_BHAU', category: 'FAMILY', targetGender: 'MALE', treeLevel: 0, reciprocalCode: 'CHULAT_BHAU' },
  { code: 'CHULAT_BAHIN', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 0, reciprocalCode: 'CHULAT_BHAU' },
  { code: 'ATYE_BHAU', category: 'FAMILY', targetGender: 'MALE', treeLevel: 0, reciprocalCode: 'MAMBHAU' },
  { code: 'ATYE_BAHIN', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 0, reciprocalCode: 'MAMBHAU' },
  { code: 'MAV_BHAU', category: 'FAMILY', targetGender: 'MALE', treeLevel: 0, reciprocalCode: 'MAV_BHAU' },
  { code: 'MAV_BAHIN', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 0, reciprocalCode: 'MAV_BHAU' },
  { code: 'MAMBHAU', category: 'FAMILY', targetGender: 'MALE', treeLevel: 0, reciprocalCode: 'ATYE_BHAU' },
  { code: 'MAMBAHIN', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 0, reciprocalCode: 'ATYE_BHAU' },
  { code: 'NANAND', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 0, reciprocalCode: 'VAHINI' },
  { code: 'NANANDOI', category: 'FAMILY', targetGender: 'MALE', treeLevel: 0, reciprocalCode: 'VAHINI' },
  { code: 'CHULTA_DIR', category: 'FAMILY', targetGender: 'MALE', treeLevel: 0, reciprocalCode: 'VAHINI' },
  { code: 'CHULTA_NANAND', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: 0, reciprocalCode: 'VAHINI' },

  // DOWN (Generation -)
  { code: 'MULGA', category: 'FAMILY', targetGender: 'MALE', treeLevel: -1, reciprocalCode: 'VADIL' },
  { code: 'MULGI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: -1, reciprocalCode: 'VADIL' },
  { code: 'JAVAI', category: 'FAMILY', targetGender: 'MALE', treeLevel: -1, reciprocalCode: 'SASRA' },
  { code: 'SUN', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: -1, reciprocalCode: 'SASRA' },
  { code: 'PUTANYA', category: 'FAMILY', targetGender: 'MALE', treeLevel: -1, reciprocalCode: 'KAKA' },
  { code: 'PUTANI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: -1, reciprocalCode: 'KAKA' },
  { code: 'BHACHA', category: 'FAMILY', targetGender: 'MALE', treeLevel: -1, reciprocalCode: 'MAMA' },
  { code: 'BHACHI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: -1, reciprocalCode: 'MAMA' },
  { code: 'SAVATR_MULGA', category: 'FAMILY', targetGender: 'MALE', treeLevel: -1, reciprocalCode: 'SAVATR_VADIL' },
  { code: 'SAVATR_MULGI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: -1, reciprocalCode: 'SAVATR_VADIL' },
  { code: 'NATU', category: 'FAMILY', targetGender: 'MALE', treeLevel: -2, reciprocalCode: 'AJOBA' },
  { code: 'NAAT', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: -2, reciprocalCode: 'AJOBA' },
  { code: 'NAT_JAVAI', category: 'FAMILY', targetGender: 'MALE', treeLevel: -2, reciprocalCode: 'AAJI' },
  { code: 'NATASUN', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: -2, reciprocalCode: 'AAJI' },
  { code: 'PANTU', category: 'FAMILY', targetGender: 'MALE', treeLevel: -3, reciprocalCode: 'PANAAJI' },
  { code: 'PANTI', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: -3, reciprocalCode: 'PANAAJI' },
  { code: 'PANTISUN', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: -3, reciprocalCode: 'PANTU' },
  { code: 'PANTU_JAVAI', category: 'FAMILY', targetGender: 'MALE', treeLevel: -3, reciprocalCode: 'PANTI' },
  { code: 'PP_NATU', category: 'FAMILY', targetGender: 'MALE', treeLevel: -4, reciprocalCode: 'PP_AJOBA' },
  { code: 'PP_NAAT', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: -4, reciprocalCode: 'PP_AJOBA' },
  { code: 'PPP_NATU', category: 'FAMILY', targetGender: 'MALE', treeLevel: -5, reciprocalCode: 'PPP_AJOBA' },
  { code: 'PPP_NAAT', category: 'FAMILY', targetGender: 'FEMALE', treeLevel: -5, reciprocalCode: 'PPP_AJOBA' },

  // FRIENDS
  { code: 'MITRA', category: 'FRIEND', targetGender: 'MALE', treeLevel: 0, reciprocalCode: 'MITRA' },
  { code: 'MAITRIN', category: 'FRIEND', targetGender: 'FEMALE', treeLevel: 0, reciprocalCode: 'MAITRIN' },
];

const translations = [
  // UP
  { code: 'AJI_SASU', mr: 'आजीसासू', en: 'Grandmother-in-law' },
  { code: 'AJI_SASRA', mr: 'आजीसासरा', en: 'Grandfather-in-law' },
  { code: 'AAJI', mr: 'आजी', en: 'Grandmother' },
  { code: 'AJOBA', mr: 'आजोबा', en: 'Grandfather' },
  { code: 'NANI', mr: 'नानी', en: 'Maternal Grandmother' },
  { code: 'NANA', mr: 'नाना', en: 'Maternal Grandfather' },
  { code: 'PANAAJI', mr: 'पणजी', en: 'Great Grandmother' },
  { code: 'PANJOBA', mr: 'पणजोबा', en: 'Great Grandfather' },
  { code: 'AAI', mr: 'आई', en: 'Mother' },
  { code: 'VADIL', mr: 'वडील', en: 'Father' },
  { code: 'SASU', mr: 'सासू', en: 'Mother-in-law' },
  { code: 'SASRA', mr: 'सासरा', en: 'Father-in-law' },
  { code: 'KAKA', mr: 'काका', en: 'Paternal Uncle' },
  { code: 'KAKI', mr: 'काकी', en: 'Paternal Aunt' },
  { code: 'MAMA', mr: 'मामा', en: 'Maternal Uncle' },
  { code: 'MAMI', mr: 'मामी', en: 'Maternal Aunt' },
  { code: 'AATYA', mr: 'आत्या', en: 'Paternal Aunt' },
  { code: 'FUA', mr: 'फुआ', en: 'Paternal Uncle (Husband of Aatya)' },
  { code: 'MAVSHI', mr: 'मावशी', en: 'Maternal Aunt' },
  { code: 'MAVSA', mr: 'मावसा', en: 'Maternal Uncle (Husband of Mavshi)' },
  { code: 'CHULTA', mr: 'चुलता', en: 'Uncle' },
  { code: 'CHULTI', mr: 'चुलती', en: 'Aunt' },
  { code: 'SAVATR_VADIL', mr: 'सावत्रवडील', en: 'Step-Father' },
  { code: 'SAVATR_AAI', mr: 'सावत्रआई', en: 'Step-Mother' },
  { code: 'PP_AJOBA', mr: 'खापर पणजोबा', en: 'Great-Great Grandfather' },
  { code: 'PP_AAJI', mr: 'खापर पणजी', en: 'Great-Great Grandmother' },
  { code: 'PPP_AJOBA', mr: 'थोर खापर पणजोबा', en: 'Great-Great-Great Grandfather' },
  { code: 'PPP_AAJI', mr: 'थोर खापर पणजी', en: 'Great-Great-Great Grandmother' },
  { code: 'AJOBA_SASRA', mr: 'आजोबासासरा', en: 'Grandfather-in-law' },
  { code: 'AJOBA_SASU', mr: 'आजोबासासू', en: 'Grandfather-in-law' },
  { code: 'MAMA_SASRA', mr: 'मामासासरा', en: 'Uncle-in-law (Maternal)' },
  { code: 'MAMI_SASU', mr: 'मामीसासू', en: 'Aunt-in-law (Maternal)' },
  { code: 'PANAJI_SASU', mr: 'पणजीसासू', en: 'Great-grandmother-in-law' },
  { code: 'PANJOBA_SASRA', mr: 'पणजोबासासरा', en: 'Great-grandfather-in-law' },
  { code: 'CHULAT_SASRA', mr: 'चुलत सासरा', en: 'Paternal Uncle-in-law' },
  { code: 'ATYA_SASU', mr: 'आत्या सासू', en: 'Paternal Aunt-in-law' },
  { code: 'MAVAS_SASU', mr: 'मावस सासू', en: 'Maternal Aunt-in-law' },

  // SAME
  { code: 'NAVRA', mr: 'नवरा', en: 'Husband' },
  { code: 'BAYKO', mr: 'बायको', en: 'Wife' },
  { code: 'BHAU', mr: 'भाऊ', en: 'Brother' },
  { code: 'BAHIN', mr: 'बहीण', en: 'Sister' },
  { code: 'VAHINI', mr: 'वहिनी', en: 'Sister-in-law' },
  { code: 'DAJI', mr: 'दाजी', en: 'Brother-in-law' },
  { code: 'MEVHANA', mr: 'मेव्हणा', en: 'Brother-in-law (Wife/Husband Brother)' },
  { code: 'MEVHANI', mr: 'मेव्हणी', en: 'Sister-in-law (Wife/Husband Sister)' },
  { code: 'DIR_CHOTE', mr: 'दिर-छोटे', en: 'Brother-in-law (Younger)' },
  { code: 'DIR_MOTHE', mr: 'दिर-मोठे', en: 'Brother-in-law (Elder)' },
  { code: 'CHULAT_BHAU', mr: 'चुलतभाऊ', en: 'Paternal Cousin Brother' },
  { code: 'CHULAT_BAHIN', mr: 'चुलतबहीण', en: 'Paternal Cousin Sister' },
  { code: 'ATYE_BHAU', mr: 'आत्येभाऊ', en: 'Paternal Aunt Son' },
  { code: 'ATYE_BAHIN', mr: 'आत्येबहीण', en: 'Paternal Aunt Daughter' },
  { code: 'MAV_BHAU', mr: 'मावसभाऊ', en: 'Maternal Aunt Son' },
  { code: 'MAV_BAHIN', mr: 'मावसबहीण', en: 'Maternal Aunt Daughter' },
  { code: 'MAMBHAU', mr: 'मामेभाऊ', en: 'Maternal Uncle Son' },
  { code: 'MAMBAHIN', mr: 'मामेबहीण', en: 'Maternal Uncle Daughter' },
  { code: 'NANAND', mr: 'नणंद', en: "Husband's Sister" },
  { code: 'NANANDOI', mr: 'नणंदोई', en: "Husband of Nanand" },
  { code: 'CHULTA_DIR', mr: 'चुलतदीर', en: 'Cousin-in-law brother' },
  { code: 'CHULTA_NANAND', mr: 'चुलतनणंद', en: 'Cousin-in-law sister' },

  // DOWN
  { code: 'MULGA', mr: 'मुलगा', en: 'Son' },
  { code: 'MULGI', mr: 'मुलगी', en: 'Daughter' },
  { code: 'JAVAI', mr: 'जावई', en: 'Son-in-law' },
  { code: 'SUN', mr: 'सुन', en: 'Daughter-in-law' },
  { code: 'PUTANYA', mr: 'पुतण्या', en: 'Nephew' },
  { code: 'PUTANI', mr: 'पुतणी', en: 'Niece' },
  { code: 'BHACHA', mr: 'भाचा', en: 'Nephew (Sister/Brother Child)' },
  { code: 'BHACHI', mr: 'भाची', en: 'Niece (Sister/Brother Child)' },
  { code: 'SAVATR_MULGA', mr: 'सावत्रमुलगा', en: 'Step-Son' },
  { code: 'SAVATR_MULGI', mr: 'सावत्रमुलगी', en: 'Step-Daughter' },
  { code: 'NATU', mr: 'नातू', en: 'Grandson' },
  { code: 'NAAT', mr: 'नात', en: 'Granddaughter' },
  { code: 'NAT_JAVAI', mr: 'नातजावई', en: 'Grandson-in-law' },
  { code: 'NATASUN', mr: 'नातसुन', en: 'Granddaughter-in-law' },
  { code: 'PANTU', mr: 'पणतू', en: 'Great Grandson' },
  { code: 'PANTI', mr: 'पणती', en: 'Great Granddaughter' },
  { code: 'PANTISUN', mr: 'पणतीसून', en: 'Great Granddaughter-in-law' },
  { code: 'PANTU_JAVAI', mr: 'पणतूजावई', en: 'Great Grandson-in-law' },
  { code: 'PP_NATU', mr: 'खापर नातू', en: 'Great-Great Grandson' },
  { code: 'PP_NAAT', mr: 'खापर नात', en: 'Great-Great Granddaughter' },
  { code: 'PPP_NATU', mr: 'थोर खापर नातू', en: 'Great-Great-Great Grandson' },
  { code: 'PPP_NAAT', mr: 'थोर खापर नात', en: 'Great-Great-Great Granddaughter' },

  // FRIENDS
  { code: 'MITRA', mr: 'मित्र', en: 'Friend (Male)' },
  { code: 'MAITRIN', mr: 'मैत्रीण', en: 'Friend (Female)' },
];

async function main() {
  console.log('🌱 Seeding ALL MASTER RELATIONS...');

  // Upsert RelationTypes first
  for (const rt of relationTypes) {
    await prisma.relationType.upsert({
      where: { code: rt.code },
      update: rt,
      create: rt,
    });
  }

  // Upsert Translations
  for (const t of translations) {
    // Marathi
    await prisma.relationTranslation.upsert({
      where: {
        relationTypeCode_languageCode_community: {
          relationTypeCode: t.code,
          languageCode: 'mr',
          community: '',
        },
      },
      update: { label: t.mr },
      create: {
        relationTypeCode: t.code,
        languageCode: 'mr',
        community: '',
        label: t.mr,
      },
    });

    // English
    if (t.en) {
      await prisma.relationTranslation.upsert({
        where: {
          relationTypeCode_languageCode_community: {
            relationTypeCode: t.code,
            languageCode: 'en',
            community: '',
          },
        },
        update: { label: t.en },
        create: {
          relationTypeCode: t.code,
          languageCode: 'en',
          community: '',
          label: t.en,
        },
      });
    }
  }

  console.log(`✅ Seeded ${relationTypes.length} relations with translations.`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
