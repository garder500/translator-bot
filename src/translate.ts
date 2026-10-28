export interface Translation {
  text: string;
  /** Langue source détectée (code court, ex. "es"), si connue. */
  detectedLanguage: string | null;
  provider: string;
}

interface Provider {
  name: string;
  /** Taille maximale (en caractères) d'un morceau accepté par l'API. */
  maxChunk: number;
  translate(text: string, target: string): Promise<{ text: string; detected: string | null }>;
}

const REQUEST_TIMEOUT_MS = 10_000;
const CACHE_MAX = 500;
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Découpe `text` en morceaux <= `max`, en préférant les fins de ligne puis de phrase puis les espaces. */
export function chunkText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = Math.max(window.lastIndexOf("\n"), -1);
    if (cut < max * 0.5) {
      const sentence = Math.max(
        window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "),
        window.lastIndexOf("。") , window.lastIndexOf("！"), window.lastIndexOf("？"),
      );
      if (sentence >= max * 0.5) cut = sentence + 1;
    }
    if (cut < max * 0.5) cut = window.lastIndexOf(" ");
    if (cut < max * 0.5) {
      cut = max; // pas de séparateur raisonnable : coupe franche
      const prev = window.charCodeAt(cut - 1);
      if (prev >= 0xd800 && prev <= 0xdbff) cut--; // ne pas couper une paire surrogate
    }
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.length) chunks.push(rest);
  return chunks;
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** API publique de Google Translate (sans clé, détection automatique de la langue source). */
const google: Provider = {
  name: "Google Translate",
  maxChunk: 1800,
  async translate(text, target) {
    const body = new URLSearchParams({ client: "gtx", sl: "auto", tl: target, dt: "t", q: text });
    const data = await fetchJson("https://translate.googleapis.com/translate_a/single", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
    });
    if (!Array.isArray(data?.[0])) throw new Error("réponse inattendue");
    const out = (data[0] as unknown[][]).map((seg) => String(seg?.[0] ?? "")).join("");
    return { text: out, detected: typeof data[2] === "string" ? data[2] : null };
  },
};

/** MyMemory : secours gratuit et sans clé (quota journalier plus faible, 500 octets par requête). */
const myMemory: Provider = {
  name: "MyMemory",
  maxChunk: 120, // 500 octets max par requête : 120 caractères * 4 octets UTF-8 au pire
  async translate(text, target) {
    const lang = target === "iw" ? "he" : target;
    const params = new URLSearchParams({ q: text, langpair: `Autodetect|${lang}` });
    if (process.env.MYMEMORY_EMAIL) params.set("de", process.env.MYMEMORY_EMAIL);
    const data = await fetchJson(`https://api.mymemory.translated.net/get?${params}`);
    if (data?.responseStatus !== 200 || typeof data?.responseData?.translatedText !== "string") {
      throw new Error(String(data?.responseDetails || "réponse inattendue"));
    }
    return { text: data.responseData.translatedText, detected: data.responseData.detectedLanguage ?? null };
  },
};

const PROVIDERS: Provider[] = [google, myMemory];

const cache = new Map<string, { value: Translation; expires: number }>();
const inflight = new Map<string, Promise<Translation>>();

function cacheGet(key: string): Translation | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  cache.delete(key); // ré-insère pour garder l'ordre LRU
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key: string, value: Translation) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
}

async function translateWith(provider: Provider, text: string, target: string): Promise<Translation> {
  const parts: string[] = [];
  let detected: string | null = null;
  for (const chunk of chunkText(text, provider.maxChunk)) {
    if (!chunk.trim()) {
      parts.push(chunk);
      continue;
    }
    const r = await provider.translate(chunk, target);
    parts.push(r.text);
    detected ??= r.detected;
  }
  return { text: parts.join(""), detectedLanguage: detected, provider: provider.name };
}

/** Traduit `text` vers `target`, avec cache, dédoublonnage des requêtes identiques et repli entre fournisseurs. */
export function translate(text: string, target: string): Promise<Translation> {
  const key = `${target}\u0000${text}`;
  const cached = cacheGet(key);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(key);
  if (pending) return pending;

  const run = (async () => {
    let lastError: unknown;
    for (const provider of PROVIDERS) {
      try {
        const result = await translateWith(provider, text, target);
        cacheSet(key, result);
        return result;
      } catch (err) {
        lastError = err;
        console.warn(`[translate] ${provider.name} a échoué :`, err instanceof Error ? err.message : err);
      }
    }
    throw new Error(`Tous les services de traduction ont échoué (${lastError instanceof Error ? lastError.message : lastError})`);
  })().finally(() => inflight.delete(key));

  inflight.set(key, run);
  return run;
}

/** Compare deux codes de langue en ignorant la région (zh-CN ~ zh, iw ~ he). */
export function sameLanguage(a: string | null, b: string): boolean {
  if (!a) return false;
  const norm = (c: string) => {
    const base = c.toLowerCase().split(/[-_]/)[0]!;
    return base === "he" ? "iw" : base === "nb" || base === "nn" ? "no" : base;
  };
  return norm(a) === norm(b);
}
