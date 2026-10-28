/** Code pays ISO 3166-1 alpha-2 -> langue principale (codes acceptés par Google Translate). */
export const COUNTRY_LANGUAGE: Record<string, string> = {
  AC: "en", AD: "ca", AE: "ar", AF: "ps", AG: "en", AI: "en", AL: "sq", AM: "hy",
  AO: "pt", AQ: "en", AR: "es", AS: "en", AT: "de", AU: "en", AW: "nl", AX: "sv",
  AZ: "az", BA: "bs", BB: "en", BD: "bn", BE: "nl", BF: "fr", BG: "bg", BH: "ar",
  BI: "fr", BJ: "fr", BL: "fr", BM: "en", BN: "ms", BO: "es", BQ: "nl", BR: "pt",
  BS: "en", BT: "dz", BV: "no", BW: "en", BY: "be", BZ: "en", CA: "en", CC: "en",
  CD: "fr", CF: "fr", CG: "fr", CH: "de", CI: "fr", CK: "en", CL: "es", CM: "fr",
  CN: "zh-CN", CO: "es", CP: "fr", CR: "es", CU: "es", CV: "pt", CW: "nl", CX: "en",
  CY: "el", CZ: "cs", DE: "de", DG: "en", DJ: "fr", DK: "da", DM: "en", DO: "es",
  DZ: "ar", EA: "es", EC: "es", EE: "et", EG: "ar", EH: "ar", ER: "ti", ES: "es",
  ET: "am", EU: "en", FI: "fi", FJ: "en", FK: "en", FM: "en", FO: "da", FR: "fr",
  GA: "fr", GB: "en", GD: "en", GE: "ka", GF: "fr", GG: "en", GH: "en", GI: "en",
  GL: "da", GM: "en", GN: "fr", GP: "fr", GQ: "es", GR: "el", GS: "en", GT: "es",
  GU: "en", GW: "pt", GY: "en", HK: "zh-TW", HM: "en", HN: "es", HR: "hr", HT: "ht",
  HU: "hu", IC: "es", ID: "id", IE: "ga", IL: "iw", IM: "en", IN: "hi", IO: "en",
  IQ: "ar", IR: "fa", IS: "is", IT: "it", JE: "en", JM: "en", JO: "ar", JP: "ja",
  KE: "sw", KG: "ky", KH: "km", KI: "en", KM: "ar", KN: "en", KP: "ko", KR: "ko",
  KW: "ar", KY: "en", KZ: "kk", LA: "lo", LB: "ar", LC: "en", LI: "de", LK: "si",
  LR: "en", LS: "st", LT: "lt", LU: "lb", LV: "lv", LY: "ar", MA: "ar", MC: "fr",
  MD: "ro", ME: "sr", MF: "fr", MG: "mg", MH: "en", MK: "mk", ML: "fr", MM: "my",
  MN: "mn", MO: "zh-TW", MP: "en", MQ: "fr", MR: "ar", MS: "en", MT: "mt", MU: "fr",
  MV: "dv", MW: "ny", MX: "es", MY: "ms", MZ: "pt", NA: "en", NC: "fr", NE: "fr",
  NF: "en", NG: "en", NI: "es", NL: "nl", NO: "no", NP: "ne", NR: "en", NU: "en",
  NZ: "en", OM: "ar", PA: "es", PE: "es", PF: "fr", PG: "en", PH: "tl", PK: "ur",
  PL: "pl", PM: "fr", PN: "en", PR: "es", PS: "ar", PT: "pt", PW: "en", PY: "es",
  QA: "ar", RE: "fr", RO: "ro", RS: "sr", RU: "ru", RW: "rw", SA: "ar", SB: "en",
  SC: "fr", SD: "ar", SE: "sv", SG: "en", SH: "en", SI: "sl", SJ: "no", SK: "sk",
  SL: "en", SM: "it", SN: "fr", SO: "so", SR: "nl", SS: "en", ST: "pt", SV: "es",
  SX: "nl", SY: "ar", SZ: "en", TA: "en", TC: "en", TD: "fr", TF: "fr", TG: "fr",
  TH: "th", TJ: "tg", TK: "en", TL: "pt", TM: "tk", TN: "ar", TO: "en", TR: "tr",
  TT: "en", TV: "en", TW: "zh-TW", TZ: "sw", UA: "uk", UG: "en", UM: "en", UN: "en",
  US: "en", UY: "es", UZ: "uz", VA: "it", VC: "en", VE: "es", VG: "en", VI: "en",
  VN: "vi", VU: "fr", WF: "fr", WS: "sm", XK: "sq", YE: "ar", YT: "fr", ZA: "af",
  ZM: "en", ZW: "en",
};

const REGIONAL_INDICATOR_A = 0x1f1e6;
const REGIONAL_INDICATOR_Z = 0x1f1ff;

/**
 * Renvoie le code pays ISO (ex. "FR") si `emoji` est exactement un drapeau de pays
 * (deux « regional indicators »), sinon null.
 */
export function flagToCountry(emoji: string | null | undefined): string | null {
  if (!emoji) return null;
  const points = Array.from(emoji, (c) => c.codePointAt(0)!);
  if (points.length !== 2) return null;
  const [a, b] = points as [number, number];
  const inRange = (p: number) => p >= REGIONAL_INDICATOR_A && p <= REGIONAL_INDICATOR_Z;
  if (!inRange(a) || !inRange(b)) return null;
  return String.fromCharCode(65 + a - REGIONAL_INDICATOR_A, 65 + b - REGIONAL_INDICATOR_A);
}

/** Langue cible associée à un emoji de drapeau, ou null si ce n'est pas un drapeau géré. */
export function flagToLanguage(emoji: string | null | undefined): { country: string; language: string } | null {
  const country = flagToCountry(emoji);
  if (!country) return null;
  const language = COUNTRY_LANGUAGE[country];
  return language ? { country, language } : null;
}
