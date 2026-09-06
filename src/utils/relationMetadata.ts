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
        // { label: "सावत्र भाऊ", code: "SAVATR_BHAU", direction: "SAME" },
        // { label: "सावत्र बहीण", code: "SAVATR_BAHIN", direction: "SAME" },
        { label: "मित्र (Friend)", code: "MITRA", direction: "SAME" },
        {
          label: "नवरा (Husband)",
          code: "NAVRA",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
      ],
      right: [
        {
          label: "बायको (Wife)",
          code: "BAYKO",
          direction: "SAME",
          triggerGender: "MALE",
        },
        {
          label: "भाऊ (Brother)",
          code: "BHAU",
          direction: "SAME",
          triggerGender: "FEMALE",
        },
        {
          label: "बहीण (Sister)",
          code: "BAHIN",
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
        // { label: "सावत्रआई", code: "SAVATR_AAI", direction: "UP" },
        // { label: "सावत्र वडील", code: "SAVATR_VADIL", direction: "UP" },
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
        },
        {
          label: "मेव्हणी",
          code: "MEVHANI",
          direction: "SAME",
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
      ],
    },
  },
  NAVRA: {
    xAxis: {
      left: [
        {
          label: "धाकटा दीर",
          code: "DIR_CHOTE",
          direction: "SAME",
        },
        {
          label: "मोठा दीर",
          code: "DIR_MOTHE",
          direction: "SAME",
        },
        {
          label: "नणंद",
          code: "NANAND",
          direction: "SAME",
        },
      ],
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

  VADIL: {
    xAxis: {
      left: [
        {
          label: "काका",
          code: "KAKA",
          direction: "SAME",
        },
        {
          label: "आत्या",
          code: "AATYA",
          direction: "SAME",
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
        },
        {
          label: "मावशी",
          code: "MAVSHI",
          direction: "SAME",
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

  DIR_CHOTE: {
    xAxis: {
      left: [
        {
          label: "धाकटा दीर",
          code: "DIR_CHOTE",
          direction: "SAME",
        },
        {
          label: "मोठे दिर",
          code: "DIR_MOTHE",
          direction: "SAME",
        },
        {
          label: "नणंद",
          code: "NANAND",
          direction: "SAME",
        }
      ],
      right: [{ label: "भावजय", code: "BHAUJAI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "सासरे", code: "SASRA", direction: "DOWN" },
        { label: "सासू", code: "SASU", direction: "DOWN" },
      ],
      bottom: [
        { label: "पुतण्या", code: "PUTANYA", direction: "DOWN" },
        { label: "पुतणी", code: "PUTANI", direction: "DOWN" },
      ],
    },
  },
  BHAUJAI: {
    xAxis: {
      left: [{ label: "दीर-छोटे", code: "DIR_CHOTE", direction: "SAME" }],
      right: [
        { label: "चुलत मेव्हणा", code: "CHULAT_MEVHANA", direction: "SAME" },
        { label: "चुलत मेव्हणी", code: "CHULAT_MEVHANI", direction: "SAME" }
      ]
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "पुतण्या", code: "PUTANYA", direction: "DOWN" },
        { label: "पुतणी", code: "PUTANI", direction: "DOWN" }
      ]
    }
  },
  DIR_MOTHE: {
    xAxis: {
      left: [
        {
          label: "धाकटा दीर",
          code: "DIR_CHOTE",
          direction: "SAME",
        },
        {
          label: "मोठे दिर",
          code: "DIR_MOTHE",
          direction: "SAME",
        },
        {
          label: "नणंद",
          code: "NANAND",
          direction: "SAME",
        }
      ],
      right: [{ label: "वहिनी", code: "VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "सासरे", code: "SASRA", direction: "DOWN" },
        { label: "सासू", code: "SASU", direction: "DOWN" },
      ],
      bottom: [
        { label: "पुतण्या", code: "PUTANYA", direction: "DOWN" },
        { label: "पुतणी", code: "PUTANI", direction: "DOWN" },
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
        },
        {
          label: "आत्या सासू",
          code: "ATYA_SASU",
          direction: "SAME",
        },
      ],
      right: [
        { label: "सासू (Mother-in-law)", code: "SASU", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "आजोबा सासरा", code: "AJOBA_SASRA", direction: "UP" },
        { label: "आजी सासू", code: "AJI_SASU", direction: "UP" },
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
        },
        {
          label: "मावस सासू",
          code: "MAVAS_SASU",
          direction: "SAME",
        },
      ],
    },
    yAxis: {
      top: [
        { label: "आजोबा सासरा", code: "AJOBA_SASRA", direction: "UP" },
        { label: "आजी सासू", code: "AJI_SASU", direction: "UP" },
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
  AJI_SASU: {
    xAxis: {
      left: [{ label: "आजी सासू", code: "AJI_SASU", direction: "SAME" }],
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
  AJOBA_SASU: {
    xAxis: {
      left: [{ label: "आजी सासू", code: "AJI_SASU", direction: "SAME" }],
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
      left: [
        { label: "मामी सासरा", code: "MAMI_SASRA", direction: "SAME" },
        { label: "मावस सासू", code: "MAVAS_SASU", direction: "SAME" }
      ],
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
      right: [
        { label: "मामी सासरा", code: "MAMI_SASRA", direction: "SAME" },
        { label: "मावस सासू", code: "MAVAS_SASU", direction: "SAME" }
      ],
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
    xAxis: {
      left: [
        { label: "चुलत नणंद", code: "CHULAT_NANAND", direction: "SAME" },
        { label: "चुलत दीर", code: "CHULTA_DIR", direction: "SAME" }
      ],
      right: [
        { label: "चुलत भाऊजय", code: "CHULAT_BHAUJAI", direction: "SAME" }
      ]
    },
    yAxis: {
      top: [
        { label: "आजी सासू", code: "AJI_SASU", direction: "UP" },
        { label: "आजोबा सासू", code: "AJOBA_SASU", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत पुतण्या", code: "CHULAT_PUTANYA", direction: "DOWN" },
        { label: "चुलत पुतणी", code: "CHULAT_PUTANI", direction: "DOWN" }
      ],
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
        },
        {
          label: "बहीण (Sister)",
          code: "BAHIN",
          direction: "SAME",
        },
      ],
      right: [{ label: "वहिनी", code: "VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "वडील", code: "VADIL", direction: "UP" },
        { label: "आई", code: "AAI", direction: "UP" }
      ],
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
        },
        {
          label: "बहीण (Sister)",
          code: "BAHIN",
          direction: "SAME",
        },
      ],
    },
    yAxis: {
      top: [
        { label: "वडील", code: "VADIL", direction: "UP" },
        { label: "आई", code: "AAI", direction: "UP" }
      ],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  VAHINI: {
    xAxis: {
      left: [{ label: "भाऊ", code: "BHAU", direction: "SAME", triggerGender: "MALE" },
      { label: "मोठा दीर", code: "DIR_MOTHE", direction: "SAME", triggerGender: "FEMALE" }
      ],
      right: [
        {
          label: "चुलत मेव्हणा",
          code: "CHULAT_MEVHANA",
          direction: "SAME",
          triggerGender: "MALE"
        },
        {
          label: "चुलत मेव्हणी",
          code: "CHULAT_MEVHANI",
          direction: "SAME",
          triggerGender: "MALE"
        },
      ],
    },
    yAxis: {
      top: [
        { label: "वडील", code: "VADIL", direction: "UP" },
        { label: "आई", code: "AAI", direction: "UP" },
      ],
      bottom: [
        { label: "पुतण्या", code: "PUTANYA", direction: "DOWN" },
        { label: "पुतणी", code: "PUTANI", direction: "DOWN" },
      ],
    },
  },
  DAJI: {
    xAxis: {
      left: [
        { label: "दाजीचा भाऊ", code: "DAJI_CHA_BHAU", direction: "SAME" },
        { label: "दाजीची बहीण", code: "DAJI_CHI_BAHIN", direction: "SAME" },
      ],
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
  DAJI_CHA_BHAU: {
    xAxis: {
      left: [{ label: "दाजी", code: "DAJI", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [],
      bottom: [],
    },
  },
  DAJI_CHI_BAHIN: {
    xAxis: {
      left: [{ label: "दाजी", code: "DAJI", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [],
      bottom: [],
    },
  },
  MULGA: {
    xAxis: {
      left: [
        { label: "मुलगा", code: "MULGA", direction: "SAME" },
        { label: "मुलगी", code: "MULGI", direction: "SAME" },
      ],
      right: [{ label: "सून", code: "SUN", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "वडील (Father)", code: "VADIL", direction: "UP" },
        { label: "आई (Mother)", code: "AAI", direction: "UP" },
      ],
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
        { label: "मुलगा", code: "MULGA", direction: "SAME" },
        { label: "मुलगी", code: "MULGI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "वडील (Father)", code: "VADIL", direction: "UP" },
        { label: "आई (Mother)", code: "AAI", direction: "UP" },
      ],
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
        },
        {
          label: "मावशी",
          code: "MAVSHI",
          direction: "SAME",
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
        { label: "मामेभाऊ", code: "MAMI_BHAU", direction: "DOWN" },
        { label: "मामेबहीण", code: "MAMI_BAHIN", direction: "DOWN" },
      ],
    },
  },
  MAMI: {
    xAxis: {
      left: [{ label: "मामा", code: "MAMA", direction: "SAME" }],
      right: [
        { label: "मामीचा भाऊ", code: "MAMI_CHA_BHAU", direction: "SAME" },
        { label: "मामीची बहीण", code: "MAMI_CHI_BAHIN", direction: "SAME" }
      ],
    },
    yAxis: {
      top: [{ label: "नातेवाईक", code: "NATEVAIK", direction: "UP" }],
      bottom: [
        { label: "मामेभाऊ", code: "MAMI_BHAU", direction: "DOWN" },
        { label: "मामेबहीण", code: "MAMI_BAHIN", direction: "DOWN" },
      ],
    },
  },
  AJOBA: {
    xAxis: {
      left: [
        { label: "आत्या आजी", code: "AATYA_AAJI", direction: "SAME" },
        { label: "चुलत आजोबा", code: "CHULAT_AJOBA", direction: "SAME" }
      ],
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
      right: [
        { label: "मामे आजोबा", code: "MAME_AAJOBA", direction: "SAME" },
        { label: "मामे आजोबा", code: "MAME_AJOBA", direction: "SAME" },
        { label: "मावस आजी", code: "MAV_AAJI", direction: "SAME" },
        { label: "मावस आजी", code: "MAVAS_AAJI", direction: "SAME" }
      ],
    },
    yAxis: {
      top: [
        {
          label: "पणजोबा (Great Grandfather)",
          code: "PANJOBA",
          direction: "UP",
        },
        { label: "पणजी (Great Grandmother)", code: "PANAAJI", direction: "UP" },
        { label: "नातेवाईक", code: "NATEVAIK", direction: "UP" }
      ],
      bottom: [
        { label: "वडील (Father)", code: "VADIL", direction: "DOWN" },
        { label: "काका (Uncle)", code: "KAKA", direction: "DOWN" },
        { label: "आत्या (Aunt)", code: "AATYA", direction: "DOWN" },
      ],
    },
  },
  CHULAT_AJOBA: {
    xAxis: {
      left: [
        { label: "चुलत आजोबा", code: "CHULAT_AJOBA", direction: "SAME" },
        { label: "आत्या आजी", code: "AATYA_AAJI", direction: "SAME" },
        { label: "आजोबा", code: "AJOBA", direction: "SAME" },
      ],
      right: [
        { label: "चुलत आजी", code: "CHULAT_AAJI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "पणजोबा", code: "PANJOBA", direction: "UP" },
        { label: "पणजी", code: "PANAAJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलतभाऊ", code: "CHULAT_BHAU", direction: "DOWN" },
        { label: "चुलतबहीण", code: "CHULAT_BAHIN", direction: "DOWN" },
      ],
    },
  },
  CHULAT_AAJI: {
    xAxis: {
      left: [
        { label: "चुलत आजोबा", code: "CHULAT_AJOBA", direction: "SAME" },
        { label: "आत्या आजी", code: "AATYA_AAJI", direction: "SAME" },
        { label: "आजोबा", code: "AJOBA", direction: "SAME" },
      ],
      right: [
        { label: "चुलत आजी", code: "CHULAT_AAJI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "पणजोबा", code: "PANJOBA", direction: "UP" },
        { label: "पणजी", code: "PANAAJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलतभाऊ", code: "CHULAT_BHAU", direction: "DOWN" },
        { label: "चुलतबहीण", code: "CHULAT_BAHIN", direction: "DOWN" },
      ],
    },
  },
  AATYA_AAJI: {
    xAxis: {
      left: [
        { label: "फुआ आजोबा", code: "FUA_AJOBA", direction: "SAME" },
      ],
      right: [
        { label: "चुलत आजोबा", code: "CHULAT_AJOBA", direction: "SAME" },
        { label: "आत्या आजी", code: "AATYA_AAJI", direction: "SAME" },
        { label: "आजोबा", code: "AJOBA", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "पणजोबा", code: "PANJOBA", direction: "UP" },
        { label: "पणजी", code: "PANAAJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत आत्येभाऊ", code: "CHULAT_AATYA_BHAU", direction: "DOWN" },
        { label: "चुलत आत्येबहीण", code: "CHULAT_AATYA_BAHIN", direction: "DOWN" },
      ],
    },
  },
  FUA_AJOBA: {
    xAxis: {
      left: [],
      right: [
        { label: "आत्या आजी", code: "AATYA_AAJI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "पणजोबा", code: "PANJOBA", direction: "UP" },
        { label: "पणजी", code: "PANAAJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत आत्येभाऊ", code: "CHULAT_AATYA_BHAU", direction: "DOWN" },
        { label: "चुलत आत्येबहीण", code: "CHULAT_AATYA_BAHIN", direction: "DOWN" },
      ],
    },
  },
  FAU_AJOBA: {
    xAxis: {
      left: [],
      right: [
        { label: "आत्या आजी", code: "AATYA_AAJI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "पणजोबा", code: "PANJOBA", direction: "UP" },
        { label: "पणजी", code: "PANAAJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत आत्येभाऊ", code: "CHULAT_AATYA_BHAU", direction: "DOWN" },
        { label: "चुलत आत्येबहीण", code: "CHULAT_AATYA_BAHIN", direction: "DOWN" },
      ],
    },
  },
  MAME_AAJOBA: {
    xAxis: {
      left: [
        { label: "आजी", code: "AAJI", direction: "SAME" },
        { label: "मामे आजोबा", code: "MAME_AAJOBA", direction: "SAME" },
        { label: "मावस आजी", code: "MAV_AAJI", direction: "SAME" },
      ],
      right: [
        { label: "मामे आजी", code: "MAME_AAJI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नाना पणजी", code: "NANA_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  MAME_AJOBA: {
    xAxis: {
      left: [
        { label: "आजी", code: "AAJI", direction: "SAME" },
        { label: "मामे आजोबा", code: "MAME_AAJOBA", direction: "SAME" },
        { label: "मावस आजी", code: "MAV_AAJI", direction: "SAME" },
      ],
      right: [
        { label: "मामे आजी", code: "MAME_AAJI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नाना पणजी", code: "NANA_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  MAME_AAJI: {
    xAxis: {
      left: [
        { label: "मामे आजोबा", code: "MAME_AAJOBA", direction: "SAME" },
      ],
      right: [],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नाना पणजी", code: "NANA_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  MAV_AAJI: {
    xAxis: {
      left: [
        { label: "मावस आजोबा", code: "MAV_AAJOBA", direction: "SAME" },
      ],
      right: [
        { label: "आजी", code: "AAJI", direction: "SAME" },
        { label: "मामे आजोबा", code: "MAME_AAJOBA", direction: "SAME" },
        { label: "मावस आजी", code: "MAV_AAJI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नाना पणजी", code: "NANA_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  MAVAS_AAJI: {
    xAxis: {
      left: [
        { label: "मावस आजोबा", code: "MAV_AAJOBA", direction: "SAME" },
      ],
      right: [
        { label: "आजी", code: "AAJI", direction: "SAME" },
        { label: "मामे आजोबा", code: "MAME_AAJOBA", direction: "SAME" },
        { label: "मावस आजी", code: "MAV_AAJI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नाना पणजी", code: "NANA_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  MAV_AAJOBA: {
    xAxis: {
      left: [],
      right: [
        { label: "मावस आजी", code: "MAV_AAJI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नाना पणजी", code: "NANA_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  CHULAT_MAMA: {
    xAxis: {
      left: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "SAME" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "SAME" },
      ],
      right: [{ label: "चुलत मामी", code: "CHULAT_MAMI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "मामे आजोबा", code: "MAME_AAJOBA", direction: "UP" },
        { label: "मामे आजी", code: "MAME_AAJI", direction: "UP" },
        { label: "मामे नाना", code: "MAME_NANA", direction: "UP" },
        { label: "मामी नानी", code: "MAMI_NANI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामेभाऊ", code: "CHULAT_MAME_BHAU", direction: "DOWN" },
        { label: "चुलत मामेबहीण", code: "CHULAT_MAME_BAHIN", direction: "DOWN" },
      ],
    },
  },
  CHULAT_MAVSHI: {
    xAxis: {
      left: [{ label: "चुलत मावसा", code: "CHULAT_MAVSHA", direction: "SAME" }],
      right: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "SAME" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "मामे आजोबा", code: "MAME_AAJOBA", direction: "UP" },
        { label: "मामे आजी", code: "MAME_AAJI", direction: "UP" },
        { label: "मामे नाना", code: "MAME_NANA", direction: "UP" },
        { label: "मामी नानी", code: "MAMI_NANI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मावसभाऊ", code: "CHULAT_MAV_BHAU", direction: "DOWN" },
        { label: "चुलत मावसबहीण", code: "CHULAT_MAV_BAHIN", direction: "DOWN" },
      ],
    },
  },
  CHULAT_MAVSHA: {
    xAxis: {
      left: [{ label: "नातेवाईक", code: "NATEVAIK", direction: "SAME" }],
      right: [{ label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "SAME" }],
    },
    yAxis: {
      top: [{ label: "नातेवाईक", code: "NATEVAIK", direction: "UP" }],
      bottom: [
        { label: "चुलत मावसभाऊ", code: "CHULAT_MAV_BHAU", direction: "DOWN" },
        { label: "चुलत मावसबहीण", code: "CHULAT_MAV_BAHIN", direction: "DOWN" },
      ],
    },
  },
  CHULAT_MAMI: {
    xAxis: {
      left: [{ label: "चुलत मामा", code: "CHULAT_MAMA", direction: "SAME" }],
      right: [{ label: "नातेवाईक", code: "NATEVAIK", direction: "SAME" }],
    },
    yAxis: {
      top: [{ label: "नातेवाईक", code: "NATEVAIK", direction: "UP" }],
      bottom: [
        { label: "चुलत मामेभाऊ", code: "CHULAT_MAME_BHAU", direction: "DOWN" },
        { label: "चुलत मामेबहीण", code: "CHULAT_MAME_BAHIN", direction: "DOWN" },
      ],
    },
  },
  CHULAT_MAME_BHAU: {
    xAxis: {
      left: [
        { label: "चुलत मामेभाऊ", code: "CHULAT_MAME_BHAU", direction: "SAME" },
        { label: "चुलत मामेबहीण", code: "CHULAT_MAME_BAHIN", direction: "SAME" },
      ],
      right: [{ label: "चुलत वहिनी", code: "CHULAT_VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "UP" },
        { label: "चुलत मामी", code: "CHULAT_MAMI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  CHULAT_MAME_BAHIN: {
    xAxis: {
      left: [{ label: "चुलत दाजी", code: "CHULAT_DAJI", direction: "SAME" }],
      right: [
        { label: "चुलत मामेभाऊ", code: "CHULAT_MAME_BHAU", direction: "SAME" },
        { label: "चुलत मामेबहीण", code: "CHULAT_MAME_BAHIN", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "UP" },
        { label: "चुलत मामी", code: "CHULAT_MAMI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  CHULAT_MAV_BHAU: {
    xAxis: {
      left: [
        { label: "चुलत मावसभाऊ", code: "CHULAT_MAV_BHAU", direction: "SAME" },
        { label: "चुलत मावसबहीण", code: "CHULAT_MAV_BAHIN", direction: "SAME" },
      ],
      right: [{ label: "चुलत वहिनी", code: "CHULAT_VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "चुलत मावसा", code: "CHULAT_MAVSHA", direction: "UP" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  CHULAT_MAV_BAHIN: {
    xAxis: {
      left: [{ label: "चुलत दाजी", code: "CHULAT_DAJI", direction: "SAME" }],
      right: [
        { label: "चुलत मावसभाऊ", code: "CHULAT_MAV_BHAU", direction: "SAME" },
        { label: "चुलत मावसबहीण", code: "CHULAT_MAV_BAHIN", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "चुलत मावसा", code: "CHULAT_MAVSHA", direction: "UP" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  NANA: {
    xAxis: {
      left: [
        { label: "चुलत नाना", code: "CHULAT_NANA", direction: "SAME" },
        { label: "आत्या नानी", code: "AATYA_NANI", direction: "SAME" }
      ],
      right: [{ label: "नानी", code: "NANI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नानी पणजी", code: "NANI_PANJI", direction: "UP" },
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
      right: [
        { label: "मामे नाना", code: "MAME_NANA", direction: "SAME" },
        { label: "मावस नानी", code: "MAVAS_NANI", direction: "SAME" }
      ],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नानी पणजी", code: "NANI_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "आई (Mother)", code: "AAI", direction: "DOWN" },
        { label: "मामा (Uncle)", code: "MAMA", direction: "DOWN" },
        { label: "मावशी (Aunt)", code: "MAVSHI", direction: "DOWN" },
      ],
    },
  },
  CHULAT_NANA: {
    xAxis: {
      left: [
        { label: "चुलत नाना", code: "CHULAT_NANA", direction: "SAME" },
        { label: "आत्या नानी", code: "AATYA_NANI", direction: "SAME" },
      ],
      right: [{ label: "चुलत नानी", code: "CHULAT_NANI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नानी पणजी", code: "NANI_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  CHULAT_NANI: {
    xAxis: {
      left: [{ label: "चुलत नाना", code: "CHULAT_NANA", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नानी पणजी", code: "NANI_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  AATYA_NANI: {
    xAxis: {
      left: [
        { label: "फुआ नाना", code: "FAU_NANA", direction: "SAME" },
        { label: "फुआ नाना", code: "FUA_NANA", direction: "SAME" },
      ],
      right: [
        { label: "आत्या नानी", code: "AATYA_NANI", direction: "SAME" },
        { label: "चुलत नाना", code: "CHULAT_NANA", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नानी पणजी", code: "NANI_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  FAU_NANA: {
    xAxis: {
      left: [],
      right: [{ label: "आत्या नानी", code: "AATYA_NANI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नानी पणजी", code: "NANI_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  FUA_NANA: {
    xAxis: {
      left: [],
      right: [{ label: "आत्या नानी", code: "AATYA_NANI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नानी पणजी", code: "NANI_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  MAME_NANA: {
    xAxis: {
      left: [
        { label: "मामे नाना", code: "MAME_NANA", direction: "SAME" },
        { label: "मावस नानी", code: "MAVAS_NANI", direction: "SAME" },
      ],
      right: [{ label: "मामी नानी", code: "MAMI_NANI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नानी पणजी", code: "NANI_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  MAMI_NANI: {
    xAxis: {
      left: [{ label: "मामे नाना", code: "MAME_NANA", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नानी पणजी", code: "NANI_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  MAVAS_NANI: {
    xAxis: {
      left: [{ label: "मावसा नाना", code: "MAVSA_NANA", direction: "SAME" }],
      right: [
        { label: "मामे नाना", code: "MAME_NANA", direction: "SAME" },
        { label: "मावस नानी", code: "MAVAS_NANI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नानी पणजी", code: "NANI_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  MAVSA_NANA: {
    xAxis: {
      left: [],
      right: [{ label: "मावस नानी", code: "MAVAS_NANI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "UP" },
        { label: "नानी पणजी", code: "NANI_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत मामा", code: "CHULAT_MAMA", direction: "DOWN" },
        { label: "चुलत मावशी", code: "CHULAT_MAVSHI", direction: "DOWN" },
      ],
    },
  },
  NANA_PANJOBA: {
    xAxis: {
      left: [],
      right: [
        { label: "नानी पणजी", code: "NANI_PANJI", direction: "SAME" },
        { label: "नाना पणजी", code: "NANA_PANJI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "खापर नाना", code: "KHAPAR_NANA", direction: "UP" },
        { label: "खापर नानी", code: "KHAPAR_NANI", direction: "UP" },
      ],
      bottom: [
        { label: "नाना", code: "NANA", direction: "DOWN" },
        { label: "आजी", code: "AAJI", direction: "DOWN" },
        { label: "मामे आजोबा", code: "MAME_AAJOBA", direction: "DOWN" },
        { label: "मावस आजी", code: "MAV_AAJI", direction: "DOWN" },
        { label: "मामे नाना", code: "MAME_NANA", direction: "DOWN" },
        { label: "मावस नानी", code: "MAVAS_NANI", direction: "DOWN" },
        { label: "चुलत नाना", code: "CHULAT_NANA", direction: "DOWN" },
        { label: "आत्या नानी", code: "AATYA_NANI", direction: "DOWN" },
      ],
    },
  },
  NANI_PANJI: {
    xAxis: {
      left: [{ label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [
        { label: "खापर नाना", code: "KHAPAR_NANA", direction: "UP" },
        { label: "खापर नानी", code: "KHAPAR_NANI", direction: "UP" },
      ],
      bottom: [
        { label: "नाना", code: "NANA", direction: "DOWN" },
        { label: "आजी", code: "AAJI", direction: "DOWN" },
        { label: "मामे आजोबा", code: "MAME_AAJOBA", direction: "DOWN" },
        { label: "मावस आजी", code: "MAV_AAJI", direction: "DOWN" },
        { label: "मामे नाना", code: "MAME_NANA", direction: "DOWN" },
        { label: "मावस नानी", code: "MAVAS_NANI", direction: "DOWN" },
        { label: "चुलत नाना", code: "CHULAT_NANA", direction: "DOWN" },
        { label: "आत्या नानी", code: "AATYA_NANI", direction: "DOWN" },
      ],
    },
  },
  NANA_PANJI: {
    xAxis: {
      left: [{ label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [
        { label: "खापर नाना", code: "KHAPAR_NANA", direction: "UP" },
        { label: "खापर नानी", code: "KHAPAR_NANI", direction: "UP" },
      ],
      bottom: [
        { label: "नाना", code: "NANA", direction: "DOWN" },
        { label: "आजी", code: "AAJI", direction: "DOWN" },
        { label: "मामे आजोबा", code: "MAME_AAJOBA", direction: "DOWN" },
        { label: "मावस आजी", code: "MAV_AAJI", direction: "DOWN" },
        { label: "मामे नाना", code: "MAME_NANA", direction: "DOWN" },
        { label: "मावस नानी", code: "MAVAS_NANI", direction: "DOWN" },
        { label: "चुलत नाना", code: "CHULAT_NANA", direction: "DOWN" },
        { label: "आत्या नानी", code: "AATYA_NANI", direction: "DOWN" },
      ],
    },
  },
  KHAPAR_NANA: {
    xAxis: {
      left: [],
      right: [{ label: "खापर नानी", code: "KHAPAR_NANI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "DOWN" },
        { label: "नानी पणजी", code: "NANI_PANJI", direction: "DOWN" },
      ],
    },
  },
  KHAPAR_NANI: {
    xAxis: {
      left: [{ label: "खापर नाना", code: "KHAPAR_NANA", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "नाना पणजोबा", code: "NANA_PANJOBA", direction: "DOWN" },
        { label: "नानी पणजी", code: "NANI_PANJI", direction: "DOWN" },
      ],
    },
  },
  KAKA: {
    xAxis: {
      left: [
        {
          label: "काका",
          code: "KAKA",
          direction: "SAME",
        },
        {
          label: "आत्या",
          code: "AATYA",
          direction: "SAME",
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
      right: [
        { label: "काकीचा भाऊ", code: "KAKI_CHA_BHAU", direction: "SAME" },
        { label: "काकीची बहीण", code: "KAKI_CHI_BAHIN", direction: "SAME" }
      ],
    },
    yAxis: {
      top: [{ label: "नातेवाईक", code: "NATEVAIK", direction: "UP" }],
      bottom: [
        { label: "चुलतभाऊ", code: "CHULAT_BHAU", direction: "DOWN" },
        { label: "चुलतबहीण", code: "CHULAT_BAHIN", direction: "DOWN" },
      ],
    },
  },
  AATYA: {
    xAxis: {
      left: [],
      right: [
        {
          label: "फूफा",
          code: "FUA",
          direction: "SAME",
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
        },
        {
          label: "मावशी",
          code: "MAVSHI",
          direction: "SAME",
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
      left: [
        { label: "चुलत पणजोबा", code: "CHULAT_PANJOBA", direction: "SAME" },
        { label: "आत्या पणजी", code: "AATYA_PANJI", direction: "SAME" }
      ],
      right: [{ label: "पणजी", code: "PANAAJI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "खापर पणजोबा", code: "KHAPAR_PANJOBA", direction: "UP" },
        { label: "खापर पणजी", code: "KHAPAR_PANJI", direction: "UP" },
      ],
      bottom: [
        { label: "आजोबा", code: "AJOBA", direction: "DOWN" },
        { label: "नाना", code: "NANA", direction: "DOWN" },
      ],
    },
  },
  PANAAJI: {
    xAxis: {
      left: [{ label: "पणजोबा", code: "PANJOBA", direction: "SAME" }],
      right: [
        { label: "मामे पणजोबा", code: "MAME_PANJOBA", direction: "SAME" },
        { label: "मावस पणजी", code: "MAVAS_PANJI", direction: "SAME" }
      ],
    },
    yAxis: {
      top: [
        { label: "खापर पणजोबा", code: "KHAPAR_PANJOBA", direction: "UP" },
        { label: "खापर पणजी", code: "KHAPAR_PANJI", direction: "UP" }
      ],
      bottom: [
        { label: "आजोबा", code: "AJOBA", direction: "DOWN" },
        { label: "नाना", code: "NANA", direction: "DOWN" },
      ],
    },
  },
  KHAPAR_PANJOBA: {
    xAxis: {
      left: [
        { label: "आत्या खापर पणजी", code: "AATYA_KHAPAR_PANJI", direction: "SAME" },
        { label: "चुलत खापर पणजोबा", code: "CHULAT_KHAPAR_PANJOBA", direction: "SAME" }
      ],
      right: [{ label: "खापर पणजी", code: "KHAPAR_PANJI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "पणजोबा", code: "PANJOBA", direction: "DOWN" },
        { label: "चुलत पणजोबा", code: "CHULAT_PANJOBA", direction: "DOWN" },
        { label: "आत्या पणजी", code: "AATYA_PANJI", direction: "DOWN" }
      ],
    },
  },
  KHAPAR_PANJI: {
    xAxis: {
      left: [{ label: "खापर पणजोबा", code: "KHAPAR_PANJOBA", direction: "SAME" }],
      right: [
        { label: "मामे खापर पणजोबा", code: "MAME_KHAPAR_PANJOBA", direction: "SAME" },
        { label: "मावस खापर पणजी", code: "MAVAS_KHAPAR_PANJI", direction: "SAME" }
      ],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "पणजोबा", code: "PANJOBA", direction: "DOWN" },
        { label: "चुलत पणजोबा", code: "CHULAT_PANJOBA", direction: "DOWN" },
        { label: "आत्या पणजी", code: "AATYA_PANJI", direction: "DOWN" }
      ],
    },
  },
  CHULAT_PANJOBA: {
    xAxis: {
      left: [
        { label: "चुलत पणजोबा", code: "CHULAT_PANJOBA", direction: "SAME" },
        { label: "आत्या पणजी", code: "AATYA_PANJI", direction: "SAME" }
      ],
      right: [{ label: "चुलत पणजी", code: "CHULAT_PANJI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "खापर पणजोबा", code: "KHAPAR_PANJOBA", direction: "UP" },
        { label: "खापर पणजी", code: "KHAPAR_PANJI", direction: "UP" }
      ],
      bottom: [
        { label: "चुलत आजोबा", code: "CHULAT_AJOBA", direction: "DOWN" },
        { label: "आत्या आजी", code: "AATYA_AAJI", direction: "DOWN" }
      ],
    },
  },
  CHULAT_PANJI: {
    xAxis: {
      left: [{ label: "चुलत पणजोबा", code: "CHULAT_PANJOBA", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [
        { label: "खापर पणजोबा", code: "KHAPAR_PANJOBA", direction: "UP" },
        { label: "खापर पणजी", code: "KHAPAR_PANJI", direction: "UP" }
      ],
      bottom: [
        { label: "चुलत आजोबा", code: "CHULAT_AJOBA", direction: "DOWN" },
        { label: "आत्या आजी", code: "AATYA_AAJI", direction: "DOWN" }
      ],
    },
  },
  AATYA_PANJI: {
    xAxis: {
      left: [{ label: "फुआ पणजोबा", code: "FUA_PANJOBA", direction: "SAME" }],
      right: [
        { label: "चुलत पणजोबा", code: "CHULAT_PANJOBA", direction: "SAME" },
        { label: "आत्या पणजी", code: "AATYA_PANJI", direction: "SAME" }
      ],
    },
    yAxis: {
      top: [
        { label: "खापर पणजोबा", code: "KHAPAR_PANJOBA", direction: "UP" },
        { label: "खापर पणजी", code: "KHAPAR_PANJI", direction: "UP" }
      ],
      bottom: [
        { label: "चुलत आत्या आजोबा", code: "CHULAT_AATYA_AAJOBA", direction: "DOWN" },
        { label: "चुलत आत्या आजी", code: "CHULAT_AATYA_AAJI", direction: "DOWN" }
      ],
    },
  },
  FUA_PANJOBA: {
    xAxis: {
      left: [],
      right: [{ label: "आत्या पणजी", code: "AATYA_PANJI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "चुलत आत्या आजोबा", code: "CHULAT_AATYA_AAJOBA", direction: "DOWN" },
        { label: "चुलत आत्या आजी", code: "CHULAT_AATYA_AAJI", direction: "DOWN" }
      ],
    },
  },
  CHULAT_AATYA_AAJOBA: {
    xAxis: {
      left: [
        { label: "चुलत आत्या आजोबा", code: "CHULAT_AATYA_AAJOBA", direction: "SAME" },
        { label: "चुलत आत्या आजी", code: "CHULAT_AATYA_AAJI", direction: "SAME" }
      ],
      right: [],
    },
    yAxis: {
      top: [
        { label: "आत्या पणजी", code: "AATYA_PANJI", direction: "UP" },
        { label: "फुआ पणजोबा", code: "FUA_PANJOBA", direction: "UP" }
      ],
      bottom: [
        { label: "चुलत आत्याभाऊ", code: "CHULAT_AATYA_BHAU", direction: "DOWN" },
        { label: "चुलत आत्याबहीण", code: "CHULAT_AATYA_BAHIN", direction: "DOWN" }
      ],
    },
  },
  CHULAT_AATYA_AAJI: {
    xAxis: {
      left: [],
      right: [
        { label: "चुलत आत्या आजोबा", code: "CHULAT_AATYA_AAJOBA", direction: "SAME" },
        { label: "चुलत आत्या आजी", code: "CHULAT_AATYA_AAJI", direction: "SAME" }
      ],
    },
    yAxis: {
      top: [
        { label: "आत्या पणजी", code: "AATYA_PANJI", direction: "UP" },
        { label: "फुआ पणजोबा", code: "FUA_PANJOBA", direction: "UP" }
      ],
      bottom: [
        { label: "चुलत आत्याभाऊ", code: "CHULAT_AATYA_BHAU", direction: "DOWN" },
        { label: "चुलत आत्याबहीण", code: "CHULAT_AATYA_BAHIN", direction: "DOWN" }
      ],
    },
  },
  MAVSHI_PANJI: {
    xAxis: {
      left: [{ label: "मावसा पणजोबा", code: "MAVSA_PANJOBA", direction: "SAME" }],
      right: [
        { label: "मावशी पणजी", code: "MAVSHI_PANJI", direction: "SAME" },
        { label: "मामे पणजोबा", code: "MAME_PANJOBA", direction: "SAME" }
      ],
    },
    yAxis: {
      top: [
        { label: "खापर पणजोबा", code: "KHAPAR_PANJOBA", direction: "UP" },
        { label: "खापर पणजी", code: "KHAPAR_PANJI", direction: "UP" }
      ],
      bottom: [
        { label: "मावस आजोबा", code: "MAV_AAJOBA", direction: "DOWN" },
        { label: "मावस आजी", code: "MAV_AAJI", direction: "DOWN" }
      ],
    },
  },
  MAVAS_PANJI: {
    xAxis: {
      left: [{ label: "मावसा पणजोबा", code: "MAVSA_PANJOBA", direction: "SAME" }],
      right: [
        { label: "मावस पणजी", code: "MAVAS_PANJI", direction: "SAME" },
        { label: "मामे पणजोबा", code: "MAME_PANJOBA", direction: "SAME" }
      ],
    },
    yAxis: {
      top: [
        { label: "खापर पणजोबा", code: "KHAPAR_PANJOBA", direction: "UP" },
        { label: "खापर पणजी", code: "KHAPAR_PANJI", direction: "UP" }
      ],
      bottom: [
        { label: "मावस आजोबा", code: "MAV_AAJOBA", direction: "DOWN" },
        { label: "मावस आजी", code: "MAV_AAJI", direction: "DOWN" }
      ],
    },
  },
  MAVSA_PANJOBA: {
    xAxis: {
      left: [],
      right: [
        { label: "मावशी पणजी", code: "MAVSHI_PANJI", direction: "SAME" },
        { label: "मावस पणजी", code: "MAVAS_PANJI", direction: "SAME" }
      ],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "मावस आजोबा", code: "MAV_AAJOBA", direction: "DOWN" },
        { label: "मावस आजी", code: "MAV_AAJI", direction: "DOWN" }
      ],
    },
  },
  MAME_PANJOBA: {
    xAxis: {
      left: [
        { label: "मामे पणजोबा", code: "MAME_PANJOBA", direction: "SAME" },
        { label: "मावशी पणजी", code: "MAVSHI_PANJI", direction: "SAME" },
        { label: "मावस पणजी", code: "MAVAS_PANJI", direction: "SAME" }
      ],
      right: [{ label: "मामी पणजी", code: "MAMI_PANJI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "खापर पणजोबा", code: "KHAPAR_PANJOBA", direction: "UP" },
        { label: "खापर पणजी", code: "KHAPAR_PANJI", direction: "UP" }
      ],
      bottom: [
        { label: "मामे आजोबा", code: "MAME_AAJOBA", direction: "DOWN" },
        { label: "मामे आजी", code: "MAME_AAJI", direction: "DOWN" }
      ],
    },
  },
  MAMI_PANJI: {
    xAxis: {
      left: [{ label: "मामे पणजोबा", code: "MAME_PANJOBA", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "मामे आजोबा", code: "MAME_AAJOBA", direction: "DOWN" },
        { label: "मामे आजी", code: "MAME_AAJI", direction: "DOWN" }
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
        },
        {
          label: "नात",
          code: "NAAT",
          direction: "SAME",
        },
      ],
      right: [{ label: "नातसून", code: "NATASUN", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "मुलगा", code: "MULGA", direction: "UP" },
        { label: "सून", code: "SUN", direction: "UP" },
        { label: "जावई", code: "JAVAI", direction: "UP" },
        { label: "मुलगी", code: "MULGI", direction: "UP" },
      ],
      bottom: [

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
        },
        {
          label: "नात",
          code: "NAAT",
          direction: "SAME",
        },
      ],
    },
    yAxis: {
      top: [
        { label: "मुलगा", code: "MULGA", direction: "UP" },
        { label: "सून", code: "SUN", direction: "UP" },
        { label: "जावई", code: "JAVAI", direction: "UP" },
        { label: "मुलगी", code: "MULGI", direction: "UP" },
      ],
      bottom: [
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
        },
        {
          label: "पणती",
          code: "PANTI",
          direction: "SAME",
        },
      ],
      right: [{ label: "पणतीसून", code: "PANTISUN", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "नातू", code: "NATU", direction: "UP" },
        { label: "नातसून", code: "NATASUN", direction: "UP" },
        { label: "नातजावई", code: "NAT_JAVAI", direction: "UP" },
        { label: "नात", code: "NAAT", direction: "UP" },
      ],
      bottom: [],
    },
  },
  PANTI: {
    xAxis: {
      left: [{ label: "पणतूजावई", code: "PANTU_JAVAI", direction: "SAME" }],
      right: [
        {
          label: "पणतू",
          code: "PANTU",
          direction: "SAME",
        },
        {
          label: "पणती",
          code: "PANTI",
          direction: "SAME",
        },
      ],
    },
    yAxis: {
      top: [
        { label: "नातू", code: "NATU", direction: "UP" },
        { label: "नातसून", code: "NATASUN", direction: "UP" },
        { label: "नातजावई", code: "NAT_JAVAI", direction: "UP" },
        { label: "नात", code: "NAAT", direction: "UP" },
      ],
      bottom: [],
    },
  },
  PANTISUN: {
    xAxis: {
      left: [{ label: "पणतू", code: "PANTU", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [
        { label: "नातू", code: "NATU", direction: "UP" },
        { label: "नातसून", code: "NATASUN", direction: "UP" },
      ],
      bottom: [],
    },
  },
  PANTU_JAVAI: {
    xAxis: {
      left: [],
      right: [{ label: "पणती", code: "PANTI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "नातू", code: "NATU", direction: "UP" },
        { label: "नातसून", code: "NATASUN", direction: "UP" },
        { label: "नातजावई", code: "NAT_JAVAI", direction: "UP" },
        { label: "नात", code: "NAAT", direction: "UP" },
      ],
      bottom: [],
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
      right: [
        { label: "सुनेचा भाऊ", code: "SUN_CHA_BHAU", direction: "SAME" },
        { label: "सुनेची बहीण", code: "SUN_CHI_BAHIN", direction: "SAME" }
      ],
    },
    yAxis: {
      top: [
        { label: "व्याही", code: "VYAHI", direction: "UP" },
        { label: "विहीण", code: "VIHIN", direction: "UP" }
      ],
      bottom: [
        { label: "नातू", code: "NATU", direction: "DOWN" },
        { label: "नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  JAVAI: {
    xAxis: {
      left: [
        { label: "जावईचा भाऊ", code: "JAVAI_CHA_BHAU", direction: "SAME" },
        { label: "जावईची बहीण", code: "JAVAI_CHI_BAHIN", direction: "SAME" }
      ],
      right: [{ label: "मुलगी", code: "MULGI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "व्याही", code: "VYAHI", direction: "UP" },
        { label: "विहीण", code: "VIHIN", direction: "UP" }
      ],
      bottom: [
        { label: "नातू", code: "NATU", direction: "DOWN" },
        { label: "नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  VYAHI: {
    xAxis: {
      left: [],
      right: [{ label: "विहीण", code: "VIHIN", direction: "SAME" }],
    },
    yAxis: {
      top: [{ label: "नातेवाईक", code: "NATEVAIK", direction: "UP" }],
      bottom: [
        { label: "जावई", code: "JAVAI", direction: "DOWN" },
        { label: "मुलगी", code: "MULGI", direction: "DOWN" }
      ],
    },
  },
  VIHIN: {
    xAxis: {
      left: [{ label: "व्याही", code: "VYAHI", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [{ label: "नातेवाईक", code: "NATEVAIK", direction: "UP" }],
      bottom: [
        { label: "जावई", code: "JAVAI", direction: "DOWN" },
        { label: "मुलगी", code: "MULGI", direction: "DOWN" },
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

  MEVHANA: {
    xAxis: {
      left: [
        {
          label: "मेव्हणा",
          code: "MEVHANA",
          direction: "SAME",
        },
        {
          label: "मेव्हणी",
          code: "MEVHANI",
          direction: "SAME",
        },
      ],
      right: [{
        label: "सुनरी", code: "SUNRI", direction: "SAME"
      }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  SUNRI: {
    xAxis: {
      left: [
        { label: "मेव्हणा", code: "MEVHANA", direction: "SAME" }
      ],
      right: [
        { label: "सुनरीचा भाऊ", code: "SUNRI_CHA_BHAU", direction: "SAME" },
        { label: "सुनरीची बहीण", code: "SUNRI_CHI_BAHIN", direction: "SAME" }
      ]
    },
    yAxis: {
      top: [{ label: "नातेवाईक", code: "NATEVAIK", direction: "UP" }],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    }
  },
  MEVHANI: {
    xAxis: {
      left: [
        {
          label: "साडू", code: "SADU", direction: "SAME"
        }
      ],
      right: [
        {
          label: "मेव्हणा",
          code: "MEVHANA",
          direction: "SAME",
        },
        {
          label: "मेव्हणी",
          code: "MEVHANI",
          direction: "SAME",
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
  SADU: {
    xAxis: {
      left: [
        { label: "साडूचा भाऊ", code: "SADU_CHA_BHAU", direction: "SAME" },
        { label: "साडूची बहीण", code: "SADU_CHI_BAHIN", direction: "SAME" }
      ],
      right: [{ label: "मेव्हणी", code: "MEVHANI", direction: "SAME" }]
    },
    yAxis: {
      top: [{ label: "नातेवाईक", code: "NATEVAIK", direction: "UP" }],
      bottom: [{ label: "भाचा", code: "BHACHA", direction: "DOWN" }, { label: "भाची", code: "BHACHI", direction: "DOWN" }]
    }
  },
  CHULAT_BHAU: {
    xAxis: {
      left: [
        {
          label: "चुलतभाऊ",
          code: "CHULAT_BHAU",
          direction: "SAME",
        },
        {
          label: "चुलतबहीण",
          code: "CHULAT_BAHIN",
          direction: "SAME",
        },
      ],
      right: [{ label: "चुलत वहिनी", code: "CHULAT_VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "काका", code: "KAKA", direction: "UP" },
        { label: "काकी", code: "KAKI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत पुतण्या", code: "CHULAT_PUTANYA", direction: "DOWN" },
        { label: "चुलत पुतणी", code: "CHULAT_PUTANI", direction: "DOWN" },
      ],
    },
  },
  CHULAT_BAHIN: {
    xAxis: {
      left: [{ label: "चुलत दाजी", code: "CHULAT_DAJI", direction: "SAME" }],
      right: [
        {
          label: "चुलतभाऊ",
          code: "CHULAT_BHAU",
          direction: "SAME",
        },
        {
          label: "चुलतबहीण",
          code: "CHULAT_BAHIN",
          direction: "SAME",
        },
      ],
    },
    yAxis: {
      top: [
        { label: "काका", code: "KAKA", direction: "UP" },
        { label: "काकी", code: "KAKI", direction: "UP" },
      ],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  CHULAT_AATYA_BHAU: {
    xAxis: {
      left: [
        { label: "चुलत आत्येभाऊ", code: "CHULAT_AATYA_BHAU", direction: "SAME" },
        { label: "चुलत आत्येबहीण", code: "CHULAT_AATYA_BAHIN", direction: "SAME" },
      ],
      right: [
        { label: "चुलत वहिनी", code: "CHULAT_VAHINI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "आत्या आजी", code: "AATYA_AAJI", direction: "UP" },
        { label: "फुआ आजोबा", code: "FUA_AJOBA", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  CHULAT_AATYA_BAHIN: {
    xAxis: {
      left: [
        { label: "चुलत दाजी", code: "CHULAT_DAJI", direction: "SAME" },
      ],
      right: [
        { label: "चुलत आत्येभाऊ", code: "CHULAT_AATYA_BHAU", direction: "SAME" },
        { label: "चुलत आत्येबहीण", code: "CHULAT_AATYA_BAHIN", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "आत्या आजी", code: "AATYA_AAJI", direction: "UP" },
        { label: "फुआ आजोबा", code: "FUA_AJOBA", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
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
        },
        {
          label: "आत्येबहीण",
          code: "ATYE_BAHIN",
          direction: "SAME",
        },
      ],
      right: [{ label: "वहिनी", code: "VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
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
        },
        {
          label: "आत्येबहीण",
          code: "ATYE_BAHIN",
          direction: "SAME",
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
        },
        {
          label: "मावसबहीण",
          code: "MAV_BAHIN",
          direction: "SAME",
        },
      ],
      right: [{ label: "मावस वहिनी", code: "MAV_VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "मावसा", code: "MAVSA", direction: "UP" },
        { label: "मावशी", code: "MAVSHI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  MAV_BAHIN: {
    xAxis: {
      left: [{ label: "मावस दाजी", code: "MAV_DAJI", direction: "SAME" }],
      right: [
        {
          label: "मावसभाऊ",
          code: "MAV_BHAU",
          direction: "SAME",
        },
        {
          label: "मावसबहीण",
          code: "MAV_BAHIN",
          direction: "SAME",
        },
      ],
    },
    yAxis: {
      top: [
        { label: "मावसा", code: "MAVSA", direction: "UP" },
        { label: "मावशी", code: "MAVSHI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  MAMI_BHAU: {
    xAxis: {
      left: [
        {
          label: "मामेभाऊ",
          code: "MAMI_BHAU",
          direction: "SAME",
        },
        {
          label: "मामेबहीण",
          code: "MAMI_BAHIN",
          direction: "SAME",
        },
      ],
      right: [{ label: "मामे वहिनी", code: "MAMI_VAHINI", direction: "SAME" }],
    },
    yAxis: {
      top: [
        { label: "मामा", code: "MAMA", direction: "UP" },
        { label: "मामी", code: "MAMI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  MAMI_BAHIN: {
    xAxis: {
      left: [{ label: "मामे दाजी", code: "MAMI_DAJI", direction: "SAME" }],
      right: [
        {
          label: "मामेभाऊ",
          code: "MAMI_BHAU",
          direction: "SAME",
        },
        {
          label: "मामेबहीण",
          code: "MAMI_BAHIN",
          direction: "SAME",
        },
      ],
    },
    yAxis: {
      top: [
        { label: "मामा", code: "MAMA", direction: "UP" },
        { label: "मामी", code: "MAMI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  CHULAT_VAHINI: {
    xAxis: {
      left: [
        { label: "चुलतभाऊ", code: "CHULAT_BHAU", direction: "SAME" },
        { label: "चुलत आत्येभाऊ", code: "CHULAT_AATYA_BHAU", direction: "SAME" }
      ],
      right: [],
    },
    yAxis: {
      top: [
        { label: "काका", code: "KAKA", direction: "UP" },
        { label: "काकी", code: "KAKI", direction: "UP" },
        { label: "आत्या आजी", code: "AATYA_AAJI", direction: "UP" },
        { label: "फुआ आजोबा", code: "FUA_AJOBA", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत पुतण्या", code: "CHULAT_PUTANYA", direction: "DOWN" },
        { label: "चुलत पुतणी", code: "CHULAT_PUTANI", direction: "DOWN" },
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  CHULAT_DAJI: {
    xAxis: {
      left: [],
      right: [
        { label: "चुलतबहीण", code: "CHULAT_BAHIN", direction: "SAME" },
        { label: "चुलत आत्येबहीण", code: "CHULAT_AATYA_BAHIN", direction: "SAME" }
      ],
    },
    yAxis: {
      top: [
        { label: "काका", code: "KAKA", direction: "UP" },
        { label: "काकी", code: "KAKI", direction: "UP" },
        { label: "आत्या आजी", code: "AATYA_AAJI", direction: "UP" },
        { label: "फुआ आजोबा", code: "FUA_AJOBA", direction: "UP" },
      ],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  MAV_VAHINI: {
    xAxis: {
      left: [{ label: "मावसभाऊ", code: "MAV_BHAU", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [
        { label: "मावसा", code: "MAVSA", direction: "UP" },
        { label: "मावशी", code: "MAVSHI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  MAV_DAJI: {
    xAxis: {
      left: [],
      right: [{ label: "मावसबहीण", code: "MAV_BAHIN", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  MAMI_VAHINI: {
    xAxis: {
      left: [{ label: "मामेभाऊ", code: "MAMI_BHAU", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [
        { label: "मामा", code: "MAMA", direction: "UP" },
        { label: "मामी", code: "MAMI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  MAMI_DAJI: {
    xAxis: {
      left: [],
      right: [{ label: "मामेबहीण", code: "MAMI_BAHIN", direction: "SAME" }],
    },
    yAxis: {
      top: [],
      bottom: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "DOWN" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "DOWN" },
      ],
    },
  },
  NANAND: {
    xAxis: {
      left: [{ label: "नणंदोई", code: "NANANDOI", direction: "SAME" }],
      right: [],
    },
    yAxis: {
      top: [
        { label: "सासू", code: "SASU", direction: "UP" },
        { label: "सासरा", code: "SASRA", direction: "UP" },
      ],
      bottom: [
        { label: "भाचा", code: "BHACHA", direction: "DOWN" },
        { label: "भाची", code: "BHACHI", direction: "DOWN" },
      ],
    },
  },
  NANANDOI: {
    xAxis: {
      left: [{ label: "नणंद", code: "NANAND", direction: "SAME" }],
      right: [
        { label: "नणंदोईचा भाऊ", code: "NANANDOI_CHA_BHAU", direction: "SAME" },
        { label: "नणंदोईची बहीण", code: "NANANDOI_CHI_BAHIN", direction: "SAME" },
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
  PUTANYA: {
    xAxis: {
      left: [
        { label: "पुतण्या", code: "PUTANYA", direction: "SAME" },
        { label: "पुतणी", code: "PUTANI", direction: "SAME" },
      ],
      right: [
        { label: "चुलत सून", code: "CHULAT_SUN", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "भाऊ", code: "BHAU", direction: "UP" },
        { label: "वहिनी", code: "VAHINI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत नातू", code: "NATU", direction: "DOWN" },
        { label: "चुलत नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  CHULAT_PUTANYA: {
    xAxis: {
      left: [
        { label: "चुलत पुतण्या", code: "CHULAT_PUTANYA", direction: "SAME" },
        { label: "चुलत पुतणी", code: "CHULAT_PUTANI", direction: "SAME" },
      ],
      right: [
        { label: "चुलत सून", code: "CHULAT_SUN", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "चुलतभाऊ", code: "CHULAT_BHAU", direction: "UP" },
        { label: "चुलत वहिनी", code: "VAHINI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत नातू", code: "NATU", direction: "DOWN" },
        { label: "चुलत नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  CHULAT_PUTANI: {
    xAxis: {
      left: [
        { label: "जावई", code: "JAVAI", direction: "SAME" },
      ],
      right: [
        { label: "चुलत पुतण्या", code: "CHULAT_PUTANYA", direction: "SAME" },
        { label: "चुलत पुतणी", code: "CHULAT_PUTANI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "चुलतभाऊ", code: "CHULAT_BHAU", direction: "UP" },
        { label: "चुलत वहिनी", code: "VAHINI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत नातू", code: "NATU", direction: "DOWN" },
        { label: "चुलत नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  PUTANI: {
    xAxis: {
      left: [
        { label: "जावई", code: "JAVAI", direction: "SAME" },
      ],
      right: [
        { label: "पुतण्या", code: "PUTANYA", direction: "SAME" },
        { label: "पुतणी", code: "PUTANI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "भाऊ", code: "BHAU", direction: "UP" },
        { label: "वहिनी", code: "VAHINI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत नातू", code: "NATU", direction: "DOWN" },
        { label: "चुलत नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  CHULAT_SUN: {
    xAxis: {
      left: [
        { label: "पुतण्या", code: "PUTANYA", direction: "SAME" },
        { label: "चुलत पुतण्या", code: "CHULAT_PUTANYA", direction: "SAME" },
      ],
      right: [],
    },
    yAxis: {
      top: [
        { label: "भाऊ", code: "BHAU", direction: "UP" },
        { label: "वहिनी", code: "VAHINI", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत नातू", code: "NATU", direction: "DOWN" },
        { label: "चुलत नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  BHACHA: {
    xAxis: {
      left: [
        { label: "भाचा", code: "BHACHA", direction: "SAME" },
        { label: "भाची", code: "BHACHI", direction: "SAME" },
      ],
      right: [
        { label: "भाची सून", code: "BHACHI_SUN", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "दाजी", code: "DAJI", direction: "UP" },
        { label: "बहीण", code: "BAHIN", direction: "UP" },
      ],
      bottom: [
        { label: "नातू", code: "NATU", direction: "DOWN" },
        { label: "नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  BHACHI: {
    xAxis: {
      left: [
        { label: "भाची जावई", code: "JAVAIBHACHA", direction: "SAME" },
      ],
      right: [
        { label: "भाचा", code: "BHACHA", direction: "SAME" },
        { label: "भाची", code: "BHACHI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "दाजी", code: "DAJI", direction: "UP" },
        { label: "बहीण", code: "BAHIN", direction: "UP" },
      ],
      bottom: [
        { label: "नातू", code: "NATU", direction: "DOWN" },
        { label: "नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  CHULAT_BHACHA: {
    xAxis: {
      left: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "SAME" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "SAME" },
      ],
      right: [
        { label: "चुलत भाची सून", code: "BHACHI_SUN", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "मामेभाऊ", code: "MAMI_BHAU", direction: "UP" },
        { label: "मामे वहिनी", code: "MAMI_VAHINI", direction: "UP" },
        { label: "मामे दाजी", code: "MAMI_DAJI", direction: "UP" },
        { label: "मामेबहीण", code: "MAMI_BAHIN", direction: "UP" },
        { label: "मावसभाऊ", code: "MAV_BHAU", direction: "UP" },
        { label: "मावस वहिनी", code: "MAV_VAHINI", direction: "UP" },
        { label: "मावस दाजी", code: "MAV_DAJI", direction: "UP" },
        { label: "मावसबहीण", code: "MAV_BAHIN", direction: "UP" },
        { label: "चुलत आत्येभाऊ", code: "CHULAT_AATYA_BHAU", direction: "UP" },
        { label: "चुलत वहिनी", code: "CHULAT_VAHINI", direction: "UP" },
        { label: "चुलत दाजी", code: "CHULAT_DAJI", direction: "UP" },
        { label: "चुलत आत्येबहीण", code: "CHULAT_AATYA_BAHIN", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत नातू", code: "NATU", direction: "DOWN" },
        { label: "चुलत नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  CHULAT_BHACHI: {
    xAxis: {
      left: [
        { label: "चुलत भाची जावई", code: "JAVAIBHACHA", direction: "SAME" },
      ],
      right: [
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "SAME" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "मामेभाऊ", code: "MAMI_BHAU", direction: "UP" },
        { label: "मामे वहिनी", code: "MAMI_VAHINI", direction: "UP" },
        { label: "मामे दाजी", code: "MAMI_DAJI", direction: "UP" },
        { label: "मामेबहीण", code: "MAMI_BAHIN", direction: "UP" },
        { label: "मावसभाऊ", code: "MAV_BHAU", direction: "UP" },
        { label: "मावस वहिनी", code: "MAV_VAHINI", direction: "UP" },
        { label: "मावस दाजी", code: "MAV_DAJI", direction: "UP" },
        { label: "मावसबहीण", code: "MAV_BAHIN", direction: "UP" },
        { label: "चुलत आत्येभाऊ", code: "CHULAT_AATYA_BHAU", direction: "UP" },
        { label: "चुलत वहिनी", code: "CHULAT_VAHINI", direction: "UP" },
        { label: "चुलत दाजी", code: "CHULAT_DAJI", direction: "UP" },
        { label: "चुलत आत्येबहीण", code: "CHULAT_AATYA_BAHIN", direction: "UP" },
      ],
      bottom: [
        { label: "चुलत नातू", code: "NATU", direction: "DOWN" },
        { label: "चुलत नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  BHACHI_SUN: {
    xAxis: {
      left: [
        { label: "भाचा", code: "BHACHA", direction: "SAME" },
        { label: "चुलत भाचा", code: "CHULAT_BHACHA", direction: "SAME" },
      ],
      right: [],
    },
    yAxis: {
      top: [
        { label: "दाजी", code: "DAJI", direction: "UP" },
        { label: "बहीण", code: "BAHIN", direction: "UP" },
      ],
      bottom: [
        { label: "नातू", code: "NATU", direction: "DOWN" },
        { label: "नात", code: "NAAT", direction: "DOWN" },
      ],
    },
  },
  JAVAIBHACHA: {
    xAxis: {
      left: [],
      right: [
        { label: "भाची", code: "BHACHI", direction: "SAME" },
        { label: "चुलत भाची", code: "CHULAT_BHACHI", direction: "SAME" },
      ],
    },
    yAxis: {
      top: [
        { label: "दाजी", code: "DAJI", direction: "UP" },
        { label: "बहीण", code: "BAHIN", direction: "UP" },
      ],
      bottom: [
        { label: "नातू", code: "NATU", direction: "DOWN" },
        { label: "नात", code: "NAAT", direction: "DOWN" },
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
  NATEVAIK: {
    xAxis: {
      left: [{ label: "नातेवाईक (Relative)", code: "NATEVAIK", direction: "SAME" }],
      right: [{ label: "नातेवाईक (Relative)", code: "NATEVAIK", direction: "SAME" }],
    },
    yAxis: {
      top: [{ label: "नातेवाईक (Relative)", code: "NATEVAIK", direction: "UP" }],
      bottom: [{ label: "नातेवाईक (Relative)", code: "NATEVAIK", direction: "DOWN" }],
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
  ["BHACHA", "BHACHI_SUN"],
  ["JAVAIBHACHA", "BHACHI"],
  ["CHULAT_BHACHA", "BHACHI_SUN"],
  ["JAVAIBHACHA", "CHULAT_BHACHI"],
  ["NAVRA", "BAYKO"],
  ["BHAU", "VAHINI"],
  ["DAJI", "BAHIN"],
  ["FUA", "AATYA"],
  ["MULGA", "SUN"],
  ["JAVAI", "MULGI"],
  ["NATU", "NATASUN"],
  ["NAT_JAVAI", "NAAT"],
  ["PANTU", "PANTISUN"],
  ["PANTU_JAVAI", "PANTI"],
  ["DIR_CHOTE", "VAHINI"],
  ["DIR_MOTHE", "VAHINI"],
  ["SADU", "MEVHANI"],
  ["NANANDOI", "NANAND"],
  ["AJI_SASRA", "AJI_SASU"],
  ["AJOBA_SASRA", "AJOBA_SASU"],
  ["MAMA_SASRA", "MAMI_SASU"],
  ["PANJOBA_SASRA", "PANAJI_SASU"],
  ["CHULAT_BHAU", "CHULAT_VAHINI"],
  ["CHULAT_DAJI", "CHULAT_BAHIN"],
  ["ATYE_BHAU", "VAHINI"],
  ["DAJI", "ATYE_BAHIN"],
  ["MAV_BHAU", "MAV_VAHINI"],
  ["MAV_DAJI", "MAV_BAHIN"],
  ["MAMI_BHAU", "MAMI_VAHINI"],
  ["MAMI_DAJI", "MAMI_BAHIN"],
  ["VYAHI", "VIHIN"],
  ["KHAPAR_PANJOBA", "KHAPAR_PANJI"],
  ["CHULAT_NANA", "CHULAT_NANI"],
  ["FUA_NANA", "AATYA_NANI"],
  ["FUA_AJOBA", "AATYA_AAJI"],
  ["FAU_AJOBA", "AATYA_AAJI"],
  ["CHULAT_AJOBA", "CHULAT_AAJI"],
  ["CHULAT_AATYA_BHAU", "CHULAT_VAHINI"],
  ["CHULAT_DAJI", "CHULAT_AATYA_BAHIN"],
  ["CHULAT_MEVHANA", "CHULAT_MEVHANI"],
  ["CHULTA_DIR", "CHULAT_BHAUJAI"],
  ["MEVHANA", "SUNRI"],
  ["MAME_AAJOBA", "MAME_AAJI"],
  ["MAME_AJOBA", "MAME_AAJI"],
  ["MAV_AAJOBA", "MAV_AAJI"],
  ["MAV_AAJOBA", "MAVAS_AAJI"],
  ["NANA_PANJOBA", "NANI_PANJI"],
  ["NANA_PANJOBA", "NANA_PANJI"],
  ["CHULAT_MAMA", "CHULAT_MAMI"],
  ["CHULAT_MAVSHA", "CHULAT_MAVSHI"],
  ["CHULAT_MAME_BHAU", "CHULAT_VAHINI"],
  ["CHULAT_DAJI", "CHULAT_MAME_BAHIN"],
  ["CHULAT_MAV_BHAU", "CHULAT_VAHINI"],
  ["CHULAT_DAJI", "CHULAT_MAV_BAHIN"],
  ["MAME_NANA", "MAMI_NANI"],
  ["MAME_NANA", "MAME_NANI"],
  ["MAMI_NANA", "MAMI_NANI"],
  ["MAVSA_NANA", "MAVAS_NANI"],
  ["FAU_NANA", "AATYA_NANI"],
  ["KHAPAR_NANA", "KHAPAR_NANI"],
  ["CHULAT_PANJOBA", "CHULAT_PANJI"],
  ["FUA_PANJOBA", "AATYA_PANJI"],
  ["MAME_PANJOBA", "MAMI_PANJI"],
  ["MAVSA_PANJOBA", "MAVSHI_PANJI"],
  ["MAVSA_PANJOBA", "MAVAS_PANJI"],
];

export const COUSIN_CODES = [
  "MAMI_BHAU",
  "MAMI_BAHIN",
  "MAV_BHAU",
  "MAV_BAHIN",
  "CHULAT_BHAU",
  "CHULAT_BAHIN",
  "CHULAT_AATYA_BHAU",
  "CHULAT_AATYA_BAHIN",
  "CHULAT_MAME_BHAU",
  "CHULAT_MAME_BAHIN",
  "CHULAT_MAV_BHAU",
  "CHULAT_MAV_BAHIN",
  "ATYE_BHAU",
  "ATYE_BAHIN",
];

export const COUSIN_PARENT_MAP: Record<string, string[]> = {
  MAMI_BHAU: ["MAMA", "MAMI", "CHULAT_MAMA"],
  MAMI_BAHIN: ["MAMA", "MAMI", "CHULAT_MAMA"],
  MAV_BHAU: ["MAVSA", "MAVSHI", "CHULAT_MAVSHI"],
  MAV_BAHIN: ["MAVSA", "MAVSHI", "CHULAT_MAVSHI"],
  CHULAT_MAME_BHAU: ["CHULAT_MAMA", "CHULAT_MAMI"],
  CHULAT_MAME_BAHIN: ["CHULAT_MAMA", "CHULAT_MAMI"],
  CHULAT_MAV_BHAU: ["CHULAT_MAVSHA", "CHULAT_MAVSHI"],
  CHULAT_MAV_BAHIN: ["CHULAT_MAVSHA", "CHULAT_MAVSHI"],
  CHULAT_BHAU: [
    "KAKA",
    "KAKI",
    "CHULAT_AJOBA",
    "CHULAT_AAJI",
  ],
  CHULAT_BAHIN: [
    "KAKA",
    "KAKI",
    "CHULAT_AJOBA",
    "CHULAT_AAJI",
  ],
  CHULAT_AATYA_BHAU: ["AATYA_AAJI", "FUA_AJOBA", "FAU_AJOBA", "CHULAT_AATYA_AAJOBA", "CHULAT_AATYA_AAJI"],
  CHULAT_AATYA_BAHIN: ["AATYA_AAJI", "FUA_AJOBA", "FAU_AJOBA", "CHULAT_AATYA_AAJOBA", "CHULAT_AATYA_AAJI"],
  ATYE_BHAU: ["AATYA", "FUA"],
  ATYE_BAHIN: ["AATYA", "FUA"],
};

/**
 * Canonical generational level for each relation code relative to ROOT (ROOT = 0).
 * Positive = above root (ancestors/parents), Negative = below root (descendants/children).
 *
 * Level 0 (ROOT row): ROOT + BAYKO/NAVRA only.
 * Level 1 (sibling row): BHAU, BAHIN, cousins, in-law siblings.
 * Level 2 (parent row): VADIL, AAI, KAKA, MAMA, SASRA, SASU, etc.
 * Level 3+: grandparents and above.
 */
export const RELATION_LEVEL_MAP: Record<string, number> = {
  PPP_AJOBA: 6, PPP_AAJI: 6,
  PP_AJOBA: 5, PP_AAJI: 5, KHAPAR_PANJOBA: 5, KHAPAR_PANJI: 5,
  KHAPAR_NANA: 5, KHAPAR_NANI: 5,
  AATYA_KHAPAR_PANJI: 5, CHULAT_KHAPAR_PANJOBA: 5, MAME_KHAPAR_PANJOBA: 5, MAVAS_KHAPAR_PANJI: 5,
  PANJOBA: 4, PANAAJI: 4, PANAJI_SASU: 4, PANJOBA_SASRA: 4,
  NANA_PANJOBA: 4, NANI_PANJI: 4, NANA_PANJI: 4, CHULAT_PANJOBA: 4, CHULAT_PANJI: 4, AATYA_PANJI: 4, FUA_PANJOBA: 4, MAME_PANJOBA: 4, MAMI_PANJI: 4, MAVSHI_PANJI: 4, MAVAS_PANJI: 4, MAVSA_PANJOBA: 4,
  AJOBA: 3, AAJI: 3, NANA: 3, NANI: 3,
  CHULAT_AATYA_AAJOBA: 3, CHULAT_AATYA_AAJI: 3,
  CHULAT_NANA: 3, CHULAT_NANI: 3, AATYA_NANI: 3, FUA_NANA: 3, FAU_NANA: 3, MAVSA_NANA: 3,
  AATYA_AAJI: 3, FUA_AJOBA: 3, FAU_AJOBA: 3, CHULAT_AJOBA: 3, CHULAT_AAJI: 3,
  MAMI_AJOBA: 3, MAME_AJOBA: 3, MAME_AAJOBA: 3, MAME_AAJI: 3, MAVAS_AAJI: 3, MAV_AAJI: 3, MAV_AAJOBA: 3,
  MAMI_NANA: 3, MAME_NANA: 3, MAMI_NANI: 3, MAME_NANI: 3, MAVAS_NANI: 3,
  AJI_SASRA: 3, AJI_SASU: 3, AJOBA_SASRA: 3, AJOBA_SASU: 3,
  VADIL: 2, AAI: 2, SAVATR_VADIL: 2, SAVATR_AAI: 2,
  KAKA: 2, KAKI: 2, MAMA: 2, MAMI: 2, AATYA: 2, FUA: 2,
  MAVSHI: 2, MAVSA: 2, CHULTA: 2, CHULTI: 2,
  CHULAT_MAMA: 2, CHULAT_MAMI: 2, CHULAT_MAVSHA: 2, CHULAT_MAVSHI: 2, VYAHI: 2, VIHIN: 2,
  SASRA: 2, SASU: 2, MAMA_SASRA: 2, MAMI_SASU: 2, MAMI_SASRA: 2,
  CHULAT_SASRA: 2, ATYA_SASU: 2, MAVAS_SASU: 2,
  BHAU: 1, BAHIN: 1, VAHINI: 1, DAJI: 1,
  MEVHANA: 1, MEVHANI: 1, SADU: 1, DIR_CHOTE: 1, DIR_MOTHE: 1,
  NANAND: 1, NANANDOI: 1, CHULAT_BHAU: 1, CHULAT_BAHIN: 1,
  CHULAT_AATYA_BHAU: 1, CHULAT_AATYA_BAHIN: 1,
  CHULAT_MAME_BHAU: 1, CHULAT_MAME_BAHIN: 1,
  CHULAT_MAV_BHAU: 1, CHULAT_MAV_BAHIN: 1,
  CHULAT_DAJI: 1, CHULAT_VAHINI: 1,
  ATYE_BHAU: 1, ATYE_BAHIN: 1, MAV_BHAU: 1, MAV_BAHIN: 1,
  MAV_DAJI: 1, MAV_VAHINI: 1,
  MAMI_BHAU: 1, MAMI_BAHIN: 1, MAMI_DAJI: 1, MAMI_VAHINI: 1,
  CHULTA_DIR: 1, CHULTA_NANAND: 1, CHULAT_DIR: 1, CHULAT_NANAND: 1,
  BHAUJAI: 1, CHULAT_MEVHANA: 1, CHULAT_MEVHANI: 1, CHULAT_BHAUJAI: 1, SUNRI: 1,
  DAJI_CHA_BHAU: 1, DAJI_CHI_BAHIN: 1, MAMI_CHA_BHAU: 1, MAMI_CHI_BAHIN: 1,
  KAKI_CHA_BHAU: 1, KAKI_CHI_BAHIN: 1, MAVSA_CHA_BHAU: 1, MAVSA_CHI_BAHIN: 1,
  FUA_CHA_BHAU: 1, FUA_CHI_BAHIN: 1, SUNRI_CHA_BHAU: 1, SUNRI_CHI_BAHIN: 1,
  SADU_CHA_BHAU: 1, SADU_CHI_BAHIN: 1, NANANDOI_CHA_BHAU: 1, NANANDOI_CHI_BAHIN: 1,
  SAVATR_BHAU: 1, SAVATR_BAHIN: 1,
  MITRA: 1, MAITRIN: 1, NATEVAIK: 0,
  NAVRA: 0, BAYKO: 0,
  MULGA: -1, MULGI: -1, SAVATR_MULGA: -1, SAVATR_MULGI: -1,
  SUN: -1, JAVAI: -1, PUTANYA: -1, PUTANI: -1, BHACHA: -1, BHACHI: -1,
  BHACHI_SUN: -1, JAVAIBHACHA: -1,
  CHULAT_PUTANYA: -1, CHULAT_PUTANI: -1, CHULAT_SUN: -1,
  CHULAT_BHACHA: -1, CHULAT_BHACHI: -1,
  SUN_CHA_BHAU: -1, SUN_CHI_BAHIN: -1, JAVAI_CHA_BHAU: -1, JAVAI_CHI_BAHIN: -1,
  NATU: -2, NAAT: -2, NATASUN: -2, NAT_JAVAI: -2,
  PANTU: -3, PANTI: -3, PANTISUN: -3, PANTU_JAVAI: -3,
  PP_NATU: -4, PP_NAAT: -4,
  PPP_NATU: -5, PPP_NAAT: -5,
};

/**
 * Canonical horizontal ordering weight for each relation code.
 * Used by the frontend layout engine to position nodes left/right within a row.
 *
 * Convention (within each generational row):
 *   - VADIL's side (paternal): negative values -> LEFT of center
 *   - AAI's side (maternal): positive values -> RIGHT of center
 *   - ROOT itself = 0
 *   - Couples: husband gets value N, wife gets N+1
 */
export const RELATION_X_ORDER: Record<string, number> = {
  // Gen 0 (root row) - SELF + SPOUSE (Husband/Male on Left, Wife/Female on Right)
  NAVRA: -10, BAYKO: 10,

  // Gen +1 (sibling row) - Root blood family (Negative = Left of Center)
  // Tier 1: Direct siblings & their spouses (Husband/Male on Left, Wife/Female on Right)
  BHAU: -10, VAHINI: -9, DAJI_CHA_BHAU: -7.5, DAJI_CHI_BAHIN: -7, DAJI: -6, BAHIN: -5,
  SAVATR_BHAU: -12, SAVATR_BAHIN: -8,

  // Tier 2: Paternal cousins (Male on Left, Female on Right)
  CHULAT_BHAU: -30, CHULAT_VAHINI: -29, CHULAT_DAJI: -26, CHULAT_BAHIN: -25,
  CHULAT_AATYA_BHAU: -38, CHULAT_AATYA_BAHIN: -36,
  ATYE_BHAU: -35, ATYE_BAHIN: -32,

  // Tier 3: Maternal cousins (Male on Left, Female on Right)
  MAMI_BHAU: -50, MAMI_VAHINI: -49, MAMI_DAJI: -46, MAMI_BAHIN: -45,
  CHULAT_MAME_BHAU: -48, CHULAT_MAME_BAHIN: -47,
  MAV_BHAU: -55, MAV_VAHINI: -54, MAV_DAJI: -53, MAV_BAHIN: -52,
  CHULAT_MAV_BHAU: -54, CHULAT_MAV_BAHIN: -53,

  // Gen +1 (sibling row) - Spouse family (Positive = Right of Center)
  // Tier 1: Spouse direct siblings & spouses (Male on Left, Female on Right)
  DIR_MOTHE: 10, DIR_CHOTE: 15, NANANDOI: 20, NANAND: 21, MEVHANA: 25, MEVHANI: 26,
  // Tier 2: Spouse cousins & Sadu (Outward to the right)
  SADU: 40, CHULTA_DIR: 45, CHULTA_NANAND: 50,

  // Tier 4: Friends (Furthest outer flanks)
  MITRA: -90, MAITRIN: 90,

  // Generic Relative (NATEVAIK) — no fixed position; visualSide drives placement
  NATEVAIK: 0,

  // Gen +2 (parent row) - LEFT = VADIL's side, RIGHT = AAI's side (Male on Left, Female on Right)
  VADIL: -10, AAI: 10, SAVATR_VADIL: -15, SAVATR_AAI: 15,
  KAKA: -30, KAKI: -25, FUA: -40, AATYA: -35, CHULTA: -45, CHULTI: -42,
  CHULAT_MAMA: 32, CHULAT_MAMI: 33,
  MAMA: 30, MAMI: 35, MAVSA: 40, MAVSHI: 45,
  CHULAT_MAVSHA: 42, CHULAT_MAVSHI: 43,
  SASRA: 60, SASU: 65, MAMA_SASRA: 75, MAMI_SASU: 80,
  CHULAT_SASRA: 85, ATYA_SASU: 90, MAVAS_SASU: 95,
  VYAHI: 100, VIHIN: 101,

  // Gen +3 (grandparent row) - Male on Left, Female on Right
  CHULAT_AATYA_AAJOBA: -66, CHULAT_AATYA_AAJI: -64,
  CHULAT_AJOBA: -60, CHULAT_AAJI: -58, FUA_AJOBA: -56, FAU_AJOBA: -56, AATYA_AAJI: -55,
  AJOBA: -50, AAJI: -40,
  MAME_AJOBA: -35, MAME_AAJOBA: -35, MAME_AAJI: -34,
  MAV_AAJOBA: -31, MAVAS_AAJI: -30, MAV_AAJI: -30,
  CHULAT_NANA: 30, CHULAT_NANI: 32, FAU_NANA: 34, FUA_NANA: 34, AATYA_NANI: 35,
  NANA: 40, NANI: 50,
  MAME_NANA: 55, MAMI_NANI: 56, MAME_NANI: 56, MAVSA_NANA: 59, MAVAS_NANI: 60,
  AJOBA_SASRA: 80, AJOBA_SASU: 90, AJI_SASRA: 100, AJI_SASU: 110,

  // Gen +4 (great-grandparent row)
  FUA_PANJOBA: -72, AATYA_PANJI: -70,
  CHULAT_PANJOBA: -65, CHULAT_PANJI: -60,
  PANJOBA: -50, PANAAJI: -40,
  MAME_PANJOBA: -35, MAMI_PANJI: -34, MAVSA_PANJOBA: -31, MAVSHI_PANJI: -30, MAVAS_PANJI: -30,
  NANA_PANJOBA: 40, NANI_PANJI: 50, NANA_PANJI: 50,
  PANJOBA_SASRA: 80, PANAJI_SASU: 90,

  // Gen +5 (great-great-grandparent row)
  CHULAT_KHAPAR_PANJOBA: -65, AATYA_KHAPAR_PANJI: -60,
  KHAPAR_PANJOBA: -50, KHAPAR_PANJI: -40,
  MAME_KHAPAR_PANJOBA: -35, MAVAS_KHAPAR_PANJI: -30,
  KHAPAR_NANA: 40, KHAPAR_NANI: 50,

  // Gen -1 (children row)
  SAVATR_MULGA: -30, MULGA: -20, SUN: -10, SUN_CHA_BHAU: -8, SUN_CHI_BAHIN: -7,
  JAVAI_CHA_BHAU: 6, JAVAI_CHI_BAHIN: 8, JAVAI: 10, MULGI: 20, SAVATR_MULGI: 30,
  PUTANYA: -40, PUTANI: -35, CHULAT_PUTANYA: -45, CHULAT_PUTANI: -42,
  BHACHA: 35, BHACHI_SUN: 36, BHACHI: 40, JAVAIBHACHA: 34,
  CHULAT_BHACHA: 45, CHULAT_BHACHI: 48,

  // Gen -2 (grandchildren row)
  NATU: -20, NATASUN: -10, NAT_JAVAI: 10, NAAT: 20,

  // Gen -3
  PANTU: -20, PANTISUN: -10, PANTU_JAVAI: 10, PANTI: 20,
};