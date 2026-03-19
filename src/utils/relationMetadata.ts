// src/utils/relationMetadata.ts

/**
 * Axis configurations for different relation codes.
 * This controls the UI options for adding new relations.
 * Labels here are used as UI hints.
 */
export interface AxisOption {
    label: string;
    code: string;
    direction: 'UP' | 'DOWN' | 'SAME';
    triggerGender?: 'MALE' | 'FEMALE' | null;
    viewerGender?: 'MALE' | 'FEMALE' | null;
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
            { label: 'मित्र (Friend)', code: 'MITRA', direction: 'SAME' },
            { label: 'मैत्रीण (Friend)', code: 'MAITRIN', direction: 'SAME' },
        ],
        yAxis: {
            top: [
                { label: 'वडील (Father)', code: 'VADIL', direction: 'UP' },
                { label: 'आई (Mother)', code: 'AAI', direction: 'UP' },
                { label: 'सावत्रआई', code: 'SAVATR_AAI', direction: 'UP' },
                { label: 'सावत्र वडील', code: 'SAVATR_VADIL', direction: 'UP' },
                { label: 'मित्र (Friend)', code: 'MITRA', direction: 'UP' },
                { label: 'मैत्रीण (Friend)', code: 'MAITRIN', direction: 'UP' },
            ],
            bottom: [
                { label: 'मुलगा (Son)', code: 'MULGA', direction: 'DOWN' },
                { label: 'मुलगी (Daughter)', code: 'MULGI', direction: 'DOWN' },
                { label: 'मित्र (Friend)', code: 'MITRA', direction: 'DOWN' },
                { label: 'मैत्रीण (Friend)', code: 'MAITRIN', direction: 'DOWN' },
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
                // For Male viewers (Wife's side)
                { label: 'बायको (Wife)', code: 'BAYKO', direction: 'DOWN', viewerGender: 'MALE' },
                { label: 'मेव्हणा', code: 'MEVHANA', direction: 'DOWN', viewerGender: 'MALE' },
                { label: 'मेव्हणी', code: 'MEVHANI', direction: 'DOWN', viewerGender: 'MALE' },
                // For Female viewers (Husband's side)
                { label: 'नवरा (Husband)', code: 'NAVRA', direction: 'DOWN', viewerGender: 'FEMALE' },
                { label: 'दीर-छोटे', code: 'DIR_CHOTE', direction: 'DOWN', viewerGender: 'FEMALE' },
                { label: 'दीर-मोठे', code: 'DIR_MOTHE', direction: 'DOWN', viewerGender: 'FEMALE' },
                { label: 'नणंद', code: 'NANAND', direction: 'DOWN', viewerGender: 'FEMALE' },
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
                // For Male viewers (Wife's side)
                { label: 'बायको (Wife)', code: 'BAYKO', direction: 'DOWN', viewerGender: 'MALE' },
                { label: 'मेव्हणा', code: 'MEVHANA', direction: 'DOWN', viewerGender: 'MALE' },
                { label: 'मेव्हणी', code: 'MEVHANI', direction: 'DOWN', viewerGender: 'MALE' },
                // For Female viewers (Husband's side)
                { label: 'नवरा (Husband)', code: 'NAVRA', direction: 'DOWN', viewerGender: 'FEMALE' },
                { label: 'दीर-छोटे', code: 'DIR_CHOTE', direction: 'DOWN', viewerGender: 'FEMALE' },
                { label: 'दीर-मोठे', code: 'DIR_MOTHE', direction: 'DOWN', viewerGender: 'FEMALE' },
                { label: 'नणंद', code: 'NANAND', direction: 'DOWN', viewerGender: 'FEMALE' },
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
                { label: 'मेव्हणा', code: 'MEVHANA', direction: 'DOWN', viewerGender: 'MALE' },
                { label: 'मेव्हणी', code: 'MEVHANI', direction: 'DOWN', viewerGender: 'MALE' },
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
    NANAND: {
        xAxis: [{ label: 'नणंदोई', code: 'NANANDOI', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'भाचा', code: 'BHACHA', direction: 'DOWN' },
                { label: 'भाची', code: 'BHACHI', direction: 'DOWN' },
            ],
        },
    },
    NANANDOI: {
        xAxis: [{ label: 'नणंद', code: 'NANAND', direction: 'SAME' }],
        yAxis: {
            top: [],
            bottom: [
                { label: 'भाचा', code: 'BHACHA', direction: 'DOWN' },
                { label: 'भाची', code: 'BHACHI', direction: 'DOWN' },
            ],
        },
    },
    MITRA: {
        xAxis: [
            { label: 'मित्र (Friend)', code: 'MITRA', direction: 'SAME' },
            { label: 'मैत्रीण (Friend)', code: 'MAITRIN', direction: 'SAME' },
        ],
        yAxis: {
            top: [
                { label: 'मित्र (Friend)', code: 'MITRA', direction: 'UP' },
                { label: 'मैत्रीण (Friend)', code: 'MAITRIN', direction: 'UP' },
            ],
            bottom: [
                { label: 'मित्र (Friend)', code: 'MITRA', direction: 'DOWN' },
                { label: 'मैत्रीण (Friend)', code: 'MAITRIN', direction: 'DOWN' },
            ],
        },
    },
    MAITRIN: {
        xAxis: [
            { label: 'मित्र (Friend)', code: 'MITRA', direction: 'SAME' },
            { label: 'मैत्रीण (Friend)', code: 'MAITRIN', direction: 'SAME' },
        ],
        yAxis: {
            top: [
                { label: 'मित्र (Friend)', code: 'MITRA', direction: 'UP' },
                { label: 'मैत्रीण (Friend)', code: 'MAITRIN', direction: 'UP' },
            ],
            bottom: [
                { label: 'मित्र (Friend)', code: 'MITRA', direction: 'DOWN' },
                { label: 'मैत्रीण (Friend)', code: 'MAITRIN', direction: 'DOWN' },
            ],
        },
    },
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
    ['BHAU', 'VAHINI'],
    ['BAHIN', 'DAJI'],
    ['FUA', 'AATYA'],
    ['MULGA', 'SUN'],
    ['MULGI', 'JAVAI'],
    ['NATU', 'NATASUN'],
    ['NAAT', 'NAT_JAVAI'],
    ['PANTU', 'PANTISUN'],
    ['PANTI', 'PANTU_JAVAI'],
    ['DIR_CHOTE', 'VAHINI'],
    ['DIR_MOTHE', 'VAHINI'],
    ['CHULAT_BHAU', 'VAHINI'],
    ['ATYE_BHAU', 'VAHINI'],
    ['MAV_BHAU', 'VAHINI'],
    ['MAMBHAU', 'VAHINI'],
    ['CHULAT_BAHIN', 'DAJI'],
    ['ATYE_BAHIN', 'DAJI'],
    ['MAV_BAHIN', 'DAJI'],
    ['MAMBAHIN', 'DAJI'],
];

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
