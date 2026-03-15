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

export const SPOUSE_PAIRS: [string, string][] = [
    ['VADIL', 'AAI'],
    ['AJOBA', 'AAJI'],
    ['NANA', 'NANI'],
    ['PANJOBA', 'PANAAJI'],
    ['SASRA', 'SASU'],
    ['KAKA', 'KAKI'],
    ['MAMA', 'MAMI'],
    ['MAVSA', 'MAVSHI'],
    ['NAVRA', 'BAYKO'],
    ['DAJI', 'AATYA'],
    ['NATU', 'NATASUN'],
    ['NAAT', 'NAT_JAVAI'],
    ['PANTU', 'PANTISUN'],
    ['PANTI', 'PANTU_JAVAI'],
];

export interface AxisOption {
    label: string;
    code: string;
    direction: 'UP' | 'DOWN' | 'SAME';
    triggerGender?: 'MALE' | 'FEMALE' | null;
}

export interface AxisConfig {
    xAxis: AxisOption[];
    yAxis: {
        top: AxisOption[];
        bottom: AxisOption[];
    };
}

export const RELATION_AXIS_CONFIG: Record<string, AxisConfig> = {
    ROOT: {
        xAxis: [
            { label: 'बायको (Wife)', code: 'BAYKO', direction: 'SAME', triggerGender: 'MALE' },
            { label: 'नवरा (Husband)', code: 'NAVRA', direction: 'SAME', triggerGender: 'FEMALE' },
        ],
        yAxis: {
            top: [
                { label: 'वडील (Father)', code: 'VADIL', direction: 'UP' },
                { label: 'आई (Mother)', code: 'AAI', direction: 'UP' },
                { label: 'सावत्रआई', code: 'SAVATR_AAI', direction: 'UP' },
                { label: 'सावत्र वडील', code: 'SAVATR_VADIL', direction: 'UP' },
            ],
            bottom: [
                { label: 'मुलगा (Son)', code: 'MULGA', direction: 'DOWN' },
                { label: 'मुलगी (Daughter)', code: 'MULGI', direction: 'DOWN' },
            ],
        },
    },
    VADIL: {
        xAxis: [{ label: 'आई (Mother)', code: 'AAI', direction: 'SAME' }],
        yAxis: {
            top: [
                { label: 'आजोबा (Grandfather)', code: 'AJOBA', direction: 'UP' },
                { label: 'आजी (Grandmother)', code: 'AAJI', direction: 'UP' },
            ],
            bottom: [
                { label: 'भाऊ (Brother)', code: 'BHAU', direction: 'DOWN' },
                { label: 'बहीण (Sister)', code: 'BAHIN', direction: 'DOWN' },
            ],
        },
    },
    AAI: {
        xAxis: [{ label: 'वडील (Father)', code: 'VADIL', direction: 'SAME' }],
        yAxis: {
            top: [
                { label: 'नाना (Grandfather)', code: 'NANA', direction: 'UP' },
                { label: 'नानी (Grandmother)', code: 'NANI', direction: 'UP' },
            ],
            bottom: [
                { label: 'भाऊ (Brother)', code: 'BHAU', direction: 'DOWN' },
                { label: 'बहीण (Sister)', code: 'BAHIN', direction: 'DOWN' },
            ],
        },
    },
    SASRA: {
        xAxis: [{ label: 'सासू (Mother-in-law)', code: 'SASU', direction: 'SAME' }],
        yAxis: {
            top: [
                { label: 'आजोबा', code: 'AJOBA', direction: 'UP' },
                { label: 'आजी', code: 'AAJI', direction: 'UP' },
            ],
            bottom: [
                { label: 'बायको (Wife)', code: 'BAYKO', direction: 'DOWN' },
                { label: 'मेव्हणा', code: 'MEVHANA', direction: 'DOWN' },
                { label: 'मेव्हणी', code: 'MEVHANI', direction: 'DOWN' },
            ],
        },
    },
    SASU: {
        xAxis: [{ label: 'सासरा (Father-in-law)', code: 'SASRA', direction: 'SAME' }],
        yAxis: {
            top: [
                { label: 'नाना', code: 'NANA', direction: 'UP' },
                { label: 'नानी', code: 'NANI', direction: 'UP' },
            ],
            bottom: [
                { label: 'बायको (Wife)', code: 'BAYKO', direction: 'DOWN' },
                { label: 'मेव्हणा', code: 'MEVHANA', direction: 'DOWN' },
                { label: 'मेव्हणी', code: 'MEVHANI', direction: 'DOWN' },
            ],
        },
    },
    BHAU: {
        xAxis: [{ label: 'वहिनी', code: 'VAHINI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'पुतण्या', code: 'PUTANYA', direction: 'DOWN' },
                { label: 'पुतणी', code: 'PUTANI', direction: 'DOWN' },
            ],
        },
    },
    BAHIN: {
        xAxis: [{ label: 'दाजी', code: 'DAJI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'भाचा', code: 'BHACHA', direction: 'DOWN' },
                { label: 'भाची', code: 'BHACHI', direction: 'DOWN' },
            ],
        },
    },
    VAHINI: {
        xAxis: [{ label: 'भाऊ', code: 'BHAU', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'पुतण्या', code: 'PUTANYA', direction: 'DOWN' },
                { label: 'पुतणी', code: 'PUTANI', direction: 'DOWN' },
            ],
        },
    },
    DAJI: {
        xAxis: [{ label: 'बहीण', code: 'BAHIN', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'भाचा', code: 'BHACHA', direction: 'DOWN' },
                { label: 'भाची', code: 'BHACHI', direction: 'DOWN' },
            ],
        },
    },
    MULGA: {
        xAxis: [{ label: 'सून', code: 'SUN', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'नातू', code: 'NATU', direction: 'DOWN' },
                { label: 'नात', code: 'NAAT', direction: 'DOWN' },
            ],
        },
    },
    MULGI: {
        xAxis: [{ label: 'जावई', code: 'JAVAI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'नातू', code: 'NATU', direction: 'DOWN' },
                { label: 'नात', code: 'NAAT', direction: 'DOWN' },
            ],
        },
    },
    MAMA: {
        xAxis: [{ label: 'मामी', code: 'MAMI', direction: 'SAME' }],
        yAxis: {
            top: [
                { label: 'नाना', code: 'NANA', direction: 'UP' },
                { label: 'नानी', code: 'NANI', direction: 'UP' },
            ],
            bottom: [
                { label: 'भाचा (Cousin)', code: 'BHACHA', direction: 'DOWN' },
                { label: 'भाची (Cousin)', code: 'BHACHI', direction: 'DOWN' },
            ],
        },
    },
    MAMI: {
        xAxis: [{ label: 'मामा', code: 'MAMA', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'भाचा (Cousin)', code: 'BHACHA', direction: 'DOWN' },
                { label: 'भाची (Cousin)', code: 'BHACHI', direction: 'DOWN' },
            ],
        },
    },
    AJOBA: {
        xAxis: [{ label: 'आजी (Grandmother)', code: 'AAJI', direction: 'SAME' }],
        yAxis: {
            top: [
                { label: 'पणजोबा (Great Grandfather)', code: 'PANJOBA', direction: 'UP' },
                { label: 'पणजी (Great Grandmother)', code: 'PANAAJI', direction: 'UP' },
            ],
            bottom: [
                { label: 'वडील (Father)', code: 'VADIL', direction: 'DOWN' },
                { label: 'काका (Uncle)', code: 'KAKA', direction: 'DOWN' },
                { label: 'आत्या (Aunt)', code: 'AATYA', direction: 'DOWN' },
            ],
        },
    },
    AAJI: {
        xAxis: [{ label: 'आजोबा (Grandfather)', code: 'AJOBA', direction: 'SAME' }],
        yAxis: {
            top: [
                { label: 'पणजोबा (Great Grandfather)', code: 'PANJOBA', direction: 'UP' },
                { label: 'पणजी (Great Grandmother)', code: 'PANAAJI', direction: 'UP' },
            ],
            bottom: [
                { label: 'वडील (Father)', code: 'VADIL', direction: 'DOWN' },
                { label: 'काका (Uncle)', code: 'KAKA', direction: 'DOWN' },
                { label: 'आत्या (Aunt)', code: 'AATYA', direction: 'DOWN' },
            ],
        },
    },
    NANA: {
        xAxis: [{ label: 'नानी', code: 'NANI', direction: 'SAME' }],
        yAxis: {
            top: [
                { label: 'पणजोबा', code: 'PANJOBA', direction: 'UP' },
                { label: 'पणजी', code: 'PANAAJI', direction: 'UP' },
            ],
            bottom: [
                { label: 'आई (Mother)', code: 'AAI', direction: 'DOWN' },
                { label: 'मामा (Uncle)', code: 'MAMA', direction: 'DOWN' },
                { label: 'मावशी (Aunt)', code: 'MAVSHI', direction: 'DOWN' },
            ],
        },
    },
    NANI: {
        xAxis: [{ label: 'नाना', code: 'NANA', direction: 'SAME' }],
        yAxis: {
            top: [
                { label: 'पणजोबा', code: 'PANJOBA', direction: 'UP' },
                { label: 'पणजी', code: 'PANAAJI', direction: 'UP' },
            ],
            bottom: [
                { label: 'आई (Mother)', code: 'AAI', direction: 'DOWN' },
                { label: 'मामा (Uncle)', code: 'MAMA', direction: 'DOWN' },
                { label: 'मावशी (Aunt)', code: 'MAVSHI', direction: 'DOWN' },
            ],
        },
    },
    KAKA: {
        xAxis: [{ label: 'काकी', code: 'KAKI', direction: 'SAME' }],
        yAxis: {
            top: [
                { label: 'आजोबा', code: 'AJOBA', direction: 'UP' },
                { label: 'आजी', code: 'AAJI', direction: 'UP' },
            ],
            bottom: [
                { label: 'चुलतभाऊ', code: 'CHULAT_BHAU', direction: 'DOWN' },
                { label: 'चुलतबहीण', code: 'CHULAT_BAHIN', direction: 'DOWN' },
            ],
        },
    },
    KAKI: {
        xAxis: [{ label: 'काका', code: 'KAKA', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'चुलतभाऊ', code: 'CHULAT_BHAU', direction: 'DOWN' },
                { label: 'चुलतबहीण', code: 'CHULAT_BAHIN', direction: 'DOWN' },
            ],
        },
    },
    AATYA: {
        xAxis: [{ label: 'दाजी', code: 'DAJI', direction: 'SAME' }],
        yAxis: {
            top: [
                { label: 'आजोबा', code: 'AJOBA', direction: 'UP' },
                { label: 'आजी', code: 'AAJI', direction: 'UP' },
            ],
            bottom: [
                { label: 'आत्येभाऊ', code: 'ATYE_BHAU', direction: 'DOWN' },
                { label: 'आत्येबहीण', code: 'ATYE_BAHIN', direction: 'DOWN' },
            ],
        },
    },
    MAVSHI: {
        xAxis: [{ label: 'मावसा', code: 'MAVSA', direction: 'SAME' }],
        yAxis: {
            top: [
                { label: 'नाना', code: 'NANA', direction: 'UP' },
                { label: 'नानी', code: 'NANI', direction: 'UP' },
            ],
            bottom: [
                { label: 'मावसभाऊ', code: 'MAV_BHAU', direction: 'DOWN' },
                { label: 'मावसबहीण', code: 'MAV_BAHIN', direction: 'DOWN' },
            ],
        },
    },
    PANJOBA: {
        xAxis: [{ label: 'पणजी', code: 'PANAAJI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'आजोबा', code: 'AJOBA', direction: 'DOWN' },
                { label: 'नाना', code: 'NANA', direction: 'DOWN' },
            ],
        },
    },
    PANAAJI: {
        xAxis: [{ label: 'पणजोबा', code: 'PANJOBA', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'आजोबा', code: 'AJOBA', direction: 'DOWN' },
                { label: 'नाना', code: 'NANA', direction: 'DOWN' },
            ],
        },
    },
    NATU: {
        xAxis: [{ label: 'नातसून', code: 'NATASUN', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'नातसून', code: 'NATASUN', direction: 'DOWN' },
                { label: 'पणतू', code: 'PANTU', direction: 'DOWN' },
                { label: 'पणती', code: 'PANTI', direction: 'DOWN' },
            ],
        },
    },
    NAAT: {
        xAxis: [{ label: 'नातजावई', code: 'NAT_JAVAI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'नातजावई', code: 'NAT_JAVAI', direction: 'DOWN' },
                { label: 'पणतू', code: 'PANTU', direction: 'DOWN' },
                { label: 'पणती', code: 'PANTI', direction: 'DOWN' },
            ],
        },
    },
    NATASUN: {
        xAxis: [{ label: 'नातू', code: 'NATU', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'पणतू', code: 'PANTU', direction: 'DOWN' },
                { label: 'पणती', code: 'PANTI', direction: 'DOWN' },
            ],
        },
    },
    NAT_JAVAI: {
        xAxis: [{ label: 'नात', code: 'NAAT', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'पणतू', code: 'PANTU', direction: 'DOWN' },
                { label: 'पणती', code: 'PANTI', direction: 'DOWN' },
            ],
        },
    },
    PANTU: {
        xAxis: [{ label: 'पणतीसून', code: 'PANTISUN', direction: 'SAME' }],
        yAxis: { top: [], bottom: [] },
    },
    PANTI: {
        xAxis: [{ label: 'पणतूजावई', code: 'PANTU_JAVAI', direction: 'SAME' }],
        yAxis: { top: [], bottom: [] },
    },
    BAYKO: {
        xAxis: [
            { label: 'नवरा (Husband)', code: 'NAVRA', direction: 'SAME' },
        ],
        yAxis: {
            top: [
                { label: 'सासरा (Father-in-law)', code: 'SASRA', direction: 'UP' },
                { label: 'सासू (Mother-in-law)', code: 'SASU', direction: 'UP' },
            ],
            bottom: [
                { label: 'मुलगा (Son)', code: 'MULGA', direction: 'DOWN' },
                { label: 'मुलगी (Daughter)', code: 'MULGI', direction: 'DOWN' },
            ],
        },
    },
    NAVRA: {
        xAxis: [
            { label: 'बायको (Wife)', code: 'BAYKO', direction: 'SAME' },
        ],
        yAxis: {
            top: [
                { label: 'सासरा (Father-in-law)', code: 'SASRA', direction: 'UP' },
                { label: 'सासू (Mother-in-law)', code: 'SASU', direction: 'UP' },
            ],
            bottom: [
                { label: 'मुलगा (Son)', code: 'MULGA', direction: 'DOWN' },
                { label: 'मुलगी (Daughter)', code: 'MULGI', direction: 'DOWN' },
            ],
        },
    },
    MAVSA: {
        xAxis: [{ label: 'मावशी', code: 'MAVSHI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'मावसभाऊ', code: 'MAV_BHAU', direction: 'DOWN' },
                { label: 'मावसबहीण', code: 'MAV_BAHIN', direction: 'DOWN' },
            ],
        },
    },
    FUA: {
        xAxis: [{ label: 'आत्या', code: 'AATYA', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'आत्येभाऊ', code: 'ATYE_BHAU', direction: 'DOWN' },
                { label: 'आत्येबहीण', code: 'ATYE_BAHIN', direction: 'DOWN' },
            ],
        },
    },
    SUN: {
        xAxis: [{ label: 'मुलगा', code: 'MULGA', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'नातू', code: 'NATU', direction: 'DOWN' },
                { label: 'नात', code: 'NAAT', direction: 'DOWN' },
            ],
        },
    },
    JAVAI: {
        xAxis: [{ label: 'मुलगी', code: 'MULGI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'नातू', code: 'NATU', direction: 'DOWN' },
                { label: 'नात', code: 'NAAT', direction: 'DOWN' },
            ],
        },
    },
    CHULTA: {
        xAxis: [{ label: 'चुलती', code: 'CHULTI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'चुलतभाऊ', code: 'CHULAT_BHAU', direction: 'DOWN' },
                { label: 'चुलतबहीण', code: 'CHULAT_BAHIN', direction: 'DOWN' },
            ],
        },
    },
    CHULTI: {
        xAxis: [{ label: 'चुलता', code: 'CHULTA', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'चुलतभाऊ', code: 'CHULAT_BHAU', direction: 'DOWN' },
                { label: 'चुलतबहीण', code: 'CHULAT_BAHIN', direction: 'DOWN' },
            ],
        },
    },
    DIR_CHOTE: {
        xAxis: [{ label: 'वहिनी', code: 'VAHINI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'पुतण्या', code: 'PUTANYA', direction: 'DOWN' },
                { label: 'पुतणी', code: 'PUTANI', direction: 'DOWN' },
            ],
        },
    },
    DIR_MOTHE: {
        xAxis: [{ label: 'वहिनी', code: 'VAHINI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'पुतण्या', code: 'PUTANYA', direction: 'DOWN' },
                { label: 'पुतणी', code: 'PUTANI', direction: 'DOWN' },
            ],
        },
    },
    MEVHANA: {
        xAxis: [{ label: 'मेव्हणी', code: 'MEVHANI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'भाचा', code: 'BHACHA', direction: 'DOWN' },
                { label: 'भाची', code: 'BHACHI', direction: 'DOWN' },
            ],
        },
    },
    MEVHANI: {
        xAxis: [{ label: 'मेव्हणा', code: 'MEVHANA', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'भाचा', code: 'BHACHA', direction: 'DOWN' },
                { label: 'भाची', code: 'BHACHI', direction: 'DOWN' },
            ],
        },
    },
    CHULAT_BHAU: {
        xAxis: [{ label: 'वहिनी', code: 'VAHINI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'मुलगा', code: 'MULGA', direction: 'DOWN' },
                { label: 'मुलगी', code: 'MULGI', direction: 'DOWN' },
            ],
        },
    },
    CHULAT_BAHIN: {
        xAxis: [{ label: 'दाजी', code: 'DAJI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'भाचा', code: 'BHACHA', direction: 'DOWN' },
                { label: 'भाची', code: 'BHACHI', direction: 'DOWN' },
            ],
        },
    },
    ATYE_BHAU: {
        xAxis: [{ label: 'वहिनी', code: 'VAHINI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'मुलगा', code: 'MULGA', direction: 'DOWN' },
                { label: 'मुलगी', code: 'MULGI', direction: 'DOWN' },
            ],
        },
    },
    ATYE_BAHIN: {
        xAxis: [{ label: 'दाजी', code: 'DAJI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'भाचा', code: 'BHACHA', direction: 'DOWN' },
                { label: 'भाची', code: 'BHACHI', direction: 'DOWN' },
            ],
        },
    },
    MAV_BHAU: {
        xAxis: [{ label: 'वहिनी', code: 'VAHINI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'मुलगा', code: 'MULGA', direction: 'DOWN' },
                { label: 'मुलगी', code: 'MULGI', direction: 'DOWN' },
            ],
        },
    },
    MAV_BAHIN: {
        xAxis: [{ label: 'दाजी', code: 'DAJI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'भाचा', code: 'BHACHA', direction: 'DOWN' },
                { label: 'भाची', code: 'BHACHI', direction: 'DOWN' },
            ],
        },
    },
    MAMBHAU: {
        xAxis: [{ label: 'वहिनी', code: 'VAHINI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'मुलगा', code: 'MULGA', direction: 'DOWN' },
                { label: 'मुलगी', code: 'MULGI', direction: 'DOWN' },
            ],
        },
    },
    MAMBAHIN: {
        xAxis: [{ label: 'दाजी', code: 'DAJI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'भाचा', code: 'BHACHA', direction: 'DOWN' },
                { label: 'भाची', code: 'BHACHI', direction: 'DOWN' },
            ],
        },
    },
};

export const COUSIN_CODES = [
    'MAMBHAU', 'MAMBAHIN',
    'MAV_BHAU', 'MAV_BAHIN',
    'CHULAT_BHAU', 'CHULAT_BAHIN',
    'ATYE_BHAU', 'ATYE_BAHIN',
];

export const COUSIN_PARENT_MAP: Record<string, string[]> = {
    'MAMBHAU': ['MAMA', 'MAMI'],
    'MAMBAHIN': ['MAMA', 'MAMI'],
    'MAV_BHAU': ['MAMA', 'MAMI'],
    'MAV_BAHIN': ['MAMA', 'MAMI'],
    'CHULAT_BHAU': ['KAKA', 'KAKI'],
    'CHULAT_BAHIN': ['KAKA', 'KAKI'],
    'ATYE_BHAU': ['AATYA', 'FUA'],
    'ATYE_BAHIN': ['AATYA', 'FUA'],
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
