export type AppMode = 'idle' | 'listening' | 'speaking';
export type Role = 'host' | 'attendee';

export interface Participant {
  user_id: string;
  role: Role;
  name: string;
}

export type ListenPreference = "raw" | "translated";
export type AudioSource = "mic" | "system";
export type TTSProvider = "cartesia" | "web";

export type EmotionType = "neutral" | "joy" | "sadness" | "anger" | "fear" | "calm" | "excited";

export const EMOTION_COLORS: Record<EmotionType, string> = {
  neutral: 'text-white/60',
  joy: 'text-emerald-400',
  sadness: 'text-blue-400',
  anger: 'text-red-400',
  fear: 'text-purple-400',
  calm: 'text-cyan-300',
  excited: 'text-amber-400',
};

export interface SpeakerInfo {
  userId: string;
  userName: string;
  sessionId: string;
  since: number;
}

export interface QueueEntry {
  userId: string;
  userName: string;
  requestedAt: number;
}

export type ConversationMode = 'manual' | 'round-robin';

export interface RoomState {
  hostId: string | null;
  activeSpeaker: SpeakerInfo | null;
  isFloorLocked: boolean;
  conversationMode: ConversationMode;
  raiseHandQueue: QueueEntry[];
  lockVersion: number;
}

export interface Caption {
  id: string;
  text: string;
  sourceLang: string;
  speakerUserId: string;
  speakerName: string;
  timestamp: number;
  isFinal: boolean;
  emotion?: EmotionType;
}

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export interface TranslationResult {
  translatedText: string;
  detectedLanguage: string;
  emotion: EmotionType;
  pronunciationGuide: string;
}

export const AUTO_DETECT: Language = { code: 'auto', name: 'Auto Detect', flag: '✨' };

