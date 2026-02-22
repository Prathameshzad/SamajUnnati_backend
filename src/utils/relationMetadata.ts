// src/utils/relationMetadata.ts

export interface RelationMetadata {
    code: string;
    label: string;
    gender: 'MALE' | 'FEMALE' | null;
    level: number;
    vg: 'UP' | 'DOWN' | 'SAME';
    reciprocalCode?: string;
}

export const RELATION_METADATA: Record<string, RelationMetadata> = {
    // UP
    // UP
    AJI_SASU: { code: 'AJI_SASU', label: 'आजीसासू', gender: 'FEMALE', level: 2, vg: 'UP', reciprocalCode: 'NAT_JAVAI' },
    AJI_SASRA: { code: 'AJI_SASRA', label: 'आजीसासरा', gender: 'MALE', level: 2, vg: 'UP', reciprocalCode: 'NAT_JAVAI' },
    AAJI: { code: 'AAJI', label: 'आजी', gender: 'FEMALE', level: 2, vg: 'UP', reciprocalCode: 'NATU' },
    AJOBA: { code: 'AJOBA', label: 'आजोबा', gender: 'MALE', level: 2, vg: 'UP', reciprocalCode: 'NATU' },
    NANI: { code: 'NANI', label: 'नानी', gender: 'FEMALE', level: 2, vg: 'UP', reciprocalCode: 'NATU' },
    NANA: { code: 'NANA', label: 'नाना', gender: 'MALE', level: 2, vg: 'UP', reciprocalCode: 'NATU' },
    PANAAJI: { code: 'PANAAJI', label: 'पणजी', gender: 'FEMALE', level: 3, vg: 'UP', reciprocalCode: 'PANTU' },
    PANJOBA: { code: 'PANJOBA', label: 'पणजोबा', gender: 'MALE', level: 3, vg: 'UP', reciprocalCode: 'PANTU' },

    AAI: { code: 'AAI', label: 'आई', gender: 'FEMALE', level: 1, vg: 'UP', reciprocalCode: 'MULGA' },
    VADIL: { code: 'VADIL', label: 'वडील', gender: 'MALE', level: 1, vg: 'UP', reciprocalCode: 'MULGA' },
    SASU: { code: 'SASU', label: 'सासू', gender: 'FEMALE', level: 1, vg: 'UP', reciprocalCode: 'JAVAI' },
    SASRA: { code: 'SASRA', label: 'सासरा', gender: 'MALE', level: 1, vg: 'UP', reciprocalCode: 'JAVAI' },
    KAKA: { code: 'KAKA', label: 'काका', gender: 'MALE', level: 1, vg: 'UP', reciprocalCode: 'PUTANYA' },
    KAKI: { code: 'KAKI', label: 'काकी', gender: 'FEMALE', level: 1, vg: 'UP', reciprocalCode: 'PUTANYA' },
    MAMA: { code: 'MAMA', label: 'मामा', gender: 'MALE', level: 1, vg: 'UP', reciprocalCode: 'BHACHA' },
    MAMI: { code: 'MAMI', label: 'मामी', gender: 'FEMALE', level: 1, vg: 'UP', reciprocalCode: 'BHACHA' },
    AATYA: { code: 'AATYA', label: 'आत्या', gender: 'FEMALE', level: 1, vg: 'UP', reciprocalCode: 'BHACHA' },
    FUA: { code: 'FUA', label: 'फुआ', gender: 'MALE', level: 1, vg: 'UP', reciprocalCode: 'BHACHA' },
    MAVSHI: { code: 'MAVSHI', label: 'मावशी', gender: 'FEMALE', level: 1, vg: 'UP', reciprocalCode: 'BHACHA' },
    MAVSA: { code: 'MAVSA', label: 'मावसा', gender: 'MALE', level: 1, vg: 'UP', reciprocalCode: 'BHACHA' },
    CHULTA: { code: 'CHULTA', label: 'चुलता', gender: 'MALE', level: 1, vg: 'UP', reciprocalCode: 'PUTANYA' },
    CHULTI: { code: 'CHULTI', label: 'चुलती', gender: 'FEMALE', level: 1, vg: 'UP', reciprocalCode: 'PUTANYA' },
    SAVATR_VADIL: { code: 'SAVATR_VADIL', label: 'सावत्रवडील', gender: 'MALE', level: 1, vg: 'UP', reciprocalCode: 'SAVATR_MULGA' },
    SAVATR_AAI: { code: 'SAVATR_AAI', label: 'सावत्रआई', gender: 'FEMALE', level: 1, vg: 'UP', reciprocalCode: 'SAVATR_MULGA' },

    // HIGHER ANCESTORS
    PP_AJOBA: { code: 'PP_AJOBA', label: 'खापर पणजोबा', gender: 'MALE', level: 4, vg: 'UP', reciprocalCode: 'NATU' },
    PP_AAJI: { code: 'PP_AAJI', label: 'खापर पणजी', gender: 'FEMALE', level: 4, vg: 'UP', reciprocalCode: 'NATU' },
    PPP_AJOBA: { code: 'PPP_AJOBA', label: 'थोर खापर पणजोबा', gender: 'MALE', level: 5, vg: 'UP', reciprocalCode: 'NATU' },
    PPP_AAJI: { code: 'PPP_AAJI', label: 'थोर खापर पणजी', gender: 'FEMALE', level: 5, vg: 'UP', reciprocalCode: 'NATU' },

    // SAME
    NAVRA: { code: 'NAVRA', label: 'नवरा', gender: 'MALE', level: 0, vg: 'SAME', reciprocalCode: 'BAYKO' },
    BAYKO: { code: 'BAYKO', label: 'बायको', gender: 'FEMALE', level: 0, vg: 'SAME', reciprocalCode: 'NAVRA' },
    BHAU: { code: 'BHAU', label: 'भाऊ', gender: 'MALE', level: 0, vg: 'SAME', reciprocalCode: 'BHAU' },
    BAHIN: { code: 'BAHIN', label: 'बहीण', gender: 'FEMALE', level: 0, vg: 'SAME', reciprocalCode: 'BHAU' },
    VAHINI: { code: 'VAHINI', label: 'वहिनी', gender: 'FEMALE', level: 0, vg: 'SAME', reciprocalCode: 'DIR_CHOTE' },
    DAJI: { code: 'DAJI', label: 'दाजी', gender: 'MALE', level: 0, vg: 'SAME', reciprocalCode: 'MEVHANA' },
    MEVHANA: { code: 'MEVHANA', label: 'मेव्हणा', gender: 'MALE', level: 0, vg: 'SAME', reciprocalCode: 'DAJI' },
    MEVHANI: { code: 'MEVHANI', label: 'मेव्हणी', gender: 'FEMALE', level: 0, vg: 'SAME', reciprocalCode: 'DAJI' },
    DIR_CHOTE: { code: 'DIR_CHOTE', label: 'दिर-छोटे', gender: 'MALE', level: 0, vg: 'SAME', reciprocalCode: 'VAHINI' },
    DIR_MOTHE: { code: 'DIR_MOTHE', label: 'दिर-मोठे', gender: 'MALE', level: 0, vg: 'SAME', reciprocalCode: 'VAHINI' },
    CHULAT_BHAU: { code: 'CHULAT_BHAU', label: 'चुलतभाऊ', gender: 'MALE', level: 0, vg: 'SAME', reciprocalCode: 'CHULAT_BHAU' },
    CHULAT_BAHIN: { code: 'CHULAT_BAHIN', label: 'चुलतबहीण', gender: 'FEMALE', level: 0, vg: 'SAME', reciprocalCode: 'CHULAT_BHAU' },
    ATYE_BHAU: { code: 'ATYE_BHAU', label: 'आत्येभाऊ', gender: 'MALE', level: 0, vg: 'SAME', reciprocalCode: 'MAMBHAU' },
    ATYE_BAHIN: { code: 'ATYE_BAHIN', label: 'आत्येबहीण', gender: 'FEMALE', level: 0, vg: 'SAME', reciprocalCode: 'MAMBHAU' },
    MAV_BHAU: { code: 'MAV_BHAU', label: 'मावसभाऊ', gender: 'MALE', level: 0, vg: 'SAME', reciprocalCode: 'MAV_BHAU' },
    MAV_BAHIN: { code: 'MAV_BAHIN', label: 'मावसबहीण', gender: 'FEMALE', level: 0, vg: 'SAME', reciprocalCode: 'MAV_BHAU' },
    MAMBHAU: { code: 'MAMBHAU', label: 'मामेभाऊ', gender: 'MALE', level: 0, vg: 'SAME', reciprocalCode: 'ATYE_BHAU' },
    MAMBAHIN: { code: 'MAMBAHIN', label: 'मामेबहीण', gender: 'FEMALE', level: 0, vg: 'SAME', reciprocalCode: 'ATYE_BHAU' },

    // DOWN
    MULGA: { code: 'MULGA', label: 'मुलगा', gender: 'MALE', level: 1, vg: 'DOWN', reciprocalCode: 'VADIL' },
    MULGI: { code: 'MULGI', label: 'मुलगी', gender: 'FEMALE', level: 1, vg: 'DOWN', reciprocalCode: 'VADIL' },
    JAVAI: { code: 'JAVAI', label: 'जावई', gender: 'MALE', level: 1, vg: 'DOWN', reciprocalCode: 'SASRA' },
    SUN: { code: 'SUN', label: 'सुन', gender: 'FEMALE', level: 1, vg: 'DOWN', reciprocalCode: 'SASRA' },
    PUTANYA: { code: 'PUTANYA', label: 'पुतण्या', gender: 'MALE', level: 1, vg: 'DOWN', reciprocalCode: 'KAKA' },
    PUTANI: { code: 'PUTANI', label: 'पुतणी', gender: 'FEMALE', level: 1, vg: 'DOWN', reciprocalCode: 'KAKA' },
    BHACHA: { code: 'BHACHA', label: 'भाचा', gender: 'MALE', level: 1, vg: 'DOWN', reciprocalCode: 'MAMA' },
    BHACHI: { code: 'BHACHI', label: 'भाची', gender: 'FEMALE', level: 1, vg: 'DOWN', reciprocalCode: 'MAMA' },
    SAVATR_MULGA: { code: 'SAVATR_MULGA', label: 'सावत्रमुलगा', gender: 'MALE', level: 1, vg: 'DOWN', reciprocalCode: 'SAVATR_VADIL' },
    SAVATR_MULGI: { code: 'SAVATR_MULGI', label: 'सावत्रमुलगी', gender: 'FEMALE', level: 1, vg: 'DOWN', reciprocalCode: 'SAVATR_VADIL' },
    NATU: { code: 'NATU', label: 'नातू', gender: 'MALE', level: 2, vg: 'DOWN', reciprocalCode: 'AJOBA' },
    NAAT: { code: 'NAAT', label: 'नात', gender: 'FEMALE', level: 2, vg: 'DOWN', reciprocalCode: 'AJOBA' },
    NAT_JAVAI: { code: 'NAT_JAVAI', label: 'नातजावई', gender: 'MALE', level: 2, vg: 'DOWN', reciprocalCode: 'AAJI' },
    NATASUN: { code: 'NATASUN', label: 'नातसुन', gender: 'FEMALE', level: 2, vg: 'DOWN', reciprocalCode: 'AAJI' },
    PANTU: { code: 'PANTU', label: 'पणतू', gender: 'MALE', level: 3, vg: 'DOWN', reciprocalCode: 'PANAAJI' },
    PANTI: { code: 'PANTI', label: 'पणती', gender: 'FEMALE', level: 3, vg: 'DOWN', reciprocalCode: 'PANAAJI' },
    PANTISUN: { code: 'PANTISUN', label: 'पणतीसून', gender: 'FEMALE', level: 3, vg: 'DOWN' },
    PANTU_JAVAI: { code: 'PANTU_JAVAI', label: 'पणतूजावई', gender: 'MALE', level: 3, vg: 'DOWN' },

    // HIGHER DESCENDANTS
    PP_NATU: { code: 'PP_NATU', label: 'खापर नातू', gender: 'MALE', level: 4, vg: 'DOWN', reciprocalCode: 'PP_AJOBA' },
    PP_NAAT: { code: 'PP_NAAT', label: 'खापर नात', gender: 'FEMALE', level: 4, vg: 'DOWN', reciprocalCode: 'PP_AJOBA' },
    PPP_NATU: { code: 'PPP_NATU', label: 'थोर खापर नातू', gender: 'MALE', level: 5, vg: 'DOWN', reciprocalCode: 'PPP_AJOBA' },
    PPP_NAAT: { code: 'PPP_NAAT', label: 'थोर खापर नात', gender: 'FEMALE', level: 5, vg: 'DOWN', reciprocalCode: 'PPP_AJOBA' },

};

