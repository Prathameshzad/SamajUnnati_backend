// src/services/notificationI18n.ts
/**
 * Localizes notification text into the recipient's APP language.
 *
 * Notifications are stored in English (the canonical form every call site
 * already writes). They are translated at the edges — when listed, pushed or
 * emitted over the socket — by matching the stored English against the known
 * templates below and re-rendering them with the extracted name/label. This
 * keeps call sites unchanged and also translates notifications created before
 * the user switched language. Unknown text is returned unchanged.
 */
import prisma from '../lib/prisma';

type Lang = 'hi' | 'mr' | 'ta' | 'kn' | 'gu' | 'te' | 'zh';
const LANGS: Lang[] = ['hi', 'mr', 'ta', 'kn', 'gu', 'te', 'zh'];

type Localized = Record<Lang, string>;

interface Template {
  /** English title; may contain {name}. */
  title: string;
  /** English message variants; placeholders {name}, {label}, {years}, {age}. */
  messages: string[];
  t: Localized;
  m: Localized;
}

const TEMPLATES: Template[] = [
  {
    title: 'Follow Request',
    messages: ['{name} wants to follow you'],
    t: { hi: 'फॉलो अनुरोध', mr: 'फॉलो विनंती', ta: 'பின்தொடர் கோரிக்கை', kn: 'ಅನುಸರಿಸುವ ವಿನಂತಿ', gu: 'ફોલો વિનંતી', te: 'ఫాలో అభ్యర్థన', zh: '关注请求' },
    m: { hi: '{name} आपको फॉलो करना चाहते हैं', mr: '{name} तुम्हाला फॉलो करू इच्छितात', ta: '{name} உங்களைப் பின்தொடர விரும்புகிறார்', kn: '{name} ನಿಮ್ಮನ್ನು ಅನುಸರಿಸಲು ಬಯಸುತ್ತಾರೆ', gu: '{name} તમને ફોલો કરવા માંગે છે', te: '{name} మిమ్మల్ని ఫాలో చేయాలనుకుంటున్నారు', zh: '{name} 想关注您' },
  },
  {
    title: 'New Follower',
    messages: ['{name} started following you'],
    t: { hi: 'नया फॉलोअर', mr: 'नवीन फॉलोअर', ta: 'புதிய பின்தொடர்பவர்', kn: 'ಹೊಸ ಅನುಯಾಯಿ', gu: 'નવા ફોલોઅર', te: 'కొత్త అనుచరుడు', zh: '新粉丝' },
    m: { hi: '{name} ने आपको फॉलो करना शुरू किया', mr: '{name} यांनी तुम्हाला फॉलो करायला सुरुवात केली', ta: '{name} உங்களைப் பின்தொடரத் தொடங்கினார்', kn: '{name} ನಿಮ್ಮನ್ನು ಅನುಸರಿಸಲು ಆರಂಭಿಸಿದರು', gu: '{name} એ તમને ફોલો કરવાનું શરૂ કર્યું', te: '{name} మిమ్మల్ని ఫాలో చేయడం ప్రారంభించారు', zh: '{name} 开始关注您' },
  },
  {
    title: 'Follow Accepted',
    messages: ['{name} accepted your follow request'],
    t: { hi: 'फॉलो स्वीकार किया गया', mr: 'फॉलो स्वीकारले', ta: 'பின்தொடர் ஏற்கப்பட்டது', kn: 'ಅನುಸರಣೆ ಸ್ವೀಕರಿಸಲಾಗಿದೆ', gu: 'ફોલો સ્વીકાર્યું', te: 'ఫాలో అంగీకరించబడింది', zh: '关注已接受' },
    m: { hi: '{name} ने आपका फॉलो अनुरोध स्वीकार किया', mr: '{name} यांनी तुमची फॉलो विनंती स्वीकारली', ta: '{name} உங்கள் பின்தொடர் கோரிக்கையை ஏற்றார்', kn: '{name} ನಿಮ್ಮ ಅನುಸರಿಸುವ ವಿನಂತಿಯನ್ನು ಸ್ವೀಕರಿಸಿದರು', gu: '{name} એ તમારી ફોલો વિનંતી સ્વીકારી', te: '{name} మీ ఫాలో అభ్యర్థనను అంగీకరించారు', zh: '{name} 接受了您的关注请求' },
  },
  {
    title: 'Friend request approved',
    messages: ['{name} approved your friend request.'],
    t: { hi: 'मित्र अनुरोध स्वीकृत', mr: 'मित्र विनंती मंजूर', ta: 'நண்பர் கோரிக்கை ஏற்கப்பட்டது', kn: 'ಸ್ನೇಹ ವಿನಂತಿ ಅನುಮೋದಿಸಲಾಗಿದೆ', gu: 'મિત્ર વિનંતી મંજૂર', te: 'స్నేహ అభ్యర్థన ఆమోదించబడింది', zh: '好友请求已通过' },
    m: { hi: '{name} ने आपका मित्र अनुरोध स्वीकार किया।', mr: '{name} यांनी तुमची मित्र विनंती मंजूर केली.', ta: '{name} உங்கள் நண்பர் கோரிக்கையை ஏற்றார்.', kn: '{name} ನಿಮ್ಮ ಸ್ನೇಹ ವಿನಂತಿಯನ್ನು ಅನುಮೋದಿಸಿದರು.', gu: '{name} એ તમારી મિત્ર વિનંતી મંજૂર કરી.', te: '{name} మీ స్నేహ అభ్యర్థనను ఆమోదించారు.', zh: '{name} 通过了您的好友请求。' },
  },
  {
    title: 'Friend request rejected',
    messages: ['{name} rejected your friend request.'],
    t: { hi: 'मित्र अनुरोध अस्वीकृत', mr: 'मित्र विनंती नाकारली', ta: 'நண்பர் கோரிக்கை நிராகரிக்கப்பட்டது', kn: 'ಸ್ನೇಹ ವಿನಂತಿ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ', gu: 'મિત્ર વિનંતી નકારી', te: 'స్నేహ అభ్యర్థన తిరస్కరించబడింది', zh: '好友请求被拒绝' },
    m: { hi: '{name} ने आपका मित्र अनुरोध अस्वीकार किया।', mr: '{name} यांनी तुमची मित्र विनंती नाकारली.', ta: '{name} உங்கள் நண்பர் கோரிக்கையை நிராகரித்தார்.', kn: '{name} ನಿಮ್ಮ ಸ್ನೇಹ ವಿನಂತಿಯನ್ನು ತಿರಸ್ಕರಿಸಿದರು.', gu: '{name} એ તમારી મિત્ર વિનંતી નકારી.', te: '{name} మీ స్నేహ అభ్యర్థనను తిరస్కరించారు.', zh: '{name} 拒绝了您的好友请求。' },
  },
  {
    title: 'Friend removed',
    messages: ['{name} has removed you from their friend list.'],
    t: { hi: 'मित्र हटाया गया', mr: 'मित्र काढले', ta: 'நண்பர் நீக்கப்பட்டார்', kn: 'ಸ್ನೇಹಿತರನ್ನು ತೆಗೆದುಹಾಕಲಾಗಿದೆ', gu: 'મિત્ર દૂર કર્યા', te: 'స్నేహితుడు తొలగించబడ్డారు', zh: '好友已移除' },
    m: { hi: '{name} ने आपको अपनी मित्र सूची से हटा दिया है।', mr: '{name} यांनी तुम्हाला त्यांच्या मित्र यादीतून काढले आहे.', ta: '{name} உங்களைத் தங்கள் நண்பர் பட்டியலிலிருந்து நீக்கினார்.', kn: '{name} ನಿಮ್ಮನ್ನು ತಮ್ಮ ಸ್ನೇಹಿತರ ಪಟ್ಟಿಯಿಂದ ತೆಗೆದುಹಾಕಿದ್ದಾರೆ.', gu: '{name} એ તમને તેમની મિત્ર યાદીમાંથી દૂર કર્યા છે.', te: '{name} మిమ్మల్ని తమ స్నేహితుల జాబితా నుండి తొలగించారు.', zh: '{name} 已将您从好友列表中移除。' },
  },
  {
    title: 'New friend request',
    messages: ['{name} has sent you a friend request.'],
    t: { hi: 'नया मित्र अनुरोध', mr: 'नवीन मित्र विनंती', ta: 'புதிய நண்பர் கோரிக்கை', kn: 'ಹೊಸ ಸ್ನೇಹ ವಿನಂತಿ', gu: 'નવી મિત્ર વિનંતી', te: 'కొత్త స్నేహ అభ్యర్థన', zh: '新的好友请求' },
    m: { hi: '{name} ने आपको मित्र अनुरोध भेजा है।', mr: '{name} यांनी तुम्हाला मित्र विनंती पाठवली आहे.', ta: '{name} உங்களுக்கு நண்பர் கோரிக்கை அனுப்பியுள்ளார்.', kn: '{name} ನಿಮಗೆ ಸ್ನೇಹ ವಿನಂತಿ ಕಳುಹಿಸಿದ್ದಾರೆ.', gu: '{name} એ તમને મિત્ર વિનંતી મોકલી છે.', te: '{name} మీకు స్నేహ అభ్యర్థన పంపారు.', zh: '{name} 向您发送了好友请求。' },
  },
  {
    title: 'Friend request sent',
    messages: ['You added {name}. Waiting for approval.'],
    t: { hi: 'मित्र अनुरोध भेजा गया', mr: 'मित्र विनंती पाठवली', ta: 'நண்பர் கோரிக்கை அனுப்பப்பட்டது', kn: 'ಸ್ನೇಹ ವಿನಂತಿ ಕಳುಹಿಸಲಾಗಿದೆ', gu: 'મિત્ર વિનંતી મોકલી', te: 'స్నేహ అభ్యర్థన పంపబడింది', zh: '好友请求已发送' },
    m: { hi: 'आपने {name} को जोड़ा। स्वीकृति की प्रतीक्षा है।', mr: 'तुम्ही {name} यांना जोडले. मंजुरीची प्रतीक्षा आहे.', ta: 'நீங்கள் {name} அவர்களைச் சேர்த்தீர்கள். ஒப்புதலுக்காகக் காத்திருக்கிறது.', kn: 'ನೀವು {name} ಅವರನ್ನು ಸೇರಿಸಿದ್ದೀರಿ. ಅನುಮೋದನೆಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ.', gu: 'તમે {name} ને ઉમેર્યા. મંજૂરીની રાહ જોવાય છે.', te: 'మీరు {name} ను జోడించారు. ఆమోదం కోసం వేచి ఉంది.', zh: '您已添加 {name}，等待对方确认。' },
  },
  {
    title: 'Matrimony Profile Management',
    messages: ['{name} wants to create and manage a Matrimony Profile for you.'],
    t: { hi: 'विवाह प्रोफ़ाइल प्रबंधन', mr: 'विवाह प्रोफाइल व्यवस्थापन', ta: 'திருமண சுயவிவர நிர்வாகம்', kn: 'ವಿವಾಹ ಪ್ರೊಫೈಲ್ ನಿರ್ವಹಣೆ', gu: 'લગ્ન પ્રોફાઇલ વ્યવસ્થાપન', te: 'వివాహ ప్రొఫైల్ నిర్వహణ', zh: '婚恋资料管理' },
    m: { hi: '{name} आपके लिए विवाह प्रोफ़ाइल बनाना और प्रबंधित करना चाहते हैं।', mr: '{name} तुमच्यासाठी विवाह प्रोफाइल तयार करून व्यवस्थापित करू इच्छितात.', ta: '{name} உங்களுக்காகத் திருமண சுயவிவரத்தை உருவாக்கி நிர்வகிக்க விரும்புகிறார்.', kn: '{name} ನಿಮಗಾಗಿ ವಿವಾಹ ಪ್ರೊಫೈಲ್ ರಚಿಸಿ ನಿರ್ವಹಿಸಲು ಬಯಸುತ್ತಾರೆ.', gu: '{name} તમારા માટે લગ્ન પ્રોફાઇલ બનાવી તેનું સંચાલન કરવા માંગે છે.', te: '{name} మీ కోసం వివాహ ప్రొఫైల్‌ను సృష్టించి నిర్వహించాలనుకుంటున్నారు.', zh: '{name} 想为您创建并管理婚恋资料。' },
  },
  {
    title: 'New Like',
    messages: ['{name} liked your post'],
    t: { hi: 'नया लाइक', mr: 'नवीन लाइक', ta: 'புதிய விருப்பம்', kn: 'ಹೊಸ ಲೈಕ್', gu: 'નવી લાઈક', te: 'కొత్త లైక్', zh: '新的点赞' },
    m: { hi: '{name} ने आपकी पोस्ट पसंद की', mr: '{name} यांना तुमची पोस्ट आवडली', ta: '{name} உங்கள் பதிவை விரும்பினார்', kn: '{name} ನಿಮ್ಮ ಪೋಸ್ಟ್ ಇಷ್ಟಪಟ್ಟಿದ್ದಾರೆ', gu: '{name} ને તમારી પોસ્ટ ગમી', te: '{name} మీ పోస్ట్‌ను ఇష్టపడ్డారు', zh: '{name} 赞了您的帖子' },
  },
  {
    title: 'New Comment',
    messages: ['{name} commented on your post'],
    t: { hi: 'नई टिप्पणी', mr: 'नवीन टिप्पणी', ta: 'புதிய கருத்து', kn: 'ಹೊಸ ಕಾಮೆಂಟ್', gu: 'નવી ટિપ્પણી', te: 'కొత్త వ్యాఖ్య', zh: '新的评论' },
    m: { hi: '{name} ने आपकी पोस्ट पर टिप्पणी की', mr: '{name} यांनी तुमच्या पोस्टवर टिप्पणी केली', ta: '{name} உங்கள் பதிவில் கருத்து தெரிவித்தார்', kn: '{name} ನಿಮ್ಮ ಪೋಸ್ಟ್‌ಗೆ ಕಾಮೆಂಟ್ ಮಾಡಿದ್ದಾರೆ', gu: '{name} એ તમારી પોસ્ટ પર ટિપ્પણી કરી', te: '{name} మీ పోస్ట్‌పై వ్యాఖ్యానించారు', zh: '{name} 评论了您的帖子' },
  },
  {
    title: 'New relation request',
    messages: ['{name} has added you as {label} to their family tree. Please approve to connect.'],
    t: { hi: 'नया रिश्ता अनुरोध', mr: 'नवीन नाते विनंती', ta: 'புதிய உறவு கோரிக்கை', kn: 'ಹೊಸ ಸಂಬಂಧ ವಿನಂತಿ', gu: 'નવી સંબંધ વિનંતી', te: 'కొత్త సంబంధ అభ్యర్థన', zh: '新的关系请求' },
    m: { hi: '{name} ने आपको अपने परिवार वृक्ष में {label} के रूप में जोड़ा है। जुड़ने के लिए स्वीकृति दें।', mr: '{name} यांनी तुम्हाला त्यांच्या कुटुंब वृक्षात {label} म्हणून जोडले आहे. जोडण्यासाठी मंजुरी द्या.', ta: '{name} உங்களைத் தங்கள் குடும்ப மரத்தில் {label} ஆகச் சேர்த்துள்ளார். இணைக்க ஒப்புதல் அளிக்கவும்.', kn: '{name} ನಿಮ್ಮನ್ನು ತಮ್ಮ ಕುಟುಂಬ ವೃಕ್ಷಕ್ಕೆ {label} ಆಗಿ ಸೇರಿಸಿದ್ದಾರೆ. ಸಂಪರ್ಕಿಸಲು ಅನುಮೋದಿಸಿ.', gu: '{name} એ તમને તેમના ફેમિલી ટ્રીમાં {label} તરીકે ઉમેર્યા છે. જોડાવા માટે મંજૂરી આપો.', te: '{name} మిమ్మల్ని తమ కుటుంబ వృక్షంలో {label} గా జోడించారు. కనెక్ట్ కావడానికి ఆమోదించండి.', zh: '{name} 已将您以「{label}」身份加入其家谱，请确认以建立联系。' },
  },
  {
    title: 'New relation request',
    messages: ['{name} has added you to their family tree.'],
    t: { hi: 'नया रिश्ता अनुरोध', mr: 'नवीन नाते विनंती', ta: 'புதிய உறவு கோரிக்கை', kn: 'ಹೊಸ ಸಂಬಂಧ ವಿನಂತಿ', gu: 'નવી સંબંધ વિનંતી', te: 'కొత్త సంబంధ అభ్యర్థన', zh: '新的关系请求' },
    m: { hi: '{name} ने आपको अपने परिवार वृक्ष में जोड़ा है।', mr: '{name} यांनी तुम्हाला त्यांच्या कुटुंब वृक्षात जोडले आहे.', ta: '{name} உங்களைத் தங்கள் குடும்ப மரத்தில் சேர்த்துள்ளார்.', kn: '{name} ನಿಮ್ಮನ್ನು ತಮ್ಮ ಕುಟುಂಬ ವೃಕ್ಷಕ್ಕೆ ಸೇರಿಸಿದ್ದಾರೆ.', gu: '{name} એ તમને તેમના ફેમિલી ટ્રીમાં ઉમેર્યા છે.', te: '{name} మిమ్మల్ని తమ కుటుంబ వృక్షంలో జోడించారు.', zh: '{name} 已将您加入其家谱。' },
  },
  {
    title: 'Request Sent',
    messages: ['You added {name}. Waiting for approval.'],
    t: { hi: 'अनुरोध भेजा गया', mr: 'विनंती पाठवली', ta: 'கோரிக்கை அனுப்பப்பட்டது', kn: 'ವಿನಂತಿ ಕಳುಹಿಸಲಾಗಿದೆ', gu: 'વિનંતી મોકલી', te: 'అభ్యర్థన పంపబడింది', zh: '请求已发送' },
    m: { hi: 'आपने {name} को जोड़ा। स्वीकृति की प्रतीक्षा है।', mr: 'तुम्ही {name} यांना जोडले. मंजुरीची प्रतीक्षा आहे.', ta: 'நீங்கள் {name} அவர்களைச் சேர்த்தீர்கள். ஒப்புதலுக்காகக் காத்திருக்கிறது.', kn: 'ನೀವು {name} ಅವರನ್ನು ಸೇರಿಸಿದ್ದೀರಿ. ಅನುಮೋದನೆಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ.', gu: 'તમે {name} ને ઉમેર્યા. મંજૂરીની રાહ જોવાય છે.', te: 'మీరు {name} ను జోడించారు. ఆమోదం కోసం వేచి ఉంది.', zh: '您已添加 {name}，等待对方确认。' },
  },
  {
    title: 'Relation approved',
    messages: ['{name} approved your request.'],
    t: { hi: 'रिश्ता स्वीकृत', mr: 'नाते मंजूर', ta: 'உறவு ஏற்கப்பட்டது', kn: 'ಸಂಬಂಧ ಅನುಮೋದಿಸಲಾಗಿದೆ', gu: 'સંબંધ મંજૂર', te: 'సంబంధం ఆమోదించబడింది', zh: '关系已确认' },
    m: { hi: '{name} ने आपका अनुरोध स्वीकार किया।', mr: '{name} यांनी तुमची विनंती मंजूर केली.', ta: '{name} உங்கள் கோரிக்கையை ஏற்றார்.', kn: '{name} ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ಅನುಮೋದಿಸಿದರು.', gu: '{name} એ તમારી વિનંતી મંજૂર કરી.', te: '{name} మీ అభ్యర్థనను ఆమోదించారు.', zh: '{name} 确认了您的请求。' },
  },
  {
    title: 'Relation rejected',
    messages: ['{name} rejected your request.'],
    t: { hi: 'रिश्ता अस्वीकृत', mr: 'नाते नाकारले', ta: 'உறவு நிராகரிக்கப்பட்டது', kn: 'ಸಂಬಂಧ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ', gu: 'સંબંધ નકાર્યો', te: 'సంబంధం తిరస్కరించబడింది', zh: '关系被拒绝' },
    m: { hi: '{name} ने आपका अनुरोध अस्वीकार किया।', mr: '{name} यांनी तुमची विनंती नाकारली.', ta: '{name} உங்கள் கோரிக்கையை நிராகரித்தார்.', kn: '{name} ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ತಿರಸ್ಕರಿಸಿದರು.', gu: '{name} એ તમારી વિનંતી નકારી.', te: '{name} మీ అభ్యర్థనను తిరస్కరించారు.', zh: '{name} 拒绝了您的请求。' },
  },
  {
    title: 'Connection removed',
    messages: ['{name} has removed you from their family tree.'],
    t: { hi: 'संबंध हटाया गया', mr: 'नाते काढले', ta: 'இணைப்பு நீக்கப்பட்டது', kn: 'ಸಂಪರ್ಕ ತೆಗೆದುಹಾಕಲಾಗಿದೆ', gu: 'જોડાણ દૂર કર્યું', te: 'కనెక్షన్ తొలగించబడింది', zh: '关系已移除' },
    m: { hi: '{name} ने आपको अपने परिवार वृक्ष से हटा दिया है।', mr: '{name} यांनी तुम्हाला त्यांच्या कुटुंब वृक्षातून काढले आहे.', ta: '{name} உங்களைத் தங்கள் குடும்ப மரத்திலிருந்து நீக்கினார்.', kn: '{name} ನಿಮ್ಮನ್ನು ತಮ್ಮ ಕುಟುಂಬ ವೃಕ್ಷದಿಂದ ತೆಗೆದುಹಾಕಿದ್ದಾರೆ.', gu: '{name} એ તમને તેમના ફેમિલી ટ્રીમાંથી દૂર કર્યા છે.', te: '{name} మిమ్మల్ని తమ కుటుంబ వృక్షం నుండి తొలగించారు.', zh: '{name} 已将您从其家谱中移除。' },
  },
  {
    title: '{name} joined Samajunnati',
    messages: ['{name} is now on Samajunnati! Your connection request has been sent for their approval.'],
    t: { hi: '{name} समाजउन्नति से जुड़े', mr: '{name} समाजउन्नतीवर आले', ta: '{name} சமாஜ்உன்னதியில் இணைந்தார்', kn: '{name} ಸಮಾಜಉನ್ನತಿಗೆ ಸೇರಿದರು', gu: '{name} સમાજઉન્નતિમાં જોડાયા', te: '{name} సమాజ్ఉన్నతిలో చేరారు', zh: '{name} 加入了 Samajunnati' },
    m: { hi: '{name} अब समाजउन्नति पर हैं! आपका जुड़ने का अनुरोध उनकी स्वीकृति के लिए भेज दिया गया है।', mr: '{name} आता समाजउन्नतीवर आहेत! तुमची जोडणी विनंती त्यांच्या मंजुरीसाठी पाठवली आहे.', ta: '{name} இப்போது சமாஜ்உன்னதியில் உள்ளார்! உங்கள் இணைப்புக் கோரிக்கை அவரின் ஒப்புதலுக்காக அனுப்பப்பட்டது.', kn: '{name} ಈಗ ಸಮಾಜಉನ್ನತಿಯಲ್ಲಿದ್ದಾರೆ! ನಿಮ್ಮ ಸಂಪರ್ಕ ವಿನಂತಿಯನ್ನು ಅವರ ಅನುಮೋದನೆಗಾಗಿ ಕಳುಹಿಸಲಾಗಿದೆ.', gu: '{name} હવે સમાજઉન્નતિ પર છે! તમારી જોડાણ વિનંતી તેમની મંજૂરી માટે મોકલાઈ છે.', te: '{name} ఇప్పుడు సమాజ్ఉన్నతిలో ఉన్నారు! మీ కనెక్షన్ అభ్యర్థన వారి ఆమోదం కోసం పంపబడింది.', zh: '{name} 已加入 Samajunnati！您的关系请求已发送，等待对方确认。' },
  },
  {
    title: 'Birthday today 🎂',
    messages: [
      "🎂 It's {name}'s birthday — {age} today! Wish them before the cake is gone.",
      "🎂 It's {name}'s birthday! Wish them before the cake is gone.",
      '🎉 {name} is a year wiser today. Go say Happy Birthday — free to send, priceless to receive!',
      "🥳 Psst... it's {name}'s birthday! A quick wish will make their day.",
      "🎈 {name} turns {age} today. Don't be the last one to wish!",
      "🎈 {name} has a birthday today. Don't be the last one to wish!",
    ],
    t: { hi: 'आज जन्मदिन है 🎂', mr: 'आज वाढदिवस 🎂', ta: 'இன்று பிறந்தநாள் 🎂', kn: 'ಇಂದು ಜನ್ಮದಿನ 🎂', gu: 'આજે જન્મદિવસ 🎂', te: 'ఈరోజు పుట్టినరోజు 🎂', zh: '今天生日 🎂' },
    m: { hi: '🎂 आज {name} का जन्मदिन है! शुभकामनाएँ भेजें।', mr: '🎂 आज {name} यांचा वाढदिवस आहे! शुभेच्छा द्या.', ta: '🎂 இன்று {name} அவர்களின் பிறந்தநாள்! வாழ்த்துகளை அனுப்புங்கள்.', kn: '🎂 ಇಂದು {name} ಅವರ ಜನ್ಮದಿನ! ಶುಭಾಶಯ ಕಳುಹಿಸಿ.', gu: '🎂 આજે {name} નો જન્મદિવસ છે! શુભેચ્છા પાઠવો.', te: '🎂 ఈరోజు {name} పుట్టినరోజు! శుభాకాంక్షలు తెలపండి.', zh: '🎂 今天是 {name} 的生日！快送上祝福吧。' },
  },
  {
    title: 'Remembrance day 🕯️',
    messages: [
      'Today is the first death anniversary of {name}. Take a moment to remember and pay your respects.',
      'Today is the {years}-year death anniversary of {name}. Take a moment to remember and pay your respects.',
    ],
    t: { hi: 'स्मृति दिवस 🕯️', mr: 'स्मृतिदिन 🕯️', ta: 'நினைவு நாள் 🕯️', kn: 'ಸ್ಮರಣೆಯ ದಿನ 🕯️', gu: 'સ્મૃતિ દિવસ 🕯️', te: 'స్మారక దినం 🕯️', zh: '纪念日 🕯️' },
    m: { hi: 'आज {name} की पुण्यतिथि है। कुछ पल उन्हें याद करें और श्रद्धांजलि दें।', mr: 'आज {name} यांची पुण्यतिथी आहे. क्षणभर त्यांची आठवण काढून श्रद्धांजली वाहा.', ta: 'இன்று {name} அவர்களின் நினைவு நாள். சில நிமிடங்கள் அவரை நினைவுகூர்ந்து அஞ்சலி செலுத்துங்கள்.', kn: 'ಇಂದು {name} ಅವರ ಪುಣ್ಯತಿಥಿ. ಸ್ವಲ್ಪ ಸಮಯ ಅವರನ್ನು ಸ್ಮರಿಸಿ ಶ್ರದ್ಧಾಂಜಲಿ ಸಲ್ಲಿಸಿ.', gu: 'આજે {name} ની પુણ્યતિથિ છે. થોડી ક્ષણ તેમને યાદ કરી શ્રદ્ધાંજલિ આપો.', te: 'ఈరోజు {name} వర్ధంతి. కొంత సమయం వారిని స్మరించుకుని నివాళులు అర్పించండి.', zh: '今天是 {name} 的忌日。请花一点时间缅怀并致以敬意。' },
  },
];

