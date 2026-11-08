import type { z } from "zod";
import type { cardSchema } from "@/lib/validation";

export const CARD_IMPORT_HEADERS = ["kanji", "hiragana", "meaning_vi", "example_ja", "example_vi"] as const;
export const MAX_CARD_IMPORT_BYTES = 750_000;
export const MAX_CARD_IMPORT_CARDS = 500;

export type CardImportRow = z.infer<typeof cardSchema>;
export type CardImportResult = { rows: CardImportRow[]; errors: { row: number; message: string }[] };

export const CARD_CSV_SAMPLE = `${CARD_IMPORT_HEADERS.join(",")}\n学ぶ,まなぶ,"học, học hỏi",毎日、日本語を学びます。,Tôi học tiếng Nhật mỗi ngày.\n`;
