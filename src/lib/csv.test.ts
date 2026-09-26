import { describe, expect, it } from "vitest";
import { parseCardCsv } from "@/lib/csv";

describe("parseCardCsv", () => {
  it("parses quoted commas and skips blank lines", () => {
    const result = parseCardCsv('kanji,hiragana,meaning_vi,example_ja,example_vi\n学ぶ,まなぶ,"học, học hỏi",毎日学びます。,Tôi học mỗi ngày.\n\n');
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].meaning_vi).toBe("học, học hỏi");
  });

  it("rejects an unexpected header without importing partial data", () => {
    const result = parseCardCsv("word,reading,meaning,ja,vi\n学ぶ,まなぶ,học,例,Ví dụ");
    expect(result.rows).toEqual([]);
    expect(result.errors[0].message).toContain("Header phải là");
  });

  it("reports the source line for an invalid card", () => {
    const result = parseCardCsv("kanji,hiragana,meaning_vi,example_ja,example_vi\n学ぶ,,học,例,Ví dụ");
    expect(result.errors[0].line).toBe(2);
  });
});

