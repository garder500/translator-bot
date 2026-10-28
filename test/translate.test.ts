import { afterEach, describe, expect, test } from "bun:test";
import { chunkText, sameLanguage, translate } from "../src/translate.ts";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

describe("chunkText", () => {
  test("ne coupe pas un texte court", () => expect(chunkText("salut", 10)).toEqual(["salut"]));
  test("respecte la taille max et conserve tout le texte", () => {
    const text = ("Une phrase assez longue. ".repeat(200)).trim();
    const chunks = chunkText(text, 300);
    expect(chunks.every((c) => c.length <= 300)).toBe(true);
    expect(chunks.join("")).toBe(text);
  });
  test("coupe franchement un mot géant", () => {
    const chunks = chunkText("x".repeat(1000), 400);
    expect(chunks.join("")).toBe("x".repeat(1000));
    expect(chunks.every((c) => c.length <= 400)).toBe(true);
  });
});

describe("sameLanguage", () => {
  test("ignore la région et les alias", () => {
    expect(sameLanguage("zh-CN", "zh-TW")).toBe(true);
    expect(sameLanguage("he", "iw")).toBe(true);
    expect(sameLanguage("es", "fr")).toBe(false);
    expect(sameLanguage(null, "fr")).toBe(false);
  });
});

describe("translate", () => {
  test("parse la réponse Google et met en cache", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return Response.json([[["Bonjour ", "Hola "], ["le monde", "mundo"]], null, "es"]);
    }) as unknown as typeof fetch;
    const a = await translate("Hola mundo", "fr");
    const b = await translate("Hola mundo", "fr");
    expect(a).toMatchObject({ text: "Bonjour le monde", detectedLanguage: "es", provider: "Google Translate" });
    expect(b).toEqual(a);
    expect(calls).toBe(1);
  });
  test("bascule sur MyMemory si Google échoue", async () => {
    globalThis.fetch = (async (url: string | URL | Request) => {
      if (String(url).includes("googleapis")) return new Response("no", { status: 429 });
      return Response.json({ responseStatus: 200, responseData: { translatedText: "Salut", detectedLanguage: "en" } });
    }) as unknown as typeof fetch;
    const r = await translate("Hello fallback", "fr");
    expect(r).toMatchObject({ text: "Salut", provider: "MyMemory" });
  });
  test("lève une erreur si tout échoue", async () => {
    globalThis.fetch = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    await expect(translate("Hello fail", "fr")).rejects.toThrow();
  });
});

describe("chunkText (cas Unicode)", () => {
  test("ne coupe pas une paire surrogate", () => {
    const text = "😀".repeat(300);
    const chunks = chunkText(text, 101); // taille impaire : une coupe franche tomberait au milieu d'un emoji
    expect(chunks.join("")).toBe(text);
    for (const c of chunks) expect(c).not.toMatch(/[\ud800-\udbff]$|^[\udc00-\udfff]/);
  });
  test("coupe sur la ponctuation CJK", () => {
    const text = "これは文です。".repeat(50);
    const chunks = chunkText(text, 100);
    expect(chunks.join("")).toBe(text);
    expect(chunks.slice(0, -1).every((c) => c.endsWith("。"))).toBe(true);
  });
});
