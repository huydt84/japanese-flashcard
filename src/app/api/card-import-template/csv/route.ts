import { CARD_CSV_SAMPLE } from "@/lib/card-import";

export function GET() {
  return new Response(`\uFEFF${CARD_CSV_SAMPLE}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mau-nhap-the.csv"',
      "Cache-Control": "public, max-age=86400",
    },
  });
}
