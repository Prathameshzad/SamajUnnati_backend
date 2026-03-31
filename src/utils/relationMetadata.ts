// src/utils/relationMetadata.ts

/**
 * Axis configurations for different relation codes.
 * This controls the UI options for adding new relations.
 * Labels here are used as UI hints.
 */
export interface AxisOption {
  label: string;
  code: string;
  direction: "UP" | "DOWN" | "SAME";
  triggerGender?: "MALE" | "FEMALE" | null;
  viewerGender?: "MALE" | "FEMALE" | null;
}

export interface AxisConfig {
  xAxis: {
    left: AxisOption[];
    right: AxisOption[];
  };
  yAxis: {
    top: AxisOption[];
    bottom: AxisOption[];
  };
}

export const RELATION_AXIS_CONFIG: Record<string, AxisConfig> = {
  ROOT: {
    xAxis: {
      left: [
        {
          label: "भाऊ (Brother)",
          code: "BHAU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "बहीण (Sister)",
          code: "BAHIN",
          direction: "SAME",
          triggerGender: "MALE",
        },
        { label: "मित्र (Friend)", code: "MITRA", direction: "SAME" },
      ],
      right: [
        {
          label: "बायको (Wife)",
          code: "BAYKO",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "नवरा (Husband)",
          code: "NAVRA",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
        { label: "मैत्रीण (Friend)", code: "MAITRIN", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "वडील (Father)", code: "VADIL", direction: "UP" },
        { label: "आई (Mother)", code: "AAI", direction: "UP" },
        { label: "सावत्रआई", code: "SAVATR_AAI", direction: "UP" },
        { label: "सावत्र वडील", code: "SAVATR_VADIL", direction: "UP" },
        { label: "मित्र (Friend)", code: "MITRA", direction: "UP" },
        { label: "मैत्रीण (Friend)", code: "MAITRIN", direction: "UP" },
      ],
      bottom: [
        { label: "मुलगा (Son)", code: "MULGA", direction: "DOWN" },
        { label: "मुलगी (Daughter)", code: "MULGI", direction: "DOWN" },
        { label: "मित्र (Friend)", code: "MITRA", direction: "DOWN" },
        { label: "मैत्रीण (Friend)", code: "MAITRIN", direction: "DOWN" },
      ],
    },
  },
  BAYKO: {
    xAxis: {
      left: [{ label: "नवरा (Husband)", code: "NAVRA", direction: "SAME" }],
      right: [
        {
          label: "मेव्हणा",
          code: "MEVHANA",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "मेव्हणी",
          code: "MEVHANI",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
    },
    yAxis: {
      top: [
        { label: "सासरा (Father-in-law)", code: "SASRA", direction: "UP" },
        { label: "सासू (Mother-in-law)", code: "SASU", direction: "UP" },
      ],
      bottom: [
        { label: "मुलगा (Son)", code: "MULGA", direction: "DOWN" },
        { label: "मुलगी (Daughter)", code: "MULGI", direction: "DOWN" },
        {
          label: "मेव्हणा",
          code: "MEVHANA",
          direction: "DOWN",
          viewerGender: "MALE",
        },
        {
          label: "मेव्हणी",
          code: "MEVHANI",
          direction: "DOWN",
          viewerGender: "MALE",
        },
      ],
    },
  },
  VADIL: {
    xAxis: {
      left: [
        {
          label: "काका",
          code: "KAKA",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "आत्या",
          code: "AATYA",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
      right: [{ label: "आई (Mother)", code: "AAI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "आजोबा (Grandfather)", code: "AJOBA", direction: "UP" },
        { label: "आजी (Grandmother)", code: "AAJI", direction: "UP" },
      ],
      bottom: [
        { label: "भाऊ (Brother)", code: "BHAU", direction: "DOWN" },
        { label: "बहीण (Sister)", code: "BAHIN", direction: "DOWN" },
      ],
    },
  },
  AAI: {
    xAxis: {
      left: [{ label: "वडील (Father)", code: "VADIL", direction: "SAME" }],
      right: [
        {
          label: "मामा",
          code: "MAMA",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "मावशी",
          code: "MAVSHI",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
    },
    yAxis: {
      top: [
        { label: "नाना (Grandfather)", code: "NANA", direction: "UP" },
        { label: "नानी (Grandmother)", code: "NANI", direction: "UP" },
      ],
      bottom: [
        { label: "भाऊ (Brother)", code: "BHAU", direction: "DOWN" },
        { label: "बहीण (Sister)", code: "BAHIN", direction: "DOWN" },
      ],
    },
  },
  SASRA: {
    xAxis: {
      left: [
        {
          label: "चुलत सासरा (Father-in-law)",
          code: "CHULAT_SASRA",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "आत्या सासू",
          code: "ATYA_SASU",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
      right: [
        { label: "सासू (Mother-in-law)", code: "SASU", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "आजी सासरा", code: "AJI_SASRA", direction: "UP" },
        { label: "आजोबा सासरा", code: "AJOBA_SASRA", direction: "UP" },
      ],
      bottom: [
        // For Male viewers (Wife's side)
        {
          label: "बायको (Wife)",
          code: "BAYKO",
          direction: "DOWN",
          viewerGender: "MALE",
        },
        {
          label: "मेव्हणा",
          code: "MEVHANA",
          direction: "DOWN",
          viewerGender: "MALE",
        },
        {
          label: "मेव्हणी",
          code: "MEVHANI",
          direction: "DOWN",
          viewerGender: "MALE",
        },
        // For Female viewers (Husband's side)
        {
          label: "नवरा (Husband)",
          code: "NAVRA",
          direction: "DOWN",
          viewerGender: "FEMALE",
        },
        {
          label: "दीर-छोटे",
          code: "DIR_CHOTE",
          direction: "DOWN",
          viewerGender: "FEMALE",
        },
        {
          label: "दीर-मोठे",
          code: "DIR_MOTHE",
          direction: "DOWN",
          viewerGender: "FEMALE",
        },
        {
          label: "नणंद",
          code: "NANAND",
          direction: "DOWN",
          viewerGender: "FEMALE",
        },
      ],
    },
  },
  SASU: {
    xAxis: {
      left: [
        { label: "सासरा (Father-in-law)", code: "SASRA", direction: "SAME" },
      ],
      right: [
        {
          label: "मामा सासरा",
          code: "MAMA_SASRA",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "मावस सासू",
          code: "MAVAS_SASU",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
    },
    yAxis: {
      top: [
        { label: "आजी सासरा", code: "AJI_SASRA", direction: "UP" },
        { label: "आजोबा सासरा", code: "AJOBA_SASRA", direction: "UP" },
      ],
      bottom: [
        // For Male viewers (Wife's side)
        {
          label: "बायको (Wife)",
          code: "BAYKO",
          direction: "DOWN",
          viewerGender: "MALE",
        },
        {
          label: "मेव्हणा",
          code: "MEVHANA",
          direction: "DOWN",
          viewerGender: "MALE",
        },
        {
          label: "मेव्हणी",
          code: "MEVHANI",
          direction: "DOWN",
          viewerGender: "MALE",
        },
        // For Female viewers (Husband's side)
        {
          label: "नवरा (Husband)",
          code: "NAVRA",
          direction: "DOWN",
          viewerGender: "FEMALE",
        },
        {
          label: "दीर-छोटे",
          code: "DIR_CHOTE",
          direction: "DOWN",
          viewerGender: "FEMALE",
        },
        {
          label: "दीर-मोठे",
          code: "DIR_MOTHE",
          direction: "DOWN",
          viewerGender: "FEMALE",
        },
        {
          label: "नणंद",
          code: "NANAND",
          direction: "DOWN",
          viewerGender: "FEMALE",
        },
      ],
    },
  },
  AJI_SASRA: {
    xAxis: {
      left: [],
      right: [{ label: "आजी सासू", code: "AJI_SASU", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "पणजी सासू", code: "PANAJI_SASU", direction: "UP" },
        { label: "पणजोबा सासरा", code: "PANJOBA_SASRA", direction: "UP" },
      ],
      bottom: [
        // For Male viewers (Wife's side)
        { label: "सासू (Mother-in-law)", code: "SASU", direction: "DOWN" },
        { label: "सासरा (Father-in-law)", code: "SASRA", direction: "DOWN" },
      ],
    },
  },
  AJOBA_SASU: {
    xAxis: {
      left: [],
      right: [{ label: "आजोबा सासू", code: "AJOBA_SASU", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "पणजी सासू", code: "PANAJI_SASU", direction: "UP" },
        { label: "पणजोबा सासरा", code: "PANJOBA_SASRA", direction: "UP" },
      ],
      bottom: [
        { label: "सासू (Mother-in-law)", code: "SASU", direction: "DOWN" },
        { label: "सासरा (Father-in-law)", code: "SASRA", direction: "DOWN" },
        { label: "मामा सासरा", code: "MAMA_SASRA", direction: "DOWN" },
        { label: "मामी सासू", code: "MAMI_SASU", direction: "DOWN" },
      ],
    },
  },
  MAMA_SASRA: {
    xAxis: {
      left: [],
      right: [{ label: "मामी सासू", code: "MAMI_SASU", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "आजी सासू", code: "AJI_SASU", direction: "UP" },
        { label: "आजोबा सासू", code: "AJOBA_SASU", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत दीर", code: "CHULTA_DIR", direction: "DOWN" },
        { label: "चुलत नणंद", code: "CHULTA_NANAND", direction: "DOWN" },
      ],
    },
  },
  MAMI_SASU: {
    xAxis: {
      left: [{ label: "मामा सासरा", code: "MAMA_SASRA", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [
        { label: "आजी सासू", code: "AJI_SASU", direction: "UP" },
        { label: "आजोबा सासू", code: "AJOBA_SASU", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत दीर", code: "CHULTA_DIR", direction: "DOWN" },
        { label: "चुलत नणंद", code: "CHULTA_NANAND", direction: "DOWN" },
      ],
    },
  },
  CHULTA_DIR: {
    xAxis: { left: [], right: [] },
    yAxis: {
      top: [
        { label: "आजी सासू", code: "AJI_SASU", direction: "UP" },
        { label: "आजोबा सासू", code: "AJOBA_SASU", direction: "UP" },
      ],
      bottom: [],
    },
  },
  CHULTA_NANAND: {
    xAxis: { left: [], right: [] },
    yAxis: {
      top: [
        { label: "आजी सासू", code: "AJI_SASU", direction: "UP" },
        { label: "आजोबा सासू", code: "AJOBA_SASU", direction: "UP" },
      ],
      bottom: [],
    },
  },
  PANAJI_SASU: {
    xAxis: {
      left: [],
      right: [
        { label: "पणजोबा सासरा", code: "PANJOBA_SASRA", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "आजी सासू", code: "AJI_SASU", direction: "DOWN" },
        { label: "आजोबा सासू", code: "AJOBA_SASU", direction: "DOWN" },
      ],
    },
  },
  PANJOBA_SASRA: {
    xAxis: {
      left: [],
      right: [
        { label: "पणजी सासू", code: "PANAJI_SASU", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "आजी सासू", code: "AJI_SASU", direction: "DOWN" },
        { label: "आजोबा सासू", code: "AJOBA_SASU", direction: "DOWN" },
      ],
    },
  },
  BHAU: {
    xAxis: {
      left: [
        {
          label: "भाऊ (Brother)",
          code: "BHAU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "बहीण (Sister)",
          code: "BAHIN",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
      right: [{ label: "वहिनी", code: "VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "पुतण्या", code: "PUTANYA", direction: "DOWN" },
        { label: "पुतणी", code: "PUTANI", direction: "DOWN" },
      ],
    },
  },
  BAHIN: {
    xAxis: {
      left: [{ label: "दाजी", code: "DAJI", direction: "SAME" }],
      right: [
        {
          label: "भाऊ (Brother)",
          code: "BHAU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "बहीण (Sister)",
          code: "BAHIN",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  VAHINI: {
    xAxis: {
      left: [{ label: "भाऊ", code: "BHAU", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "पुतण्या", code: "PUTANYA", direction: "DOWN" },
        { label: "पुतणी", code: "PUTANI", direction: "DOWN" },
      ],
    },
  },
  DAJI: {
    xAxis: {
      left: [],
      right: [{ label: "बहीण", code: "BAHIN", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  MULGA: {
    xAxis: {
      left: [
        {
          label: "मुलगा",
          code: "MULGA",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "मुलगी",
          code: "MULGI",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
      right: [{ label: "सून", code: "SUN", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "नातू", code: "NATU", direction: "DOWN" },
        { label: "नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  MULGI: {
    xAxis: {
      left: [{ label: "जावई", code: "JAVAI", direction: "SAME" }],
      right: [
        {
          label: "मुलगा",
          code: "MULGA",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "मुलगी",
          code: "MULGI",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "नातू", code: "NATU", direction: "DOWN" },
        { label: "नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  MAMA: {
    xAxis: {
      left: [
        {
          label: "मामा",
          code: "MAMA",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "मावशी",
          code: "MAVSHI",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
        {
          label: "आई",
          code: "AAI",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
      right: [{ label: "मामी", code: "MAMI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "नाना", code: "NANA", direction: "UP" },
        { label: "नानी", code: "NANI", direction: "UP" },
      ],
      bottom: [
        { label: "भाचा (Cousin)", code: "BHACHA", direction: "DOWN" },
        { label: "भाची (Cousin)", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  MAMI: {
    xAxis: {
      left: [{ label: "मामा", code: "MAMA", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "भाचा (Cousin)", code: "BHACHA", direction: "DOWN" },
        { label: "भाची (Cousin)", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  AJOBA: {
    xAxis: {
      left: [],
      right: [{ label: "आजी (Grandmother)", code: "AAJI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        {
          label: "पणजोबा (Great Grandfather)",
          code: "PANJOBA",
          direction: "UP",
        },
        { label: "पणजी (Great Grandmother)", code: "PANAAJI", direction: "UP" },
      ],
      bottom: [
        { label: "वडील (Father)", code: "VADIL", direction: "DOWN" },
        { label: "काका (Uncle)", code: "KAKA", direction: "DOWN" },
        { label: "आत्या (Aunt)", code: "AATYA", direction: "DOWN" },
      ],
    },
  },
  AAJI: {
    xAxis: {
      left: [
        { label: "आजोबा (Grandfather)", code: "AJOBA", direction: "SAME" },
      ],
      right: [],
    },
    yAxis: {
      top: [
        {
          label: "पणजोबा (Great Grandfather)",
          code: "PANJOBA",
          direction: "UP",
        },
        { label: "पणजी (Great Grandmother)", code: "PANAAJI", direction: "UP" },
      ],
      bottom: [
        { label: "वडील (Father)", code: "VADIL", direction: "DOWN" },
        { label: "काका (Uncle)", code: "KAKA", direction: "DOWN" },
        { label: "आत्या (Aunt)", code: "AATYA", direction: "DOWN" },
      ],
    },
  },
  NANA: {
    xAxis: {
      left: [],
      right: [{ label: "नानी", code: "NANI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "पणजोबा", code: "PANJOBA", direction: "UP" },
        { label: "पणजी", code: "PANAAJI", direction: "UP" },
      ],
      bottom: [
        { label: "आई (Mother)", code: "AAI", direction: "DOWN" },
        { label: "मामा (Uncle)", code: "MAMA", direction: "DOWN" },
        { label: "मावशी (Aunt)", code: "MAVSHI", direction: "DOWN" },
      ],
    },
  },
  NANI: {
    xAxis: {
      left: [{ label: "नाना", code: "NANA", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [
        { label: "पणजोबा", code: "PANJOBA", direction: "UP" },
        { label: "पणजी", code: "PANAAJI", direction: "UP" },
      ],
      bottom: [
        { label: "आई (Mother)", code: "AAI", direction: "DOWN" },
        { label: "मामा (Uncle)", code: "MAMA", direction: "DOWN" },
        { label: "मावशी (Aunt)", code: "MAVSHI", direction: "DOWN" },
      ],
    },
  },
  KAKA: {
    xAxis: {
      left: [
        {
          label: "वडील",
          code: "VADIL",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "काका",
          code: "KAKA",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "आत्या",
          code: "AATYA",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
      right: [{ label: "काकी", code: "KAKI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "आजोबा", code: "AJOBA", direction: "UP" },
        { label: "आजी", code: "AAJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलतभाऊ", code: "CHULAT_BHAU", direction: "DOWN" },
        { label: "चुलतबहीण", code: "CHULAT_BAHIN", direction: "DOWN" },
      ],
    },
  },
  KAKI: {
    xAxis: {
      left: [{ label: "काका", code: "KAKA", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "चुलतभाऊ", code: "CHULAT_BHAU", direction: "DOWN" },
        { label: "चुलतबहीण", code: "CHULAT_BAHIN", direction: "DOWN" },
      ],
    },
  },
  AATYA: {
    xAxis: {
      left: [
        { label: "दाजी", code: "DAJI", direction: "SAME" },
        { label: "फूफा", code: "FUA", direction: "SAME" },
      ],
      right: [
        {
          label: "वडील",
          code: "VADIL",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "काका",
          code: "KAKA",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "आत्या",
          code: "AATYA",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
    },
    yAxis: {
      top: [
        { label: "आजोबा", code: "AJOBA", direction: "UP" },
        { label: "आजी", code: "AAJI", direction: "UP" },
      ],
      bottom: [
        { label: "आत्येभाऊ", code: "ATYE_BHAU", direction: "DOWN" },
        { label: "आत्येबहीण", code: "ATYE_BAHIN", direction: "DOWN" },
      ],
    },
  },
  MAVSHI: {
    xAxis: {
      left: [{ label: "मावसा", code: "MAVSA", direction: "SAME" }],
      right: [
        {
          label: "मामा",
          code: "MAMA",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "मावशी",
          code: "MAVSHI",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
        {
          label: "आई",
          code: "AAI",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
    },
    yAxis: {
      top: [
        { label: "नाना", code: "NANA", direction: "UP" },
        { label: "नानी", code: "NANI", direction: "UP" },
      ],
      bottom: [
        { label: "मावसभाऊ", code: "MAV_BHAU", direction: "DOWN" },
        { label: "मावसबहीण", code: "MAV_BAHIN", direction: "DOWN" },
      ],
    },
  },
  PANJOBA: {
    xAxis: {
      left: [],
      right: [{ label: "पणजी", code: "PANAAJI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "आजोबा", code: "AJOBA", direction: "DOWN" },
        { label: "नाना", code: "NANA", direction: "DOWN" },
      ],
    },
  },
  PANAAJI: {
    xAxis: {
      left: [{ label: "पणजोबा", code: "PANJOBA", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "आजोबा", code: "AJOBA", direction: "DOWN" },
        { label: "नाना", code: "NANA", direction: "DOWN" },
      ],
    },
  },
  NATU: {
    xAxis: {
      left: [
        {
          label: "नातू",
          code: "NATU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "नात",
          code: "NAAT",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
      right: [{ label: "नातसून", code: "NATASUN", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "नातसून", code: "NATASUN", direction: "DOWN" },
        { label: "पणतू", code: "PANTU", direction: "DOWN" },
        { label: "पणती", code: "PANTI", direction: "DOWN" },
      ],
    },
  },
  NAAT: {
    xAxis: {
      left: [{ label: "नातजावई", code: "NAT_JAVAI", direction: "SAME" }],
      right: [
        {
          label: "नातू",
          code: "NATU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "नात",
          code: "NAAT",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "नातजावई", code: "NAT_JAVAI", direction: "DOWN" },
        { label: "पणतू", code: "PANTU", direction: "DOWN" },
        { label: "पणती", code: "PANTI", direction: "DOWN" },
      ],
    },
  },
  NATASUN: {
    xAxis: {
      left: [{ label: "नातू", code: "NATU", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "पणतू", code: "PANTU", direction: "DOWN" },
        { label: "पणती", code: "PANTI", direction: "DOWN" },
      ],
    },
  },
  NAT_JAVAI: {
    xAxis: {
      left: [],
      right: [{ label: "नात", code: "NAAT", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "पणतू", code: "PANTU", direction: "DOWN" },
        { label: "पणती", code: "PANTI", direction: "DOWN" },
      ],
    },
  },
  PANTU: {
    xAxis: {
      left: [
        {
          label: "पणतू",
          code: "PANTU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "पणती",
          code: "PANTI",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
      right: [{ label: "पणतीसून", code: "PANTISUN", direction: "SAME" }],
    },
    yAxis: { top: [], bottom: [] },
  },
  PANTI: {
    xAxis: {
      left: [{ label: "पणतूजावई", code: "PANTU_JAVAI", direction: "SAME" }],
      right: [
        {
          label: "पणतू",
          code: "PANTU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "पणती",
          code: "PANTI",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
    },
    yAxis: { top: [], bottom: [] },
  },

  NAVRA: {
    xAxis: {
      left: [],
      right: [{ label: "बायको (Wife)", code: "BAYKO", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "सासरा (Father-in-law)", code: "SASRA", direction: "UP" },
        { label: "सासू (Mother-in-law)", code: "SASU", direction: "UP" },
      ],
      bottom: [
        { label: "मुलगा (Son)", code: "MULGA", direction: "DOWN" },
        { label: "मुलगी (Daughter)", code: "MULGI", direction: "DOWN" },
      ],
    },
  },
  MAVSA: {
    xAxis: {
      left: [],
      right: [{ label: "मावशी", code: "MAVSHI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "मावसभाऊ", code: "MAV_BHAU", direction: "DOWN" },
        { label: "मावसबहीण", code: "MAV_BAHIN", direction: "DOWN" },
      ],
    },
  },
  FUA: {
    xAxis: {
      left: [],
      right: [{ label: "आत्या", code: "AATYA", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "आत्येभाऊ", code: "ATYE_BHAU", direction: "DOWN" },
        { label: "आत्येबहीण", code: "ATYE_BAHIN", direction: "DOWN" },
      ],
    },
  },
  SUN: {
    xAxis: {
      left: [{ label: "मुलगा", code: "MULGA", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "नातू", code: "NATU", direction: "DOWN" },
        { label: "नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  JAVAI: {
    xAxis: {
      left: [],
      right: [{ label: "मुलगी", code: "MULGI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "नातू", code: "NATU", direction: "DOWN" },
        { label: "नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  CHULTA: {
    xAxis: {
      left: [],
      right: [{ label: "चुलती", code: "CHULTI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "चुलतभाऊ", code: "CHULAT_BHAU", direction: "DOWN" },
        { label: "चुलतबहीण", code: "CHULAT_BAHIN", direction: "DOWN" },
      ],
    },
  },
  CHULTI: {
    xAxis: {
      left: [{ label: "चुलता", code: "CHULTA", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "चुलतभाऊ", code: "CHULAT_BHAU", direction: "DOWN" },
        { label: "चुलतबहीण", code: "CHULAT_BAHIN", direction: "DOWN" },
      ],
    },
  },
  DIR_CHOTE: {
    xAxis: {
      left: [],
      right: [{ label: "वहिनी", code: "VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "पुतण्या", code: "PUTANYA", direction: "DOWN" },
        { label: "पुतणी", code: "PUTANI", direction: "DOWN" },
      ],
    },
  },
  DIR_MOTHE: {
    xAxis: {
      left: [],
      right: [{ label: "वहिनी", code: "VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "पुतण्या", code: "PUTANYA", direction: "DOWN" },
        { label: "पुतणी", code: "PUTANI", direction: "DOWN" },
      ],
    },
  },
  MEVHANA: {
    xAxis: {
      left: [
        {
          label: "मेव्हणा",
          code: "MEVHANA",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "मेव्हणी",
          code: "MEVHANI",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
      right: [],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  MEVHANI: {
    xAxis: {
      left: [],
      right: [
        {
          label: "मेव्हणा",
          code: "MEVHANA",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "मेव्हणी",
          code: "MEVHANI",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  CHULAT_BHAU: {
    xAxis: {
      left: [
        {
          label: "चुलतभाऊ",
          code: "CHULAT_BHAU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "चुलतबहीण",
          code: "CHULAT_BAHIN",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
      right: [{ label: "वहिनी", code: "VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "मुलगा", code: "MULGA", direction: "DOWN" },
        { label: "मुलगी", code: "MULGI", direction: "DOWN" },
      ],
    },
  },
  CHULAT_BAHIN: {
    xAxis: {
      left: [{ label: "दाजी", code: "DAJI", direction: "SAME" }],
      right: [
        {
          label: "चुलतभाऊ",
          code: "CHULAT_BHAU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "चुलतबहीण",
          code: "CHULAT_BAHIN",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  ATYE_BHAU: {
    xAxis: {
      left: [
        {
          label: "आत्येभाऊ",
          code: "ATYE_BHAU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "आत्येबहीण",
          code: "ATYE_BAHIN",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
      right: [{ label: "वहिनी", code: "VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "मुलगा", code: "MULGA", direction: "DOWN" },
        { label: "मुलगी", code: "MULGI", direction: "DOWN" },
      ],
    },
  },
  ATYE_BAHIN: {
    xAxis: {
      left: [{ label: "दाजी", code: "DAJI", direction: "SAME" }],
      right: [
        {
          label: "आत्येभाऊ",
          code: "ATYE_BHAU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "आत्येबहीण",
          code: "ATYE_BAHIN",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  MAV_BHAU: {
    xAxis: {
      left: [
        {
          label: "मावसभाऊ",
          code: "MAV_BHAU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "मावसबहीण",
          code: "MAV_BAHIN",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
      right: [{ label: "वहिनी", code: "VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "मुलगा", code: "MULGA", direction: "DOWN" },
        { label: "मुलगी", code: "MULGI", direction: "DOWN" },
      ],
    },
  },
  MAV_BAHIN: {
    xAxis: {
      left: [{ label: "दाजी", code: "DAJI", direction: "SAME" }],
      right: [
        {
          label: "मावसभाऊ",
          code: "MAV_BHAU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "मावसबहीण",
          code: "MAV_BAHIN",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  MAMBHAU: {
    xAxis: {
      left: [
        {
          label: "मामेभाऊ",
          code: "MAMBHAU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "मामेबहीण",
          code: "MAMBAHIN",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
      right: [{ label: "वहिनी", code: "VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "मुलगा", code: "MULGA", direction: "DOWN" },
        { label: "मुलगी", code: "MULGI", direction: "DOWN" },
      ],
    },
  },
  MAMBAHIN: {
    xAxis: {
      left: [{ label: "दाजी", code: "DAJI", direction: "SAME" }],
      right: [
        {
          label: "मामेभाऊ",
          code: "MAMBHAU",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "मामेबहीण",
          code: "MAMBAHIN",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  NANAND: {
    xAxis: {
      left: [],
      right: [{ label: "नणंदोई", code: "NANANDOI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  NANANDOI: {
    xAxis: {
      left: [{ label: "नणंद", code: "NANAND", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  MITRA: {
    xAxis: {
      left: [{ label: "मित्र (Friend)", code: "MITRA", direction: "SAME" }],
      right: [
        { label: "मैत्रीण (Friend)", code: "MAITRIN", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "मित्र (Friend)", code: "MITRA", direction: "UP" },
        { label: "मैत्रीण (Friend)", code: "MAITRIN", direction: "UP" },
      ],
      bottom: [
        { label: "मित्र (Friend)", code: "MITRA", direction: "DOWN" },
        { label: "मैत्रीण (Friend)", code: "MAITRIN", direction: "DOWN" },
      ],
    },
  },
  MAITRIN: {
    xAxis: {
      left: [{ label: "मित्र (Friend)", code: "MITRA", direction: "SAME" }],
      right: [
        { label: "मैत्रीण (Friend)", code: "MAITRIN", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "मित्र (Friend)", code: "MITRA", direction: "UP" },
        { label: "मैत्रीण (Friend)", code: "MAITRIN", direction: "UP" },
      ],
      bottom: [
        { label: "मित्र (Friend)", code: "MITRA", direction: "DOWN" },
        { label: "मैत्रीण (Friend)", code: "MAITRIN", direction: "DOWN" },
      ],
    },
  },
};

export const SPOUSE_PAIRS: [string, string][] = [
  ["VADIL", "AAI"],
  ["AJOBA", "AAJI"],
  ["NANA", "NANI"],
  ["PANJOBA", "PANAAJI"],
  ["SASRA", "SASU"],
  ["KAKA", "KAKI"],
  ["MAMA", "MAMI"],
  ["MAVSA", "MAVSHI"],
  ["NAVRA", "BAYKO"],
  ["BHAU", "VAHINI"],
  ["BAHIN", "DAJI"],
  ["FUA", "AATYA"],
  ["MULGA", "SUN"],
  ["MULGI", "JAVAI"],
  ["NATU", "NATASUN"],
  ["NAT_JAVAI", "NAAT"],
  ["PANTU", "PANTISUN"],
  ["PANTI", "PANTU_JAVAI"],
  ["DIR_CHOTE", "VAHINI"],
  ["DIR_MOTHE", "VAHINI"],
  ["AJI_SASRA", "AJI_SASU"],
  ["AJOBA_SASRA", "AJOBA_SASU"],
  ["MAMA_SASRA", "MAMI_SASU"],
  ["PANAJI_SASU", "PANJOBA_SASRA"],
  ["CHULAT_BHAU", "VAHINI"],
  ["ATYE_BHAU", "VAHINI"],
  ["MAV_BHAU", "VAHINI"],
  ["MAMBHAU", "VAHINI"],
  ["CHULAT_BAHIN", "DAJI"],
  ["ATYE_BAHIN", "DAJI"],
  ["MAV_BAHIN", "DAJI"],
  ["MAMBAHIN", "DAJI"],
];

export const COUSIN_CODES = [
  "MAMBHAU",
  "MAMBAHIN",
  "MAV_BHAU",
  "MAV_BAHIN",
  "CHULAT_BHAU",
  "CHULAT_BAHIN",
  "ATYE_BHAU",
  "ATYE_BAHIN",
];

export const COUSIN_PARENT_MAP: Record<string, string[]> = {
  MAMBHAU: ["MAMA", "MAMI"],
  MAMBAHIN: ["MAMA", "MAMI"],
  MAV_BHAU: ["MAMA", "MAMI"],
  MAV_BAHIN: ["MAMA", "MAMI"],
  CHULAT_BHAU: ["KAKA", "KAKI"],
  CHULAT_BAHIN: ["KAKA", "KAKI"],
  ATYE_BHAU: ["AATYA", "FUA"],
  ATYE_BAHIN: ["AATYA", "FUA"],
};
