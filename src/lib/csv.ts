import { cardSchema } from "@/lib/validation";

export const CARD_CSV_HEADERS = [
  "kanji",
  "hiragana",
  "meaning_vi",
  "example_ja",
  "example_vi",
] as const;

export type CardCsvRow = Record<(typeof CARD_CSV_HEADERS)[number], string>;
export type CsvResult = { rows: CardCsvRow[]; errors: { line: number; message: string }[] };

function parseLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return { cells, quoted };
}

export function parseCardCsv(input: string): CsvResult {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/);
  const errors: CsvResult["errors"] = [];
  const firstNonEmpty = lines.findIndex((line) => line.trim());
  if (firstNonEmpty < 0) return { rows: [], errors: [{ line: 1, message: "File CSV đang trống" }] };

  const header = parseLine(lines[firstNonEmpty]).cells;
  if (header.join(",") !== CARD_CSV_HEADERS.join(",")) {
    return {
      rows: [],
      errors: [{ line: firstNonEmpty + 1, message: `Header phải là: ${CARD_CSV_HEADERS.join(",")}` }],
    };
  }

  const rows: CardCsvRow[] = [];
  lines.slice(firstNonEmpty + 1).forEach((line, offset) => {
    if (!line.trim()) return;
    const lineNumber = firstNonEmpty + offset + 2;
    const parsed = parseLine(line);
    if (parsed.quoted) errors.push({ line: lineNumber, message: "Dấu ngoặc kép chưa được đóng" });
    if (parsed.cells.length !== CARD_CSV_HEADERS.length) {
      errors.push({ line: lineNumber, message: `Cần đúng ${CARD_CSV_HEADERS.length} cột` });
      return;
    }
    const row = Object.fromEntries(CARD_CSV_HEADERS.map((key, index) => [key, parsed.cells[index]])) as CardCsvRow;
    const checked = cardSchema.safeParse(row);
    if (!checked.success) {
      errors.push({ line: lineNumber, message: checked.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" });
    } else rows.push(checked.data);
  });
  return { rows, errors };
}

