import ExcelJS from "exceljs";
import { CARD_IMPORT_HEADERS } from "@/lib/card-import";

export const runtime = "nodejs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Thẻ học");
  sheet.addRow([...CARD_IMPORT_HEADERS]);
  sheet.addRow(["学ぶ", "まなぶ", "học, học hỏi", "毎日、日本語を学びます。", "Tôi học tiếng Nhật mỗi ngày."]);
  sheet.columns = [{ width: 18 }, { width: 18 }, { width: 26 }, { width: 36 }, { width: 38 }];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="mau-nhap-the.xlsx"',
      "Cache-Control": "public, max-age=86400",
    },
  });
}