// Extracted from the list above + explicit mappings
const reciprocalDefaults: Record<string, string> = {
    // UP -> DOWN
    'AAI': 'MULGA', 'VADIL': 'MULGA',
    'SASU': 'JAVAI', 'SASRA': 'JAVAI',
    'KAKA': 'PUTANYA', 'KAKI': 'PUTANYA', 'CHULTA': 'PUTANYA', 'CHULTI': 'PUTANYA',
    'MAMA': 'BHACHA', 'MAMI': 'BHACHA',
    'AATYA': 'BHACHA', 'FUA': 'BHACHA',
    'MAVSHI': 'BHACHA', 'MAVSA': 'BHACHA', // Commonly called Bhacha/Bhachi too
    'SAVATR_VADIL': 'SAVATR_MULGA', 'SAVATR_AAI': 'SAVATR_MULGA',
    'AAJI': 'NATU', 'AJOBA': 'NATU', 'NANI': 'NATU', 'NANA': 'NATU',
    'AJI_SASU': 'NAT_JAVAI', 'AJI_SASRA': 'NAT_JAVAI',
    'PANAAJI': 'PANTU', 'PANJOBA': 'PANTU',

    // SAME
    'NAVRA': 'BAYKO', 'BAYKO': 'NAVRA',
    'BHAU': 'BHAU', 'BAHIN': 'BHAU', // Simplified: Brother sees sibling as Brother (need gender logic for Sister)
    'VAHINI': 'DIR_CHOTE', // or NANAND if female
    'DAJI': 'MEVHANA',
    'MEVHANA': 'DAJI', 'MEVHANI': 'DAJI',
    'DIR_CHOTE': 'VAHINI', 'DIR_MOTHE': 'VAHINI',
    'JAU': 'JAU', 'NANDOI': 'MAVSHI', // ... approximate
    'SADU': 'SADU', 'VYAHI': 'VYAHIN', 'VYAHIN': 'VYAHI',
    'MITRA': 'MITRA', 'MAITRIN': 'MITRA',

    // DOWN -> UP
    'MULGA': 'VADIL', 'MULGI': 'VADIL',
    'JAVAI': 'SASRA', 'SUN': 'SASRA',
    'PUTANYA': 'KAKA', 'PUTANI': 'KAKA',
    'BHACHA': 'MAMA', 'BHACHI': 'MAMA',
    'SAVATR_MULGA': 'SAVATR_VADIL', 'SAVATR_MULGI': 'SAVATR_VADIL',
    'NATU': 'AJOBA', 'NAAT': 'AJOBA',
    'NAT_JAVAI': 'AJI_SASU', 'NATASUN': 'AJI_SASU',
    'PANTU': 'PANAAJI', 'PANTI': 'PANAAJI',
};

export function getReciprocalCode(code: string, targetGender?: 'MALE' | 'FEMALE' | null): string {
    // Try to find an explicit reverse map
    const rec = reciprocalDefaults[code];
    if (rec) return rec;

    // Fallback: check metadata if we have a defined reciprocalCode
    const meta = RELATION_METADATA[code];
    if (meta?.reciprocalCode) return meta.reciprocalCode;

    // Final fallback: assume symmetric
    return code;
}

export function getRelationLabel(code: string): string {
    return RELATION_METADATA[code]?.label || code;
}
