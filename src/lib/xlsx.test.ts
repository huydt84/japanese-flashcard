import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { GET as getTemplate } from "@/app/api/card-import-template/route";
import { parseCardXlsx } from "@/lib/xlsx";

async function workbookFile(rows: unknown[][], name = "cards.xlsx") {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Thẻ học");
  rows.forEach((row) => sheet.addRow(row as ExcelJS.CellValue[]));
  const bytes = await workbook.xlsx.writeBuffer();
  return new File([new Uint8Array(bytes)], name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const validRow = ["学ぶ", "まなぶ", "học, học hỏi", "毎日、日本語を学びます。", "Tôi học tiếng Nhật mỗi ngày."];
const expectedHeaders = ["kanji", "hiragana", "meaning_vi", "example_ja", "example_vi"];

describe("Excel card import", () => {
  it("reads the fixed columns and skips an empty row", async () => {
    const file = await workbookFile([expectedHeaders, validRow, [], ["食べる", "たべる", "ăn", "朝ごはんを食べます。", "Tôi ăn sáng."]]);
    const result = await parseCardXlsx(file);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { kanji: "学ぶ", hiragana: "まなぶ", meaning_vi: "học, học hỏi", example_ja: "毎日、日本語を学びます。", example_vi: "Tôi học tiếng Nhật mỗi ngày." },
      { kanji: "食べる", hiragana: "たべる", meaning_vi: "ăn", example_ja: "朝ごはんを食べます。", example_vi: "Tôi ăn sáng." },
    ]);
  });

  it("rejects the whole workbook and identifies the invalid spreadsheet row", async () => {
    const file = await workbookFile([expectedHeaders, validRow, ["食べる", "", "ăn", "朝ごはんを食べます。", "Tôi ăn sáng."]]);
    const result = await parseCardXlsx(file);
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([{ row: 3, message: "Thiếu hiragana" }]);
  });

  it("rejects a wrong header and formulas", async () => {
    const wrongHeader = await parseCardXlsx(await workbookFile([["word", ...expectedHeaders.slice(1)], validRow]));
    expect(wrongHeader.rows).toEqual([]);
    expect(wrongHeader.errors).toEqual([{ row: 1, message: "Hàng 1 phải gồm đúng 5 tiêu đề theo thứ tự: kanji, hiragana, meaning_vi, example_ja, example_vi" }]);

    const formula = await parseCardXlsx(await workbookFile([expectedHeaders, ["学ぶ", { formula: '"まなぶ"', result: "まなぶ" }, ...validRow.slice(2)]]));
    expect(formula.rows).toEqual([]);
    expect(formula.errors[0]).toEqual({ row: 2, message: "Các ô phải là văn bản; không dùng số, ngày hoặc công thức" });
  });

  it("rejects a renamed non-Excel file", async () => {
    const result = await parseCardXlsx(new File(["not a workbook"], "cards.xlsx"));
    expect(result.rows).toEqual([]);
    expect(result.errors[0].message).toContain("không phải Excel");
    expect((await parseCardXlsx(new File(["anything"], "cards.csv"))).errors[0].message).toContain(".xlsx");
  });

  it("provides a template that the importer accepts", async () => {
    const response = await getTemplate();
    const file = new File([await response.arrayBuffer()], "mau-nhap-the.xlsx");
    const result = await parseCardXlsx(file);
    expect(response.headers.get("content-type")).toContain("spreadsheetml.sheet");
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([{ kanji: "学ぶ", hiragana: "まなぶ", meaning_vi: "học, học hỏi", example_ja: "毎日、日本語を学びます。", example_vi: "Tôi học tiếng Nhật mỗi ngày." }]);
  });
});