/** Fallback names call sites use when the person's name is unknown. */
const FALLBACK_NAMES: Record<string, Localized> = {
  Someone: { hi: 'कोई', mr: 'कोणीतरी', ta: 'ஒருவர்', kn: 'ಯಾರೋ', gu: 'કોઈ', te: 'ఎవరో', zh: '有人' },
  'Your family member': { hi: 'आपके परिवार सदस्य', mr: 'तुमचे कुटुंब सदस्य', ta: 'உங்கள் குடும்ப உறுப்பினர்', kn: 'ನಿಮ್ಮ ಕುಟುಂಬ ಸದಸ್ಯರು', gu: 'તમારા પરિવાર સભ્ય', te: 'మీ కుటుంబ సభ్యుడు', zh: '您的家人' },
  'Your relative': { hi: 'आपके रिश्तेदार', mr: 'तुमचे नातेवाईक', ta: 'உங்கள் உறவினர்', kn: 'ನಿಮ್ಮ ಸಂಬಂಧಿ', gu: 'તમારા સગા', te: 'మీ బంధువు', zh: '您的亲戚' },
  User: { hi: 'उपयोगकर्ता', mr: 'वापरकर्ता', ta: 'பயனர்', kn: 'ಬಳಕೆದಾರ', gu: 'વપરાશકર્તા', te: 'వినియోగదారు', zh: '用户' },
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Compiles "Hi {name}, {age}" into a regex with named groups. */
function compile(template: string): RegExp {
  const parts = template.split(/(\{\w+\})/);
  const body = parts
    .map((p) => {
      const m = /^\{(\w+)\}$/.exec(p);
      return m ? `(?<${m[1]}>.+?)` : escapeRegex(p);
    })
    .join('');
  return new RegExp(`^${body}$`, 's');
}

const COMPILED = TEMPLATES.map((tpl) => ({
  tpl,
  title: compile(tpl.title),
  messages: tpl.messages.map(compile),
}));

function fill(text: string, vars: Record<string, string>, lang: Lang): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key] ?? '';
    return FALLBACK_NAMES[value]?.[lang] ?? value;
  });
}

