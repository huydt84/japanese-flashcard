import { CsvError, parse } from "csv-parse/sync";
import { CARD_IMPORT_HEADERS, MAX_CARD_IMPORT_BYTES, MAX_CARD_IMPORT_CARDS, type CardImportResult, type CardImportRow } from "@/lib/card-import";
import { cardSchema } from "@/lib/validation";

function error(row: number, message: string): CardImportResult {
  return { rows: [], errors: [{ row, message }] };
}

export function parseCardCsv(text: string): CardImportResult {
  if (Buffer.byteLength(text, "utf8") > MAX_CARD_IMPORT_BYTES) return error(1, "Nội dung CSV vượt quá 750 KB");
  if (!text.trim()) return error(1, "Nội dung CSV đang trống");

  const lines: number[] = [];
  let records: string[][];
  try {
    // csv-parse counts CRLF twice inside quoted fields; normalize source lines first.
    records = parse(text.replace(/\r\n?/g, "\n"), {
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      max_record_size: MAX_CARD_IMPORT_BYTES,
      on_record(record, context) {
        lines.push(context.lines);
        return record;
      },
    });
  } catch (cause) {
    const line = cause instanceof CsvError && typeof cause.lines === "number" ? cause.lines : 1;
    return error(line, 'CSV không hợp lệ. Đặt nội dung có dấu phẩy hoặc xuống dòng trong dấu ngoặc kép; viết dấu " trong ô thành ""');
  }

  const [header] = records;
  if (!header || header.length !== CARD_IMPORT_HEADERS.length || CARD_IMPORT_HEADERS.some((name, index) => header[index] !== name)) {
    return error(1, `Hàng đầu phải gồm đúng 5 tiêu đề theo thứ tự: ${CARD_IMPORT_HEADERS.join(", ")}`);
  }

  const rows: CardImportRow[] = [];
  const errors: CardImportResult["errors"] = [];
  let populatedRows = 0;
  records.slice(1).forEach((values, index) => {
    const line = lines[index + 1];
    if (values.every((value) => !value.trim())) return;
    populatedRows += 1;
    if (populatedRows > MAX_CARD_IMPORT_CARDS) {
      if (populatedRows === MAX_CARD_IMPORT_CARDS + 1) errors.push({ row: line, message: `Tối đa ${MAX_CARD_IMPORT_CARDS} thẻ mỗi lần nhập` });
      return;
    }
    if (values.length !== CARD_IMPORT_HEADERS.length) {
      errors.push({ row: line, message: "Mỗi hàng phải có đúng 5 cột, phân cách bằng dấu phẩy" });
      return;
    }
    const candidate = Object.fromEntries(CARD_IMPORT_HEADERS.map((key, column) => [key, values[column]]));
    const checked = cardSchema.safeParse(candidate);
    if (!checked.success) errors.push({ row: line, message: checked.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" });
    else rows.push(checked.data);
  });

  if (!rows.length && !errors.length) return error(2, "Chưa có thẻ nào. Nhập dữ liệu sau hàng tiêu đề");
  return { rows: errors.length ? [] : rows, errors };
}

export async function parseCardCsvFile(file: File): Promise<CardImportResult> {
  if (!file.name.toLowerCase().endsWith(".csv")) return error(1, "Chỉ chấp nhận tệp .csv");
  if (!file.size) return error(1, "Tệp CSV đang trống");
  if (file.size > MAX_CARD_IMPORT_BYTES) return error(1, "Tệp vượt quá 750 KB");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    return error(1, "Không đọc được tệp CSV. Hãy lưu dưới dạng CSV UTF-8 và thử lại");
  }
  return parseCardCsv(text);
}
