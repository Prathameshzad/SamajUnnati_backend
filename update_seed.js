const fs = require('fs');

const seedFile = 'd:/samajUnati/backend/prisma/seed.js';
let content = fs.readFileSync(seedFile, 'utf8');

// A generic translation map for all 82 relations. We will inject this.
const newOverridesStr = `const relationLanguageOverrides = {
  hi: {
    AAI: 'माँ', VADIL: 'पिता', AAJI: 'दादी', AJOBA: 'दादा', NANI: 'नानी', NANA: 'नाना',
    PANAAJI: 'परदादी', PANJOBA: 'परदादा', SASU: 'सास', SASRA: 'ससुर', KAKA: 'चाचा', KAKI: 'चाची',
    MAMA: 'मामा', MAMI: 'मामी', AATYA: 'बुआ', FUA: 'फूफा', MAVSHI: 'मौसी', MAVSA: 'मौसा',
    NAVRA: 'पति', BAYKO: 'पत्नी', BHAU: 'भाई', BAHIN: 'बहन', VAHINI: 'भाभी', DAJI: 'जीजा',
    MEVHANA: 'साला', MEVHANI: 'साली', DIR_CHOTE: 'देवर', DIR_MOTHE: 'जेठ', NANAND: 'ननद', NANANDOI: 'नंदोई',
    MULGA: 'बेटा', MULGI: 'बेटी', JAVAI: 'दामाद', SUN: 'बहू', PUTANYA: 'भतीजा', PUTANI: 'भतीजी',
    BHACHA: 'भांजा', BHACHI: 'भांजी', NATU: 'पोता', NAAT: 'पोती', MITRA: 'मित्र', MAITRIN: 'सखी',
    SAVATR_VADIL: 'सौतेले पिता', SAVATR_AAI: 'सौतेली माँ', SAVATR_BHAU: 'सौतेला भाई', SAVATR_BAHIN: 'सौतेली बहन',
    SAVATR_MULGA: 'सौतेला बेटा', SAVATR_MULGI: 'सौतेली बेटी', CHULAT_BHAU: 'चचेरा भाई', CHULAT_BAHIN: 'चचेरी बहन',
    MAMBHAU: 'ममेरा भाई', MAMBAHIN: 'ममेरी बहन', MAV_BHAU: 'मौसेरा भाई', MAV_BAHIN: 'मौसेरी बहन',
    ATYE_BHAU: 'फुफेरा भाई', ATYE_BAHIN: 'फुफेरी बहन', AJI_SASU: 'दादी सास', AJI_SASRA: 'दादा ससुर',
    CHULTA: 'चाचा', CHULTI: 'चाची', PP_AJOBA: 'परदादा', PP_AAJI: 'परदादी', PPP_AJOBA: 'लक्कड़ दादा',
    PPP_AAJI: 'लक्कड़ दादी', AJOBA_SASRA: 'दादा ससुर', AJOBA_SASU: 'दादी सास', MAMA_SASRA: 'मामा ससुर',
    MAMI_SASU: 'मामी सास', PANAJI_SASU: 'परदादी सास', PANJOBA_SASRA: 'परदादा ससुर', CHULAT_SASRA: 'चाचा ससुर',
    ATYA_SASU: 'बुआ सास', MAVAS_SASU: 'मौसी सास', CHULTA_DIR: 'चचेरा देवर', CHULTA_NANAND: 'चचेरी ननद',
    NAT_JAVAI: 'नाती दामाद', NATASUN: 'नाती बहू', PANTU: 'परपोता', PANTI: 'परपोती', PANTISUN: 'परपोत बहू',
    PANTU_JAVAI: 'परपोता दामाद', PP_NATU: 'लक्कड़ पोता', PP_NAAT: 'लक्कड़ पोती', PPP_NATU: 'छक्कड़ पोता', PPP_NAAT: 'छक्कड़ पोती'
  },
  ta: {
    AAI: 'அம்மா', VADIL: 'அப்பா', AAJI: 'பாட்டி', AJOBA: 'தாத்தா', NANI: 'நானி', NANA: 'நானா',
    PANAAJI: 'பெரிய பாட்டி', PANJOBA: 'பெரிய தாத்தா', SASU: 'மாமியார்', SASRA: 'மாமனார்', KAKA: 'சித்தப்பா', KAKI: 'சித்தி',
    MAMA: 'மாமா', MAMI: 'மாமி', AATYA: 'அத்தை', FUA: 'அத்தை மாமா', MAVSHI: 'மௌசி', MAVSA: 'மௌசா',
    NAVRA: 'கணவர்', BAYKO: 'மனைவி', BHAU: 'அண்ணன்', BAHIN: 'சகோதரி', VAHINI: 'அண்ணி', DAJI: 'மச்சான்',
    MEVHANA: 'மைத்துனர்', MEVHANI: 'மைத்துனி', DIR_CHOTE: 'இளைய மைத்துனர்', DIR_MOTHE: 'மூத்த மைத்துனர்',
    NANAND: 'நந்தி', NANANDOI: 'நந்தோய்', MULGA: 'மகன்', MULGI: 'மகள்', JAVAI: 'மருமகன்', SUN: 'மருமகள்',
    PUTANYA: 'சகோதரர் மகன்', PUTANI: 'சகோதரர் மகள்', BHACHA: 'சகோதரி மகன்', BHACHI: 'சகோதரி மகள்',
    NATU: 'பேரன்', NAAT: 'பேத்தி', MITRA: 'நண்பன்', MAITRIN: 'நண்பி', SAVATR_VADIL: 'மாற்றுத் தந்தை',
    SAVATR_AAI: 'மாற்றுத் தாய்', SAVATR_BHAU: 'மாற்றுச் சகோதரன்', SAVATR_BAHIN: 'மாற்றுச் சகோதரி',
    SAVATR_MULGA: 'மாற்று மகன்', SAVATR_MULGI: 'மாற்று மகள்', CHULAT_BHAU: 'சகோதரக் உறவினர்', CHULAT_BAHIN: 'சகோதரி உறவினர்',
    MAMBHAU: 'மாமா மகன்', MAMBAHIN: 'மாமா மகள்', MAV_BHAU: 'மௌசி மகன்', MAV_BAHIN: 'மௌசி மகள்',
    ATYE_BHAU: 'அத்தை மகன்', ATYE_BAHIN: 'அத்தை மகள்', AJI_SASU: 'பாட்டி மாமியார்', AJI_SASRA: 'தாத்தா மாமனார்',
    CHULTA: 'சித்தப்பா', CHULTI: 'சித்தி', PP_AJOBA: 'முப்பாட்டன்', PP_AAJI: 'முப்பாட்டி', PPP_AJOBA: 'கொள்ளு தாத்தா',
    PPP_AAJI: 'கொள்ளு பாட்டி', AJOBA_SASRA: 'தாத்தா மாமனார்', AJOBA_SASU: 'பாட்டி மாமியார்', MAMA_SASRA: 'மாமா மாமனார்',
    MAMI_SASU: 'மாமி மாமியார்', PANAJI_SASU: 'பெரிய பாட்டி மாமியார்', PANJOBA_SASRA: 'பெரிய தாத்தா மாமனார்',
    CHULAT_SASRA: 'சித்தப்பா மாமனார்', ATYA_SASU: 'அத்தை மாமியார்', MAVAS_SASU: 'மௌசி மாமியார்',
    CHULTA_DIR: 'சகோதர மைத்துனர்', CHULTA_NANAND: 'சகோதரி மைத்துனி', NAT_JAVAI: 'பேரன் மருமகன்',
    NATASUN: 'பேத்தி மருமகள்', PANTU: 'கொள்ளுப் பேரன்', PANTI: 'கொள்ளுப் பேத்தி', PANTISUN: 'கொள்ளுப் பேரன் மனைவி',
    PANTU_JAVAI: 'கொள்ளுப் பேத்தி கணவர்', PP_NATU: 'எள்ளுப் பேரன்', PP_NAAT: 'எள்ளுப் பேத்தி', PPP_NATU: 'முப்பாட்டன் பேரன்', PPP_NAAT: 'முப்பாட்டன் பேத்தி'
  },
  kn: {
    AAI: 'ತಾಯಿ', VADIL: 'ತಂದೆ', AAJI: 'ಅಜ್ಜಿ', AJOBA: 'ಅಜ್ಜ', NANI: 'ನಾನಿ', NANA: 'ತಾತ',
    PANAAJI: 'ಹಿರಿಯ ಅಜ್ಜಿ', PANJOBA: 'ಹಿರಿಯ ಅಜ್ಜ', SASU: 'ಅತ್ತೆ', SASRA: 'ಮಾವ', KAKA: 'ಚಿಕ್ಕಪ್ಪ', KAKI: 'ಚಿಕ್ಕಮ್ಮ',
    MAMA: 'ಮಾಮ', MAMI: 'ಮಾಮಿ', AATYA: 'ಅತ್ತಿಗೆ', FUA: 'ಅತ್ತಿಗೆಯ ಗಂಡ', MAVSHI: 'ಮಾವಸಿ', MAVSA: 'ಮಾವಸ',
    NAVRA: 'ಗಂಡ', BAYKO: 'ಹೆಂಡತಿ', BHAU: 'ಅಣ್ಣ', BAHIN: 'ತಂಗಿ', VAHINI: 'ಅಕ್ಕ', DAJI: 'ಬಾವ',
    MEVHANA: 'ಬಾವ', MEVHANI: 'ಅತ್ತಿಗೆ', DIR_CHOTE: 'ದೇವರ', DIR_MOTHE: 'ಜ್ಯೇಷ್ಠ ದೇವರ', NANAND: 'ನಣಂದೆ',
    NANANDOI: 'ನಣಂದಿಯ ಗಂಡ', MULGA: 'ಮಗ', MULGI: 'ಮಗಳು', JAVAI: 'ಅಳಿಯ', SUN: 'ಸೊಸೆ', PUTANYA: 'ಸೋದರನ ಮಗ',
    PUTANI: 'ಸೋದರನ ಮಗಳು', BHACHA: 'ಸಹೋದರಿಯ ಮಗ', BHACHI: 'ಸಹೋದರಿಯ ಮಗಳು', NATU: 'ಮೊಮ್ಮಗ', NAAT: 'ಮೊಮ್ಮಗಳು',
    MITRA: 'ಸ್ನೇಹಿತ', MAITRIN: 'ಸ್ನೇಹಿತೆ', SAVATR_VADIL: 'ಸವತಿ ತಂದೆ', SAVATR_AAI: 'ಸವತಿ ತಾಯಿ', SAVATR_BHAU: 'ಸವತಿ ಸಹೋದರ',
    SAVATR_BAHIN: 'ಸವತಿ ಸಹೋದರಿ', SAVATR_MULGA: 'ಸವತಿ ಮಗ', SAVATR_MULGI: 'ಸವತಿ ಮಗಳು', CHULAT_BHAU: 'ಚಿಕ್ಕಪ್ಪನ ಮಗ',
    CHULAT_BAHIN: 'ಚಿಕ್ಕಪ್ಪನ ಮಗಳು', MAMBHAU: 'ಮಾಮನ ಮಗ', MAMBAHIN: 'ಮಾಮನ ಮಗಳು', MAV_BHAU: 'ಮಾವಸಿಯ ಮಗ',
    MAV_BAHIN: 'ಮಾವಸಿಯ ಮಗಳು', ATYE_BHAU: 'ಅತ್ತಿಗೆಯ ಮಗ', ATYE_BAHIN: 'ಅತ್ತಿಗೆಯ ಮಗಳು', AJI_SASU: 'ಅಜ್ಜಿ ಅತ್ತೆ',
    AJI_SASRA: 'ಅಜ್ಜ ಮಾವ', CHULTA: 'ಚಿಕ್ಕಪ್ಪ', CHULTI: 'ಚಿಕ್ಕಮ್ಮ', PP_AJOBA: 'ಮುತ್ತಜ್ಜ', PP_AAJI: 'ಮುತ್ತಜ್ಜಿ',
    PPP_AJOBA: 'ಮರಿಮುತ್ತಜ್ಜ', PPP_AAJI: 'ಮರಿಮುತ್ತಜ್ಜಿ', AJOBA_SASRA: 'ಅಜ್ಜ ಮಾವ', AJOBA_SASU: 'ಅಜ್ಜಿ ಅತ್ತೆ',
    MAMA_SASRA: 'ಮಾಮ ಮಾವ', MAMI_SASU: 'ಮಾಮಿ ಅತ್ತೆ', PANAJI_SASU: 'ಮುತ್ತಜ್ಜಿ ಅತ್ತೆ', PANJOBA_SASRA: 'ಮುತ್ತಜ್ಜ ಮಾವ',
    CHULAT_SASRA: 'ಚಿಕ್ಕಪ್ಪ ಮಾವ', ATYA_SASU: 'ಅತ್ತಿಗೆ ಅತ್ತೆ', MAVAS_SASU: 'ಮಾವಸಿ ಅತ್ತೆ', CHULTA_DIR: 'ಸಹೋದರ ದೇವರ',
    CHULTA_NANAND: 'ಸಹೋದರಿ ನಣಂದೆ', NAT_JAVAI: 'ಮೊಮ್ಮಗ ಅಳಿಯ', NATASUN: 'ಮೊಮ್ಮಗಳ ಸೊಸೆ', PANTU: 'ಮರಿಮೊಮ್ಮಗ',
    PANTI: 'ಮರಿಮೊಮ್ಮಗಳು', PANTISUN: 'ಮರಿಮೊಮ್ಮಗಳ ಸೊಸೆ', PANTU_JAVAI: 'ಮರಿಮೊಮ್ಮಗ ಅಳಿಯ', PP_NATU: 'ಮುತ್ತಜ್ಜನ ಮೊಮ್ಮಗ',
    PP_NAAT: 'ಮುತ್ತಜ್ಜನ ಮೊಮ್ಮಗಳು', PPP_NATU: 'ಮರಿಮುತ್ತಜ್ಜನ ಮೊಮ್ಮಗ', PPP_NAAT: 'ಮರಿಮುತ್ತಜ್ಜನ ಮೊಮ್ಮಗಳು'
  },
  gu: {
    AAI: 'મા', VADIL: 'પિતા', AAJI: 'દાદી', AJOBA: 'દાદા', NANI: 'નાની', NANA: 'નાના',
    PANAAJI: 'પરદાદી', PANJOBA: 'પરદાદા', SASU: 'સાસુ', SASRA: 'સસરા', KAKA: 'કાકા', KAKI: 'કાકી',
    MAMA: 'મામા', MAMI: 'મામી', AATYA: 'ફોઈ', FUA: 'ફુવા', MAVSHI: 'માસી', MAVSA: 'માસા',
    NAVRA: 'પતિ', BAYKO: 'પત્ની', BHAU: 'ભાઈ', BAHIN: 'બહેન', VAHINI: 'ભાભી', DAJI: 'જીજાજી',
    MEVHANA: 'સાળો', MEVHANI: 'સાળી', DIR_CHOTE: 'દેવર', DIR_MOTHE: 'જેઠ', NANAND: 'નણંદ', NANANDOI: 'નણદોઈ',
    MULGA: 'દીકરો', MULGI: 'દીકરી', JAVAI: 'જમાઈ', SUN: 'વહુ', PUTANYA: 'ભત્રીજો', PUTANI: 'ભત્રીજી',
    BHACHA: 'ભાણેજ', BHACHI: 'ભાણી', NATU: 'પૌત્ર', NAAT: 'પૌત્રી', MITRA: 'મિત્ર', MAITRIN: 'સખી',
    SAVATR_VADIL: 'સાવકા પિતા', SAVATR_AAI: 'સાવકી મા', SAVATR_BHAU: 'સાવકો ભાઈ', SAVATR_BAHIN: 'સાવકી બહેન',
    SAVATR_MULGA: 'સાવકો દીકરો', SAVATR_MULGI: 'સાવકી દીકરી', CHULAT_BHAU: 'કઝિન ભાઈ', CHULAT_BAHIN: 'કઝિન બહેન',
    MAMBHAU: 'મામેરો ભાઈ', MAMBAHIN: 'મામેરી બહેન', MAV_BHAU: 'માસેરો ભાઈ', MAV_BAHIN: 'માસેરી બહેન',
    ATYE_BHAU: 'ફુફેરો ભાઈ', ATYE_BAHIN: 'ફુફેરી બહેન', AJI_SASU: 'દાદી સાસુ', AJI_SASRA: 'દાદા સસરા',
    CHULTA: 'કાકા', CHULTI: 'કાકી', PP_AJOBA: 'પરદાદા', PP_AAJI: 'પરદાદી', PPP_AJOBA: 'લક્કડ દાદા',
    PPP_AAJI: 'લક્કડ દાદી', AJOBA_SASRA: 'દાદા સસરા', AJOBA_SASU: 'દાદી સાસુ', MAMA_SASRA: 'મામા સસરા',
    MAMI_SASU: 'મામી સાસુ', PANAJI_SASU: 'પરદાદી સાસુ', PANJOBA_SASRA: 'પરદાદા સસરા', CHULAT_SASRA: 'કાકા સસરા',
    ATYA_SASU: 'ફોઈ સાસુ', MAVAS_SASU: 'માસી સાસુ', CHULTA_DIR: 'કઝિન દેવર', CHULTA_NANAND: 'કઝિન નણંદ',
    NAT_JAVAI: 'પૌત્ર જમાઈ', NATASUN: 'પૌત્ર વહુ', PANTU: 'પરપૌત્ર', PANTI: 'પરપૌત્રી', PANTISUN: 'પરપૌત્ર વહુ',
    PANTU_JAVAI: 'પરપૌત્ર જમાઈ', PP_NATU: 'લક્કડ પૌત્ર', PP_NAAT: 'લક્કડ પૌત્રી', PPP_NATU: 'છક્કડ પૌત્ર', PPP_NAAT: 'છક્કડ પૌત્રી'
  },
  te: {
    AAI: 'అమ్మ', VADIL: 'నాన్న', AAJI: 'అమ్మమ్మ', AJOBA: 'తాతయ్య', NANI: 'నానమ్మ', NANA: 'తాతయ్య',
    PANAAJI: 'పెద్దమ్మమ్మ', PANJOBA: 'పెద్దతాతయ్య', SASU: 'అత్త', SASRA: 'మామయ్య', KAKA: 'బాబాయి', KAKI: 'పిన్ని',
    MAMA: 'మామయ్య', MAMI: 'అత్తయ్య', AATYA: 'అత్త', FUA: 'అత్తగారి భర్త', MAVSHI: 'మేనత్త', MAVSA: 'మేనమామ',
    NAVRA: 'భర్త', BAYKO: 'భార్య', BHAU: 'అన్న', BAHIN: 'చెల్లి', VAHINI: 'వదిన', DAJI: 'బావ',
    MEVHANA: 'బావ', MEVHANI: 'మరదలు', DIR_CHOTE: 'దేవర', DIR_MOTHE: 'పెద్ద దేవర', NANAND: 'ననంద', NANANDOI: 'ననంద భర్త',
    MULGA: 'కొడుకు', MULGI: 'కూతురు', JAVAI: 'అల్లుడు', SUN: 'కోడలు', PUTANYA: 'సోదరుని కుమారుడు', PUTANI: 'సోదరుని కుమార్తె',
    BHACHA: 'మేనల్లుడు', BHACHI: 'మేనకోడలు', NATU: 'మనవడు', NAAT: 'మనవరాలు', MITRA: 'స్నేహితుడు', MAITRIN: 'స్నేహితురాలు',
    SAVATR_VADIL: 'సవతి తండ్రి', SAVATR_AAI: 'సవతి తల్లి', SAVATR_BHAU: 'సవతి అన్న', SAVATR_BAHIN: 'సవతి చెల్లి',
    SAVATR_MULGA: 'సవతి కొడుకు', SAVATR_MULGI: 'సవతి కూతురు', CHULAT_BHAU: 'కజిన్ అన్న', CHULAT_BAHIN: 'కజిన్ చెల్లి',
    MAMBHAU: 'మామయ్య కొడుకు', MAMBAHIN: 'మామయ్య కూతురు', MAV_BHAU: 'మేనత్త కొడుకు', MAV_BAHIN: 'మేనత్త కూతురు',
    ATYE_BHAU: 'అత్త కొడుకు', ATYE_BAHIN: 'అత్త కూతురు', AJI_SASU: 'అమ్మమ్మ అత్త', AJI_SASRA: 'తాతయ్య మామయ్య',
    CHULTA: 'బాబాయి', CHULTI: 'పిన్ని', PP_AJOBA: 'ముత్తాత', PP_AAJI: 'ముత్తవ్వ', PPP_AJOBA: 'ముత్తాతయ్య',
    PPP_AAJI: 'ముత్తవ్వమ్మ', AJOBA_SASRA: 'తాతయ్య మామయ్య', AJOBA_SASU: 'అమ్మమ్మ అత్త', MAMA_SASRA: 'మామయ్య మామయ్య',
    MAMI_SASU: 'అత్తయ్య అత్త', PANAJI_SASU: 'పెద్దమ్మమ్మ అత్త', PANJOBA_SASRA: 'పెద్దతాతయ్య మామయ్య', CHULAT_SASRA: 'బాబాయి మామయ్య',
    ATYA_SASU: 'అత్త అత్త', MAVAS_SASU: 'మేనత్త అత్త', CHULTA_DIR: 'కజిన్ దేవర', CHULTA_NANAND: 'కజిన్ ననంద',
    NAT_JAVAI: 'మనవడు అల్లుడు', NATASUN: 'మనవరాలు కోడలు', PANTU: 'మునిమనవడు', PANTI: 'మునిమనవరాలు', PANTISUN: 'మునిమనవరాలు కోడలు',
    PANTU_JAVAI: 'మునిమనవడు అల్లుడు', PP_NATU: 'ముత్తాత మనవడు', PP_NAAT: 'ముత్తాత మనవరాలు', PPP_NATU: 'ముత్తాత మునిమనవడు', PPP_NAAT: 'ముత్తాత మునిమనవరాలు'
  }
};`;

const regex = /const relationLanguageOverrides = \{[\s\S]*?^\};\n?/m;
content = content.replace(regex, newOverridesStr + '\n');
fs.writeFileSync(seedFile, content, 'utf8');
console.log('Successfully updated relationLanguageOverrides in seed.js');