export function normalizeLang(lang?: string | null): Lang | 'en' {
  const code = String(lang || '').toLowerCase().split('-')[0];
  return (LANGS as string[]).includes(code) ? (code as Lang) : 'en';
}

/** Translates one notification's title/message into `lang`. English and unknown text pass through. */
export function localizeNotificationText(
  title: string,
  message: string,
  lang?: string | null
): { title: string; message: string } {
  const target = normalizeLang(lang);
  if (target === 'en') return { title, message };

  for (const { tpl, title: titleRe, messages } of COMPILED) {
    const titleMatch = titleRe.exec(title);
    if (!titleMatch) continue;
    const titleVars = { ...(titleMatch.groups ?? {}) };

    for (const re of messages) {
      const m = re.exec(message);
      if (m) {
        const vars = { ...titleVars, ...(m.groups ?? {}) };
        return { title: fill(tpl.t[target], vars, target), message: fill(tpl.m[target], vars, target) };
      }
    }
  }

  // Title-only match (message didn't fit any variant): translate just the title.
  for (const { tpl, title: titleRe } of COMPILED) {
    const titleMatch = titleRe.exec(title);
    if (titleMatch) return { title: fill(tpl.t[target], titleMatch.groups ?? {}, target), message };
  }
  return { title, message };
}

/** Recipient's app language (stored on the user by the app's settings screen). */
export async function getUserAppLanguage(userId: string): Promise<string> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { appLanguage: true } });
    return u?.appLanguage || 'en';
  } catch {
    return 'en';
  }
}