export const LANGUAGES: Language[] = [
  AUTO_DETECT,

  // --- English World ---
  { code: 'en-US', name: 'English (United States)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (United Kingdom)', flag: '🇬🇧' },
  { code: 'en-CA', name: 'English (Canada)', flag: '🇨🇦' },
  { code: 'en-AU', name: 'English (Australia)', flag: '🇦🇺' },
  { code: 'en-NZ', name: 'English (New Zealand)', flag: '🇳🇿' },
  { code: 'en-IE', name: 'English (Ireland)', flag: '🇮🇪' },
  { code: 'en-ZA', name: 'English (South Africa)', flag: '🇿🇦' },
  { code: 'en-IN', name: 'English (India)', flag: '🇮🇳' },
  { code: 'en-PH', name: 'English (Philippines)', flag: '🇵🇭' },
  { code: 'en-SG', name: 'English (Singapore)', flag: '🇸🇬' },
  { code: 'en-MY', name: 'English (Malaysia)', flag: '🇲🇾' },
  { code: 'en-HK', name: 'English (Hong Kong)', flag: '🇭🇰' },
  { code: 'en-KE', name: 'English (Kenya)', flag: '🇰🇪' },
  { code: 'en-GH', name: 'English (Ghana)', flag: '🇬🇭' },
  { code: 'en-NG', name: 'English (Nigeria)', flag: '🇳🇬' },
  { code: 'en-PK', name: 'English (Pakistan)', flag: '🇵🇰' },

  // --- Spanish World ---
  { code: 'es-ES', name: 'Spanish (Spain)', flag: '🇪🇸' },
  { code: 'es-MX', name: 'Spanish (Mexico)', flag: '🇲🇽' },
  { code: 'es-US', name: 'Spanish (United States)', flag: '🇺🇸' },
  { code: 'es-AR', name: 'Spanish (Argentina)', flag: '🇦🇷' },
  { code: 'es-BO', name: 'Spanish (Bolivia)', flag: '🇧🇴' },
  { code: 'es-CL', name: 'Spanish (Chile)', flag: '🇨🇱' },
  { code: 'es-CO', name: 'Spanish (Colombia)', flag: '🇨🇴' },
  { code: 'es-CR', name: 'Spanish (Costa Rica)', flag: '🇨🇷' },
  { code: 'es-CU', name: 'Spanish (Cuba)', flag: '🇨🇺' },
  { code: 'es-DO', name: 'Spanish (Dominican Republic)', flag: '🇩🇴' },
  { code: 'es-EC', name: 'Spanish (Ecuador)', flag: '🇪🇨' },
  { code: 'es-SV', name: 'Spanish (El Salvador)', flag: '🇸🇻' },
  { code: 'es-GT', name: 'Spanish (Guatemala)', flag: '🇬🇹' },
  { code: 'es-HN', name: 'Spanish (Honduras)', flag: '🇭🇳' },
  { code: 'es-NI', name: 'Spanish (Nicaragua)', flag: '🇳🇮' },
  { code: 'es-PA', name: 'Spanish (Panama)', flag: '🇵🇦' },
  { code: 'es-PY', name: 'Spanish (Paraguay)', flag: '🇵🇾' },
  { code: 'es-PE', name: 'Spanish (Peru)', flag: '🇵🇪' },
  { code: 'es-PR', name: 'Spanish (Puerto Rico)', flag: '🇵🇷' },
  { code: 'es-UY', name: 'Spanish (Uruguay)', flag: '🇺🇾' },
  { code: 'es-VE', name: 'Spanish (Venezuela)', flag: '🇻🇪' },

  // --- Portuguese World ---
  { code: 'pt-PT', name: 'Portuguese (Portugal)', flag: '🇵🇹' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', flag: '🇧🇷' },
  { code: 'pt-AO', name: 'Portuguese (Angola)', flag: '🇦🇴' },
  { code: 'pt-MZ', name: 'Portuguese (Mozambique)', flag: '🇲🇿' },

  // --- French World ---
  { code: 'fr-FR', name: 'French (France)', flag: '🇫🇷' },
  { code: 'fr-CA', name: 'French (Canada)', flag: '🇨🇦' },
  { code: 'fr-BE', name: 'French (Belgium)', flag: '🇧🇪' },
  { code: 'fr-CH', name: 'French (Switzerland)', flag: '🇨🇭' },
  { code: 'fr-LU', name: 'French (Luxembourg)', flag: '🇱🇺' },
  { code: 'fr-SN', name: 'French (Senegal)', flag: '🇸🇳' },
  { code: 'fr-CI', name: "French (Côte d'Ivoire)", flag: '🇨🇮' },

  // --- Germanic (Core) ---
  { code: 'de-DE', name: 'German (Germany)', flag: '🇩🇪' },
  { code: 'de-AT', name: 'German (Austria)', flag: '🇦🇹' },
  { code: 'de-CH', name: 'German (Switzerland)', flag: '🇨🇭' },
  { code: 'nl-NL', name: 'Dutch (Netherlands)', flag: '🇳🇱' },
  { code: 'nl-BE', name: 'Dutch (Belgium / Flemish Standard)', flag: '🇧🇪' },

  // --- Belgium Regional Languages / Dialects ---
  { code: 'vls-BE', name: 'West Flemish (Belgium)', flag: '🇧🇪' },
  { code: 'zea-BE', name: 'Zeelandic (Belgium)', flag: '🇧🇪' },
  { code: 'lim-BE', name: 'Limburgish (Belgium)', flag: '🇧🇪' },
  { code: 'wa-BE', name: 'Walloon (Belgium)', flag: '🇧🇪' },
  { code: 'de-BE', name: 'German (Belgium)', flag: '🇧🇪' },
  { code: 'pcd-BE', name: 'Picard (Belgium)', flag: '🇧🇪' },

  // --- African Regional Languages ---
  { code: 'fr-CM', name: 'French (Cameroon)', flag: '🇨🇲' },
  { code: 'en-CM', name: 'English (Cameroon)', flag: '🇨🇲' },
  { code: 'byv-CM', name: 'Medumba (Cameroon)', flag: '🇨🇲' },
  { code: 'wo-SN', name: 'Wolof (Senegal)', flag: '🇸🇳' },

  // --- Philippines Regional Languages ---
  { code: 'fil-PH', name: 'Filipino (Philippines)', flag: '🇵🇭' },
  { code: 'tl-PH', name: 'Tagalog (Philippines)', flag: '🇵🇭' },
  { code: 'ceb-PH', name: 'Cebuano (Philippines)', flag: '🇵🇭' },
  { code: 'ilo-PH', name: 'Ilocano (Philippines)', flag: '🇵🇭' },
  { code: 'hil-PH', name: 'Hiligaynon (Philippines)', flag: '🇵🇭' },
  { code: 'war-PH', name: 'Waray (Philippines)', flag: '🇵🇭' },

  // --- Italy & Neighbors ---
  { code: 'it-IT', name: 'Italian (Italy)', flag: '🇮🇹' },
  { code: 'it-CH', name: 'Italian (Switzerland)', flag: '🇨🇭' },
  { code: 'rm-CH', name: 'Romansh (Switzerland)', flag: '🇨🇭' },

  // --- Nordics ---
  { code: 'sv-SE', name: 'Swedish', flag: '🇸🇪' },
  { code: 'da-DK', name: 'Danish', flag: '🇩🇰' },
  { code: 'nb-NO', name: 'Norwegian Bokmål', flag: '🇳🇴' },
  { code: 'nn-NO', name: 'Norwegian Nynorsk', flag: '🇳🇴' },
  { code: 'fi-FI', name: 'Finnish', flag: '🇫🇮' },
  { code: 'is-IS', name: 'Icelandic', flag: '🇮🇸' },
  { code: 'fo-FO', name: 'Faroese', flag: '🇫🇴' },

  // --- Western & Central Europe ---
  { code: 'ga-IE', name: 'Irish', flag: '🇮🇪' },
  { code: 'gd-GB', name: 'Scottish Gaelic', flag: '🏴' },
  { code: 'cy-GB', name: 'Welsh', flag: '🏴' },
  { code: 'br-FR', name: 'Breton', flag: '🇫🇷' },
  { code: 'eu-ES', name: 'Basque', flag: '🇪🇸' },
  { code: 'ca-ES', name: 'Catalan', flag: '🇪🇸' },
  { code: 'gl-ES', name: 'Galician', flag: '🇪🇸' },
  { code: 'oc-FR', name: 'Occitan', flag: '🇫🇷' },
  { code: 'lb-LU', name: 'Luxembourgish', flag: '🇱🇺' },
  { code: 'mt-MT', name: 'Maltese', flag: '🇲🇹' },

  // --- Balkans & Eastern Europe ---
  { code: 'pl-PL', name: 'Polish', flag: '🇵🇱' },
  { code: 'cs-CZ', name: 'Czech', flag: '🇨🇿' },
  { code: 'sk-SK', name: 'Slovak', flag: '🇸🇰' },
  { code: 'hu-HU', name: 'Hungarian', flag: '🇭🇺' },
  { code: 'ro-RO', name: 'Romanian', flag: '🇷🇴' },
  { code: 'bg-BG', name: 'Bulgarian', flag: '🇧🇬' },
  { code: 'sl-SI', name: 'Slovenian', flag: '🇸🇮' },
  { code: 'hr-HR', name: 'Croatian', flag: '🇭🇷' },
  { code: 'sr-RS', name: 'Serbian (Serbia)', flag: '🇷🇸' },
  { code: 'bs-BA', name: 'Bosnian', flag: '🇧🇦' },
  { code: 'mk-MK', name: 'Macedonian', flag: '🇲🇰' },
  { code: 'sq-AL', name: 'Albanian', flag: '🇦🇱' },
  { code: 'el-GR', name: 'Greek', flag: '🇬🇷' },
  { code: 'ru-RU', name: 'Russian', flag: '🇷🇺' },
  { code: 'uk-UA', name: 'Ukrainian', flag: '🇺🇦' },
  { code: 'be-BY', name: 'Belarusian', flag: '🇧🇾' },
  { code: 'et-EE', name: 'Estonian', flag: '🇪🇪' },
  { code: 'lv-LV', name: 'Latvian', flag: '🇱🇻' },
  { code: 'lt-LT', name: 'Lithuanian', flag: '🇱🇹' },

  // --- Caucasus & Central Asia ---
  { code: 'ka-GE', name: 'Georgian', flag: '🇬🇪' },
  { code: 'hy-AM', name: 'Armenian', flag: '🇦🇲' },
  { code: 'az-AZ', name: 'Azerbaijani', flag: '🇦🇿' },
  { code: 'kk-KZ', name: 'Kazakh', flag: '🇰🇿' },
  { code: 'ky-KG', name: 'Kyrgyz', flag: '🇰🇬' },
  { code: 'uz-UZ', name: 'Uzbek', flag: '🇺🇿' },
  { code: 'tk-TM', name: 'Turkmen', flag: '🇹🇲' },
  { code: 'tg-TJ', name: 'Tajik', flag: '🇹🇯' },

  // --- Middle East (Semitic/Iranic/Turkic) ---
  { code: 'tr-TR', name: 'Turkish', flag: '🇹🇷' },
  { code: 'he-IL', name: 'Hebrew', flag: '🇮🇱' },
  { code: 'fa-IR', name: 'Persian (Iran)', flag: '🇮🇷' },
  { code: 'fa-AF', name: 'Dari (Afghanistan)', flag: '🇦🇫' },
  { code: 'ps-AF', name: 'Pashto (Afghanistan)', flag: '🇦🇫' },
  { code: 'ku-TR', name: 'Kurdish (Kurmanji)', flag: '🇹🇷' },
  { code: 'ckb-IQ', name: 'Kurdish (Sorani)', flag: '🇮🇶' },

  // Arabic regional variants (common)
  { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', flag: '🇸🇦' },
  { code: 'ar-AE', name: 'Arabic (UAE)', flag: '🇦🇪' },
  { code: 'ar-QA', name: 'Arabic (Qatar)', flag: '🇶🇦' },
  { code: 'ar-KW', name: 'Arabic (Kuwait)', flag: '🇰🇼' },
  { code: 'ar-BH', name: 'Arabic (Bahrain)', flag: '🇧🇭' },
  { code: 'ar-OM', name: 'Arabic (Oman)', flag: '🇴🇲' },
  { code: 'ar-YE', name: 'Arabic (Yemen)', flag: '🇾🇪' },
  { code: 'ar-IQ', name: 'Arabic (Iraq)', flag: '🇮🇶' },
  { code: 'ar-JO', name: 'Arabic (Jordan)', flag: '🇯🇴' },
  { code: 'ar-LB', name: 'Arabic (Lebanon)', flag: '🇱🇧' },
  { code: 'ar-SY', name: 'Arabic (Syria)', flag: '🇸🇾' },
  { code: 'ar-EG', name: 'Arabic (Egypt)', flag: '🇪🇬' },
  { code: 'ar-SD', name: 'Arabic (Sudan)', flag: '🇸🇩' },
  { code: 'ar-DZ', name: 'Arabic (Algeria)', flag: '🇩🇿' },
  { code: 'ar-TN', name: 'Arabic (Tunisia)', flag: '🇹🇳' },
  { code: 'ar-MA', name: 'Arabic (Morocco)', flag: '🇲🇦' },

  // --- South Asia ---
  { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
  { code: 'ur-PK', name: 'Urdu (Pakistan)', flag: '🇵🇰' },
  { code: 'ur-IN', name: 'Urdu (India)', flag: '🇮🇳' },
  { code: 'bn-BD', name: 'Bengali (Bangladesh)', flag: '🇧🇩' },
  { code: 'bn-IN', name: 'Bengali (India)', flag: '🇮🇳' },
  { code: 'pa-IN', name: 'Punjabi (India)', flag: '🇮🇳' },
  { code: 'pa-PK', name: 'Punjabi (Pakistan)', flag: '🇵🇰' },
  { code: 'gu-IN', name: 'Gujarati', flag: '🇮🇳' },
  { code: 'mr-IN', name: 'Marathi', flag: '🇮🇳' },
  { code: 'ta-IN', name: 'Tamil (India)', flag: '🇮🇳' },
  { code: 'ta-LK', name: 'Tamil (Sri Lanka)', flag: '🇱🇰' },
  { code: 'te-IN', name: 'Telugu', flag: '🇮🇳' },
  { code: 'kn-IN', name: 'Kannada', flag: '🇮🇳' },
  { code: 'ml-IN', name: 'Malayalam', flag: '🇮🇳' },
  { code: 'or-IN', name: 'Odia', flag: '🇮🇳' },
  { code: 'as-IN', name: 'Assamese', flag: '🇮🇳' },
  { code: 'ne-NP', name: 'Nepali', flag: '🇳🇵' },
  { code: 'si-LK', name: 'Sinhala', flag: '🇱🇰' },
  { code: 'my-MM', name: 'Burmese (Myanmar)', flag: '🇲🇲' },

  // --- East Asia (Sino-Tibetan, Japonic, Koreanic) ---
  { code: 'zh-Hans', name: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'zh-Hant', name: 'Chinese (Traditional)', flag: '🇹🇼' },
  { code: 'zh-CN', name: 'Chinese (Simplified, China)', flag: '🇨🇳' },
  { code: 'zh-SG', name: 'Chinese (Simplified, Singapore)', flag: '🇸🇬' },
  { code: 'zh-TW', name: 'Chinese (Traditional, Taiwan)', flag: '🇹🇼' },
  { code: 'zh-HK', name: 'Chinese (Traditional, Hong Kong)', flag: '🇭🇰' },
  { code: 'yue-HK', name: 'Cantonese (Hong Kong)', flag: '🇭🇰' },
  { code: 'zh-MO', name: 'Chinese (Traditional, Macau)', flag: '🇲🇴' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },

  // --- Southeast Asia ---
  { code: 'id-ID', name: 'Indonesian', flag: '🇮🇩' },
  { code: 'jv-ID', name: 'Javanese', flag: '🇮🇩' },
  { code: 'su-ID', name: 'Sundanese', flag: '🇮🇩' },
  { code: 'ms-MY', name: 'Malay (Malaysia)', flag: '🇲🇾' },
  { code: 'ms-SG', name: 'Malay (Singapore)', flag: '🇸🇬' },
  { code: 'ms-BN', name: 'Malay (Brunei)', flag: '🇧🇳' },
  { code: 'vi-VN', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'th-TH', name: 'Thai', flag: '🇹🇭' },
  { code: 'km-KH', name: 'Khmer (Cambodia)', flag: '🇰🇭' },
  { code: 'lo-LA', name: 'Lao', flag: '🇱🇦' },

  // --- Philippines (Major Regional Languages) ---
  { code: 'bcl-PH', name: 'Central Bikol', flag: '🇵🇭' },
  { code: 'pam-PH', name: 'Kapampangan', flag: '🇵🇭' },
  { code: 'pag-PH', name: 'Pangasinan', flag: '🇵🇭' },
  { code: 'mnd-PH', name: 'Maguindanao', flag: '🇵🇭' },
  { code: 'mrw-PH', name: 'Maranao', flag: '🇵🇭' },
  { code: 'tsg-PH', name: 'Tausug', flag: '🇵🇭' },
  { code: 'cbk-PH', name: 'Chavacano', flag: '🇵🇭' },
  { code: 'bto-PH', name: 'Rinconada Bikol', flag: '🇵🇭' },
  { code: 'krj-PH', name: 'Kinaray-a', flag: '🇵🇭' },
  { code: 'akl-PH', name: 'Aklanon', flag: '🇵🇭' },
  { code: 'msb-PH', name: 'Masbateño', flag: '🇵🇭' },
  { code: 'sur-PH', name: 'Surigaonon', flag: '🇵🇭' },

  // --- Africa (Pan) ---
  { code: 'sw-KE', name: 'Swahili (Kenya)', flag: '🇰🇪' },
  { code: 'sw-TZ', name: 'Swahili (Tanzania)', flag: '🇹🇿' },
  { code: 'am-ET', name: 'Amharic', flag: '🇪🇹' },
  { code: 'ti-ER', name: 'Tigrinya (Eritrea)', flag: '🇪🇷' },
  { code: 'ti-ET', name: 'Tigrinya (Ethiopia)', flag: '🇪🇹' },
  { code: 'ha-NG', name: 'Hausa (Nigeria)', flag: '🇳🇬' },
  { code: 'yo-NG', name: 'Yoruba (Nigeria)', flag: '🇳🇬' },
  { code: 'ig-NG', name: 'Igbo (Nigeria)', flag: '🇳🇬' },
  { code: 'zu-ZA', name: 'Zulu (South Africa)', flag: '🇿🇦' },
  { code: 'xh-ZA', name: 'Xhosa (South Africa)', flag: '🇿🇦' },
  { code: 'st-LS', name: 'Sesotho', flag: '🇱🇸' },
  { code: 'sn-ZW', name: 'Shona', flag: '🇿🇼' },
  { code: 'so-SO', name: 'Somali', flag: '🇸🇴' },
  { code: 'rw-RW', name: 'Kinyarwanda', flag: '🇷🇼' },
  { code: 'rn-BI', name: 'Kirundi', flag: '🇧🇮' },
  { code: 'mg-MG', name: 'Malagasy', flag: '🇲🇬' },
  { code: 'ny-MW', name: 'Chichewa', flag: '🇲🇼' },
  { code: 'ts-ZA', name: 'Xitsonga', flag: '🇿🇦' },
  { code: 'tn-ZA', name: 'Setswana', flag: '🇿🇦' },
  { code: 'ff-SN', name: 'Fula (Pulaar / Fulfulde)', flag: '🇸🇳' },

  // --- Cameroon (Expanded) ---
  { code: 'wes-CM', name: 'Cameroon Pidgin', flag: '🇨🇲' },
  { code: 'ewo-CM', name: 'Ewondo', flag: '🇨🇲' },
  { code: 'dua-CM', name: 'Duala', flag: '🇨🇲' },
  { code: 'bas-CM', name: 'Basaa', flag: '🇨🇲' },
  { code: 'bum-CM', name: 'Bulu', flag: '🇨🇲' },
  { code: 'bkm-CM', name: 'Kom (Cameroon)', flag: '🇨🇲' },
  { code: 'fub-CM', name: 'Fulfulde (Cameroon)', flag: '🇨🇲' },

  // --- Americas (Non-English) ---
  { code: 'fr-HT', name: 'Haitian French', flag: '🇭🇹' },
  { code: 'ht-HT', name: 'Haitian Creole', flag: '🇭🇹' },
  { code: 'qu-PE', name: 'Quechua (Peru)', flag: '🇵🇪' },
  { code: 'gn-PY', name: 'Guarani (Paraguay)', flag: '🇵🇾' },
  { code: 'ay-BO', name: 'Aymara (Bolivia)', flag: '🇧🇴' },

  // --- East Africa / Horn ---
  { code: 'om-ET', name: 'Oromo (Ethiopia)', flag: '🇪🇹' },

  // --- Oceania ---
  { code: 'mi-NZ', name: 'Māori (New Zealand)', flag: '🇳🇿' },
  { code: 'sm-WS', name: 'Samoan', flag: '🇼🇸' },
  { code: 'to-TO', name: 'Tongan', flag: '🇹🇴' },
  { code: 'fj-FJ', name: 'Fijian', flag: '🇫🇯' },
  { code: 'tpi-PG', name: 'Tok Pisin', flag: '🇵🇬' },

  // --- Indigenous Americas (JW.org subset) ---
  { code: 'yua-MX', name: 'Maya (Yucatec)', flag: '🇲🇽' },
  { code: 'nah-MX', name: 'Nahuatl (Central)', flag: '🇲🇽' },
  { code: 'quc-GT', name: "K'iche'", flag: '🇬🇹' },
  { code: 'mam-GT', name: 'Mam', flag: '🇬🇹' },
  { code: 'kek-GT', name: "Q'eqchi'", flag: '🇬🇹' },
  { code: 'cak-GT', name: 'Kaqchikel', flag: '🇬🇹' },
  { code: 'zap-MX', name: 'Zapotec (Isthmus)', flag: '🇲🇽' },
  { code: 'mix-MX', name: 'Mixtec', flag: '🇲🇽' },
  { code: 'miq-NI', name: 'Miskito', flag: '🇳🇮' },
  { code: 'pap-CW', name: 'Papiamento', flag: '🇨🇼' },

  // --- African Languages (Expanded) ---
  { code: 'tw-GH', name: 'Twi', flag: '🇬🇭' },
  { code: 'ee-GH', name: 'Ewe', flag: '🇬🇭' },
  { code: 'ln-CD', name: 'Lingala', flag: '🇨🇩' },
  { code: 'lg-UG', name: 'Luganda', flag: '🇺🇬' },
  { code: 'ki-KE', name: 'Kikuyu', flag: '🇰🇪' },
  { code: 'bem-ZM', name: 'Bemba', flag: '🇿🇲' },
  
  // --- Asia / Other ---
  { code: 'hmn-CN', name: 'Hmong', flag: '🇨🇳' },
  { code: 'rom', name: 'Romani', flag: '🌍' },
  { code: 'szl-PL', name: 'Silesian', flag: '🇵🇱' },

  // --- Constructed / Other ---
  { code: 'eo', name: 'Esperanto', flag: '🌐' },
  { code: 'la', name: 'Latin', flag: '🌐' },

// --- JW.org Extended Languages ---
  { code: 'en', name: 'English', flag: '🌍' },
  { code: 'ar', name: 'العربية', flag: '🌍' },
  { code: 'el', name: 'Ελληνική', flag: '🌍' },
  { code: 'ja', name: '日本語', flag: '🌍' },
  { code: 'ko', name: '한국어', flag: '🌍' },
  { code: 'ru', name: 'русский', flag: '🌍' },
  { code: 'sn', name: 'Shona', flag: '🌍' },
  { code: 'sr-cyrl', name: 'српски (ћирилица)', flag: '🌍' },
  { code: 'sv', name: 'Svenska', flag: '🌍' },
  { code: 'ty', name: 'Tahiti', flag: '🌍' },
  { code: 'bci', name: 'Wawle', flag: '🌍' },
  { code: 'no', name: 'Norsk', flag: '🌍' },
  { code: 'da', name: 'Dansk', flag: '🌍' },
  { code: 'nl', name: 'Nederlands', flag: '🌍' },
  { code: 'is', name: 'íslenska', flag: '🌍' },
  { code: 'tl', name: 'Tagalog', flag: '🌍' },
  { code: 'ne', name: 'नेपाली', flag: '🌍' },
  { code: 'zpa', name: 'diitza', flag: '🌍' },
  { code: 'hu', name: 'magyar', flag: '🌍' },
  { code: 'fo', name: 'Føroyskt', flag: '🌍' },
  { code: 'sl', name: 'slovenščina', flag: '🌍' },
  { code: 'sg', name: 'Sango', flag: '🌍' },
  { code: 'hy', name: 'Հայերեն', flag: '🌍' },
  { code: 'kj', name: 'Oshikwanyama', flag: '🌍' },
  { code: 'guw', name: 'Gungbe', flag: '🌍' },
  { code: 'fi', name: 'suomi', flag: '🌍' },
  { code: 'sm', name: 'Faa-Samoa', flag: '🌍' },
  { code: 'xh', name: 'IsiXhosa', flag: '🌍' },
  { code: 'ceb', name: 'Cebuano', flag: '🌍' },
  { code: 'mg', name: 'Malagasy', flag: '🌍' },
  { code: 'efi', name: 'Efịk', flag: '🌍' },
  { code: 'sw', name: 'Kiswahili', flag: '🌍' },
  { code: 'ny', name: 'Chichewa', flag: '🌍' },
  { code: 'ilo', name: 'Iloko', flag: '🌍' },
  { code: 'ka', name: 'ქართული', flag: '🌍' },
  { code: 'ml', name: 'മലയാളം', flag: '🌍' },
  { code: 'ig', name: 'Igbo', flag: '🌍' },
  { code: 'gaa', name: 'Ga', flag: '🌍' },
  { code: 'ti', name: 'ትግርኛ', flag: '🌍' },
  { code: 'hil', name: 'Hiligaynon', flag: '🌍' },
  { code: 'loz', name: 'Silozi', flag: '🌍' },
  { code: 'tum', name: 'Chitumbuka', flag: '🌍' },
  { code: 'uz-cyrl', name: 'ўзбекча', flag: '🌍' },
  { code: 'run', name: 'Ikirundi', flag: '🌍' },
  { code: 'ts', name: 'Xitsonga', flag: '🌍' },
  { code: 'nso', name: 'Sepedi', flag: '🌍' },
  { code: 'ky', name: 'кыргыз', flag: '🌍' },
  { code: 'uk', name: 'українська', flag: '🌍' },
  { code: 'de', name: 'Deutsch', flag: '🌍' },
  { code: 'az', name: 'Azərbaycan', flag: '🌍' },
  { code: 'vi', name: 'Việt', flag: '🌍' },
  { code: 'cmn-hant', name: '中文繁體（國語）', flag: '🌍' },
  { code: 'az-cyrl', name: 'Aзәрбајҹан (кирил әлифбасы)', flag: '🌍' },
  { code: 'cs', name: 'čeština', flag: '🌍' },
  { code: 'zu', name: 'IsiZulu', flag: '🌍' },
  { code: 'it', name: 'Italiano', flag: '🌍' },
  { code: 'id', name: 'Indonesia', flag: '🌍' },
  { code: 'st', name: 'Sesotho (Lesotho)', flag: '🌍' },
  { code: 'ta', name: 'தமிழ்', flag: '🌍' },
  { code: 'si', name: 'සිංහල', flag: '🌍' },
  { code: 'ln', name: 'Lingala', flag: '🌍' },
  { code: 'bg', name: 'български', flag: '🌍' },
  { code: 'tr', name: 'Türkçe', flag: '🌍' },
  { code: 'th', name: 'ไทย', flag: '🌍' },
  { code: 'mt', name: 'Malti', flag: '🌍' },
  { code: 'hr', name: 'hrvatski', flag: '🌍' },
  { code: 'fr', name: 'Français', flag: '🌍' },
  { code: 'yo', name: 'Yorùbá', flag: '🌍' },
  { code: 'lv', name: 'latviešu', flag: '🌍' },
  { code: 'bem', name: 'Cibemba', flag: '🌍' },
  { code: 'mk', name: 'македонски', flag: '🌍' },
  { code: 'sk', name: 'slovenčina', flag: '🌍' },
  { code: 'ss', name: 'SiSwati', flag: '🌍' },
  { code: 'guc', name: 'Wayuunaiki', flag: '🌍' },
  { code: 've', name: 'Luvenda', flag: '🌍' },
  { code: 'pdt', name: 'Plautdietsch', flag: '🌍' },
  { code: 'kl', name: 'Kalaallisut', flag: '🌍' },
  { code: 'quy', name: 'Quechua (Ayacucho)', flag: '🌍' },
  { code: 'sr-latn', name: 'srpski (latinica)', flag: '🌍' },
  { code: 'he', name: 'עברית', flag: '🌍' },
  { code: 'srn', name: 'Sranantongo', flag: '🌍' },
  { code: 'quz', name: 'quechua (Cusco)', flag: '🌍' },
  { code: 'mr', name: 'मराठी', flag: '🌍' },
  { code: 'bn', name: 'বাংলা', flag: '🌍' },
  { code: 'af', name: 'Afrikaans', flag: '🌍' },
  { code: 'hi', name: 'हिंदी', flag: '🌍' },
  { code: 'pap', name: 'Papiamentu (Kòrsou)', flag: '🌍' },
  { code: 'nr', name: 'IsiNdebele', flag: '🌍' },
  { code: 'te', name: 'తెలుగు', flag: '🌍' },
  { code: 'qu', name: 'Quechua (Bolivia)', flag: '🌍' },
  { code: 'fa', name: 'فارسی', flag: '🌍' },
  { code: 'que', name: 'Quechua (Ancash)', flag: '🌍' },
  { code: 'ug-cyrl', name: 'Уйғур (кирилл йезиғи)', flag: '🌍' },
  { code: 'ncj', name: 'náhuatl del norte de Puebla', flag: '🌍' },
  { code: 'ach', name: 'Acholi', flag: '🌍' },
  { code: 'lo', name: 'ລາວ', flag: '🌍' },
  { code: 'ay', name: 'Aymara', flag: '🌍' },
  { code: 'fj', name: 'vakaViti', flag: '🌍' },
  { code: 'uz-latn', name: 'o‘zbekcha (lotincha)', flag: '🌍' },
  { code: 'vmw', name: 'Emakhuwa', flag: '🌍' },
  { code: 'seh', name: 'Cisena', flag: '🌍' },
  { code: 'tpi', name: 'Tok Pisin', flag: '🌍' },
  { code: 'mh', name: 'Kajin M̦ajel̦', flag: '🌍' },
  { code: 'ee', name: 'Eʋegbe', flag: '🌍' },
  { code: 'lgg', name: 'Lugbara', flag: '🌍' },
  { code: 'wo', name: 'Wolof', flag: '🌍' },
  { code: 'mn', name: 'монгол', flag: '🌍' },
  { code: 'mfe', name: 'Kreol Morisien', flag: '🌍' },
  { code: 'ada', name: 'Dangme', flag: '🌍' },
  { code: 'pau', name: 'Palauan', flag: '🌍' },
  { code: 'ht', name: 'Kreyòl ayisyen', flag: '🌍' },
  { code: 'nzi', name: 'Nzema', flag: '🌍' },
  { code: 'kwy', name: 'Kikongo', flag: '🌍' },
  { code: 'gug', name: 'guarani', flag: '🌍' },
  { code: 'sid', name: 'Sidaamu Afoo', flag: '🌍' },
  { code: 'tg', name: 'тоҷикӣ', flag: '🌍' },
  { code: 'om', name: 'Afaan Oromoo', flag: '🌍' },
  { code: 'lg', name: 'Luganda', flag: '🌍' },
  { code: 'kos', name: 'Kosraean', flag: '🌍' },
  { code: 'zai', name: 'diidxazá', flag: '🌍' },
  { code: 'pap-x-paa', name: 'Papiamento (Aruba)', flag: '🌍' },
  { code: 'mos', name: 'Moore', flag: '🌍' },
  { code: 'kk', name: 'қазақ', flag: '🌍' },
  { code: 'kab', name: 'Taqbaylit', flag: '🌍' },
  { code: 'ngu', name: 'náhuatl de guerrero', flag: '🌍' },
  { code: 'ho', name: 'Hiri Motu', flag: '🌍' },
  { code: 'xmv', name: 'Tankarana', flag: '🌍' },
  { code: 'to', name: 'Faka-Tonga', flag: '🌍' },
  { code: 'umb', name: 'Umbundu', flag: '🌍' },
  { code: 'quc', name: 'quiché', flag: '🌍' },
  { code: 'tk-cyrl', name: 'түркмен (кириллица)', flag: '🌍' },
  { code: 'hmn', name: 'Hmoob Dawb', flag: '🌍' },
  { code: 'nyn', name: 'Runyankore', flag: '🌍' },
  { code: 'bi', name: 'Bislama', flag: '🌍' },
  { code: 'cat', name: 'català', flag: '🌍' },
  { code: 'kmb', name: 'Kimbundu', flag: '🌍' },
  { code: 'gil', name: 'Kiribati', flag: '🌍' },
  { code: 'ngl', name: 'Elomwe', flag: '🌍' },
  { code: 'kmr-cyrl', name: 'К′öрди Кöрманщи (Кирили)', flag: '🌍' },
  { code: 'ki', name: 'Gĩkũyũ', flag: '🌍' },
  { code: 'luo', name: 'Dholuo', flag: '🌍' },
  { code: 'crs', name: 'Kreol Seselwa', flag: '🌍' },
  { code: 'kam', name: 'Kikamba', flag: '🌍' },
  { code: 'wls', name: 'Faka\'uvea', flag: '🌍' },
  { code: 'tiv', name: 'Tiv', flag: '🌍' },
  { code: 'ha', name: 'Hausa', flag: '🌍' },
  { code: 'os', name: 'ирон', flag: '🌍' },
  { code: 'tdt', name: 'Tetun Dili', flag: '🌍' },
  { code: 'yua', name: 'maaya', flag: '🌍' },
  { code: 'pon', name: 'Lokaiahn Pohnpei', flag: '🌍' },
  { code: 'hyw', name: 'Արեւմտահայերէն', flag: '🌍' },
  { code: 'bm', name: 'Bamanankan', flag: '🌍' },
  { code: 'tt', name: 'татар', flag: '🌍' },
  { code: 'teo', name: 'Ateso', flag: '🌍' },
  { code: 'lu', name: 'Kiluba', flag: '🌍' },
  { code: 'war', name: 'Waray-Waray', flag: '🌍' },
  { code: 'pag', name: 'Pangasinan', flag: '🌍' },
  { code: 'bcl', name: 'Bicol', flag: '🌍' },
  { code: 'lua', name: 'Tshiluba', flag: '🌍' },
  { code: 'rw', name: 'Ikinyarwanda', flag: '🌍' },
  { code: 'kg', name: 'Kikongo (Rép. dém. du congo)', flag: '🌍' },
  { code: 'maz', name: 'jñatrjo', flag: '🌍' },
  { code: 'nv', name: 'Diné Bizaad', flag: '🌍' },
  { code: 'nch', name: 'náhuatl de la huasteca', flag: '🌍' },
  { code: 'tog', name: 'Chitonga (Malawi)', flag: '🌍' },
  { code: 'swc', name: 'Kiswahili (Congo)', flag: '🌍' },
  { code: 'cy', name: 'Cymraeg', flag: '🌍' },
  { code: 'am', name: 'አማርኛ', flag: '🌍' },
  { code: 'km', name: 'ខ្មែរ', flag: '🌍' },
  { code: 'kn', name: 'ಕನ್ನಡ', flag: '🌍' },
  { code: 'my', name: 'မြန်မာ', flag: '🌍' },
  { code: 'tn', name: 'Setswana', flag: '🌍' },
  { code: 'toi', name: 'Chitonga', flag: '🌍' },
  { code: 'rtm', name: 'Rotuạm ta', flag: '🌍' },
  { code: 'yap', name: 'Waab', flag: '🌍' },
  { code: 'tyv', name: 'тыва', flag: '🌍' },
  { code: 'hz', name: 'Otjiherero', flag: '🌍' },
  { code: 'as', name: 'অসমীয়া', flag: '🌍' },
  { code: 'zne', name: 'Zande', flag: '🌍' },
  { code: 'ttj', name: 'Rutoro', flag: '🌍' },
  { code: 'tvl', name: 'Tuvalu', flag: '🌍' },
  { code: 'ng', name: 'Oshindonga', flag: '🌍' },
  { code: 'cv', name: 'чӑвашла', flag: '🌍' },
  { code: 'niu', name: 'Faka-Niue', flag: '🌍' },
  { code: 'chk', name: 'Chuuk', flag: '🌍' },
  { code: 'bin', name: 'Edo', flag: '🌍' },
  { code: 'nd', name: 'Ndebele (Zimbabwe)', flag: '🌍' },
  { code: 'bas', name: 'Basaa (Kamerun)', flag: '🌍' },
  { code: 'gkn', name: 'Gokana', flag: '🌍' },
  { code: 'dga', name: 'Dagaare', flag: '🌍' },
  { code: 'bba', name: 'Baatɔnum', flag: '🌍' },
  { code: 'ckb', name: 'کوردی سۆرانی', flag: '🌍' },
  { code: 'wal', name: 'Wolayttattuwa', flag: '🌍' },
  { code: 'dua', name: 'Douala', flag: '🌍' },
  { code: 'fon', name: 'Fɔngbe', flag: '🌍' },
  { code: 'bum', name: 'Bulu', flag: '🌍' },
  { code: 'nya', name: 'Cinyanja', flag: '🌍' },
  { code: 'whg', name: 'Jiwaka Yu', flag: '🌍' },
  { code: 'rmn-x-rm', name: 'romane (Makedonija)', flag: '🌍' },
  { code: 'lb', name: 'Lëtzebuergesch', flag: '🌍' },
  { code: 'kck-x-kl', name: 'Kalanga (Botswana)', flag: '🌍' },
  { code: 'kbd', name: 'адыгэбзэ', flag: '🌍' },
  { code: 'mni', name: 'মৈতৈলোন্', flag: '🌍' },
  { code: 'dyu', name: 'Jula', flag: '🌍' },
  { code: 'os-x-dgr', name: 'дигорон', flag: '🌍' },
  { code: 'gui', name: 'Guaraní boliviano', flag: '🌍' },

  // --- JW.org Extended Languages (578 additional) ---
  { code: 'ab', name: 'Abkhazian', flag: '🌍' },
  { code: 'fub', name: 'Adamawa Fulfulde', flag: '🌍' },
  { code: 'aa', name: 'Afar', flag: '🌍' },
  { code: 'agr', name: 'Aguaruna', flag: '🌍' },
  { code: 'ake', name: 'Akawaio', flag: '🌍' },
  { code: 'bss', name: 'Akoose', flag: '🌍' },
  { code: 'alz', name: 'Alur', flag: '🌍' },
  { code: 'amc', name: 'Amahuaca', flag: '🌍' },
  { code: 'zpo', name: 'Amatlán Zapotec', flag: '🌍' },
  { code: 'qva', name: 'Ambo-Pasco Quechua', flag: '🌍' },
  { code: 'ami', name: 'Amis', flag: '🌍' },
  { code: 'grc', name: 'Ancient Greek', flag: '🌍' },
  { code: 'yli', name: 'Angguruk Yali', flag: '🌍' },
  { code: 'aui', name: 'Anuki', flag: '🌍' },
  { code: 'ajg', name: 'Aja (Benin)', flag: '🌍' },
  { code: 'aii', name: 'Assyrian Neo-Aramaic', flag: '🌍' },
  { code: 'awa', name: 'Awadhi', flag: '🌍' },
  { code: 'azb', name: 'South Azerbaijani', flag: '🌍' },
  { code: 'kbr', name: 'Kafa', flag: '🌍' },
  { code: 'shp', name: 'Shipibo-Conibo', flag: '🌍' },
  { code: 'ura', name: 'Urarina', flag: '🌍' },
  { code: 'sah', name: 'Yakut', flag: '🌍' },
  { code: 'yaa', name: 'Yaminahua', flag: '🌍' },
  { code: 'dje', name: 'Zarma', flag: '🌍' },
  { code: 'zyp', name: 'Zhuang', flag: '🌍' },
];
