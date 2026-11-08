import ExcelJS from "exceljs";
import { cardSchema } from "@/lib/validation";
import { CARD_IMPORT_HEADERS, MAX_CARD_IMPORT_BYTES, MAX_CARD_IMPORT_CARDS, type CardImportResult, type CardImportRow } from "@/lib/card-import";

function error(row: number, message: string): CardImportResult {
  return { rows: [], errors: [{ row, message }] };
}

function textValue(cell: ExcelJS.Cell): string | null {
  if (cell.type === ExcelJS.ValueType.String) return String(cell.value).trim();
  if (cell.type === ExcelJS.ValueType.RichText) {
    const value = cell.value as ExcelJS.CellRichTextValue;
    return value.richText.map((part) => part.text).join("").trim();
  }
  return null;
}

export async function parseCardXlsx(file: File): Promise<CardImportResult> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) return error(1, "Chỉ chấp nhận tệp Excel .xlsx");
  if (!file.size) return error(1, "Tệp Excel đang trống");
  if (file.size > MAX_CARD_IMPORT_BYTES) return error(1, "Tệp vượt quá 750 KB");

  const bytes = await file.arrayBuffer();
  const signature = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  if (signature[0] !== 0x50 || signature[1] !== 0x4b) return error(1, "Tệp không phải Excel .xlsx hợp lệ");

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes);
  } catch {
    return error(1, "Không đọc được tệp Excel. Hãy lưu lại dưới dạng .xlsx và thử lại");
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return error(1, "Tệp Excel không có trang tính");
  const header = sheet.getRow(1);
  let extraHeader = false;
  header.eachCell((cell, column) => { if (column > CARD_IMPORT_HEADERS.length && cell.value !== "") extraHeader = true; });
  if (CARD_IMPORT_HEADERS.some((name, index) => textValue(header.getCell(index + 1)) !== name) || extraHeader) {
    return error(1, `Hàng 1 phải gồm đúng 5 tiêu đề theo thứ tự: ${CARD_IMPORT_HEADERS.join(", ")}`);
  }

  const rows: CardImportRow[] = [];
  const errors: CardImportResult["errors"] = [];
  let populatedRows = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    let hasContent = false;
    let extraCell = false;
    row.eachCell((cell, column) => {
      const filled = cell.value !== null && (textValue(cell) ?? cell.value) !== "";
      if (filled) hasContent = true;
      if (filled && column > CARD_IMPORT_HEADERS.length) extraCell = true;
    });
    if (!hasContent) return;
    populatedRows += 1;
    if (populatedRows > MAX_CARD_IMPORT_CARDS) {
      if (populatedRows === MAX_CARD_IMPORT_CARDS + 1) errors.push({ row: rowNumber, message: `Tối đa ${MAX_CARD_IMPORT_CARDS} thẻ trong một tệp` });
      return;
    }
    if (extraCell) {
      errors.push({ row: rowNumber, message: "Chỉ dùng 5 cột A–E" });
      return;
    }
    const values = CARD_IMPORT_HEADERS.map((_, index) => {
      const cell = row.getCell(index + 1);
      return cell.value === null ? "" : textValue(cell);
    });
    if (values.some((value) => value === null)) {
      errors.push({ row: rowNumber, message: "Các ô phải là văn bản; không dùng số, ngày hoặc công thức" });
      return;
    }
    const candidate = Object.fromEntries(CARD_IMPORT_HEADERS.map((key, index) => [key, values[index]]));
    const checked = cardSchema.safeParse(candidate);
    if (!checked.success) {
      errors.push({ row: rowNumber, message: checked.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" });
    } else rows.push(checked.data);
  });

  if (!rows.length && !errors.length) return error(2, "Chưa có thẻ nào. Nhập dữ liệu từ hàng 2");
  return { rows: errors.length ? [] : rows, errors };
}
