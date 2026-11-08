import { describe, expect, it } from "vitest";
import { GET as getTemplate } from "@/app/api/card-import-template/csv/route";
import { parseCardCsv, parseCardCsvFile } from "@/lib/csv";

const header = "kanji,hiragana,meaning_vi,example_ja,example_vi";
const row = '学ぶ,まなぶ,"học, học hỏi",毎日、日本語を学びます。,Tôi học tiếng Nhật mỗi ngày.';

describe("CSV card import", () => {
  it("preserves Japanese and Vietnamese with BOM, CRLF, quoted commas, escaped quotes and multiline fields", () => {
    const result = parseCardCsv(`\uFEFF${header}\r\n${row}\r\n\r\n,,,,\r\n読む,よむ,đọc,"「本」を\n読みます。","Tôi đọc ""sách""."\r\n`);
    expect(result).toEqual({ rows: [
      { kanji: "学ぶ", hiragana: "まなぶ", meaning_vi: "học, học hỏi", example_ja: "毎日、日本語を学びます。", example_vi: "Tôi học tiếng Nhật mỗi ngày." },
      { kanji: "読む", hiragana: "よむ", meaning_vi: "đọc", example_ja: "「本」を\n読みます。", example_vi: 'Tôi đọc "sách".' },
    ], errors: [] });
  });

  it.each([
    ["wrong headers", `word,hiragana,meaning_vi,example_ja,example_vi\n${row}`, 1, "Hàng đầu phải gồm đúng 5 tiêu đề theo thứ tự: kanji, hiragana, meaning_vi, example_ja, example_vi"],
    ["extra columns", `${header}\n${row},extra`, 2, "Mỗi hàng phải có đúng 5 cột, phân cách bằng dấu phẩy"],
    ["missing columns", `${header}\n学ぶ,まなぶ,học`, 2, "Mỗi hàng phải có đúng 5 cột, phân cách bằng dấu phẩy"],
    ["a missing required value after a valid and blank row", `${header}\n${row}\n\n書く,,viết,手紙を書きます。,Tôi viết thư.`, 4, "Thiếu hiragana"],
    ["a missing value after a multiline Windows CSV record", `${header}\r\n読む,よむ,đọc,"本を\r\n読みます。",Tôi đọc sách.\r\n書く,,viết,手紙を書きます。,Tôi viết thư.`, 4, "Thiếu hiragana"],
    ["only headers and blank records", `${header}\n\n,,,,`, 2, "Chưa có thẻ nào. Nhập dữ liệu sau hàng tiêu đề"],
    ["empty text", " \n\t", 1, "Nội dung CSV đang trống"],
  ])("rejects the whole input for %s and identifies the source line", (_name, text, line, message) => {
    expect(parseCardCsv(text)).toEqual({ rows: [], errors: [{ row: line, message }] });
  });

  it("rejects broken quoting without returning the preceding valid cards", () => {
    const result = parseCardCsv(`${header}\n${row}\n読む,よむ,đọc,"本を読みます。,Tôi đọc sách.`);
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([{ row: 3, message: 'CSV không hợp lệ. Đặt nội dung có dấu phẩy hoặc xuống dòng trong dấu ngoặc kép; viết dấu " trong ô thành ""' }]);
  });

  it("accepts 500 cards and rejects 501 cards", () => {
    const accepted = parseCardCsv(`${header}\n${Array(500).fill(row).join("\n")}`);
    expect(accepted.rows).toHaveLength(500);
    expect(accepted.errors).toEqual([]);
    expect(parseCardCsv(`${header}\n${Array(501).fill(row).join("\n")}`)).toEqual({ rows: [], errors: [{ row: 502, message: "Tối đa 500 thẻ mỗi lần nhập" }] });
  });

  it("enforces the byte limit for pasted multibyte text and uploaded files", async () => {
    expect(parseCardCsv("学".repeat(250_001))).toEqual({ rows: [], errors: [{ row: 1, message: "Nội dung CSV vượt quá 750 KB" }] });
    expect(await parseCardCsvFile(new File(["a".repeat(750_001)], "cards.csv"))).toEqual({ rows: [], errors: [{ row: 1, message: "Tệp vượt quá 750 KB" }] });
  });

  it("rejects the wrong file type, an empty file, and non-UTF-8 bytes", async () => {
    expect(await parseCardCsvFile(new File([row], "cards.xlsx"))).toEqual({ rows: [], errors: [{ row: 1, message: "Chỉ chấp nhận tệp .csv" }] });
    expect(await parseCardCsvFile(new File([], "cards.csv"))).toEqual({ rows: [], errors: [{ row: 1, message: "Tệp CSV đang trống" }] });
    expect(await parseCardCsvFile(new File([new Uint8Array([0x82, 0xa0])], "cards.csv"))).toEqual({ rows: [], errors: [{ row: 1, message: "Không đọc được tệp CSV. Hãy lưu dưới dạng CSV UTF-8 và thử lại" }] });
  });

  it("provides a downloadable UTF-8 template accepted by the file importer", async () => {
    const response = getTemplate();
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(await parseCardCsvFile(new File([await response.arrayBuffer()], "mau-nhap-the.CSV"))).toEqual({
      rows: [{ kanji: "学ぶ", hiragana: "まなぶ", meaning_vi: "học, học hỏi", example_ja: "毎日、日本語を学びます。", example_vi: "Tôi học tiếng Nhật mỗi ngày." }], errors: [],
    });
  });
});
