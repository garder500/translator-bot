import { describe, expect, test } from "bun:test";
import { COUNTRY_LANGUAGE, flagToCountry, flagToLanguage } from "../src/flags.ts";

describe("flags", () => {
  test("détecte les drapeaux de pays", () => {
    expect(flagToCountry("🇫🇷")).toBe("FR");
    expect(flagToCountry("🇪🇸")).toBe("ES");
    expect(flagToCountry("🇯🇵")).toBe("JP");
  });
  test("ignore ce qui n'est pas un drapeau de pays", () => {
    for (const e of ["👍", "😀", "🏳️", "🏴‍☠️", "🇫", "🇫🇷🇪🇸", "A", "", null, undefined]) {
      expect(flagToCountry(e as string)).toBeNull();
    }
  });
  test("associe la langue", () => {
    expect(flagToLanguage("🇫🇷")).toEqual({ country: "FR", language: "fr" });
    expect(flagToLanguage("🇬🇧")?.language).toBe("en");
    expect(flagToLanguage("🇨🇳")?.language).toBe("zh-CN");
    expect(flagToLanguage("🇮🇱")?.language).toBe("iw");
  });
  test("les drapeaux courants sont couverts", () => {
    for (const cc of ["FR","GB","US","ES","DE","IT","PT","BR","JP","KR","CN","RU","SA","TR","NL","PL","UA","IN","MX"]) {
      expect(COUNTRY_LANGUAGE[cc]).toBeTruthy();
    }
  });
});
